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
    // real space weather from NASA (falls back to the 2024 archive offline)
    const weather = new AbortController();
    void store.loadSpaceWeather(weather.signal);
    // Start the game on the next frame: under React StrictMode the first, throwaway mount is
    // cleaned up before then, so it never builds a second Phaser canvas.
    // WebGL can't make a 0×0 framebuffer, so if the container has no size yet (a tab that
    // is still opening, a collapsed pane) wait until it gets one before booting.
    let game: Phaser.Game | null = null;
    let frame = 0;
    const el = host.current!;
    const sized = () => el.clientWidth > 0 && el.clientHeight > 0;
    const watch = new ResizeObserver(() => {
      if (!game && !frame && sized()) frame = requestAnimationFrame(start);
    });
    const start = () => {
      frame = 0;
      if (game || !sized()) return;
      watch.disconnect();
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
    };
    if (sized()) frame = requestAnimationFrame(start);
    watch.observe(el);
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
      weather.abort();
      cancelAnimationFrame(frame);
      watch.disconnect();
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
        // the map never takes focus itself, so hand it back from whichever HUD button had it: keys then reach the game again
        onPointerDownCapture={() => {
          if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
        }}
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
