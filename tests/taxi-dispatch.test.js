import test from 'node:test'
import assert from 'node:assert/strict'
import { createTicket, dispatchReducer, formatDistance, initialDispatchState, remainingDistance } from '../src/taxi/dispatch.js'

test('new requests always put pickup and drop-off ahead of the cab', () => {
  for (const distance of [0, 179, 180, 900, 12_345]) {
    const ticket = createTicket(distance, 3)
    assert.ok(ticket.pickup.distance > distance)
    assert.ok(ticket.dropoff.distance > ticket.pickup.distance)
    assert.ok(ticket.fare > 0)
  }
})

test('accept, pickup, drop-off, payment and next ride form a complete dispatch loop', () => {
  let state = initialDispatchState()
  state = dispatchReducer(state, { type: 'accept' })
  assert.equal(state.status, 'pickup')
  assert.equal(remainingDistance(state, 0), state.ticket.pickup.distance)
  state = dispatchReducer(state, { type: 'progress', distance: state.ticket.pickup.distance, speedKmh: 40 })
  assert.equal(state.status, 'pickup', 'passing a stop at speed does not board')
  state = dispatchReducer(state, { type: 'progress', distance: state.ticket.pickup.distance + 10, speedKmh: 0 })
  assert.equal(state.status, 'trip')
  state = dispatchReducer(state, { type: 'progress', distance: state.ticket.dropoff.distance, speedKmh: 0 })
  assert.equal(state.status, 'completed')
  assert.equal(state.completedRides, 1)
  assert.equal(state.earnings, state.ticket.fare)
  state = dispatchReducer(state, { type: 'progress', distance: state.ticket.dropoff.distance, speedKmh: 0 })
  assert.equal(state.completedRides, 1, 'fare is credited only once')
  const newState = dispatchReducer(state, { type: 'next', distance: state.ticket.dropoff.distance })
  assert.equal(newState.status, 'available')
  assert.ok(newState.ticket.pickup.distance > state.ticket.dropoff.distance)
  assert.equal(newState.earnings, state.earnings)
})

test('skipping and missed stops cannot strand a driver', () => {
  let state = dispatchReducer(initialDispatchState(), { type: 'skip', distance: 500 })
  assert.ok(state.ticket.pickup.distance > 500)
  state = dispatchReducer(state, { type: 'accept' })
  const lateDistance = state.ticket.dropoff.distance + 200
  state = dispatchReducer(state, { type: 'progress', distance: lateDistance, speedKmh: 0 })
  assert.equal(state.status, 'trip')
  assert.ok(state.ticket.dropoff.distance > lateDistance)
  assert.equal(dispatchReducer(state, { type: 'skip', distance: lateDistance }), state,
    'an active trip cannot be skipped as a new request')
  const reset = dispatchReducer(state, { type: 'reset' })
  assert.equal(reset.status, 'available')
  assert.equal(reset.earnings, 0)
})

test('distance labels are readable at short and long ranges', () => {
  assert.equal(formatDistance(250), '250 m')
  assert.equal(formatDistance(1200), '1.2 km')
})
