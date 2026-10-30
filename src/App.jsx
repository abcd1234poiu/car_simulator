import { useCallback, useEffect, useState } from 'react'
import { SelectView } from './views/SelectView.jsx'
import { DriveView } from './views/DriveView.jsx'
import { EngineAudio } from './engine/audio.js'
import './App.css'

function App() {
  const [audio] = useState(() => new EngineAudio())
  const [muted, setMuted] = useState(false)
  const [session, setSession] = useState(null)

  const toggleMute = useCallback(() => {
    setMuted((previous) => {
      const next = !previous
      audio.setMuted(next)
      return next
    })
  }, [audio])

  const startDrive = useCallback(
    (car, engine, transmission) => {
      audio.setMuted(muted)
      audio.start(engine)
      setSession({ car, engine, transmission })
    },
    [audio, muted],
  )

  const exitDrive = useCallback(() => {
    audio.stop()
    setSession(null)
  }, [audio])

  useEffect(() => () => audio.dispose(), [audio])

  return (
    <div className="app">
      {session ? (
        <DriveView
          session={session}
          audio={audio}
          muted={muted}
          onToggleMute={toggleMute}
          onExit={exitDrive}
        />
      ) : (
        <SelectView
          audio={audio}
          muted={muted}
          onToggleMute={toggleMute}
          onStart={startDrive}
        />
      )}
    </div>
  )
}

export default App
