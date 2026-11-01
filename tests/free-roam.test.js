import test from 'node:test'
import assert from 'node:assert/strict'
import { CARS, ENGINES, TRANSMISSIONS } from '../src/constants/config.js'
import { FreeRoamVehiclePhysics } from '../src/engine/freeRoamPhysics.js'
import {
  AUTOBAHN,
  BUILDINGS,
  CITY_LIMIT,
  CITY_STOPS,
  DISTRICTS,
  EAST_LINK,
  GENTING,
  GENTING_ROAD_SAMPLES,
  GENTING_ROUTES,
  HIGHLAND,
  MAJOR_ROAD_HALF,
  NORTHGATE,
  PARKED_CARS,
  PARKS,
  RIVER,
  RIVERSIDE,
  ROAD_LINES,
  SOUTHPORT,
  SPAWN,
  SUNCOAST,
  TELEPORT_POINTS,
  WORLD_BOUNDS,
  cityLabelAt,
  isOnRoad,
  isOnSidewalk,
  nearestIntersection,
  resolveCollision,
  streetRoute,
  surfaceHeightAt,
  townAt,
} from '../src/maps/city.js'

const create = () =>
  new FreeRoamVehiclePhysics({
    car: CARS[0],
    engine: ENGINES['eco-i4'],
    transmission: TRANSMISSIONS.automatic,
  })

const drive = (vehicle, seconds, controls = {}) => {
  const steps = Math.round(seconds / 0.05)
  let snapshot
  for (let i = 0; i < steps; i += 1) snapshot = vehicle.update(0.05, controls)
  return snapshot
}

test('city layout exposes a large deterministic road grid with districts and stops', () => {
  assert.ok(ROAD_LINES.length >= 15)
  assert.ok(CITY_LIMIT > 800)
  assert.ok(BUILDINGS.length > 500)
  assert.ok(PARKS.length > 30)
  assert.ok(PARKED_CARS.length > 200)
  assert.ok(CITY_STOPS.length > 45)
  assert.ok(DISTRICTS.length >= 10)
  assert.equal(isOnRoad(0, 0), true)
  assert.equal(isOnRoad(ROAD_LINES[2], 42), true)
  assert.equal(isOnRoad(AUTOBAHN.x, 300), true)
  assert.equal(isOnRoad(RIVERSIDE.xLines[1], 0), true)
  assert.equal(isOnRoad(NORTHGATE.xLines[1], NORTHGATE.mainZ), true)
  assert.equal(isOnRoad(SOUTHPORT.xLines[1], SOUTHPORT.mainZ), true)
  assert.equal(isOnRoad(HIGHLAND.xLines[1], HIGHLAND.mainZ), true)
  assert.equal(isOnRoad(SUNCOAST.xLines[1], SUNCOAST.mainZ), true)
  assert.equal(isOnRoad(1000, 700), false)
  assert.equal(isOnRoad(PARKS[0].x, PARKS[0].z), false)
  assert.equal(isOnSidewalk(ROAD_LINES[0] + MAJOR_ROAD_HALF + 2, 42), true)
  assert.equal(cityLabelAt(0, 0), 'Downtown Core')
  assert.equal(cityLabelAt(AUTOBAHN.x, -500), 'A1 Autobahn')
  for (const stop of CITY_STOPS) {
    assert.ok(stop.x >= WORLD_BOUNDS.minX && stop.x <= WORLD_BOUNDS.maxX, stop.name)
    assert.ok(stop.z >= WORLD_BOUNDS.minZ && stop.z <= WORLD_BOUNDS.maxZ, stop.name)
    assert.equal(isOnRoad(stop.x, stop.z), true, `${stop.name} should sit on a street`)
  }
})

test('city collision resolution pushes out of buildings, river walls and the boundary', () => {
  const building = BUILDINGS[0]
  const inside = resolveCollision(building.x, building.z, 1.35)
  assert.ok(inside)
  assert.ok(Number.isFinite(inside.x) && Number.isFinite(inside.z))

  const riverWall = resolveCollision(RIVER.x - RIVER.halfWidth - 1.5, 700, 1.35)
  assert.ok(riverWall, 'river embankment should be solid away from the bridge')

  const edge = resolveCollision(WORLD_BOUNDS.maxX + 20, 0, 1.35)
  assert.ok(edge)
  assert.ok(edge.x <= WORLD_BOUNDS.maxX)
})

test('street routes follow roads and cross the river bridge into Riverside', () => {
  const from = { x: SPAWN.x, z: SPAWN.z }
  const to = CITY_STOPS[5]
  const route = streetRoute(from, to)
  assert.ok(route.length >= 3)
  assert.deepEqual(route[route.length - 1], { x: to.x, z: to.z })
  for (let i = 1; i < route.length; i += 1) {
    const previous = route[i - 1]
    const current = route[i]
    const aligned =
      Math.abs(previous.x - current.x) < 0.001 ||
      Math.abs(previous.z - current.z) < 0.001
    assert.ok(aligned, `segment ${i} should follow a street`)
  }

  const crossCity = streetRoute(from, { x: RIVERSIDE.xLines[2], z: 60 })
  assert.ok(crossCity.some((point) => Math.abs(point.z - EAST_LINK.z) < 0.001 &&
    point.x > RIVER.x), 'cross-city route should use the East Link bridge')

  const intersection = nearestIntersection(-301.4, 452.8)
  assert.ok(ROAD_LINES.includes(intersection.x))
  assert.ok(ROAD_LINES.includes(intersection.z))
})

test('free roam spawns on the road and accelerates through the gearbox', () => {
  const vehicle = create()
  const spawn = vehicle.snapshot()
  assert.equal(spawn.x, SPAWN.x)
  assert.equal(spawn.z, SPAWN.z)
  assert.equal(spawn.heading, SPAWN.heading)
  assert.equal(spawn.offRoad, false)

  assert.equal(vehicle.selectRange('D').ok, true)
  const snapshot = drive(vehicle, 4, { throttle: 1 })
  assert.ok(snapshot.speedKmh > 20)
  assert.ok(snapshot.z < SPAWN.z)
  assert.ok(snapshot.gear >= 2)
  assert.ok(snapshot.distance > 10)
})

test('free roam steering changes heading in the requested direction', () => {
  const vehicle = create()
  vehicle.selectRange('D')
  drive(vehicle, 1.5, { throttle: 0.8 })
  const left = drive(vehicle, 1.2, { throttle: 0.5, steer: 1 })
  assert.ok(left.heading < 0, 'left input should turn toward negative heading')

  vehicle.reset()
  vehicle.selectRange('D')
  drive(vehicle, 1.5, { throttle: 0.8 })
  const right = drive(vehicle, 1.2, { throttle: 0.5, steer: -1 })
  assert.ok(right.heading > 0, 'right input should turn toward positive heading')
})

test('free roam detects grass and clamps the car inside the city', () => {
  const vehicle = create()
  vehicle.x = PARKS[0].x
  vehicle.z = PARKS[0].z
  const snapshot = vehicle.update(0.05, { throttle: 0.2 })
  assert.equal(snapshot.offRoad, true)

  vehicle.x = WORLD_BOUNDS.maxX - 1
  vehicle.z = 0
  vehicle.heading = Math.PI / 2
  vehicle.speed = 20
  for (let i = 0; i < 30; i += 1) vehicle.update(0.05, { throttle: 0.5 })
  assert.ok(vehicle.x <= WORLD_BOUNDS.maxX)
})

test('free roam keeps reverse, neutral and traction-control behaviour', () => {
  const vehicle = create()
  drive(vehicle, 0.2, { brake: 1 })
  assert.equal(vehicle.selectRange('R').ok, true)
  const reverse = drive(vehicle, 2, { throttle: 0.8 })
  assert.ok(reverse.signedSpeed < 0)
  assert.equal(reverse.gear, -1)

  vehicle.reset()
  assert.equal(vehicle.selectRange('N').ok, true)
  drive(vehicle, 1, { throttle: 1 })
  assert.ok(Math.abs(vehicle.speed) < 0.5)

  vehicle.setTractionControl(false)
  const snapshot = vehicle.snapshot()
  assert.equal(snapshot.tractionControl, false)
})

test('keyboard steer assist eases the car back toward the road direction', () => {
  const vehicle = create()
  vehicle.selectRange('D')
  vehicle.x = 0
  vehicle.z = 200
  vehicle.heading = 0.35
  vehicle.speed = 16
  vehicle.gear = 3
  const before = Math.abs(vehicle.heading)
  for (let i = 0; i < 60; i += 1) vehicle.update(0.05, {})
  assert.ok(Math.abs(vehicle.heading) < before * 0.5,
    `heading should realign: ${before} -> ${vehicle.heading}`)
})


test('A1 exits connect every satellite town', () => {
  assert.equal(townAt(1800, -1200)?.id, 'northgate')
  assert.equal(townAt(1920, 1200)?.id, 'southport')
  assert.equal(townAt(2820, 0)?.id, 'highland')
  assert.equal(townAt(3660, 0)?.id, 'suncoast')

  const north = streetRoute({ x: SPAWN.x, z: SPAWN.z }, { x: 1740, z: -1200 })
  assert.ok(north.some((point) => Math.abs(point.x - AUTOBAHN.x) < 0.001))
  assert.ok(north.some((point) =>
    Math.abs(point.z - NORTHGATE.mainZ) < 0.001 && point.x > RIVER.x))

  const south = streetRoute({ x: SPAWN.x, z: SPAWN.z }, { x: 1860, z: 1200 })
  assert.ok(south.some((point) => Math.abs(point.x - AUTOBAHN.x) < 0.001))
  assert.ok(south.some((point) =>
    Math.abs(point.z - SOUTHPORT.mainZ) < 0.001 && point.x > RIVER.x))

  const highland = streetRoute({ x: SPAWN.x, z: SPAWN.z }, { x: 2820, z: 0 })
  assert.ok(highland.some((point) => Math.abs(point.z) < 0.001 && point.x >= 2520))

  const suncoast = streetRoute({ x: SPAWN.x, z: SPAWN.z }, { x: 3660, z: 0 })
  assert.ok(suncoast.some((point) => Math.abs(point.z) < 0.001 && point.x >= 3360))
})


test('Genting pass has elevation, hairpins and drivable slopes', () => {
  assert.ok(GENTING.halfWidth >= 15, 'mountain road should be wide enough for traffic')
  const summit = GENTING_ROAD_SAMPLES[GENTING_ROAD_SAMPLES.length - 1]
  assert.ok(surfaceHeightAt(summit.x, summit.z) > 150)
  assert.ok(GENTING_ROAD_SAMPLES.some((sample, index) => {
    if (index === 0) return false
    const previous = GENTING_ROAD_SAMPLES[index - 1]
    return Math.abs(sample.x - previous.x) > 0.01 &&
      Math.abs(sample.z - previous.z) > 0.01 &&
      Math.abs(sample.heading - previous.heading) > 0.1
  }), 'road should contain sharp direction changes')

  const vehicle = create()
  vehicle.x = summit.x
  vehicle.z = summit.z
  vehicle.heading = summit.heading
  const snapshot = vehicle.update(0.05, { brake: 1 })
  assert.ok(snapshot.y > 150, 'car height should follow the mountain')
  assert.equal(isOnRoad(summit.x, summit.z), true)

  assert.ok(GENTING_ROUTES.length >= 3)
  const batang = GENTING_ROUTES[1]
  assert.notDeepEqual(batang.samples[0], GENTING_ROUTES[0].samples[0])
  assert.ok(batang.samples.length > 400)
  const batangSummit = batang.samples[batang.samples.length - 1]
  assert.ok(surfaceHeightAt(batangSummit.x, batangSummit.z) > 150)
  assert.equal(isOnRoad(batangSummit.x, batangSummit.z), true)
})


test('teleport moves the car onto road points and clears momentum', () => {
  const vehicle = create()
  vehicle.selectRange('D')
  drive(vehicle, 1.5, { throttle: 0.8 })
  assert.ok(vehicle.speed > 1)
  for (const point of TELEPORT_POINTS) {
    const snapshot = vehicle.teleport(point.x, point.z, point.heading)
    assert.equal(snapshot.x, point.x)
    assert.equal(snapshot.z, point.z)
    assert.equal(snapshot.speed, 0)
    assert.equal(snapshot.offRoad, false)
    assert.ok(snapshot.y >= 0)
  }

  const arbitrary = vehicle.teleport(42, 42, 1.2)
  assert.equal(arbitrary.x, 42)
  assert.equal(arbitrary.z, 42)
  assert.equal(arbitrary.heading, 1.2)
  assert.equal(arbitrary.speed, 0)
})
