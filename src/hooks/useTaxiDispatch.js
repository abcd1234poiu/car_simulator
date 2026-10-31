import { useEffect, useReducer } from 'react'
import { dispatchReducer, initialDispatchState } from '../taxi/dispatch.js'

export function useTaxiDispatch(telemetry, resetCount) {
  const [dispatch, send] = useReducer(dispatchReducer, undefined, initialDispatchState)

  useEffect(() => {
    send({ type: 'progress', distance: telemetry.distance, speedKmh: telemetry.speedKmh })
  }, [telemetry.distance, telemetry.speedKmh])

  useEffect(() => {
    if (resetCount > 0) send({ type: 'reset' })
  }, [resetCount])

  return {
    dispatch,
    accept: () => send({ type: 'accept' }),
    skip: () => send({ type: 'skip', distance: telemetry.distance }),
    next: () => send({ type: 'next', distance: telemetry.distance }),
  }
}
