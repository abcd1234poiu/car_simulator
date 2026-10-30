import { useEffect, useRef, useState } from 'react'
import {
  ChevronLeft,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { RoadScene } from '../engine/scene.js'
import { useDrivingSession } from '../hooks/useDrivingSession.js'
import { Dashboard } from '../components/Dashboard.jsx'
import { TouchControls } from '../components/TouchControls.jsx'
import '../styles/drive.css'

const CONTROL_ROWS = [
  ['W / ↑', 'Throttle'],
  ['S / ↓', 'Brake'],
  ['A D / ← →', 'Steer'],
  ['E / Q', 'Shift up / down'],
  ['Space', 'Handbrake'],
  ['R', 'Reset run'],
  ['P / Esc', 'Pause'],
  ['M', 'Mute sound'],
]

export function DriveView({ session, audio, muted, onToggleMute, onExit }) {
  const { car, engine, transmission } = session
  const canvasRef = useRef(null)
  const sceneRef = useRef(null)
  const [sceneError, setSceneError] = useState(false)

  const {
    telemetry,
    paused,
    notice,
    shiftPulse,
    togglePause,
    reset,
    setTouch,
    requestShift,
  } = useDrivingSession({
    car,
    engine,
    transmission,
    sceneRef,
    audio,
    onToggleMute,
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined

    let scene = null
    try {
      scene = new RoadScene(canvas, car)
      sceneRef.current = scene
    } catch (error) {
      console.error('Unable to start the 3D road scene', error)
      requestAnimationFrame(() => setSceneError(true))
    }

    return () => {
      scene?.dispose()
      sceneRef.current = null
    }
  }, [car])

  return (
    <div className="drive-screen">
      <div className={`drive-stage ${sceneError ? 'is-fallback' : ''}`}>
        <canvas ref={canvasRef} className="drive-canvas" aria-hidden="true" />
        {sceneError && <div className="scene-fallback" aria-hidden="true" />}
        <div className="drive-vignette" aria-hidden="true" />
      </div>

      <header className="drive-top">
        <button type="button" className="ghost-button" onClick={onExit}>
          <ChevronLeft size={18} />
          Garage
        </button>

        <div className="drive-title">
          <span className="drive-car" style={{ '--car-color': car.color }}>
            {car.name}
          </span>
          <span className="drive-config">
            {engine.badge} · {transmission.shortName} · {car.drivetrain}
          </span>
        </div>

        <div className="drive-actions">
          <button
            type="button"
            className="icon-button"
            onClick={onToggleMute}
            aria-label={muted ? 'Unmute sound' : 'Mute sound'}
            title={muted ? 'Unmute sound' : 'Mute sound'}
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={togglePause}
            aria-label={paused ? 'Resume driving' : 'Pause driving'}
            title={paused ? 'Resume' : 'Pause'}
          >
            {paused ? <Play size={18} /> : <Pause size={18} />}
          </button>
        </div>
      </header>

      {notice && <div className={`toast toast-${notice.tone}`}>{notice.message}</div>}

      {telemetry.offRoad && !paused && (
        <div className="offroad-alert">OFF ROAD — GRIP &amp; SPEED REDUCED</div>
      )}

      <TouchControls
        setTouch={setTouch}
        requestShift={requestShift}
        transmission={transmission}
      />

      <div className="drive-bottom">
        <Dashboard
          car={car}
          engine={engine}
          transmission={transmission}
          telemetry={telemetry}
          shiftPulse={shiftPulse}
        />
      </div>

      {paused && (
        <div className="pause-overlay">
          <div className="pause-card">
            <span className="eyebrow">
              <span className="pulse-dot" />
              SIMULATION PAUSED
            </span>
            <h2>Take a breath.</h2>

            <div className="controls-grid">
              {CONTROL_ROWS.map(([keys, action]) => (
                <div key={action} className="control-row">
                  <span className="control-keys">{keys}</span>
                  <span className="control-action">{action}</span>
                </div>
              ))}
            </div>

            <div className="pause-actions">
              <button type="button" className="start-button compact" onClick={togglePause}>
                <Play size={18} fill="currentColor" />
                Resume
              </button>
              <button type="button" className="ghost-button" onClick={reset}>
                <RotateCcw size={16} />
                Restart
              </button>
              <button type="button" className="ghost-button" onClick={onExit}>
                <ChevronLeft size={16} />
                Garage
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
