import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ASPIRATIONS, CARS, ENGINES, TRANSMISSIONS, SUSPENSION_PRESETS,
  normalizeSuspension,
} from '../src/constants/config.js'
import { FreeRoamVehiclePhysics } from '../src/engine/freeRoamPhysics.js'
import {
  BRIDGE, BUILDINGS, CITY_STOPS, DISTRICTS, ROAD_SEGMENTS, SPAWN, TELEPORT_POINTS,
  WORLD_BOUNDS, cityLabelAt, distanceBetween, isOnRoad,
  nearestRoad, nearestRoadHeading, resolveCollision, streetRoute,
  streetDistance, roadDeckHeightAt, surfaceHeightAt, surfaceSlopeAlong,
  terrainHeightAt, terrainMeshHeightAt,
} from '../src/maps/roadWorld.js'

const create = () => new FreeRoamVehiclePhysics({
  car: CARS[0],
  engine: ENGINES['eco-i4'],
  transmission: TRANSMISSIONS.automatic,
})

const drive = (vehicle, seconds, controls = {}) => {
  let snapshot
  for (let i = 0; i < Math.round(seconds / 0.05); i += 1) {
    snapshot = vehicle.update(0.05, controls)
  }
  return snapshot
}

test('replacement map exposes a connected roads-first island', () => {
  assert.ok(ROAD_SEGMENTS.length > 1200)
  assert.ok(DISTRICTS.length >= 14)
  assert.ok(BUILDINGS.length > 700)
  assert.ok(WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX > 11000)
  assert.equal(cityLabelAt(0, 1080), 'Downtown Los Santos')
  assert.equal(isOnRoad(SPAWN.x, SPAWN.z), true)
  assert.equal(isOnRoad(3000, 1000), false)
  for (const stop of CITY_STOPS) {
    assert.equal(isOnRoad(stop.x, stop.z), true, `${stop.name} must sit on a road`)
  }
  for (const point of TELEPORT_POINTS) {
    assert.equal(isOnRoad(point.x, point.z), true, `${point.name} must sit on a road`)
  }
})

test('Bayview is connected by a long autobahn and an elevated river bridge', () => {
  const bayview = TELEPORT_POINTS.find((point) => point.id === 'bayview')
  const route = streetRoute(SPAWN, bayview)
  assert.ok(route.some((point) => point.x >= BRIDGE.xMin && point.x <= BRIDGE.xMax &&
    point.z === BRIDGE.z))
  assert.ok(streetDistance(SPAWN, bayview) > 5000)
  assert.equal(isOnRoad(bayview.x, bayview.z), true)
  assert.ok(surfaceHeightAt(3600, BRIDGE.z) > terrainHeightAt(3600, BRIDGE.z) + 20)
  assert.ok(surfaceSlopeAlong(3120, BRIDGE.z, Math.PI / 2) > 0.01)
  const railZ = BRIDGE.z + BRIDGE.halfWidth + 2
  const rail = resolveCollision(3600, railZ, 1.35)
  assert.ok(rail && rail.z < railZ)
})

test('mountain roads have grades and city buildings are solid', () => {
  assert.ok(surfaceHeightAt(-540, -900) > 100)
  assert.ok(Math.abs(surfaceSlopeAlong(-540, -540, Math.PI / 2)) > 0.03)
  const building = BUILDINGS[0]
  assert.ok(resolveCollision(building.x, building.z, 1.35))
  assert.equal(isOnRoad(building.x, building.z), false)
  for (const road of ROAD_SEGMENTS) {
    const midpoint = { x: (road.a.x + road.b.x) / 2, z: (road.a.z + road.b.z) / 2 }
    assert.equal(resolveCollision(midpoint.x, midpoint.z, 1.35), null,
      `${road.name} must not be blocked by a building`)
  }
})

test('city approach and autobahn have driveable uphill and downhill grades', () => {
  const cityLow = surfaceHeightAt(-1080, 1080)
  const cityHigh = surfaceHeightAt(-1080, 540)
  const bayviewLow = surfaceHeightAt(5040, 1080)
  const bayviewHigh = surfaceHeightAt(5760, 1080)
  assert.ok(cityHigh - cityLow > 20)
  assert.ok(bayviewHigh - bayviewLow > 20)
  assert.ok(surfaceSlopeAlong(-1080, 960, 0) > 0.02)
  assert.ok(surfaceSlopeAlong(-1080, 960, Math.PI) < -0.02)
  assert.ok(surfaceSlopeAlong(5400, 1080, Math.PI / 2) > 0.02)
})

test('outer freeway lanes remain on-road even where narrow streets overlap', () => {
  for (const z of [1068, 1092]) {
    const x = 5130
    const nearest = nearestRoad(x, z)
    assert.ok(nearest.distance > nearest.segment.halfWidth)
    assert.equal(isOnRoad(x, z), true)
    assert.ok(surfaceHeightAt(x, z) > terrainMeshHeightAt(x, z))
  }
})

test('free-roam physics has no fixed forward speed ceiling', () => {
  const vehicle = create()
  vehicle.teleport(5400, 1080, 0)
  vehicle.selectRange('D')
  vehicle.gear = vehicle.gearCount
  vehicle.speed = 112
  vehicle.rpm = vehicle.rpmForSpeed(112)
  vehicle.update(0.05, { throttle: 1 })
  assert.ok(vehicle.speed > 110)
})

test('Meridian GT V6 SC DSG uses seventh on the A7 without leaving the road', () => {
  const vehicle = new FreeRoamVehiclePhysics({
    car: CARS.find((car) => car.id === 'meridian-gt'),
    engine: ENGINES.v6,
    transmission: TRANSMISSIONS.dsg,
    aspiration: ASPIRATIONS.supercharger,
  })
  vehicle.teleport(2160, 1080, Math.PI / 2)
  vehicle.selectRange('D')
  vehicle.setDriveMode('sport')
  let offRoadFrames = 0
  for (let i = 0; i < 1400; i += 1) {
    if (vehicle.update(0.05, { throttle: 1 }).offRoad) offRoadFrames += 1
  }
  assert.equal(vehicle.gear, 7)
  assert.ok(vehicle.maxSpeed * 3.6 > 320)
  assert.equal(offRoadFrames, 0)
})

test('road decks clear the visible terrain and vehicles cannot sink at crossings', () => {
  for (const road of ROAD_SEGMENTS) {
    const dx = road.b.x - road.a.x
    const dz = road.b.z - road.a.z
    const length = Math.hypot(dx, dz)
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const x = road.a.x + dx * t
      const z = road.a.z + dz * t
      const deck = roadDeckHeightAt(road, t)
      assert.ok(surfaceHeightAt(x, z) + 0.01 >= deck, `${road.name}: car below road`)
      for (const side of [-1, 0, 1]) {
        const px = x - dz / length * road.halfWidth * side
        const pz = z + dx / length * road.halfWidth * side
        assert.ok(terrainMeshHeightAt(px, pz) < deck + 0.13,
          `${road.name}: grass above asphalt`)
      }
    }
  }
})

test('routing follows actual road edges between urban, desert, and coast stops', () => {
  for (const from of TELEPORT_POINTS) for (const to of TELEPORT_POINTS) {
    if (from === to) continue
    const route = streetRoute(from, to)
    assert.ok(route.length > 2, `${from.name} to ${to.name} should connect`)
    assert.deepEqual(route.at(-1), { x: to.x, z: to.z })
    for (const point of route.slice(1, -1)) {
      assert.equal(isOnRoad(point.x, point.z), true)
    }
    assert.ok(route.reduce((sum, point, index) =>
      index ? sum + distanceBetween(route[index - 1], point) : 0, 0) >=
      distanceBetween(from, to))
  }
})

test('road heading selects the matching direction at intersections', () => {
  assert.ok(Math.abs(nearestRoadHeading(0, 1080, 0)) < 0.01)
  assert.ok(Math.abs(nearestRoadHeading(0, 1080, Math.PI / 2) - Math.PI / 2) < 0.01)
  assert.ok(nearestRoad(0, 1080).distance < 0.01)
  assert.equal(nearestRoadHeading(3000, 1000), null)
})

test('free roam spawns on the new map and accelerates through the gearbox', () => {
  const vehicle = create()
  const spawn = vehicle.snapshot()
  assert.equal(spawn.x, SPAWN.x)
  assert.equal(spawn.z, SPAWN.z)
  assert.equal(spawn.offRoad, false)
  assert.equal(vehicle.selectRange('D').ok, true)
  const snapshot = drive(vehicle, 4, { throttle: 1 })
  assert.ok(snapshot.speedKmh > 20)
  assert.ok(snapshot.z < SPAWN.z)
  assert.ok(snapshot.gear >= 2)
})

test('steering and handbrake drift turn in the requested direction', () => {
  for (const handbrake of [false, true]) {
    const vehicle = create()
    vehicle.selectRange('D')
    drive(vehicle, 1.5, { throttle: 0.8 })
    assert.ok(drive(vehicle, 1.2, { throttle: 0.5, steer: 1, handbrake }).heading < 0)
    vehicle.reset()
    vehicle.selectRange('D')
    drive(vehicle, 1.5, { throttle: 0.8 })
    assert.ok(drive(vehicle, 1.2, { throttle: 0.5, steer: -1, handbrake }).heading > 0)
  }
})

test('speed-sensitive steering keeps highway corrections calmer than town turns', () => {
  const turnAt = (speed) => {
    const vehicle = create()
    vehicle.teleport(5400, 1080, Math.PI / 2)
    vehicle.selectRange('D')
    vehicle.gear = 4
    vehicle.speed = speed
    vehicle.rpm = vehicle.rpmForSpeed(speed)
    drive(vehicle, 0.3, { throttle: 0.5, steer: 1 })
    return Math.abs(vehicle.heading - Math.PI / 2)
  }
  assert.ok(turnAt(35) < turnAt(10) * 0.65)
})

test('straight-line braking dips the nose without rolling the car sideways', () => {
  const vehicle = create()
  vehicle.teleport(5400, 1080, Math.PI / 2)
  vehicle.selectRange('D')
  vehicle.gear = 4
  vehicle.speed = 20
  vehicle.rpm = vehicle.rpmForSpeed(20)
  const state = drive(vehicle, 0.5, { brake: 1 })
  assert.ok(state.bodyPitch < -0.02)
  assert.ok(Math.abs(state.bodyRoll) < 0.01)
})

test('off-road grip and world boundaries still work', () => {
  const vehicle = create()
  vehicle.teleport(3000, 1000)
  assert.equal(vehicle.snapshot().offRoad, true)
  const edge = resolveCollision(WORLD_BOUNDS.maxX + 20, 0, 1.35)
  assert.ok(edge && edge.x <= WORLD_BOUNDS.maxX)
  vehicle.x = WORLD_BOUNDS.maxX - 1
  vehicle.z = 0
  vehicle.heading = Math.PI / 2
  vehicle.speed = 20
  drive(vehicle, 1.5, { throttle: 0.5 })
  assert.ok(vehicle.x <= WORLD_BOUNDS.maxX)
})

test('reverse, neutral and traction control remain functional', () => {
  const vehicle = create()
  drive(vehicle, 0.2, { brake: 1 })
  assert.equal(vehicle.selectRange('R').ok, true)
  assert.ok(drive(vehicle, 2, { throttle: 0.8 }).signedSpeed < 0)
  vehicle.reset()
  assert.equal(vehicle.selectRange('N').ok, true)
  drive(vehicle, 1, { throttle: 1 })
  assert.ok(Math.abs(vehicle.speed) < 0.5)
  vehicle.setTractionControl(false)
  assert.equal(vehicle.snapshot().tractionControl, false)
})

test('teleport points are all on the replacement road network', () => {
  const vehicle = create()
  vehicle.selectRange('D')
  drive(vehicle, 1.5, { throttle: 0.8 })
  for (const point of TELEPORT_POINTS) {
    const snapshot = vehicle.teleport(point.x, point.z, point.heading)
    assert.equal(snapshot.x, point.x)
    assert.equal(snapshot.z, point.z)
    assert.equal(snapshot.speed, 0)
    assert.equal(snapshot.offRoad, false)
  }
})

test('absorber tuning changes body roll and preserves controlled drifting', () => {
  assert.deepEqual(normalizeSuspension({ spring: -1, damper: 2 }), { spring: 0, damper: 1 })
  const run = (suspension) => {
    const vehicle = new FreeRoamVehiclePhysics({
      car: CARS[2], engine: ENGINES.v8, transmission: TRANSMISSIONS.automatic,
      suspension,
    })
    vehicle.teleport(5400, 1080, 0)
    vehicle.selectRange('D')
    drive(vehicle, 2.5, { throttle: 1 })
    return drive(vehicle, 1.75, { throttle: 0.6, steer: 1, handbrake: true })
  }
  const comfort = run(SUSPENSION_PRESETS.comfort)
  const sport = run(SUSPENSION_PRESETS.sport)
  assert.ok(Math.abs(comfort.slipAngle) > 0.2)
  assert.ok(Math.abs(sport.slipAngle) > 0.2)
  assert.ok(Math.abs(sport.bodyRoll) < Math.abs(comfort.bodyRoll))
  assert.ok(Number.isFinite(sport.suspensionTravel))
  const live = create()
  live.setSuspension({ spring: 0.9, damper: 0.2 })
  assert.deepEqual(live.snapshot().suspension, { spring: 0.9, damper: 0.2 })
})

test('countersteering arrests a handbrake drift and the car settles', () => {
  const vehicle = new FreeRoamVehiclePhysics({
    car: CARS[2], engine: ENGINES.v8, transmission: TRANSMISSIONS.automatic,
  })
  vehicle.teleport(5400, 1080, 0)
  vehicle.selectRange('D')
  drive(vehicle, 3, { throttle: 1 })
  const drift = drive(vehicle, 0.9, { throttle: 0.6, steer: 1, handbrake: true })
  const counter = drive(vehicle, 1, { throttle: 0.6, steer: -1 })
  const recovered = drive(vehicle, 2.5, { throttle: 0.5 })
  assert.ok(Math.abs(drift.slipAngle) > 0.3)
  assert.ok(Math.abs(counter.slipAngle) < Math.abs(drift.slipAngle))
  assert.ok(Math.abs(recovered.slipAngle) < 0.08)
})
