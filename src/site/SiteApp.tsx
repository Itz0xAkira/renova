'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Nav } from './components/Nav'
import { ChapterIndicator } from './components/ui'
import { GameEntry } from './pixel/GameEntry'
import { About } from './sections/About'
import { Challenge } from './sections/Challenge'
import { EnterGame } from './sections/EnterGame'
import { Footer } from './sections/Footer'
import { Hero } from './sections/Hero'
import { Learn } from './sections/Learn'
import { QuickMission } from './sections/QuickMission'
import { Systems } from './sections/Systems'
import { Team } from './sections/Team'

export default function SiteApp() {
  const [ready, setReady] = useState(false)
  // The game title screen lives at #play, so it can be linked to and closed with Back.
  const [playing, setPlaying] = useState(() => window.location.hash === '#play')
  const pushed = useRef(false)

  useEffect(() => {
    const sync = () => setPlaying(window.location.hash === '#play')
    window.addEventListener('popstate', sync)
    window.addEventListener('hashchange', sync)
    return () => {
      window.removeEventListener('popstate', sync)
      window.removeEventListener('hashchange', sync)
    }
  }, [])

  const play = useCallback(() => {
    if (window.location.hash !== '#play') {
      history.pushState(null, '', '#play')
      pushed.current = true
    }
    setPlaying(true)
  }, [])

  const close = useCallback(() => {
    if (pushed.current) {
      pushed.current = false
      history.back()
    } else {
      history.replaceState(null, '', window.location.pathname + window.location.search)
    }
    setPlaying(false)
  }, [])

  return (
    <>
      <a href="#challenge" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:bg-mars focus:px-4 focus:py-2 focus:text-navy">
        Skip the intro
      </a>
      <Nav onPlay={play} ready={ready} />
      <main>
        <Hero onReady={() => setReady(true)} />
        <Challenge />
        <Systems />
        <QuickMission />
        <EnterGame onEnter={play} />
        <Learn />
        <About />
        <Team />
      </main>
      <Footer onPlay={play} />
      <ChapterIndicator hidden={playing} />
      <GameEntry open={playing} onClose={close} />
    </>
  )
}
