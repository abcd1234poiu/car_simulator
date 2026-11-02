import test from 'node:test'
import assert from 'node:assert/strict'
import { CARS } from '../src/constants/config.js'
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
