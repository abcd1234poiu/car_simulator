import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ALL_TRANSMISSIONS,
  ASPIRATIONS,
  CARS,
  ENGINES,
  TRANSMISSIONS,
  defaultAspirationForEngine,
} from '../src/constants/config.js'
import { performanceSummary } from '../src/engine/specs.js'

test('every car exposes every transmission model', () => {
  const all = Object.keys(TRANSMISSIONS)
  assert.deepEqual([...ALL_TRANSMISSIONS], all)
  for (const car of CARS) {
    assert.deepEqual([...car.transmissions], all, car.id)
    assert.ok(car.transmissions.includes(car.defaultTransmission), car.id)
    assert.ok(car.fuelCapacity > 0, `${car.id} has a fuel tank`)
  }
})

test('every car can be configured with every engine, aspiration and gearbox', () => {
  for (const car of CARS) {
    for (const engineId of car.engines) {
      const engine = ENGINES[engineId]
      for (const aspirationId of Object.keys(ASPIRATIONS)) {
        for (const transmissionId of ALL_TRANSMISSIONS) {
          const result = performanceSummary(
            car,
            engine,
            TRANSMISSIONS[transmissionId],
            ASPIRATIONS[aspirationId],
          )
          assert.ok(result.powerHp > 0, `${car.id}/${engineId}/${aspirationId}/${transmissionId}`)
          assert.ok(result.topSpeedKmh > 20, `${car.id}/${engineId}/${aspirationId}/${transmissionId}`)
        }
      }
    }
  }
})

test('factory aspiration stays available for every engine', () => {
  for (const car of CARS) {
    for (const engineId of car.engines) {
      const factory = defaultAspirationForEngine(ENGINES[engineId])
      assert.ok(ASPIRATIONS[factory.id], `${engineId} factory aspiration`)
    }
  }
})
