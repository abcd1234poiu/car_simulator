import { useEffect, useRef, useState } from 'react'
import {
  ChevronLeft,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  Smartphone,
  Navigation,
} from 'lucide-react'
import { RoadScene } from '../engine/scene.js'
import { useDrivingSession } from '../hooks/useDrivingSession.js'
import { Dashboard } from '../components/Dashboard.jsx'
import { TouchControls } from '../components/TouchControls.jsx'
import { DispatchPhone } from '../components/DispatchPhone.jsx'
import { TaxiMap } from '../components/TaxiMap.jsx'
import { useTaxiDispatch } from '../hooks/useTaxiDispatch.js'
import { formatDistance, remainingDistance } from '../taxi/dispatch.js'
import '../styles/drive.css'
import '../styles/taxi.css'

const CONTROL_ROWS = [
  ['W / ↑', 'Throttle'],
  ['S / ↓', 'Brake'],
  ['A D / ← →', 'Steer'],
  ['C + E / Q', 'Clutch + shift (manual)'],
  ['G', 'Switch D / M (automatic)'],
  ['V / N / F', 'Reverse / neutral / drive (hold brake or clutch)'],
  ['1 / 2 / 3', 'Eco / Normal / Sport'],
  ['T', 'Traction control on / off'],
  ['Space', 'Handbrake'],
  ['R', 'Reset run'],
  ['P / Esc', 'Pause'],
  ['M', 'Mute sound'],
]

export function DriveView({ session, audio, muted, onToggleMute, onExit }) {
  const { car, engine, transmission, roadSeed } = session
  const canvasRef = useRef(null)
  const sceneRef = useRef(null)
  const [sceneError, setSceneError] = useState(false)
  const [phoneOpen, setPhoneOpen] = useState(true)

  const {
    telemetry,
    paused,
    notice,
    shiftPulse,
    resetCount,
    togglePause,
    reset,
    setTouch,
    requestShift,
    requestRange,
    setDriveMode,
    toggleTractionControl,
    toggleGearboxMode,
  } = useDrivingSession({
    car,
    engine,
    transmission,
    sceneRef,
    audio,
    onToggleMute,
  })
  const { dispatch, accept, skip, next } = useTaxiDispatch(telemetry, resetCount)
  const remaining = remainingDistance(dispatch, telemetry.distance)
  const target = dispatch.status === 'trip' ? dispatch.ticket.dropoff : dispatch.ticket.pickup
  const resetRun = () => {
    reset()
    setPhoneOpen(true)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined

    let scene = null
    try {
      scene = new RoadScene(canvas, car, roadSeed)
      sceneRef.current = scene
    } catch (error) {
      console.error('Unable to start the 3D road scene', error)
      requestAnimationFrame(() => setSceneError(true))
    }

    return () => {
      scene?.dispose()
      sceneRef.current = null
    }
  }, [car, roadSeed])

  useEffect(() => {
    sceneRef.current?.setStops(
      dispatch.ticket.pickup.distance,
      dispatch.ticket.dropoff.distance,
      dispatch.status,
    )
  }, [dispatch.status, dispatch.ticket, sceneRef])

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
          Fleet
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
          <button type="button" className={`icon-button dispatch-trigger ${dispatch.status === 'available' || dispatch.status === 'completed' ? 'has-alert' : ''}`}
            onClick={() => setPhoneOpen((value) => !value)} aria-label={phoneOpen ? 'Close dispatch phone' : 'Open dispatch phone'}
            title="Dispatch phone" aria-pressed={phoneOpen}>
            <Smartphone size={18} />
          </button>
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

      <div className="taxi-mission">
        <div className="mission-head"><span><Navigation size={14} /> LIVE ROUTE</span><strong>{dispatch.completedRides} rides · RM {dispatch.earnings.toFixed(2)}</strong></div>
        <TaxiMap ticket={dispatch.ticket} distance={telemetry.distance} lateral={telemetry.lateral} status={dispatch.status} roadSeed={roadSeed} compact />
        <div className="mission-target">
          <small>{dispatch.status === 'available' ? 'NEW RIDE REQUEST' : dispatch.status === 'pickup' ? 'PICK UP PASSENGER' : dispatch.status === 'trip' ? 'DROP OFF PASSENGER' : 'FARE COMPLETE'}</small>
          <strong>{dispatch.status === 'completed' ? `RM ${dispatch.ticket.fare.toFixed(2)} earned` : target.name}</strong>
          <span>{dispatch.status === 'available' ? 'Open the phone to accept' : dispatch.status === 'completed' ? 'Open the phone for your next ride' : remaining > 0 ? `${formatDistance(remaining)} ahead` : 'Stop safely here'}</span>
        </div>
      </div>

      <DispatchPhone dispatch={dispatch} distance={telemetry.distance} lateral={telemetry.lateral} roadSeed={roadSeed} open={phoneOpen}
        onClose={() => setPhoneOpen(false)}
        onAccept={() => { accept(); setPhoneOpen(false) }} onSkip={skip} onNext={next} />

      {notice && <div className={`toast toast-${notice.tone}`}>{notice.message}</div>}

      {telemetry.offRoad && !paused && (
        <div className="offroad-alert">OFF ROAD — GRIP &amp; SPEED REDUCED</div>
      )}

      <div className="drive-settings" aria-label="Drive settings">
        <div className="setting-group" role="group" aria-label="Driving mode">
          {['eco', 'normal', 'sport'].map((mode) => (
            <button key={mode} type="button" className={telemetry.driveMode === mode ? 'is-active' : ''}
              onClick={() => setDriveMode(mode)} aria-pressed={telemetry.driveMode === mode}>
              {mode}
            </button>
          ))}
        </div>
        <button type="button" className={`setting-toggle ${!telemetry.tractionControl ? 'is-danger' : ''}`}
          onClick={toggleTractionControl} aria-pressed={!telemetry.tractionControl}>
          TSC {telemetry.tractionControl ? 'ON' : 'OFF'}
        </button>
        {transmission.type !== 'manual' && (
          <button type="button" className="setting-toggle" onClick={toggleGearboxMode}
            aria-label={`Gearbox ${telemetry.gearboxMode} mode. Switch to ${telemetry.gearboxMode === 'D' ? 'manual' : 'drive'} mode`}>
            {telemetry.gearboxMode === 'D' ? 'D · AUTO' : 'M · MANUAL'}
          </button>
        )}
      </div>

      <div className="range-selector" role="group" aria-label="Transmission range">
        <span className="range-caption">GEAR SELECTOR</span>
        {[
          ['R', 'Reverse', 'V'],
          ['N', 'Neutral', 'N'],
          ['D', transmission.type === 'manual' ? 'First gear' : 'Drive', 'F'],
        ].map(([range, label, key]) => (
          <button key={range} type="button" onClick={() => requestRange(range)}
            className={range === 'R' ? (telemetry.gear === -1 ? 'is-active' : '')
              : range === 'N' ? (telemetry.gear === 0 ? 'is-active' : '')
                : telemetry.gear > 0 ? 'is-active' : ''}
            aria-pressed={range === 'R' ? telemetry.gear === -1 : range === 'N' ? telemetry.gear === 0 : telemetry.gear > 0}
            aria-label={`${label} (${key})`} title={`${label} · ${key}`}>
            {range === 'D' && transmission.type === 'manual' ? '1+' : range}
          </button>
        ))}
      </div>

      <TouchControls
        setTouch={setTouch}
        requestShift={requestShift}
        gearboxMode={telemetry.gearboxMode}
        manualClutch={transmission.type === 'manual'}
        telemetry={telemetry}
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
              <button type="button" className="ghost-button" onClick={resetRun}>
                <RotateCcw size={16} />
                Restart
              </button>
              <button type="button" className="ghost-button" onClick={onExit}>
                <ChevronLeft size={16} />
                Fleet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
