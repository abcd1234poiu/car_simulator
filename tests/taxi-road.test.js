import test from 'node:test'
import assert from 'node:assert/strict'
import { roadCenter, roadHeading, roadLocalPoint } from '../src/taxi/road.js'

test('generated roads vary by shift while remaining deterministic', () => {
  assert.equal(roadCenter(420, 123), roadCenter(420, 123))
  assert.notEqual(roadCenter(420, 123), roadCenter(420, 456))
  const samples = [0, 160, 320, 480, 640].map((distance) => roadCenter(distance, 123))
  assert.ok(new Set(samples.map((value) => value.toFixed(2))).size > 3)
})

test('road bends connect smoothly and stay navigable', () => {
  for (let distance = 160; distance <= 1600; distance += 160) {
    assert.ok(Math.abs(roadCenter(distance - 0.01, 77) - roadCenter(distance + 0.01, 77)) < 0.02)
  }
  for (let distance = 0; distance <= 5000; distance += 25) {
    assert.ok(Math.abs(roadHeading(distance, 77)) < 0.4)
  }
})

test('pickup and drop-off markers use the same road coordinate transform', () => {
  const car = roadLocalPoint(200, 200, 0, 92)
  const curb = roadLocalPoint(200, 200, -5.9, 92)
  assert.ok(Math.abs(car.x) < 0.001 && Math.abs(car.z) < 0.001)
  assert.ok(Math.abs(curb.x + 5.9) < 0.001)
  assert.ok(Math.abs(curb.z) < 0.001)
})
