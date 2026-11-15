'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { groundURL, itemURL, thumbURL } from '@/game/art/sprites'
import {
  BATTERY_KJ_LEVEL,
  BUILDINGS,
  CORE_LINK,
  CORE_REACH,
  HABITAT_BEDS,
  HOTKEYS,
  ITEMS,
  MAX_LEVEL,
  NEEDS,
  PYLON_LINK,
  PYLON_REACH,
  REACTOR_KW,
  RESEARCH,
  SHIELD_REACH,
  SOLAR_KW,
  SPEED,
  STATION_MAX_PLANTS,
  UPGRADES,
  type ItemId,
  type Kind,
} from '@/game/core/data'
import { MISSIONS } from '@/game/core/missions'
import { MARS_RADIATION, OSDR_STUDIES, SOURCES } from '@/game/core/nasa'
import { lightMinutes } from '@/game/core/orbits'
import { CARGO, PACK_LEAD } from '@/game/core/sim'
import type { Cargo } from '@/game/core/types'

/**
 * The illustrated field manual for RENOVA. Used on first launch, from the HUD
 * and the pause menu, and from the website's title screen.
 *
 * Every number in it is read from the game data, so the guide stays right
 * when the balance changes. Chapters are listed down the side on wide screens;
 * arrow keys or the buttons page through them.
 */

type Art = { kinds: Record<string, string>; items: Record<ItemId, string>; ground: Record<'ice' | 'ore' | 'sand', string> }

const KINDS: Kind[] = ['core', 'belt', 'junction', 'drill', 'excavator', 'melter', 'smelter', 'kiln', 'washer', 'greenhouse', 'moxie', 'habitat', 'shield', 'solar', 'pylon', 'battery', 'reactor', 'lab']

/* ------------------------------- building blocks ------------------------------- */

function Sprite({ src, label, size = 'md' }: { src: string; label?: string; size?: 'sm' | 'md' | 'lg' }) {
  const cls = size === 'sm' ? 'h-9 w-9' : size === 'lg' ? 'h-20 w-[4.2rem]' : 'h-14 w-[2.9rem]'
  return (
    <span className="inline-flex flex-col items-center gap-1">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={label ?? ''} className={`pixelated ${cls}`} />
      {label && <span className="text-center text-[10px] leading-tight text-star/75">{label}</span>}
    </span>
  )
}

const Arrow = () => (
  <span aria-hidden className="px-1 text-lg text-mars">
    →
  </span>
)

type Step = { item: ItemId } | { kind: Kind } | { ground: 'ice' | 'ore' | 'sand' }

function Chain({ art, steps, note }: { art: Art; steps: Step[]; note?: ReactNode }) {
  return (
    <div className="border-2 border-star/10 bg-star/[0.03] px-3 py-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {steps.map((s, k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            {k > 0 && <Arrow />}
            {'item' in s ? (
              <Sprite src={art.items[s.item]} label={ITEMS[s.item].name} size="sm" />
            ) : 'kind' in s ? (
              <Sprite src={art.kinds[s.kind]} label={BUILDINGS[s.kind].short} />
            ) : (
              <Sprite src={art.ground[s.ground]} label={s.ground === 'ice' ? 'Ice ground' : s.ground === 'ore' ? 'Ore ground' : 'Sand'} size="sm" />
            )}
          </span>
        ))}
      </div>
      {note && <p className="mt-1.5 font-sans text-[13px] normal-case text-star/70">{note}</p>}
    </div>
  )
}

/** Body text: a readable sans at 15px with generous line height. */
const P = ({ children }: { children: ReactNode }) => <p className="font-sans text-[15px] normal-case leading-[1.7] text-star/90">{children}</p>
const B = ({ children, className = 'text-star' }: { children: ReactNode; className?: string }) => <b className={`font-semibold ${className}`}>{children}</b>
const K = ({ children }: { children: ReactNode }) => (
  <kbd className="mx-0.5 inline-block min-w-[1.6em] border-2 border-star/30 bg-star/10 px-1 py-px text-center font-pixel text-[11px] not-italic leading-tight text-star">{children}</kbd>
)
const H = ({ children }: { children: ReactNode }) => <h3 className="pt-1 font-pixel text-[13px] text-sand">{children}</h3>

/** A highlighted hint box. */
function Tip({ children, tone = 'tip' }: { children: ReactNode; tone?: 'tip' | 'warn' }) {
  return (
    <div className={`flex gap-3 border-l-4 px-3 py-2.5 font-sans text-[14px] normal-case leading-relaxed ${tone === 'warn' ? 'border-[#ff7a6e] bg-[#ff7a6e]/10 text-[#ffd2cc]' : 'border-mars bg-mars/10 text-star/90'}`}>
      <span className="font-pixel text-[11px] uppercase text-mars">{tone === 'warn' ? 'Careful' : 'Tip'}</span>
      <div className="flex-1">{children}</div>
    </div>
  )
}

/** A simple two-or-more column table. */
function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto border-2 border-star/10">
      <table className="w-full border-collapse font-sans text-[14px] normal-case">
        <thead>
          <tr className="bg-star/[0.06] text-left font-pixel text-[11px] uppercase text-sand">
            {head.map((h) => (
              <th key={h} className="px-3 py-2 font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, k) => (
            <tr key={k} className="border-t border-star/10 align-top">
              {r.map((c, n) => (
                <td key={n} className={`px-3 py-2 ${n === 0 ? 'text-star' : 'text-star/80'}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const items = (list: Partial<Record<ItemId, number>>) =>
  (Object.entries(list) as [ItemId, number][])
    .map(([k, n]) => `${n} ${ITEMS[k].name.toLowerCase()}`)
    .join(' + ')

const cost = (k: Kind) => {
  const c = BUILDINGS[k].cost
  return [c.metal ? `${c.metal} metal` : '', c.brick ? `${c.brick} bricks` : ''].filter(Boolean).join(' + ') || 'free'
}

/** The Mars Trek Viking colour map with the landing site and the rovers whose data we use. */
function MarsMap() {
  // equirectangular: x = (lon + 180) / 360, y = (90 − lat) / 180
  const pins: { name: string; lat: number; lon: number; tone: string }[] = [
    { name: 'Colony 001 (Arcadia Planitia)', lat: 47, lon: -176, tone: '#e8753b' },
    { name: 'Curiosity (Gale Crater)', lat: -5.4, lon: 137.8, tone: '#65C9E8' },
    { name: 'Perseverance + MOXIE (Jezero)', lat: 18.4, lon: 77.5, tone: '#A8B87A' },
  ]
  return (
    <figure className="border-2 border-star/10">
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mars-trek-viking.jpg" alt="Colour map of Mars from NASA Mars Trek" width={1024} height={512} className="block h-auto w-full" />
        {pins.map((p) => (
          <span key={p.name} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${((p.lon + 180) / 360) * 100}%`, top: `${((90 - p.lat) / 180) * 100}%` }}>
            <span className="block h-3 w-3 rounded-full border-2 border-white" style={{ background: p.tone }} />
          </span>
        ))}
      </div>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 px-3 py-2 font-sans text-[12px] normal-case text-star/80">
        {pins.map((p) => (
          <span key={p.name} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: p.tone }} /> {p.name}
          </span>
        ))}
        <span className="text-star/50">Map: NASA Mars Trek, Viking MDIM 2.1 colour mosaic (archived)</span>
      </figcaption>
    </figure>
  )
}

/** Curiosity's daily radiation dose on Mars around the May 2024 solar storm (RadLab, archived). */
function DoseChart() {
  const data = MARS_RADIATION.may2024
  const max = Math.max(...data.map(([, v]) => v))
  const W = 540
  const H = 150
  const bw = W / data.length
  return (
    <figure className="border-2 border-star/10 p-3">
      <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full" role="img" aria-label="Bar chart: Curiosity measured about 90 to 130 micrograys a day in May 2024, then 1,664 on 20 May">
        {data.map(([d, v], k) => {
          const h = Math.max(2, (v / max) * H)
          const storm = d === MARS_RADIATION.stormDay.date
          return (
            <g key={d}>
              <rect x={k * bw + 2} y={H - h} width={bw - 4} height={h} fill={storm ? '#ff7a6e' : '#65C9E8'} />
              {(storm || k % 4 === 0) && (
                <text x={k * bw + bw / 2} y={H + 13} fill="#f4f0e8" fillOpacity={0.6} fontSize={10} textAnchor="middle">
                  {Number(d.slice(8))} May
                </text>
              )}
              {storm && (
                <text x={k * bw + bw / 2 - 6} y={14} fill="#ff7a6e" fontSize={11} textAnchor="end">
                  {v.toLocaleString('en')} μGy in one day
                </text>
              )}
            </g>
          )
        })}
      </svg>
      <figcaption className="mt-1 font-sans text-[12px] normal-case text-star/60">Radiation dose per day measured by Curiosity on Mars, May 2024. Source: NASA OSDR RadLab, MSL-RAD (archived).</figcaption>
    </figure>
  )
}

/** Science words, explained for ages 7–12. */
const GLOSSARY: [string, string][] = [
  ['Sol', 'A day on Mars. It lasts 24 hours and 39 minutes, a little longer than a day on Earth. In the game, one sol goes by in about 2 minutes.'],
  ['Regolith', 'The dusty, rocky ground that covers Mars. It looks like soil but has nothing living in it.'],
  ['Perchlorate', 'A salt in Martian regolith that is poisonous to people. It has to be washed out before plants can grow in it.'],
  ['Hematite', 'A kind of iron ore. Rusty iron is part of why Mars looks red. Smelting it gives the colony metal.'],
  ['Atmosphere', 'The air around a planet. Mars has very thin air, less than 1% as thick as Earth’s, and it is mostly carbon dioxide (CO₂), which people can’t breathe.'],
  ['MOXIE', 'A NASA experiment on the Perseverance rover that made oxygen out of Mars air. The MOXIE plant in the game does the same job.'],
  ['Radiation', 'Invisible energy and tiny fast particles from the Sun and deep space. Too much can damage living cells. Earth’s thick air and magnetic field protect us; Mars has neither.'],
  ['Radiation dose', 'How much radiation a body soaks up. It is measured in grays; a microgray (μGy) is one millionth of a gray. On Mars, Curiosity measures about 190 μGy a day.'],
  ['Shielding', 'Putting something thick, like a pile of regolith, between people and radiation, so less of it gets through.'],
  ['Solar flare', 'A sudden, giant flash of energy on the Sun. Flares are graded A, B, C, M and X; each letter is ten times stronger than the one before, so X flares are the strongest.'],
  ['Solar storm', 'When the Sun flings out clouds of fast particles. If they reach Mars, the radiation goes up for hours or days.'],
  ['Microgravity', 'The floating feeling astronauts have in orbit. Without weight to carry, muscles and bones get weaker, so astronauts exercise every day. Mars has gravity, but only 38% of Earth’s.'],
  ['Power and energy', 'Power (kilowatts, kW) is how fast electricity is being made or used right now. Energy (kilojoules, kJ) is how much is stored up, like water in a tank. Batteries store energy.'],
  ['Dust storm', 'Strong winds lift dust high into the air. It blocks sunlight, so solar panels make much less power.'],
  ['Communication delay', 'Radio messages travel at the speed of light, but Mars is so far away that a message takes between about 3 and 22 minutes to arrive, depending on where the planets are. The game works out today’s real delay; open Mission Control to see it. The crew can’t wait for Earth to help in an emergency.'],
  ['Solar conjunction', 'When Mars is behind the Sun, as seen from Earth. The Sun scrambles radio signals, so missions stop sending commands for about two weeks. It happens every 26 months.'],
  ['Mission planner', 'The people on Earth who decide what a mission does, what it carries and how much risk is OK. In RENOVA, that’s you.'],
]

/* ---------------------------------- chapters ---------------------------------- */

type Chapter = { title: string; kicker: string; body: ReactNode }

function chapters(art: Art, sun: string, minutes: number): Chapter[] {
  const machines: Kind[] = ['melter', 'smelter', 'kiln', 'washer', 'greenhouse']
  const coreBeds = BUILDINGS.core.housing ?? 0
  return [
    {
      title: 'Welcome to Mars',
      kicker: 'Your mission',
      body: (
        <>
          <div className="flex flex-wrap items-end justify-center gap-5 py-2">
            <Sprite src={art.kinds.core} label="Colony core" size="lg" />
            <Sprite src={art.kinds.habitat} label="Habitat" size="lg" />
            <Sprite src={art.kinds.greenhouse} label="Greenhouse" size="lg" />
            <Sprite src={art.kinds.solar} label="Solar" size="lg" />
          </div>
          <P>
            You are the <B>mission planner</B> for Colony 001, the first base on Mars. Your lander has just touched down with <B>4 crew</B>, a few days of food, water and air, and some building materials. Earth is so far away (about 225 million km on average) that nothing else is coming for a long time. To survive, the crew has to make everything from Mars itself: ice, rock, thin air and sunlight. Space agencies call this <B>living off the land</B>.
          </P>
          <H>Every choice costs something</H>
          <P>Real mission planners never get a free choice, and neither do you. For example:</P>
          <Table
            head={['If you…', '…you get', '…but it costs']}
            rows={[
              ['Build a factory', 'More metal and bricks', 'Power, which life support may need at night'],
              ['Build regolith shields', 'Crew safe from solar flares', 'Bricks you could have spent on a greenhouse'],
              ['Grow food in a greenhouse', 'Food for the crew', 'Water, which the crew also has to drink'],
              ['Do research in a lab', 'Machines that work faster', 'Power and metal now, for a reward later'],
              ['Spread out with pylons', 'More room and more resources', 'Metal for every pylon, and longer belts'],
              ['Order materials on the supply ship', 'Metal and bricks to build with', 'No new crew on that ship'],
            ]}
          />
          <H>How you win</H>
          <P>
            Follow the <B>mission log</B> at the top left. Each mission teaches one part of the colony. Finish all <B>{MISSIONS.length} missions</B>; the last one is to grow to <B>20 colonists</B> with nothing running short. Then Colony 001 can look after itself.
          </P>
          <H>How you lose</H>
          <P>
            If food, water, oxygen, power, beds or radiation protection run short, <B>colony health</B> goes down. At <B>0%</B> the crew have to leave and the mission fails. Health comes back on its own once every problem is fixed, so you can learn from mistakes.
          </P>
          <H>Real science, real NASA data</H>
          <P>
            RENOVA was made for the <B>NASA Space Apps Challenge 2026</B>, for the challenge “Build a Junior Astronaut Mission Trainer”: a game that lets young players make the same kinds of decisions as real mission planners. So the science is real. Every <B>solar flare</B> in the game is a flare NASA recorded. The radiation numbers come from the <B>Curiosity rover</B> on Mars. The plant and health facts come from real NASA experiments. The chapter <B>Real NASA data</B> shows where each one comes from.
          </P>
          <Tip>New words like <B>sol</B>, <B>regolith</B> and <B>radiation dose</B> are explained in the next chapter, <B>Science words</B>. The game pauses whenever this guide is open. Press <K>H</K> any time to come back.</Tip>
        </>
      ),
    },
    {
      title: 'Science words',
      kicker: 'What the words mean',
      body: (
        <>
          <P>Scientists use some special words for life on Mars. Here’s what they mean, in plain language.</P>
          <Table
            head={['Word', 'What it means']}
            rows={GLOSSARY.map(([w, m]) => [<b key={w} className="text-mars">{w}</b>, m])}
          />
        </>
      ),
    },
    {
      title: 'Reading the screen',
      kicker: 'The HUD',
      body: (
        <>
          <Table
            head={['Where', 'What it tells you']}
            rows={[
              ['Top left', 'The sol (Martian day) and time. The sun or moon icon shows day and night; storm and flare warnings appear here.'],
              ['Top bar', 'Crew / beds, colony health, power (made / used, with the battery bar), then your stocks of water, food, oxygen, metal and bricks.'],
              ['Under each stock', 'How fast it is changing per sol: ▲ rising, ▼ falling. Red means it will run out soon. Hover for the exact numbers.'],
              ['Top right', 'Pause, game speed 1× 2× 3×, research progress, this guide and the menu.'],
              ['Left', 'The mission log: your current goal, a progress bar, a tip, and the latest colony messages.'],
              ['Right', 'The inspector: click any building to see what it is doing, what it holds, its power use and its upgrade.'],
              ['Bottom', 'The build bar: six colour-coded categories. Click one to open its tray of buildings, with each one’s cost and hotkey; click it again (or press Esc) to close. Hover a card to read about it.'],
            ]}
          />
          <Tip>Click the power readout in the top bar to open the power panel, with a graph of the last few sols.</Tip>
        </>
      ),
    },
    {
      title: 'Building',
      kicker: 'Placing, rotating, removing',
      body: (
        <>
          <P>
            Open a category in the bar at the bottom and pick a building, or press its number key. A see-through <B>ghost</B> follows your cursor, with its <B>footprint</B> outlined on the ground: green if it fits, red if it doesn’t, with the reason next to the cursor. <B>Click</B> to build.
          </P>
          <H>Sizes</H>
          <P>
            Buildings are big. Machines take <B>2×2</B> or <B>3×3</B> tiles, the greenhouse <B>4×3</B>. Belts, junctions and pylons take a single tile. Nothing can be built on <B>grey boulders</B> or in <B>craters</B>.
          </P>
          <H>Plugging in belts</H>
          <P>
            Belts plug into <B>any side</B> of a building, and you can connect as many as you like. A belt that <B>points into</B> a building feeds it. A belt that starts beside a building and <B>points away</B> carries its products out: an output chute appears on that edge. With several output belts, the products take turns between them.
          </P>
          <P>
            Buildings that <B>touch</B> hand items straight over, no belt needed, as long as the neighbour uses them: put a drill against a melter and the ice goes right in. Hover a building to see arrows on every belt its products leave by.
          </P>
          <H>Paying and refunds</H>
          <P>
            Buildings cost <B>metal</B> and <B>bricks</B> from the core’s stores. <B>Right-click</B> a building to remove it and get the <B>full cost back</B>, upgrades included. Right-drag removes many at once. <K>Q</K> copies the building under the cursor, facing and all.
          </P>
          <Tip>Construction drones fly out from the core to every new building, and the rovers start visiting it. It’s all for show, but it tells you the colony is busy.</Tip>
        </>
      ),
    },
    {
      title: 'Mining',
      kicker: 'Everything starts in the ground',
      body: (
        <>
          <Chain art={art} steps={[{ ground: 'ice' }, { kind: 'drill' }, { item: 'ice' }]} note="Pale blue ground is buried water ice." />
          <Chain art={art} steps={[{ ground: 'ore' }, { kind: 'excavator' }, { item: 'ore' }]} note="Dark red ground is hematite, iron ore." />
          <Chain art={art} steps={[{ ground: 'sand' }, { kind: 'excavator' }, { item: 'regolith' }]} note="Plain sand is regolith: crushed rock and dust." />
          <P>
            <B>Ice drills</B> only work on ice. <B>Excavators</B> dig ore from ore ground, or regolith from sand. A miner only needs <B>some</B> of its footprint on the right ground. On mixed ground it digs whatever covers most of it, and the inspector says what it’s mining.
          </P>
          <P>
            Miners need <B>power</B> to run (see the Power chapter) and somewhere to put what they dig: a belt beside them pointing away, or a machine they touch.
          </P>
          <Tip>Your landing site always has ice and ore within reach of the core’s power. Look for the blue and dark red patches nearby.</Tip>
        </>
      ),
    },
    {
      title: 'Conveyor belts',
      kicker: 'Moving things around',
      body: (
        <>
          <Chain art={art} steps={[{ kind: 'drill' }, { kind: 'belt' }, { kind: 'belt' }, { kind: 'melter' }, { kind: 'belt' }, { kind: 'core' }]} />
          <P>
            Choose the belt (<K>1</K>) and <B>drag</B> to lay a line: it follows your mouse and turns corners for you. Items ride along the belt and are pushed into whatever the belt points at.
          </P>
          <H>Joining and crossing</H>
          <P>
            A belt that runs into the <B>side</B> of another merges into it, making a T-junction or Y-merge, or a four-way merge with feeds from both sides. To let two lines <B>cross</B> without mixing, build a <B>junction</B> where they meet. Dragging straight across another line makes one for you.
          </P>
          <H>Machines and the core</H>
          <P>
            Belts feed straight into machines from <B>any edge</B>. Anything that reaches the <B>colony core</B> goes into your stores, which is where the HUD numbers come from and what pays for buildings.
          </P>
          <Tip>Machines with two ingredients (the washer and greenhouse) are happiest with one belt per ingredient. A single mixed belt still works, just more slowly.</Tip>
          <Tip tone="warn">If a machine’s products have nowhere to go, it stops with “Output blocked”. Select it: the inspector’s “Sends to” line lists its output belts. A belt running <B>past</B> a building along its edge doesn’t take anything; it has to point away.</Tip>
        </>
      ),
    },
    {
      title: 'Production chains',
      kicker: 'Turning Mars into supplies',
      body: (
        <>
          <Chain art={art} steps={[{ item: 'ice' }, { kind: 'melter' }, { item: 'water' }]} />
          <Chain art={art} steps={[{ item: 'ore' }, { kind: 'smelter' }, { item: 'metal' }]} />
          <Chain art={art} steps={[{ item: 'regolith' }, { kind: 'kiln' }, { item: 'brick' }]} />
          <Chain art={art} steps={[{ item: 'regolith' }, { item: 'water' }, { kind: 'washer' }, { item: 'soil' }]} note="Martian soil holds toxic perchlorate salts, so it has to be washed before anything will grow in it." />
          <Chain art={art} steps={[{ item: 'soil' }, { item: 'water' }, { kind: 'greenhouse' }, { item: 'food' }]} />
          <Table
            head={['Machine', 'Takes', 'Makes', 'Time', 'Power']}
            rows={machines.map((k) => {
              const r = BUILDINGS[k].recipe!
              return [BUILDINGS[k].name, items(r.in), items(r.out), `${r.time} s`, `${BUILDINGS[k].power} kW`]
            })}
          />
          <P>
            <B>Metal</B> and <B>bricks</B> pay for new buildings, so a smelter and a kiln feeding the core are your first real economy. Water, food and oxygen keep the crew alive.
          </P>
          <P>
            Farming in space is real. In NASA experiment <B>{OSDR_STUDIES.peppers.id}</B>, astronauts grew chile peppers on the space station for 137 days and picked 26. The Canadian Space Agency’s <B>Tomatosphere</B> project lets classes grow tomato seeds that have been exposed to space conditions.
          </P>
        </>
      ),
    },
    {
      title: 'Keeping the crew alive',
      kicker: 'Food, water, air, a bed, a roof',
      body: (
        <>
          <Table
            head={['Every colonist needs, per sol', 'Made by']}
            rows={[
              [`${NEEDS.water} water`, 'Ice melters (ice → water)'],
              [`${NEEDS.food} food`, 'Greenhouses (washed soil + water → food)'],
              [`${NEEDS.o2} oxygen`, 'MOXIE plants split the CO₂ air; greenhouses add a little'],
            ]}
          />
          <div className="flex flex-wrap items-end justify-center gap-5">
            <Sprite src={art.kinds.moxie} label="MOXIE · oxygen" />
            <Sprite src={art.kinds.habitat} label={`Habitat · ${HABITAT_BEDS[0]} beds`} />
            <Sprite src={art.kinds.shield} label="Regolith shield" />
          </div>
          <H>Beds</H>
          <P>
            The core sleeps <B>{coreBeds}</B>. Each <B>habitat</B> adds <B>{HABITAT_BEDS[0]}</B> beds ({HABITAT_BEDS[1]} and {HABITAT_BEDS[2]} when upgraded), but only while it is <B>connected to power</B>. Crew without a bed slowly lose health.
          </P>
          <H>Radiation</H>
          <P>
            Mars has no magnetic field and very thin air, so radiation from the Sun and deep space reaches the ground. NASA’s Curiosity rover measures about <B>{MARS_RADIATION.averagePerDay} micrograys a day</B> there, and much more during solar storms. A habitat needs a <B>regolith shield</B> within <B>{SHIELD_REACH[0]} tiles</B> of it ({SHIELD_REACH[1]} and {SHIELD_REACH[2]} when the shield is upgraded), or its crew soak up radiation. Crew move into shielded habitats first.
          </P>
          <H>Staying strong</H>
          <P>
            In NASA experiment <B>{OSDR_STUDIES.muscle.id}</B>, mice on the space station lost muscle and bone in just 33 days of floating. Mars has some gravity (38% of Earth’s), but crews still have to exercise and eat well, which is why food and beds matter as much as air.
          </P>
          <H>Supply ships and Mission Control</H>
          <P>
            A <B>supply ship</B> from Earth lands at the core every <B>1.5 sols</B>. You choose what it brings in <B>Mission Control</B> (the 📡 button at the top left), and every choice has a cost:
          </P>
          <Table
            head={['Order', 'The ship brings']}
            rows={(Object.keys(CARGO) as Cargo[]).map((k) => [CARGO[k].name, CARGO[k].brings])}
          />
          <P>
            The catch is the <B>communication delay</B>. Your message travels to Earth at the speed of light, and Earth and Mars are so far apart that it takes minutes; in the game, today, about <B>{Math.round(minutes)} seconds</B>. The ship is packed {PACK_LEAD} seconds before it lands, so an order sent too late goes on the ship after. Decide early!
          </P>
          <Tip>Watch the ▲/▼ rates under each stock. A small ▼ on water or food is a warning, not a crisis, as long as you build the next melter or greenhouse before it runs out.</Tip>
        </>
      ),
    },
    {
      title: 'Power and the grid',
      kicker: 'Mars gets 43% of Earth’s sunlight',
      body: (
        <>
          <div className="flex flex-wrap items-end justify-center gap-5">
            <Sprite src={art.kinds.solar} label={`Solar · ${SOLAR_KW[0]} kW`} />
            <Sprite src={art.kinds.battery} label="Battery bank" />
            <Sprite src={art.kinds.pylon} label="Power pylon" />
            <Sprite src={art.kinds.reactor} label={`Reactor · ${REACTOR_KW[0]} kW`} />
          </div>
          <H>Making power</H>
          <P>
            A <B>solar panel</B> makes up to <B>{SOLAR_KW[0]} kW</B> at noon, less at dawn and dusk, and nothing at night. <B>Batteries</B> store daytime surplus ({BATTERY_KJ_LEVEL[0].toLocaleString('en')} kJ each) to carry you through the dark. After research, the <B>Kilopower reactor</B> gives a steady {REACTOR_KW[0]} kW day and night.
          </P>
          <H>The grid: two ranges</H>
          <P>
            Power only reaches buildings that are <B>connected</B>, and every grid node (the core and each <B>pylon</B>) has two ranges:
          </P>
          <Table
            head={['', 'Area: what it powers', 'Cable: how far it links']}
            rows={[
              ['Core', `${CORE_REACH} tiles all round`, `${CORE_LINK} tiles`],
              ...UPGRADES.pylon!.names.map((name, k) => [name, `${PYLON_REACH[k]} tiles all round`, `${PYLON_LINK[k]} tiles`]),
            ]}
          />
          <P>
            <B>Area</B>: the blue square around a node. A building with even one tile inside a connected area is on the grid. <B>Cable</B>: a pylon only works if a cable reaches it from the core or another working pylon, so you chain pylons out from the core like stepping stones.
          </P>
          <P>
            You never have to guess. While you place anything that uses power, the blue areas show on the map and the note by your cursor says <B className="text-[#9fe3f5]">“Powered by…”</B> or exactly what’s missing. A pylon’s ghost draws the cable it would get, or says how far out of reach it is. Press <K>P</K> any time to see the whole grid.
          </P>
          <H>The two warnings</H>
          <Table
            head={['Warning', 'Means', 'Fix']}
            rows={[
              [<span key="n" className="text-[#ff7a6e]">Not connected to the grid</span>, 'No connected area reaches it, so it gets nothing at all.', 'Build a pylon close to it that a cable can reach.'],
              [<span key="p" className="text-[#F4D03F]">Not enough power</span>, 'It’s connected, but the colony makes less power than it uses.', 'More solar, a battery for the night, or a reactor.'],
            ]}
          />
          <H>When there isn’t enough</H>
          <P>
            <B>Life support comes first</B>: the core, habitats and MOXIE get power before industry. The factories slow down, but the crew keep breathing. The power panel (click the power readout) shows who uses what.
          </P>
          <Tip>Build a battery before your first night. The “Night shift” mission is there to remind you.</Tip>
        </>
      ),
    },
    {
      title: 'Upgrades and research',
      kicker: 'Getting better at everything',
      body: (
        <>
          <H>Upgrades</H>
          <P>
            Select a building and press <K>U</K> (or the upgrade button in the inspector) to take it up to <B>level {MAX_LEVEL}</B>. Machines work <B>{Math.round((SPEED[1] - 1) * 100)}%</B> and then <B>{Math.round((SPEED[2] - 1) * 100)}%</B> faster but use more power. You can see the new parts bolted on.
          </P>
          <Table
            head={['Building', 'Level 2', 'Level 3']}
            rows={(['solar', 'battery', 'pylon', 'habitat', 'shield', 'reactor'] as Kind[]).map((k) => {
              const u = UPGRADES[k]!
              return [u.names[0], `${u.names[1]}: ${u.gains[0]}`, `${u.names[2]}: ${u.gains[1]}`]
            })}
          />
          <P>
            A level-3 <B>solar station</B> keeps planting new panels around itself, up to {STATION_MAX_PLANTS}, wherever there’s room on the grid.
          </P>
          <H>Research</H>
          <P>
            Open research with <K>T</K> and pick a project. The core researches slowly on its own; every connected <B>lab</B> adds much more.
          </P>
          <Table head={['Project', 'Cost', 'Effect']} rows={RESEARCH.map((r) => [r.name, `${r.cost} RP`, r.effect])} />
        </>
      ),
    },
    {
      title: 'Storms, flares and rovers',
      kicker: 'Living with Mars',
      body: (
        <>
          <H>Dust storms</H>
          <P>
            Every few sols a <B className="text-[#e0a072]">dust storm</B> rolls in for about half a sol. Solar panels lose most of their output, so stored power and reactors carry the colony. The “Self-cleaning panels” research halves the loss.
          </P>
          <P>
            Mission Control on Earth watches the weather and sends a warning, but it takes the signal delay to arrive. When Mars is far from Earth, you get less time to get ready, so keep your batteries charged.
          </P>
          <H>Solar flares</H>
          <P>
            A <B className="text-[#ff7a6e]">solar flare</B> floods the surface with radiation for a short time. Crew outside head in, and anyone in an unshielded habitat takes damage. Shield every habitat before the first one.
          </P>
          <P>
            These flares are <B>real</B>: each one is a flare NASA’s DONKI database recorded, and the log tells you its class and date. A stronger real flare (an X5 rather than an M2, say) does more harm. The first time, a card shows what the same kind of storm did on Mars in May 2024. See <B>Real NASA data</B> for more.
          </P>
          <P>You always get a warning in the mission log before each storm or flare.</P>
          <H>Drones, rovers and roads</H>
          <P>
            <B>Drones</B> build and upgrade from pads on the core. AI-driven <B>rovers</B> haul ore between your buildings and the core, and crew walk out to work by day. Their traffic wears <B>tyre tracks</B> into the ground, and busy routes turn into <B>roads</B> that the drones pave. Rovers drive faster on roads.
          </P>
        </>
      ),
    },
    {
      title: 'Your first sols',
      kicker: 'A good opening',
      body: (
        <>
          <ol className="list-decimal space-y-2.5 pl-6 font-sans text-[15px] normal-case leading-relaxed text-star/90 marker:font-pixel marker:text-mars">
            <li>
              Build <B>two solar panels</B> (<K>7</K>) close to the core. Everything else needs power.
            </li>
            <li>
              Put an <B>ice drill</B> (<K>2</K>) on a blue patch with an <B>ice melter</B> (<K>4</K>) touching it, then run a belt from beside the melter, pointing away, to the core.
            </li>
            <li>
              Add a <B>battery</B> before dark, and a <B>pylon</B> if the ice or ore is outside the core’s reach.
            </li>
            <li>
              Dig ore with an <B>excavator</B> (<K>3</K>) into a <B>smelter</B> (<K>5</K>) for metal, and regolith into a <B>kiln</B> (<K>6</K>) for bricks. Now you can afford anything.
            </li>
            <li>
              Build a <B>MOXIE</B> (<K>0</K>) for oxygen, then a <B>soil washer</B> feeding a <B>greenhouse</B> for food.
            </li>
            <li>
              Add <B>habitats</B> (<K>8</K>) with <B>shields</B> (<K>9</K>) beside them so supply ships can land new crew, and a <B>lab</B> to speed up research.
            </li>
          </ol>
          <Tip>Speed up time with the 2× and 3× buttons while you wait for stock to build up, and pause with <K>Space</K> whenever you need to think.</Tip>
        </>
      ),
    },
    {
      title: 'Real NASA data',
      kicker: 'Where the science comes from',
      body: (
        <>
          <P>
            The numbers that matter in RENOVA come from real NASA missions. Some are <B>live</B> (fetched while you play) and some are <B>archived</B> (copied into the game when it was made). The game always says which.
          </P>
          <H>Where we are: Mars Trek</H>
          <MarsMap />
          <P>
            This colour map of Mars comes from <B>NASA Mars Trek</B> (built from Viking orbiter photos). We picture Colony 001 in <B>Arcadia Planitia</B>, a flat northern plain where water ice lies just under the ground, close enough for ice drills. The radiation numbers come from <B>Curiosity</B>, in Gale Crater, the rover that has measured Mars radiation the longest.
          </P>
          <H>Solar flares: DONKI</H>
          <P>
            Every solar flare in the game is a real one from <B>DONKI</B>, NASA’s space-weather database. When the game starts, it asks DONKI for the flares of the last 30 days. Right now: <B>{sun}</B>. Without a connection it replays 34 real X-class flares from 2024, like the <B>X9.0</B> of 3 October 2024 and the <B>X8.7</B> of 14 May 2024. A flare’s class decides how much it hurts unshielded crew: the stronger the real flare, the bigger the danger.
          </P>
          <H>Radiation on Mars: RadLab</H>
          <DoseChart />
          <P>
            <B>RadLab</B> holds about 275,000 radiation readings that Curiosity’s RAD detector took on Mars between 2015 and 2024: on average <B>{MARS_RADIATION.averagePerDay} micrograys a day</B>. On <B>20 May 2024</B>, a storm of particles from the same sunspot group that made the big May flares hit Mars, and Curiosity measured <B>{MARS_RADIATION.stormDay.perDay.toLocaleString('en')} micrograys</B> in one day. That is why the game gives habitats regolith shields.
          </P>
          <H>Life in space: OSDR</H>
          <ul className="space-y-2 font-sans text-[15px] normal-case leading-relaxed text-star/90">
            {Object.values(OSDR_STUDIES).map((st) => (
              <li key={st.id}>
                <a href={st.link} target="_blank" rel="noreferrer" className="font-semibold text-mars underline underline-offset-2">
                  {st.id}
                </a>{' '}
                {st.what}
              </li>
            ))}
          </ul>
          <H>All sources</H>
          <Table
            head={['Source', 'How RENOVA uses it']}
            rows={SOURCES.map((src) => [
              <a key={src.name} href={src.link} target="_blank" rel="noreferrer" className="text-mars underline underline-offset-2">
                {src.name}
                <span className="block text-[12px] text-star/60 no-underline">{src.by}</span>
              </a>,
              src.use,
            ])}
          />
          <Tip>
            What’s simplified: how fast machines work, how much they cost and how quickly health drops are game choices, not NASA numbers. They’re tuned so a whole mission fits into one play session. The flares, the radiation readings and the science facts are real.
          </Tip>
        </>
      ),
    },
    {
      title: 'All controls',
      kicker: 'Mouse, keyboard or touch',
      body: (
        <Table
          head={['Input', 'Does']}
          rows={[
            ['Click', 'Build the selected building, or select a building to inspect it'],
            ['Drag', 'Lay belts in a line; pans the map when nothing is selected'],
            ['Right-click · right-drag', 'Remove a building (full refund) · remove many'],
            [
              <>
                <K>R</K> · <K>Shift</K>+<K>R</K>
              </>,
              'Turn the belt you’re about to lay, or the belt under the cursor',
            ],
            [<K key="q">Q</K>, 'Copy the building under the cursor'],
            [<K key="u">U</K>, `Upgrade the selected building (up to level ${MAX_LEVEL})`],
            [<K key="p">P</K>, 'Power view: grid coverage and unconnected buildings'],
            [
              <>
                <K>1</K>–<K>0</K>
              </>,
              (Object.entries(HOTKEYS) as [Kind, string][]).map(([k, key]) => `${key} ${BUILDINGS[k].short}`).join(' · '),
            ],
            [
              <>
                <K>W</K>
                <K>A</K>
                <K>S</K>
                <K>D</K> · arrows
              </>,
              'Pan the map · mouse wheel or + / − to zoom · C jumps to the core',
            ],
            [<K key="sp">Space</K>, 'Pause and resume · the 1× 2× 3× buttons set the speed'],
            [
              <>
                <K>T</K> · <K>H</K> · <K>Esc</K>
              </>,
              'Research · this guide · close / cancel / menu',
            ],
            ['Touch', 'Tap to build or select · drag to pan · pinch to zoom'],
          ]}
        />
      ),
    },
  ]
}

/* ----------------------------------- dialog ----------------------------------- */

export function HowToPlay({
  onClose,
  doneLabel = 'Got it',
  closeable = true,
  sun = 'the game checks the live feed when you start playing',
  minutes = lightMinutes(new Date()),
}: {
  onClose: () => void
  doneLabel?: string
  closeable?: boolean
  /** Where the game's flares come from right now, in words. */
  sun?: string
  /** Today's one-way signal delay to Earth, in minutes. */
  minutes?: number
}) {
  const art = useMemo<Art>(
    () => ({
      kinds: Object.fromEntries(KINDS.map((k) => [k, thumbURL(k)])),
      items: Object.fromEntries((Object.keys(ITEMS) as ItemId[]).map((k) => [k, itemURL(k)])) as Record<ItemId, string>,
      ground: { ice: groundURL('ice'), ore: groundURL('ore'), sand: groundURL('sand') },
    }),
    [],
  )
  const list = useMemo(() => chapters(art, sun, minutes), [art, sun, minutes])
  const [n, setN] = useState(0)
  const last = n === list.length - 1
  const page = list[n]
  const scroller = useRef<HTMLDivElement>(null)

  // every chapter starts at its top
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 })
  }, [n])

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setN((x) => Math.min(list.length - 1, x + 1))
      else if (e.key === 'ArrowLeft') setN((x) => Math.max(0, x - 1))
      else return
      e.preventDefault()
      e.stopPropagation()
    }
    window.addEventListener('keydown', k, true)
    return () => window.removeEventListener('keydown', k, true)
  }, [list.length])

  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-[#0c1220]/80 p-2 font-pixel uppercase text-star sm:p-6" onClick={closeable ? onClose : undefined}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="How to play"
        onClick={(e) => e.stopPropagation()}
        className="rise flex h-full max-h-[52rem] w-full max-w-5xl flex-col border-2 border-mars bg-[#0c1220] shadow-[6px_6px_0_#b75c42]"
      >
        <div className="flex items-center justify-between gap-3 border-b-2 border-star/10 px-4 py-3 text-[12px] sm:px-5">
          <span className="text-mars">RENOVA field manual</span>
          <span className="flex items-center gap-4">
            <span className="text-star/60">
              {n + 1} / {list.length}
            </span>
            {closeable && (
              <button type="button" onClick={onClose} className="text-base text-star/60 hover:text-mars" aria-label="Close guide">
                ✕
              </button>
            )}
          </span>
        </div>

        <div className="flex min-h-0 flex-1">
          {/* chapter list: jump to any topic */}
          <nav aria-label="Chapters" className="hidden w-56 shrink-0 overflow-y-auto border-r-2 border-star/10 py-2 md:block">
            {list.map((c, k) => (
              <button
                key={c.title}
                type="button"
                onClick={() => setN(k)}
                aria-current={k === n ? 'page' : undefined}
                className={`flex w-full items-baseline gap-2 px-4 py-2 text-left text-[11px] leading-snug transition-colors ${k === n ? 'bg-mars/15 text-mars' : 'text-star/65 hover:bg-star/5 hover:text-star'}`}
              >
                <span className="w-5 shrink-0 text-right text-star/40">{k + 1}</span>
                <span>{c.title}</span>
              </button>
            ))}
          </nav>

          <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-8">
            <div className="mx-auto max-w-3xl space-y-4">
              <div>
                <p className="text-[12px] text-sand/80">{page.kicker}</p>
                <h2 className="mt-1.5 font-pixel text-2xl text-mars sm:text-3xl">{page.title}</h2>
              </div>
              {page.body}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t-2 border-star/10 px-4 py-3 text-[13px] sm:px-5">
          <button type="button" onClick={() => setN(n - 1)} disabled={n === 0} className="border-2 border-star/30 px-4 py-2.5 transition-colors hover:border-mars hover:text-mars disabled:invisible">
            ◀ Back
          </button>
          <div className="flex gap-1.5 md:hidden" aria-hidden>
            {list.map((_, k) => (
              <button key={k} type="button" tabIndex={-1} onClick={() => setN(k)} className={`h-2.5 w-2.5 ${k === n ? 'bg-mars' : 'bg-star/25 hover:bg-star/50'}`} />
            ))}
          </div>
          <span className="hidden text-[11px] text-star/40 md:block">← → to turn pages</span>
          <button
            type="button"
            autoFocus
            onClick={() => (last ? onClose() : setN(n + 1))}
            className="border-2 border-mars bg-mars px-4 py-2.5 text-navy transition-colors hover:border-star hover:bg-star"
          >
            {last ? doneLabel : `Next: ${list[n + 1].title} ▶`}
          </button>
        </div>
      </div>
    </div>
  )
}
