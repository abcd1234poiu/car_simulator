import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react'

export function TouchControls({ setTouch, requestShift, transmission }) {
  const holdProps = (control) => ({
    onPointerDown: (event) => {
      event.preventDefault()
      event.currentTarget.setPointerCapture?.(event.pointerId)
      setTouch(control, true)
    },
    onPointerUp: () => setTouch(control, false),
    onPointerLeave: () => setTouch(control, false),
    onPointerCancel: () => setTouch(control, false),
    onContextMenu: (event) => event.preventDefault(),
  })

  return (
    <div className="touch-controls">
      <div className="touch-cluster">
        <button type="button" className="touch-button touch-steer" {...holdProps('left')} aria-label="Steer left">
          <ChevronLeft size={30} />
        </button>
        <button type="button" className="touch-button touch-steer" {...holdProps('right')} aria-label="Steer right">
          <ChevronRight size={30} />
        </button>
      </div>

      <div className="touch-cluster touch-cluster-right">
        {transmission.type === 'manual' && (
          <div className="touch-shifters">
            <button
              type="button"
              className="touch-button touch-shift"
              onPointerDown={(event) => {
                event.preventDefault()
                requestShift('up')
              }}
              aria-label="Shift up"
            >
              <ChevronUp size={22} />
            </button>
            <button
              type="button"
              className="touch-button touch-shift"
              onPointerDown={(event) => {
                event.preventDefault()
                requestShift('down')
              }}
              aria-label="Shift down"
            >
              <ChevronDown size={22} />
            </button>
          </div>
        )}
        <button type="button" className="touch-button touch-brake" {...holdProps('brake')} aria-label="Brake">
          BRAKE
        </button>
        <button type="button" className="touch-button touch-gas" {...holdProps('throttle')} aria-label="Accelerate">
          GAS
        </button>
      </div>
    </div>
  )
}
