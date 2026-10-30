import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react'
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

export function TouchControls({ setTouch, requestShift, gearboxMode, manualClutch, telemetry }) {
  const holdProps = (control) => ({
    onPointerDown: (event) => {
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      setTouch(control, true)
    },
    onPointerUp: () => setTouch(control, false),
    onPointerCancel: () => setTouch(control, false),
    onLostPointerCapture: () => setTouch(control, false),
    onContextMenu: (event) => event.preventDefault(),
  })

  return (
    <div className="touch-controls">
      <div className="touch-cluster touch-steering">
        <button type="button" className="touch-button touch-steer" {...holdProps('left')} aria-label="Steer left">
          <ChevronLeft size={30} />
        </button>
        <button type="button" className="touch-button touch-steer" {...holdProps('right')} aria-label="Steer right">
          <ChevronRight size={30} />
        </button>
      </div>

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
          {manualClutch && <AnalogPedal control="clutch" label="CLUTCH" value={telemetry.clutch} setTouch={setTouch} />}
          <AnalogPedal control="brake" label="BRAKE" value={telemetry.brake} setTouch={setTouch} />
          <AnalogPedal control="throttle" label="GAS" value={telemetry.throttle} setTouch={setTouch} />
        </div>
      </div>
    </div>
  )
}
