import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FreeRoamVehiclePhysics } from '../engine/freeRoamPhysics.js'
import { InputController } from '../engine/input.js'

const UI_REFRESH = 0.05

export function useDrivingSession({
  car, engine, transmission, aspiration, tyre, sceneRef, audio, onToggleMute,
}) {
  const physics = useMemo(
    () => new FreeRoamVehiclePhysics({ car, engine, transmission, aspiration, tyre }),
    [car, engine, transmission, aspiration, tyre],
  )
  const input = useMemo(() => new InputController(), [])

  const [telemetry, setTelemetry] = useState(() => physics.snapshot())
  const [paused, setPaused] = useState(false)
  const [ignition, setIgnitionState] = useState(false)
  const [ignitionSweep, setIgnitionSweep] = useState(0)
  const [notice, setNotice] = useState(null)
  const [shiftPulse, setShiftPulse] = useState(0)
  const [resetCount, setResetCount] = useState(0)
  const pausedRef = useRef(false)
  const ignitionRef = useRef(false)
  const noticeTimer = useRef(null)

  const notify = useCallback((message, tone = 'info') => {
    window.clearTimeout(noticeTimer.current)
    setNotice({ message, tone, id: Date.now() })
    noticeTimer.current = window.setTimeout(() => setNotice(null), 2400)
  }, [])

  const requestShift = useCallback(
    (direction) => {
      const result = direction === 'up' ? physics.shiftUp() : physics.shiftDown()
      if (result.ok) {
        setShiftPulse((value) => value + 1)
        setTelemetry(physics.snapshot())
      } else {
        notify(result.message, 'warn')
      }
    },
    [physics, notify],
  )

  const requestRange = useCallback((range) => {
    const result = physics.selectRange(range)
    if (result.ok) {
      setShiftPulse((value) => value + 1)
      setTelemetry(physics.snapshot())
      notify(result.message, 'info')
    } else {
      notify(result.message, 'warn')
    }
  }, [physics, notify])

  const setDriveMode = useCallback((mode) => {
    if (physics.setDriveMode(mode)) {
      setTelemetry(physics.snapshot())
      notify(`${mode.toUpperCase()} mode`, 'info')
    }
  }, [physics, notify])

  const toggleTractionControl = useCallback(() => {
    physics.setTractionControl(!physics.tractionControl)
    setTelemetry(physics.snapshot())
    notify(physics.tractionControl ? 'Traction control on' : 'TSC OFF — wheelspin possible',
      physics.tractionControl ? 'info' : 'warn')
  }, [physics, notify])

  const toggleGearboxMode = useCallback(() => {
    if (physics.setGearboxMode(physics.gearboxMode === 'D' ? 'M' : 'D')) {
      setTelemetry(physics.snapshot())
      notify(physics.gearboxMode === 'D' ? 'Drive mode — automatic shifting' : 'Manual shift mode', 'info')
    }
  }, [physics, notify])

  const togglePause = useCallback(() => {
    setPaused((value) => !value)
  }, [])

  const setIgnition = useCallback((next) => {
    const on = Boolean(next)
    if (ignitionRef.current === on) return
    ignitionRef.current = on
    physics.setIgnition(on)
    setIgnitionState(on)
    setTelemetry(physics.snapshot())
    if (on) {
      setIgnitionSweep((value) => value + 1)
      if (audio?.startIgnition) audio.startIgnition(engine, aspiration)
      else audio?.start(engine, aspiration)
      notify('Ignition on — engine running', 'info')
    } else {
      audio?.stop()
      notify('Ignition off', 'warn')
    }
  }, [physics, audio, engine, aspiration, notify])

  const toggleIgnition = useCallback(() => {
    setIgnition(!ignitionRef.current)
  }, [setIgnition])

  const teleport = useCallback((point) => {
    if (!point) return
    const snapshot = physics.teleport(point.x, point.z, point.heading)
    input.clear()
    setTelemetry(snapshot)
    setPaused(false)
    notify(`Teleported to ${point.name ?? 'location'}`, 'info')
  }, [physics, input, notify])

  const reset = useCallback(() => {
    physics.reset()
    physics.setIgnition(ignitionRef.current)
    input.clear()
    setTelemetry(physics.snapshot())
    setResetCount((count) => count + 1)
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
      onGearboxMode: toggleGearboxMode,
      onRange: requestRange,
      onDriveMode: setDriveMode,
      onTractionControl: toggleTractionControl,
      onIgnition: toggleIgnition,
    })
    return () => input.detach()
  }, [input, togglePause, reset, onToggleMute, requestShift, toggleGearboxMode, requestRange, setDriveMode, toggleTractionControl, toggleIgnition])

  // Pause automatically when the tab loses focus.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) setPaused(true)
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  useEffect(() => {
    physics.setIgnition(false)
    audio?.stop()
  }, [physics, audio])

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

      audio?.update({
        rpm: snapshot.rpm,
        throttle: snapshot.throttle,
        boost: snapshot.boost,
        limiter: snapshot.limiter,
        shiftEvent: snapshot.shiftEvent,
      })
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
    toggleGearboxMode,
  }
}
