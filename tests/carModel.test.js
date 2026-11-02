import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { CARS, ENGINES, TRANSMISSIONS } from '../src/constants/config.js'
import { createCarModel } from '../src/engine/carModel.js'

// Canvas textures are created here but not rendered in Node.
globalThis.document = {
  createElement: () => ({
    width: 0,
    height: 0,
    getContext: () => ({
      createRadialGradient: () => ({ addColorStop() {} }),
      fillRect() {},
      fillText() {},
    }),
  }),
}

test('every configured body style builds a finite, detailed 3D car', () => {
  for (const car of CARS) {
    const model = createCarModel(car)
    assert.equal(model.wheels.length, 4, `${car.name}: four wheels`)
    assert.ok(model.group.children.length > 90, `${car.name}: model details`)
    model.group.traverse((object) => {
      assert.ok(object.position.toArray().every(Number.isFinite),
        `${car.name}: finite object position`)
      if (!object.isMesh) return
      const positions = object.geometry.attributes.position
      assert.ok(positions, `${car.name}: mesh has geometry`)
      for (let index = 0; index < positions.count; index += 1) {
        assert.ok(Number.isFinite(positions.getX(index)) &&
          Number.isFinite(positions.getY(index)) &&
          Number.isFinite(positions.getZ(index)), `${car.name}: finite mesh vertex`)
      }
    })
  }
})

test('Meridian GT has the reference-inspired front and side details', () => {
  const gt = createCarModel(CARS.find((car) => car.id === 'meridian-gt'))
  for (const detail of ['gt-grille', 'gt-grille-frame', 'gt-swept-headlight',
    'gt-side-vent']) {
    assert.ok(gt.group.getObjectByName(detail), `${detail} exists`)
  }
  for (const wheel of gt.wheels) {
    // The reference has fine multi-spoke alloys rather than five heavy bars.
    assert.ok(wheel.spin.children.length >= 20)
  }
})


test('GLB cars are wired to their supplied models', () => {
  const expected = [
    {
      id: 'bmw-m4-csl', engine: 's58-i6', transmission: 'dsg',
      file: 'bmw_m4csl.glb', minBytes: 1_000_000,
    },
    {
      id: 'civic-type-r', engine: 'k20c1-i4', transmission: 'manual',
      file: '2023_honda_civic_type_r.glb', minBytes: 1_000_000,
    },
    {
      id: 'perodua-myvi', engine: 'k3-ve-i4', transmission: 'manual',
      file: '2005_perodua_myvi.glb', minBytes: 500_000,
    },
  ]
  for (const entry of expected) {
    const car = CARS.find((candidate) => candidate.id === entry.id)
    assert.ok(car, `${entry.id} is in the catalogue`)
    assert.equal(car.defaultEngine, entry.engine)
    assert.ok(ENGINES[entry.engine], `${entry.engine} exists`)
    assert.equal(car.defaultTransmission, entry.transmission)
    assert.equal(TRANSMISSIONS[car.defaultTransmission].id, entry.transmission)
    assert.equal(car.modelUrl, `/models/${entry.file}`)
    assert.ok(car.modelLength > 3, `${entry.id} has a target length`)
    assert.ok(car.modelForward, `${entry.id} declares a forward axis`)
    assert.ok(car.modelCredit, `${entry.id} has model attribution`)
    const modelPath = fileURLToPath(new URL(`../public${car.modelUrl}`, import.meta.url))
    assert.ok(existsSync(modelPath), `${entry.file} is present in public/models`)
    assert.ok(statSync(modelPath).size > entry.minBytes, `${entry.file} is a real asset`)
  }
})


test('every fleet car has a rendered card thumbnail', () => {
  for (const car of CARS) {
    const thumbnail = fileURLToPath(
      new URL(`../public/images/cars/${car.id}.png`, import.meta.url),
    )
    assert.ok(existsSync(thumbnail), `${car.id} card thumbnail is present`)
    assert.ok(statSync(thumbnail).size > 10_000, `${car.id} card thumbnail is not empty`)
  }
})
