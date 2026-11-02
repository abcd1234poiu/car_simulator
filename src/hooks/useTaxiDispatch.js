import { useEffect, useReducer } from 'react'
import { SPAWN } from '../maps/roadWorld.js'
import { dispatchReducer, initialDispatchState } from '../taxi/dispatch.js'

export function useTaxiDispatch(telemetry, resetCount) {
  const [dispatch, send] = useReducer(
    dispatchReducer,
    undefined,
    () => initialDispatchState({ x: telemetry.x ?? SPAWN.x, z: telemetry.z ?? SPAWN.z }),
  )

  useEffect(() => {
    send({
      type: 'progress',
      position: {
        x: telemetry.x ?? SPAWN.x,
        z: telemetry.z ?? SPAWN.z,
      },
      speedKmh: telemetry.speedKmh,
    })
  }, [telemetry.x, telemetry.z, telemetry.speedKmh])

  useEffect(() => {
    if (resetCount > 0) send({ type: 'reset', position: SPAWN })
  }, [resetCount])

  const position = { x: telemetry.x ?? SPAWN.x, z: telemetry.z ?? SPAWN.z }

  return {
    dispatch,
    accept: () => send({ type: 'accept' }),
    cancel: () => send({ type: 'cancel', position }),
    skip: () => send({ type: 'skip', position }),
    next: () => send({ type: 'next', position }),
  }
}
