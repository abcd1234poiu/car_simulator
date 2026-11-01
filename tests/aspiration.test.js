import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ASPIRATIONS,
  CARS,
  ENGINES,
  TRANSMISSIONS,
  defaultAspirationForEngine,
  getAspiration,
} from '../src/constants/config.js'
import { VehiclePhysics } from '../src/engine/physics.js'
import { peakPowerHp, peakTorqueNm, performanceSummary } from '../src/engine/specs.js'

const create = (engineId = 'v6', aspirationId = 'na') =>
  new VehiclePhysics({
    car: CARS[3],
    engine: ENGINES[engineId],
    transmission: TRANSMISSIONS.automatic,
    aspiration: getAspiration(aspirationId),
  })

test('each engine reports its factory aspiration tune', () => {
  assert.equal(defaultAspirationForEngine(ENGINES.v6).id, 'na')
  assert.equal(defaultAspirationForEngine(ENGINES['inline-4']).id, 'turbo')
  assert.equal(defaultAspirationForEngine(ENGINES['twin-turbo-v6']).id, 'twin-turbo')
  assert.equal(defaultAspirationForEngine(ENGINES['supercharged-v8']).id, 'supercharger')
  assert.equal(defaultAspirationForEngine(ENGINES['vtec-i4']).id, 'vtec')
  assert.equal(Object.keys(ASPIRATIONS).length, 5)
})

test('the factory tune is the identity tune for existing performance', () => {
  for (const engine of Object.values(ENGINES)) {
    const factory = defaultAspirationForEngine(engine)
    assert.equal(peakPowerHp(engine, factory), peakPowerHp(engine))
    assert.equal(peakTorqueNm(engine, factory), peakTorqueNm(engine))
  }
})

test('aspiration selection changes both spec output and simulated acceleration', () => {
  const naPower = peakPowerHp(ENGINES.v6, getAspiration('na'))
  const turboPower = peakPowerHp(ENGINES.v6, getAspiration('turbo'))
  const twinPower = peakPowerHp(ENGINES.v6, getAspiration('twin-turbo'))
  assert.ok(turboPower > naPower)
  assert.ok(twinPower > turboPower)

  const naSummary = performanceSummary(CARS[3], ENGINES.v6, TRANSMISSIONS.automatic, getAspiration('na'))
  const twinSummary = performanceSummary(CARS[3], ENGINES.v6, TRANSMISSIONS.automatic, getAspiration('twin-turbo'))
  assert.ok(twinSummary.powerHp > naSummary.powerHp)
  assert.ok(twinSummary.topSpeedKmh > naSummary.topSpeedKmh)

  const run = (aspirationId) => {
    const vehicle = create('v6', aspirationId)
    for (let i = 0; i < 200; i += 1) vehicle.update(0.05, { throttle: 1 })
    return vehicle.speed
  }
  assert.ok(run('twin-turbo') > run('na'))
})

test('a non-factory tune can also de-tune a forced-induction engine', () => {
  const factoryPower = peakPowerHp(ENGINES['inline-4'], getAspiration('turbo'))
  const naPower = peakPowerHp(ENGINES['inline-4'], getAspiration('na'))
  assert.ok(naPower < factoryPower)

  const vehicle = create('inline-4', 'na')
  vehicle.update(0.05, { throttle: 0.6 })
  assert.equal(vehicle.snapshot().aspiration, 'na')
  assert.equal(vehicle.snapshot().baseAspiration, 'turbo')
})

test('free roam inherits the selected aspiration', async () => {
  const { FreeRoamVehiclePhysics } = await import('../src/engine/freeRoamPhysics.js')
  const vehicle = new FreeRoamVehiclePhysics({
    car: CARS[3],
    engine: ENGINES.v6,
    transmission: TRANSMISSIONS.automatic,
    aspiration: getAspiration('supercharger'),
  })
  assert.equal(vehicle.snapshot().aspiration, 'supercharger')
  vehicle.selectRange('D')
  for (let i = 0; i < 100; i += 1) vehicle.update(0.05, { throttle: 1 })
  assert.ok(vehicle.snapshot().boost > 0)
})
