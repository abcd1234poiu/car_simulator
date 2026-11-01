import { useRef, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { pedalLevelAt } from '../engine/pedals.js'

function AnalogPedal({ control, label, value, setTouch }) {
  const setFromPointer = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    setTouch(control, pedalLevelAt(event.clientY, bounds.top, bounds.height))
  }
  const release = () => setTouch(control, 0)
  const percent = Math.round((value ?? 0) * 100)

  return (
    <button
      type="button"
      className={`touch-button touch-pedal touch-${control === 'throttle' ? 'gas' : control}`}
      onPointerDown={(event) => {
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        setFromPointer(event)
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) setFromPointer(event)
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(event) => event.preventDefault()}
      aria-label={`${label} pedal, ${percent} percent. Press higher for more and drag to adjust.`}
      title={`${label}: click or drag vertically for 5–100%`}
    >
      <span className="pedal-level-fill" style={{ height: `${percent}%` }} aria-hidden="true" />
      <span className="touch-pedal-label">{label}</span>
      <span className="touch-pedal-percent">{percent}%</span>
    </button>
  )
}

function TouchSteering({ value, setTouch }) {
  const dragRef = useRef(null)
  const angleAt = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const dx = event.clientX - (bounds.left + bounds.width / 2)
    const dy = event.clientY - (bounds.top + bounds.height / 2)
    return Math.atan2(dx, -dy)
  }
  const normalize = (angle) => {
    let result = angle
    while (result > Math.PI) result -= Math.PI * 2
    while (result < -Math.PI) result += Math.PI * 2
    return result
  }
  const updateFromPointer = (event) => {
    const drag = dragRef.current
    if (!drag) return
    const delta = normalize(angleAt(event) - drag.angle)
    // Left rotation is positive steer in the physics model.
    setTouch('steer', Math.max(-1, Math.min(1, drag.value - delta / (Math.PI / 2))))
  }
  const release = () => {
    dragRef.current = null
    setTouch('steer', 0)
  }
  const percent = Math.round((value ?? 0) * 100)

  return (
    <div
      className="touch-steering"
      role="slider"
      aria-label="Steering wheel"
      aria-valuemin={-100}
      aria-valuemax={100}
      aria-valuenow={percent}
      onPointerDown={(event) => {
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        const angle = angleAt(event)
        dragRef.current = { angle, value: value ?? 0 }
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) updateFromPointer(event)
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div
        className="steer-wheel-rotor"
        style={{ transform: `rotate(${-(value ?? 0) * 120}deg)` }}
        aria-hidden="true"
      >
        <svg viewBox="0 0 100 100" className="steer-wheel-svg">
          <circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" strokeWidth="6" />
          <circle cx="50" cy="50" r="8" fill="none" stroke="currentColor" strokeWidth="5" />
          <path d="M50 14V40 M18 62L43 54 M82 62L57 54" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
          <path d="M14 50H38 M62 50H86" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
        </svg>
      </div>
      <span className="steer-caption">
        {percent > 0 ? `L ${percent}` : percent < 0 ? `R ${-percent}` : 'STEER'}
      </span>
    </div>
  )
}

export function TouchControls({ setTouch, requestShift, gearboxMode, manualClutch, telemetry }) {
  const [handbrakeLatched, setHandbrakeLatched] = useState(false)
  const handbrakeLatchedRef = useRef(false)
  const handbrakeDrag = useRef(null)

  const handbrakeDown = (event) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    if (handbrakeLatchedRef.current) {
      handbrakeLatchedRef.current = false
      setHandbrakeLatched(false)
      handbrakeDrag.current = null
      setTouch('handbrake', false)
      return
    }
    handbrakeDrag.current = { startY: event.clientY, latched: false }
    setTouch('handbrake', true)
  }
  const handbrakeMove = (event) => {
    const drag = handbrakeDrag.current
    if (!drag || !event.currentTarget.hasPointerCapture(event.pointerId)) return
    if (drag.startY - event.clientY > 24) {
      drag.latched = true
      handbrakeLatchedRef.current = true
      setHandbrakeLatched(true)
    }
  }
  const handbrakeUp = () => {
    const drag = handbrakeDrag.current
    handbrakeDrag.current = null
    if (handbrakeLatchedRef.current || drag?.latched) {
      handbrakeLatchedRef.current = true
      setHandbrakeLatched(true)
      setTouch('handbrake', true)
    } else {
      setTouch('handbrake', false)
    }
  }
  const handbrakeCancel = () => {
    const wasLatched = handbrakeLatchedRef.current || handbrakeDrag.current?.latched
    handbrakeDrag.current = null
    handbrakeLatchedRef.current = Boolean(wasLatched)
    setHandbrakeLatched(Boolean(wasLatched))
    setTouch('handbrake', Boolean(wasLatched))
  }

  return (
    <div className="touch-controls">
      <TouchSteering value={telemetry.steer} setTouch={setTouch} />

      <div className="pedal-area">
        <span className="pedal-hint">PRESS HIGHER · DRAG TO MODULATE</span>
        <div className="touch-cluster touch-cluster-right">
          {gearboxMode === 'M' && (
            <div className="touch-shifters">
              <button type="button" className="touch-button touch-shift"
                onPointerDown={(event) => { event.preventDefault(); requestShift('up') }}
                aria-label="Shift up">
                <ChevronUp size={22} />
              </button>
              <button type="button" className="touch-button touch-shift"
                onPointerDown={(event) => { event.preventDefault(); requestShift('down') }}
                aria-label="Shift down">
                <ChevronDown size={22} />
              </button>
            </div>
          )}
          <button
            type="button"
            className={`touch-button touch-handbrake ${telemetry.handbrake ? 'is-active' : ''} ${handbrakeLatched ? 'is-latched' : ''}`}
            onPointerDown={handbrakeDown}
            onPointerMove={handbrakeMove}
            onPointerUp={handbrakeUp}
            onPointerCancel={handbrakeCancel}
            onContextMenu={(event) => event.preventDefault()}
            aria-label={handbrakeLatched ? 'Handbrake locked. Tap to release.' : 'Handbrake. Drag up to lock.'}
            title="Handbrake · drag up to lock"
          >
            <span>{handbrakeLatched ? 'LOCK' : 'HB'}</span>
          </button>
          {manualClutch && <AnalogPedal control="clutch" label="CLUTCH" value={telemetry.clutch} setTouch={setTouch} />}
          <AnalogPedal control="brake" label="BRAKE" value={telemetry.brake} setTouch={setTouch} />
          <AnalogPedal control="throttle" label="GAS" value={telemetry.throttle} setTouch={setTouch} />
        </div>
      </div>
    </div>
  )
}
