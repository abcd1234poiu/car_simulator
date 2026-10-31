// Stops follow the winding main road and repeat as the shift advances, so rides
// remain available indefinitely even though intersections are not selectable yet.
const STOP_NAMES = [
  'Central Station', 'Market Square', 'Riverfront', 'Civic Centre',
  'Old Town', 'University Gate', 'Garden District', 'East Terminal',
]
const PASSENGERS = ['Aisha', 'Daniel', 'Mei Ling', 'Ravi', 'Sofia', 'Hafiz', 'Nadia', 'Alex']
const BLOCK_METRES = 180
const fareFor = (pickupDistance, dropoffDistance) =>
  Math.round((5 + (dropoffDistance - pickupDistance) * 0.004) * 10) / 10

export function stopAt(index) {
  const district = Math.floor(index / STOP_NAMES.length)
  return {
    name: `${STOP_NAMES[index % STOP_NAMES.length]}${district ? ` · District ${district + 1}` : ''}`,
    distance: index * BLOCK_METRES,
  }
}

export function createTicket(currentDistance = 0, serial = 1) {
  const pickupIndex = Math.max(1, Math.ceil((currentDistance + 130) / BLOCK_METRES))
  const dropoffIndex = pickupIndex + 3 + (serial % 3)
  const pickup = stopAt(pickupIndex)
  const dropoff = stopAt(dropoffIndex)
  return {
    id: `TX-${String(serial).padStart(3, '0')}`,
    passenger: PASSENGERS[(serial - 1) % PASSENGERS.length],
    originDistance: currentDistance,
    pickup,
    dropoff,
    fare: fareFor(pickup.distance, dropoff.distance),
  }
}

export function initialDispatchState() {
  return {
    status: 'available',
    ticket: createTicket(),
    serial: 1,
    earnings: 0,
    completedRides: 0,
  }
}

export function dispatchReducer(state, action) {
  switch (action.type) {
    case 'accept':
      return state.status === 'available' ? { ...state, status: 'pickup' } : state
    case 'skip':
    case 'next': {
      if (action.type === 'skip' && state.status !== 'available') return state
      if (action.type === 'next' && state.status !== 'completed') return state
      const serial = state.serial + 1
      return {
        ...state,
        status: 'available',
        serial,
        ticket: createTicket(action.distance, serial),
      }
    }
    case 'progress': {
      const { distance, speedKmh } = action
      if (speedKmh > 6) return state
      if (state.status === 'pickup' && distance >= state.ticket.pickup.distance - 25) {
        // If a driver passes the original drop-off before boarding, place a new
        // destination ahead instead of creating a trip with no forward progress.
        let ticket = state.ticket
        if (distance >= ticket.dropoff.distance - 50) {
          const dropoff = stopAt(Math.ceil((distance + 500) / BLOCK_METRES))
          ticket = {
            ...ticket,
            dropoff,
            fare: fareFor(distance, dropoff.distance),
          }
        }
        return { ...state, status: 'trip', ticket }
      }
      if (state.status === 'trip' && distance >= state.ticket.dropoff.distance - 25) {
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
      return initialDispatchState()
    default:
      return state
  }
}

export function remainingDistance(state, distance) {
  if (state.status === 'pickup') return Math.max(0, state.ticket.pickup.distance - distance)
  if (state.status === 'trip') return Math.max(0, state.ticket.dropoff.distance - distance)
  return 0
}

export function formatDistance(metres) {
  return metres >= 1000 ? `${(metres / 1000).toFixed(1)} km` : `${Math.ceil(metres)} m`
}
