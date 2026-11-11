"use client";

import Phaser from "phaser";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { skyCanvas } from "@/game/art/sprites";
import { Hud } from "@/game/ui/Hud";
import { MarsScene } from "@/game/render/MarsScene";
import { GameStore } from "@/game/store";

export default function GameRoot() {
  const host = useRef<HTMLDivElement>(null);
  const [store] = useState(() => new GameStore());
  useSyncExternalStore(store.subscribe, store.getVersion, store.getVersion);
  const sky = useMemo(() => skyCanvas(320, 180).toDataURL(), []);

  useEffect(() => {
    const debug = window as unknown as { __renova?: GameStore };
    if (process.env.NODE_ENV !== "production") debug.__renova = store;
    const release = store.claimSave();
    // Start the game on the next frame: under React StrictMode the first, throwaway mount is
    // cleaned up before then, so it never builds a second Phaser canvas.
    let game: Phaser.Game | null = null;
    const boot = requestAnimationFrame(() => {
      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: host.current!,
        transparent: true,
        pixelArt: true,
        banner: false,
        scale: { mode: Phaser.Scale.RESIZE, width: "100%", height: "100%" },
        input: { mouse: { preventDefaultWheel: true } },
        scene: [new MarsScene(store)],
      });
    });
    // a lost colony isn't written back, so reloading can't undo the loss screen into a playable dying colony
    const save = () => {
      if (store.sim.over !== "lost") store.save();
    };
    const id = window.setInterval(save, 15000);
    const vis = () => document.visibilityState === "hidden" && save();
    window.addEventListener("beforeunload", save);
    document.addEventListener("visibilitychange", vis);
    return () => {
      save();
      window.clearInterval(id);
      window.removeEventListener("beforeunload", save);
      document.removeEventListener("visibilitychange", vis);
      release();
      cancelAnimationFrame(boot);
      game?.destroy(true);
      delete debug.__renova;
    };
  }, [store]);

  // night falls as a multiply tint over the world; storms add a dusty haze
  const sim = store.sim;
  const sun = sim.sun();
  const storm = sim.ev.storm && sim.time >= sim.ev.storm.start;
  const flare = sim.ev.flare && sim.time >= sim.ev.flare.start;

  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-[#0c1220] font-pixel text-star">
      <div
        aria-hidden
        className="pixelated absolute inset-0 bg-cover bg-bottom"
        style={{ backgroundImage: `url(${sky})` }}
      />
      <div
        ref={host}
        className="absolute inset-0"
        role="application"
        aria-label="RENOVA colony map"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 mix-blend-multiply transition-[background-color] duration-1000"
        style={{ backgroundColor: `rgba(52, 62, 120, ${(1 - sun) * 0.55})` }}
      />
      {storm && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[#c27a4a]/25 mix-blend-hard-light"
        />
      )}
      {flare && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 shadow-[inset_0_0_120px_30px_rgba(255,90,79,0.45)]"
        />
      )}
      <Hud store={store} />
      {store.notice && (
        <div
          role="status"
          className="absolute bottom-24 left-1/2 z-50 flex max-w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 items-start gap-3 border border-[#C8754D] bg-[#1F2022]/95 px-3 py-2 font-sans text-[12px] normal-case text-[#F6F6F6]"
        >
          <span className="flex-1">{store.notice}</span>
          <button
            type="button"
            className="font-pixel text-[10px] uppercase text-[#8A8A8A] hover:text-white"
            onClick={() => store.dismissNotice()}
          >
            OK
          </button>
        </div>
      )}
    </div>
  );
}
