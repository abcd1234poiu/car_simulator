// World-space taxi dispatch for the merged free-roam city.
//
// Rides are placed on named street corners anywhere in the city. The driver is
// free to take any route; a stop is completed by arriving within STOP_RADIUS
// metres of the marker below 6 km/h. Pickups and drop-offs always lie a
// sensible drive away from the cab so a shift keeps moving.

import {
  CITY_STOPS,
  SPAWN,
  districtAt,
  distanceBetween,
} from '../maps/roadWorld.js'

const PASSENGERS = ['Aisha', 'Daniel', 'Mei Ling', 'Ravi', 'Sofia', 'Hafiz', 'Nadia', 'Alex']
const BASE_FARE = 4.5
const FARE_PER_METRE = 0.0035
export const STOP_RADIUS = 20

const fareFor = (pickup, dropoff) =>
  Math.round((BASE_FARE + distanceBetween(pickup, dropoff) * FARE_PER_METRE) * 10) / 10

const CITY_IDS = [...new Set(CITY_STOPS.map((stop) => districtAt(stop.x, stop.z)?.id))]
const STOP_CITY = new Map(CITY_STOPS.map((stop) => [
  stop,
  districtAt(stop.x, stop.z)?.id,
]))
const STOPS_BY_CITY = new Map(CITY_IDS.map((id) => [
  id,
  CITY_STOPS.filter((stop) => STOP_CITY.get(stop) === id),
]))

function pickStop(pool, offset) {
  return pool[((offset % pool.length) + pool.length) % pool.length]
}

const cityOf = (position) => districtAt(position.x, position.z)?.id

export function createTicket(currentPosition = SPAWN, serial = 1) {
  const position = { x: currentPosition.x ?? SPAWN.x, z: currentPosition.z ?? SPAWN.z }
  const localCity = cityOf(position)
  const localIndex = Math.max(0, CITY_IDS.indexOf(localCity))

  // Rotate the pickup city through the whole map so fares are not all in Metro.
  const pickupCityId = CITY_IDS[(localIndex + Math.max(1, serial)) % CITY_IDS.length]
  const cityPool = STOPS_BY_CITY.get(pickupCityId)?.length
    ? STOPS_BY_CITY.get(pickupCityId)
    : CITY_STOPS
  const spacedPickups = cityPool.filter(
    (stop) => distanceBetween(position, stop) >= 150,
  )
  const pickupPool = spacedPickups.length ? spacedPickups : cityPool
  const pickup = pickStop(pickupPool, serial * 5 - 3)
  const pickupIndex = Math.max(0, CITY_IDS.indexOf(STOP_CITY.get(pickup)))

  // Two out of three fares cross a city boundary; every third ride stays local.
  const crossCity = true
  let dropoffPool = []
  if (crossCity) {
    for (let step = 1; step < CITY_IDS.length && dropoffPool.length === 0; step += 1) {
      const cityId = CITY_IDS[(pickupIndex + serial + step) % CITY_IDS.length]
      if (cityId === pickupCityId) continue
      dropoffPool = (STOPS_BY_CITY.get(cityId) ?? []).filter(
        (stop) => distanceBetween(pickup, stop) >= 280,
      )
    }
  }
  if (dropoffPool.length === 0) {
    dropoffPool = pickupPool.filter(
      (stop) => stop !== pickup && distanceBetween(pickup, stop) >= 280,
    )
  }
  if (dropoffPool.length === 0) {
    dropoffPool = CITY_STOPS.filter((stop) => stop !== pickup)
  }
  const dropoff = pickStop(dropoffPool, serial * 11 + 1)

  return {
    id: `TX-${String(serial).padStart(3, '0')}`,
    passenger: PASSENGERS[(serial - 1) % PASSENGERS.length],
    pickup,
    dropoff,
    fare: fareFor(pickup, dropoff),
  }
}

export function initialDispatchState(position = SPAWN) {
  return {
    status: 'available',
    ticket: createTicket(position),
    serial: 1,
    earnings: 0,
    completedRides: 0,
  }
}

export function dispatchReducer(state, action) {
  switch (action.type) {
    case 'accept':
      return state.status === 'available' ? { ...state, status: 'pickup' } : state
    case 'cancel': {
      if (state.status !== 'pickup' && state.status !== 'trip') return state
      const serial = state.serial + 1
      return {
        ...state,
        status: 'available',
        serial,
        ticket: createTicket(action.position, serial),
      }
    }
    case 'skip':
    case 'next': {
      if (action.type === 'skip' && state.status !== 'available') return state
      if (action.type === 'next' && state.status !== 'completed') return state
      const serial = state.serial + 1
      return {
        ...state,
        status: 'available',
        serial,
        ticket: createTicket(action.position, serial),
      }
    }
    case 'progress': {
      const { position, speedKmh } = action
      if (!position || speedKmh > 6) return state
      if (state.status === 'pickup' &&
        distanceBetween(position, state.ticket.pickup) <= STOP_RADIUS) {
        return { ...state, status: 'trip' }
      }
      if (state.status === 'trip' &&
        distanceBetween(position, state.ticket.dropoff) <= STOP_RADIUS) {
        return {
          ...state,
          status: 'completed',
          earnings: Math.round((state.earnings + state.ticket.fare) * 10) / 10,
          completedRides: state.completedRides + 1,
        }
      }
      return state
    }
    case 'reset':
      return initialDispatchState(action.position)
    default:
      return state
  }
}

/** Current waypoint, or null when there is nothing to drive to. */
export function currentStop(state) {
  if (state.status === 'pickup') return state.ticket.pickup
  if (state.status === 'trip') return state.ticket.dropoff
  return null
}

export function remainingDistance(state, position) {
  const stop = currentStop(state)
  if (!stop || !position) return 0
  return Math.max(0, distanceBetween(position, stop) - STOP_RADIUS)
}

export function formatDistance(metres) {
  return metres >= 1000 ? `${(metres / 1000).toFixed(1)} km` : `${Math.ceil(metres)} m`
}
