import test from 'node:test'
import assert from 'node:assert/strict'
import { SPAWN, distanceBetween, districtAt } from '../src/maps/roadWorld.js'
import {
  STOP_RADIUS,
  createTicket,
  dispatchReducer,
  formatDistance,
  initialDispatchState,
  remainingDistance,
} from '../src/taxi/dispatch.js'

const position = { x: SPAWN.x, z: SPAWN.z }

test('new requests always place pickup and drop-off a sensible drive away', () => {
  for (let serial = 1; serial <= 8; serial += 1) {
    const ticket = createTicket(position, serial)
    const pickupDistance = distanceBetween(position, ticket.pickup)
    const tripDistance = distanceBetween(ticket.pickup, ticket.dropoff)
    assert.ok(pickupDistance >= 150, `${serial}: pickup should not spawn under the cab`)
    assert.ok(tripDistance >= 200, `${serial}: drop-off should be a real trip`)
    assert.notEqual(ticket.pickup.id, ticket.dropoff.id)
    assert.ok(ticket.pickup.name.length > 0 && ticket.dropoff.name.length > 0)
    assert.ok(ticket.fare > 0)
  }
})

test('accept, arrive at pickup, drop-off, payment and next ride form a complete loop', () => {
  let state = initialDispatchState(position)
  state = dispatchReducer(state, { type: 'accept' })
  assert.equal(state.status, 'pickup')
  assert.equal(remainingDistance(state, position),
    Math.max(0, distanceBetween(position, state.ticket.pickup) - STOP_RADIUS))

  state = dispatchReducer(state, {
    type: 'progress',
    position: state.ticket.pickup,
    speedKmh: 40,
  })
  assert.equal(state.status, 'pickup', 'stopping is required to board')

  state = dispatchReducer(state, {
    type: 'progress',
    position: state.ticket.pickup,
    speedKmh: 0,
  })
  assert.equal(state.status, 'trip')

  state = dispatchReducer(state, {
    type: 'progress',
    position: state.ticket.dropoff,
    speedKmh: 0,
  })
  assert.equal(state.status, 'completed')
  assert.equal(state.completedRides, 1)
  assert.equal(state.earnings, state.ticket.fare)

  state = dispatchReducer(state, {
    type: 'progress',
    position: state.ticket.dropoff,
    speedKmh: 0,
  })
  assert.equal(state.completedRides, 1, 'fare is credited only once')

  const newState = dispatchReducer(state, {
    type: 'next',
    position: state.ticket.dropoff,
  })
  assert.equal(newState.status, 'available')
  assert.ok(distanceBetween(state.ticket.dropoff, newState.ticket.pickup) >= 150)
  assert.equal(newState.earnings, state.earnings)
})

test('skipping and missed stops cannot strand a driver', () => {
  let state = dispatchReducer(initialDispatchState(position), {
    type: 'skip',
    position: { x: -700, z: 700 },
  })
  assert.ok(distanceBetween({ x: -700, z: 700 }, state.ticket.pickup) >= 150)

  state = dispatchReducer(state, { type: 'accept' })
  const latePosition = state.ticket.pickup
  state = dispatchReducer(state, {
    type: 'progress',
    position: latePosition,
    speedKmh: 0,
  })
  assert.equal(state.status, 'trip')
  assert.equal(dispatchReducer(state, {
    type: 'skip',
    position: latePosition,
  }), state, 'an active trip cannot be skipped as a new request')

  const reset = dispatchReducer(state, { type: 'reset', position })
  assert.equal(reset.status, 'available')
  assert.equal(reset.earnings, 0)
})

test('distance labels are readable at short and long ranges', () => {
  assert.equal(formatDistance(250), '250 m')
  assert.equal(formatDistance(1200), '1.2 km')
})

test('an active fare can be cancelled without losing shift earnings', () => {
  let state = initialDispatchState(position)
  state = dispatchReducer(state, { type: 'accept' })
  const activeTicket = state.ticket
  state = dispatchReducer(state, { type: 'cancel', position })
  assert.equal(state.status, 'available')
  assert.notEqual(state.ticket.id, activeTicket.id)
  assert.equal(state.earnings, 0)

  const available = dispatchReducer(state, { type: 'cancel', position })
  assert.equal(available, state, 'there is nothing to cancel without an active fare')

  state = dispatchReducer(state, { type: 'accept' })
  state = dispatchReducer(state, {
    type: 'progress',
    position: state.ticket.pickup,
    speedKmh: 0,
  })
  assert.equal(state.status, 'trip')
  state = dispatchReducer(state, { type: 'cancel', position: state.ticket.pickup })
  assert.equal(state.status, 'available')
})


test('fares can start and finish across different cities', () => {
  const towns = new Set()
  for (let serial = 1; serial <= 16; serial += 1) {
    const ticket = createTicket(position, serial)
    towns.add(districtAt(ticket.pickup.x, ticket.pickup.z)?.id ?? 'metro')
    towns.add(districtAt(ticket.dropoff.x, ticket.dropoff.z)?.id ?? 'metro')
  }
  assert.ok(towns.size >= 4, `expected fares across several towns, got ${[...towns].join(', ')}`)
})
