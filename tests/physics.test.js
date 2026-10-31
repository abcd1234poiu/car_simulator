import test from 'node:test'
import assert from 'node:assert/strict'
import { CARS, ENGINES, TRANSMISSIONS } from '../src/constants/config.js'
import { VehiclePhysics } from '../src/engine/physics.js'
import { performanceSummary } from '../src/engine/specs.js'
import { InputController } from '../src/engine/input.js'
import { pedalLevelAt } from '../src/engine/pedals.js'

const create = (engine = 'inline-4', transmission = 'manual', car = CARS[0]) =>
  new VehiclePhysics({ car, engine: ENGINES[engine], transmission: TRANSMISSIONS[transmission] })

test('every offered engine and gearbox produces a finite performance estimate', () => {
  for (const car of CARS) {
    for (const engineId of car.engines) {
      for (const gearboxId of car.transmissions) {
        const result = performanceSummary(car, ENGINES[engineId], TRANSMISSIONS[gearboxId])
        assert.ok(result.zeroTo100 > 0, `${car.id}/${engineId}/${gearboxId}`)
        assert.ok(result.topSpeedKmh > 30, `${car.id}/${engineId}/${gearboxId}`)
      }
    }
  }
})

test('manual transmission needs the clutch and clutch disconnects drive', () => {
  const car = create()
  assert.equal(car.shiftUp().ok, false)
  for (let i = 0; i < 20; i += 1) car.update(0.05, { clutch: 1 })
  assert.equal(car.shiftUp().ok, true)
  assert.equal(car.gear, 2)
  car.reset()
  for (let i = 0; i < 40; i += 1) car.update(0.05, { throttle: 1, clutch: 1 })
  assert.equal(car.speed, 0)
})

test('automatic gearbox offers D and M with manual shifts only in M', () => {
  const car = create('inline-4', 'automatic')
  assert.equal(car.snapshot().gearboxMode, 'D')
  assert.equal(car.shiftUp().ok, false)
  assert.equal(car.setGearboxMode('M'), true)
  assert.equal(car.shiftUp().ok, true)
  assert.equal(car.snapshot().gear, 2)
  assert.equal(car.setGearboxMode('D'), true)
})

test('CVT varies its ratio in D and allows virtual manual gears', () => {
  const car = create('eco-i4', 'cvt', CARS[3])
  const firstRatio = car.cvtRatio
  for (let i = 0; i < 250; i += 1) car.update(0.05, { throttle: 1 })
  assert.ok(car.cvtRatio < firstRatio)
  assert.equal(car.setGearboxMode('M'), true)
  const gear = car.gear
  const result = gear > 1 ? car.shiftDown() : car.shiftUp()
  assert.equal(result.ok, true)
  assert.notEqual(car.gear, gear)
})

test('drive modes and traction control appear in telemetry', () => {
  const car = create()
  assert.equal(car.setDriveMode('sport'), true)
  car.setTractionControl(false)
  const state = car.snapshot()
  assert.equal(state.driveMode, 'sport')
  assert.equal(state.tractionControl, false)
  assert.equal(car.setDriveMode('invalid'), false)
})

test('on-screen pedal positions produce proportional input instead of a binary press', () => {
  assert.equal(pedalLevelAt(100, 100, 100), 1)
  assert.equal(pedalLevelAt(150, 100, 100), 0.5)
  assert.equal(pedalLevelAt(200, 100, 100), 0.05)
  const input = new InputController()
  input.setTouch('throttle', 0.35)
  input.setTouch('brake', 0.6)
  for (let i = 0; i < 30; i += 1) input.update(0.05)
  assert.ok(Math.abs(input.throttle - 0.35) < 0.01)
  assert.ok(Math.abs(input.brake - 0.6) < 0.01)
  input.setTouch('throttle', 0)
  for (let i = 0; i < 30; i += 1) input.update(0.05)
  assert.ok(input.throttle < 0.01)
})

test('PDK skips directly to a safe kickdown gear on full throttle', () => {
  const car = create('twin-turbo-v6', 'pdk')
  car.speed = 28
  car.gear = 7
  car.rpm = car.rpmForSpeed(car.speed)
  car.update(0.05, { throttle: 1 })
  assert.ok(car.gear <= 4, `Expected multi-gear kickdown, got ${car.gear}`)
  assert.equal(car.snapshot().shiftEvent, 'down')
  assert.ok(car.rpmForSpeed(car.speed) < car.engine.redline)
  const kickedGear = car.gear
  for (let i = 0; i < 10; i += 1) car.update(0.05, { throttle: 1 })
  assert.equal(car.gear, kickedGear, 'Kickdown should not be followed by an immediate upshift')
})

test('Sport mode requests a direct downshift while PDK is in D, but not M', () => {
  const car = create('twin-turbo-v6', 'pdk')
  car.speed = 28
  car.gear = 7
  car.rpm = car.rpmForSpeed(car.speed)
  car.setDriveMode('sport')
  car.update(0.05, { throttle: 0 })
  assert.ok(car.gear <= 4)

  car.reset()
  car.speed = 28
  car.gear = 7
  car.setGearboxMode('M')
  car.setDriveMode('sport')
  car.update(0.05, { throttle: 1 })
  assert.equal(car.gear, 7)
})

test('D mode upshifts at lower RPM under a held light pedal and keeps shifting as speed builds', () => {
  for (const gearbox of ['automatic', 'dsg', 'pdk']) {
    const light = create('inline-4', gearbox)
    const full = create('inline-4', gearbox)
    let lightFirstShift = null
    let fullFirstShift = null
    let lightDownshifts = 0
    for (let i = 0; i < 1600; i += 1) {
      const lightState = light.update(0.05, { throttle: 0.25 })
      const fullState = full.update(0.05, { throttle: 1 })
      if (lightState.shiftEvent === 'up' && lightFirstShift === null) lightFirstShift = lightState.rpm
      if (fullState.shiftEvent === 'up' && fullFirstShift === null) fullFirstShift = fullState.rpm
      if (lightState.shiftEvent === 'down') lightDownshifts += 1
    }
    assert.ok(lightFirstShift < fullFirstShift - 1500, gearbox)
    assert.ok(light.gear >= 5, `${gearbox} stayed in ${light.gear} under a held pedal`)
    assert.equal(lightDownshifts, 0, `${gearbox} hunted between gears`)
  }
})

test('torque-converter, DSG, and PDK have distinct shift durations and torque transfer', () => {
  const boxes = ['automatic', 'dsg', 'pdk'].map((id) => {
    const car = create('inline-4', id)
    car.setGearboxMode('M')
    car.speed = 15
    car.rpm = car.rpmForSpeed(car.speed)
    assert.equal(car.shiftUp().ok, true)
    return car
  })
  const [automatic, dsg, pdk] = boxes
  assert.ok(automatic.shiftTimer > dsg.shiftTimer)
  assert.ok(dsg.shiftTimer > pdk.shiftTimer)
  assert.ok(automatic.shiftTransfer < dsg.shiftTransfer)
  assert.ok(dsg.shiftTransfer < pdk.shiftTransfer)
  for (const car of boxes) {
    const firstFrame = car.update(0.05, { throttle: 0.7 })
    assert.equal(firstFrame.shiftEvent, 'up')
    assert.equal(firstFrame.shiftActive, true)
    for (let i = 0; i < 15; i += 1) car.update(0.05, { throttle: 0.7 })
    assert.equal(car.snapshot().shiftActive, false)
  }
})

test('DSG performs a safe multi-gear kickdown without immediately upshifting', () => {
  const car = create('inline-4', 'dsg')
  car.speed = 28
  car.gear = 7
  car.rpm = car.rpmForSpeed(car.speed)
  car.update(0.05, { throttle: 0.9 })
  assert.ok(car.gear <= 4)
  assert.ok(car.rpmForSpeed(car.speed) < car.engine.redline * 0.83)
  const gear = car.gear
  for (let i = 0; i < 12; i += 1) car.update(0.05, { throttle: 0.9 })
  assert.equal(car.gear, gear)
})

test('dual-clutch boxes shift faster when the next gear was preselected', () => {
  for (const id of ['dsg', 'pdk']) {
    const prepared = create('inline-4', id)
    const unprepared = create('inline-4', id)
    for (const car of [prepared, unprepared]) {
      car.setGearboxMode('M')
      car.gear = 3
      car.speed = 22
    }
    prepared.preselectedGear = 4
    unprepared.preselectedGear = 2
    assert.equal(prepared.shiftUp().ok, true)
    assert.equal(unprepared.shiftUp().ok, true)
    assert.ok(prepared.shiftTimer < unprepared.shiftTimer, id)
  }
})

test('CVT varies ratio continuously in D without discrete shift events', () => {
  const car = create('eco-i4', 'cvt', CARS[3])
  const ratios = []
  let shifts = 0
  for (let i = 0; i < 600; i += 1) {
    const state = car.update(0.05, { throttle: 0.7 })
    if (state.shiftEvent) shifts += 1
    if (state.speedKmh > 30 && state.speedKmh < 100) ratios.push(car.cvtRatio)
  }
  assert.equal(shifts, 0)
  assert.ok(new Set(ratios.map((ratio) => ratio.toFixed(2))).size > 15)
})

test('D mode downshifts under braking without selecting first gear too early', () => {
  const car = create('inline-4', 'dsg')
  car.speed = 25
  car.gear = 5
  car.rpm = car.rpmForSpeed(car.speed)
  let firstGearSpeed = null
  for (let i = 0; i < 180; i += 1) {
    const state = car.update(0.05, { brake: 0.5 })
    if (state.gear === 1 && firstGearSpeed === null) firstGearSpeed = state.speedKmh
  }
  assert.ok(firstGearSpeed !== null)
  assert.ok(firstGearSpeed < 20)
})

test('automated M mode holds the requested gear at speed but protects a stop', () => {
  const car = create('inline-4', 'pdk')
  car.setGearboxMode('M')
  car.gear = 2
  car.speed = 15
  car.rpm = car.rpmForSpeed(car.speed)
  for (let i = 0; i < 300; i += 1) car.update(0.05, { throttle: 1 })
  assert.equal(car.gear, 2)
  car.speed = 0
  car.gear = 7
  car.shiftCooldown = 0
  for (let i = 0; i < 80; i += 1) car.update(0.05, { brake: 1 })
  assert.equal(car.gear, 1)
})

test('converter and CVT creep gently, while a manual car remains stopped', () => {
  for (const id of ['automatic', 'dsg', 'pdk', 'cvt']) {
    const car = create('inline-4', id)
    for (let i = 0; i < 300; i += 1) car.update(0.05)
    assert.ok(car.speed > 0, id)
    assert.ok(car.speed * 3.6 < 9, id)
  }
  const manual = create()
  for (let i = 0; i < 300; i += 1) manual.update(0.05)
  assert.equal(manual.speed, 0)
})

test('automatic ranges provide reverse, neutral free-revving, and safe direction changes', () => {
  for (const id of ['automatic', 'cvt', 'dsg', 'pdk']) {
    const car = create('eco-i4', id)
    assert.equal(car.selectRange('R').ok, false, `${id}: brake interlock`)
    for (let i = 0; i < 15; i += 1) car.update(0.05, { brake: 1 })
    assert.equal(car.selectRange('R').ok, true, id)
    for (let i = 0; i < 60; i += 1) car.update(0.05, { throttle: 0.6 })
    assert.ok(car.speed < -1, `${id}: should actually reverse`)
    assert.ok(car.distance < 0, `${id}: road position should move backward`)
    assert.ok(car.snapshot().speedKmh > 0 && car.snapshot().gearRatio < 0)
    assert.equal(car.selectRange('D').ok, false, `${id}: cannot change direction while rolling`)
    assert.equal(car.selectRange('N').ok, true, `${id}: neutral while rolling`)
    const neutralSpeed = car.speed
    for (let i = 0; i < 10; i += 1) car.update(0.05, { throttle: 1 })
    assert.ok(car.speed > neutralSpeed, `${id}: neutral should coast toward a stop, not accelerate backward`)
    assert.equal(car.snapshot().gearRatio, 0)
    assert.ok(car.rpm > car.engine.idleRpm * 2, `${id}: neutral should free-rev`)
    for (let i = 0; i < 100; i += 1) car.update(0.05, { brake: 1 })
    assert.equal(car.speed, 0)
    assert.equal(car.selectRange('D').ok, true)
    assert.ok(car.gear > 0)
    assert.ok(car.snapshot().distanceKm > 0, `${id}: odometer includes reverse travel`)
  }
})

test('manual gearbox shifts through reverse, neutral and first with the clutch', () => {
  const car = create('eco-i4', 'manual')
  assert.equal(car.selectRange('N').ok, false)
  for (let i = 0; i < 20; i += 1) car.update(0.05, { clutch: 1 })
  assert.equal(car.shiftDown().ok, true)
  assert.equal(car.gear, 0)
  assert.equal(car.shiftDown().ok, true)
  assert.equal(car.gear, -1)
  assert.equal(car.shiftUp().ok, true)
  assert.equal(car.gear, 0)
  assert.equal(car.shiftUp().ok, true)
  assert.equal(car.gear, 1)
})

test('manual reverse drives backward only after the clutch is released', () => {
  const car = create('eco-i4', 'manual')
  for (let i = 0; i < 20; i += 1) car.update(0.05, { clutch: 1 })
  assert.equal(car.selectRange('R').ok, true)
  for (let i = 0; i < 30; i += 1) car.update(0.05, { clutch: 1, throttle: 0.7 })
  assert.equal(car.speed, 0)
  for (let i = 0; i < 80; i += 1) car.update(0.05, { throttle: 0.7 })
  assert.ok(car.speed < 0)
  assert.ok(car.snapshot().speedKmh > 0)
  assert.ok(car.distance < 0)
})

test('range keyboard shortcuts invoke reverse, neutral and drive selectors', () => {
  const input = new InputController()
  const selected = []
  input.onRange = (range) => selected.push(range)
  for (const code of ['KeyV', 'KeyN', 'KeyF']) {
    input.handleKeyDown({ code, repeat: false, preventDefault() {} })
  }
  assert.deepEqual(selected, ['R', 'N', 'D'])
})
