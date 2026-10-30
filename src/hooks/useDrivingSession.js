import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { VehiclePhysics } from '../engine/physics.js'
import { InputController } from '../engine/input.js'

const UI_REFRESH = 0.05

export function useDrivingSession({ car, engine, transmission, sceneRef, audio, onToggleMute }) {
  const physics = useMemo(
    () => new VehiclePhysics({ car, engine, transmission }),
    [car, engine, transmission],
  )
  const input = useMemo(() => new InputController(), [])

  const [telemetry, setTelemetry] = useState(() => physics.snapshot())
  const [paused, setPaused] = useState(false)
  const [notice, setNotice] = useState(null)
  const [shiftPulse, setShiftPulse] = useState(0)
  const pausedRef = useRef(false)
  const noticeTimer = useRef(null)

  const notify = useCallback((message, tone = 'info') => {
    window.clearTimeout(noticeTimer.current)
    setNotice({ message, tone, id: Date.now() })
    noticeTimer.current = window.setTimeout(() => setNotice(null), 2400)
  }, [])

  const requestShift = useCallback(
    (direction) => {
      if (transmission.type !== 'manual') {
        notify('Automatic gearbox — shifts are handled for you', 'info')
        return
      }
      const result = direction === 'up' ? physics.shiftUp() : physics.shiftDown()
      if (result.ok) {
        setShiftPulse((value) => value + 1)
      } else {
        notify(result.message, 'warn')
      }
    },
    [physics, transmission.type, notify],
  )

  const togglePause = useCallback(() => {
    setPaused((value) => !value)
  }, [])

  const reset = useCallback(() => {
    physics.reset()
    input.clear()
    setTelemetry(physics.snapshot())
    setPaused(false)
    notify('Run reset', 'info')
  }, [physics, input, notify])

  const setTouch = useCallback(
    (control, active) => {
      input.setTouch(control, active)
    },
    [input],
  )

  // Keep pause state available to the animation loop without re-subscribing.
  useEffect(() => {
    pausedRef.current = paused
    audio?.setPaused(paused)
    if (paused) input.clear()
  }, [paused, audio, input])

  // Wire one-shot keyboard actions.
  useEffect(() => {
    input.attach(window, {
      onPause: togglePause,
      onReset: reset,
      onMute: () => onToggleMute?.(),
      onShift: requestShift,
    })
    return () => input.detach()
  }, [input, togglePause, reset, onToggleMute, requestShift])

  // Pause automatically when the tab loses focus.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) setPaused(true)
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  useEffect(() => () => window.clearTimeout(noticeTimer.current), [])

  // Main simulation loop.
  useEffect(() => {
    let frame = 0
    let last = performance.now()
    let uiClock = 0

    const tick = (now) => {
      frame = requestAnimationFrame(tick)
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000))
      last = now
      if (pausedRef.current) return

      const snapshot = physics.update(dt, input.update(dt))
      if (snapshot.shiftEvent) setShiftPulse((value) => value + 1)

      audio?.update({ rpm: snapshot.rpm, throttle: snapshot.throttle })
      sceneRef.current?.update(dt, snapshot)

      uiClock += dt
      if (uiClock >= UI_REFRESH) {
        setTelemetry(snapshot)
        uiClock = 0
      }
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [physics, input, audio, sceneRef])

  return {
    telemetry,
    paused,
    notice,
    shiftPulse,
    togglePause,
    reset,
    setTouch,
    requestShift,
  }
}
