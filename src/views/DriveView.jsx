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
  Map,
  Power,
  X,
} from 'lucide-react'
import { RoadScene } from '../engine/roadScene.js'
import { useDrivingSession } from '../hooks/useDrivingSession.js'
import { Dashboard } from '../components/Dashboard.jsx'
import { TouchControls } from '../components/TouchControls.jsx'
import { DispatchPhone } from '../components/DispatchPhone.jsx'
import { RoadMap } from '../maps/RoadMap.jsx'
import { useTaxiDispatch } from '../hooks/useTaxiDispatch.js'
import { formatDistance, remainingDistance } from '../taxi/dispatch.js'
import { TELEPORT_POINTS, cityLabelAt, distanceBetween } from '../maps/roadWorld.js'
import '../styles/drive.css'
import '../styles/taxi.css'

const CONTROL_ROWS = [
  ['W / ↑', 'Throttle'],
  ['S / ↓', 'Brake / reverse'],
  ['A D / ← →', 'Steer'],
  ['C + E / Q', 'Clutch + shift (manual)'],
  ['G', 'Switch D / M (automatic)'],
  ['V / N / F', 'Reverse / neutral / drive (hold brake or clutch)'],
  ['1 / 2 / 3', 'Eco / Normal / Sport'],
  ['T', 'Traction control on / off'],
  ['Space', 'Handbrake'],
  ['R', 'Return to spawn & restart shift'],
  ['P / Esc', 'Pause'],
  ['I', 'Ignition on / off'],
  ['M', 'Mute sound'],
]

const STATUS_COPY = {
  available: 'NEW RIDE REQUEST',
  pickup: 'PICK UP PASSENGER',
  trip: 'DROP OFF PASSENGER',
  completed: 'FARE COMPLETE',
}

export function DriveView({ session, audio, muted, onToggleMute, onExit }) {
  const { car, engine, transmission, aspiration, tyre, suspension } = session
  const canvasRef = useRef(null)
  const sceneRef = useRef(null)
  const [sceneError, setSceneError] = useState(false)
  const [phoneOpen, setPhoneOpen] = useState(true)
  const [overview, setOverview] = useState(false)
  const [destination, setDestination] = useState(null)
  const [tuningOpen, setTuningOpen] = useState(false)

  const {
    telemetry,
    paused,
    ignition,
    ignitionSweep,
    notice,
    shiftPulse,
    resetCount,
    togglePause,
    toggleIgnition,
    teleport,
    reset,
    setTouch,
    requestShift,
    requestRange,
    setDriveMode,
    toggleTractionControl,
    tuneSuspension,
    toggleGearboxMode,
  } = useDrivingSession({
    car,
    engine,
    transmission,
    aspiration,
    tyre,
    suspension,
    sceneRef,
    audio,
    onToggleMute,
  })
  const { dispatch, accept, cancel, skip, next } = useTaxiDispatch(telemetry, resetCount)
  const remaining = remainingDistance(dispatch, telemetry)
  const target = dispatch.status === 'trip' ? dispatch.ticket.dropoff : dispatch.ticket.pickup
  const district = cityLabelAt(telemetry.x ?? 0, telemetry.z ?? 0)

  const resetRun = () => {
    reset()
    setPhoneOpen(true)
  }

  const teleportToDestination = () => {
    if (!destination) return
    teleport({
      x: destination.x,
      z: destination.z,
      heading: telemetry.heading ?? 0,
      name: 'map point',
    })
    setDestination(null)
    setOverview(false)
    setPhoneOpen(false)
  }

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

  useEffect(() => {
    sceneRef.current?.setStops(
      dispatch.ticket.pickup,
      dispatch.ticket.dropoff,
      dispatch.status,
    )
  }, [dispatch.status, dispatch.ticket])

  return (
    <div className="drive-screen">
      <div className={`drive-stage ${sceneError ? 'is-fallback' : ''}`}>
        <canvas ref={canvasRef} className="drive-canvas" aria-hidden="true" />
        {sceneError && <div className="scene-fallback" aria-hidden="true" />}
        <div className="drive-vignette" aria-hidden="true" />
        <div
          className="impact-flash"
          style={{ opacity: Math.min(0.55, (telemetry.impact ?? 0) * 0.7) }}
          aria-hidden="true"
        />
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
            {district} · {aspiration?.badge} · {engine.badge} · {transmission.shortName} · {car.drivetrain}
          </span>
        </div>

        <div className="drive-actions">
          <button
            type="button"
            className={`icon-button ignition-button ${ignition ? 'is-on' : ''}`}
            onClick={toggleIgnition}
            aria-label={ignition ? 'Switch ignition off' : 'Start ignition'}
            title={ignition ? 'Ignition off' : 'Start engine (I)'}
            aria-pressed={ignition}
          >
            <Power size={18} />
          </button>
          <button
            type="button"
            className={`icon-button dispatch-trigger ${dispatch.status === 'available' || dispatch.status === 'completed' ? 'has-alert' : ''}`}
            onClick={() => setPhoneOpen((value) => !value)}
            aria-label={phoneOpen ? 'Close dispatch phone' : 'Open dispatch phone'}
            title="Dispatch phone"
            aria-pressed={phoneOpen}
          >
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
          <button
            type="button"
            className="icon-button"
            onClick={() => setOverview((value) => !value)}
            aria-label={overview ? 'Return to drive camera' : 'Show full road map'}
            title={overview ? 'Drive view' : 'Full road map'}
            aria-pressed={overview}
          >
            <Map size={18} />
          </button>
        </div>
      </header>

      <RoadMap
        telemetry={telemetry}
        ticket={dispatch.ticket}
        status={dispatch.status}
        destination={destination}
      />

      <div className="taxi-mission">
        <div className="mission-head">
          <span><Navigation size={14} /> {dispatch.status === 'available' ? 'DISPATCH' : 'LIVE ROUTE'}</span>
          <strong>{dispatch.completedRides} rides · RM {dispatch.earnings.toFixed(2)}</strong>
        </div>
        <div className="mission-target">
          <small>{STATUS_COPY[dispatch.status]}</small>
          <strong>{dispatch.status === 'completed' ? `RM ${dispatch.ticket.fare.toFixed(2)} earned` : target.name}</strong>
          <span>
            {dispatch.status === 'available'
              ? 'Open the phone to accept'
              : dispatch.status === 'completed'
                ? 'Open the phone for your next ride'
                : remaining > 0
                  ? `${formatDistance(remaining)} to ${dispatch.status === 'pickup' ? 'pickup' : 'drop-off'}`
                  : 'Stop safely here'}
          </span>
        </div>
      </div>

      <DispatchPhone
        dispatch={dispatch}
        telemetry={telemetry}
        destination={destination}
        open={phoneOpen}
        onClose={() => setPhoneOpen(false)}
        onAccept={() => { accept(); setPhoneOpen(false) }}
        onCancel={cancel}
        onSkip={skip}
        onNext={next}
      />

      {!ignition && !paused && (
        <div className="ignition-hint">
          <Power size={15} />
          <span>ENGINE OFF</span>
          <button type="button" onClick={toggleIgnition}>Start engine</button>
          <small>I</small>
        </div>
      )}

      {notice && <div className={`toast toast-${notice.tone}`}>{notice.message}</div>}

      {telemetry.offRoad && !paused && (
        <div className="offroad-alert">OFF ROAD — GRIP &amp; SPEED REDUCED</div>
      )}

      {overview && (
        <div className="overview-map" role="dialog" aria-label="Full road map">
          <div className="overview-label">
            <Map size={14} /> SAN ANDREAS ROADS <span>· {district}</span>
          </div>
          <button
            type="button"
            className="overview-close"
            onClick={() => setOverview(false)}
            aria-label="Close road map"
            title="Close map"
          >
            <X size={20} />
          </button>
          <div className={`overview-destination ${destination ? 'is-set' : ''}`}>
            {destination
              ? (
                <>
                  DESTINATION · {formatDistance(distanceBetween(
                    { x: telemetry.x ?? 0, z: telemetry.z ?? 0 },
                    destination,
                  ))}
                  <button type="button" className="is-primary" onClick={teleportToDestination}>
                    Teleport here
                  </button>
                  <button type="button" onClick={() => setDestination(null)}>Clear</button>
                </>
              )
              : 'Click anywhere on the map to set a destination or teleport there'}
          </div>
          <RoadMap
            variant="overview"
            telemetry={telemetry}
            ticket={dispatch.ticket}
            status={dispatch.status}
            destination={destination}
            onPickDestination={setDestination}
          />
          <div className="teleport-panel" aria-label="Teleport locations">
            <span className="teleport-title">TELEPORT</span>
            <div className="teleport-options">
              {TELEPORT_POINTS.map((point) => (
                <button
                  key={point.id}
                  type="button"
                  onClick={() => {
                    teleport(point)
                    setOverview(false)
                    setPhoneOpen(false)
                  }}
                >
                  {point.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="drive-settings" aria-label="Drive settings">
        <div className="setting-group" role="group" aria-label="Driving mode">
          {['eco', 'normal', 'sport'].map((driveMode) => (
            <button key={driveMode} type="button" className={telemetry.driveMode === driveMode ? 'is-active' : ''}
              onClick={() => setDriveMode(driveMode)} aria-pressed={telemetry.driveMode === driveMode}>
              {driveMode}
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
        <button type="button" className={`setting-toggle ${tuningOpen ? 'is-active' : ''}`}
          onClick={() => setTuningOpen((value) => !value)} aria-expanded={tuningOpen}>
          Absorbers
        </button>
      </div>

      {tuningOpen && (
        <div className="live-suspension" aria-label="Live suspension tuning">
          <strong>SUSPENSION TUNING</strong>
          {[
            ['spring', 'Spring stiffness'],
            ['damper', 'Absorber damping'],
          ].map(([key, label]) => (
            <label key={key}>
              <span>{label} · {Math.round((telemetry.suspension?.[key] ?? 0.5) * 100)}%</span>
              <input type="range" min="0" max="100"
                value={Math.round((telemetry.suspension?.[key] ?? 0.5) * 100)}
                onChange={(event) => tuneSuspension({
                  ...telemetry.suspension,
                  [key]: Number(event.target.value) / 100,
                })} />
            </label>
          ))}
        </div>
      )}

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
          aspiration={aspiration}
          transmission={transmission}
          telemetry={telemetry}
          shiftPulse={shiftPulse}
          ignitionSweep={ignitionSweep}
          tyre={tyre}
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
