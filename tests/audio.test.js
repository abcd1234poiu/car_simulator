import test from 'node:test'
import assert from 'node:assert/strict'

globalThis.sampleRate = 48000
globalThis.AudioWorkletProcessor = class {
  constructor() { this.port = { onmessage: null } }
}
let Processor
globalThis.registerProcessor = (name, implementation) => {
  assert.equal(name, 'combustion-engine')
  Processor = implementation
}
await import('../src/engine/combustion-worklet.js')

function render(profile, cylinders, rpm = 3000, throttle = 0.6) {
  const processor = new Processor()
  processor.port.onmessage({ data: { type: 'engine', profile, cylinders, maxRpm: 7500, volume: 1 } })
  let sumSquares = 0
  let peak = 0
  let count = 0
  for (let block = 0; block < 600; block += 1) {
    const output = new Float32Array(128)
    processor.process([], [[output]], {
      rpm: [rpm], throttle: [throttle], boost: [0.8],
    })
    if (block < 50) continue
    for (const sample of output) {
      assert.ok(Number.isFinite(sample), 'worklet produced a non-finite sample')
      peak = Math.max(peak, Math.abs(sample))
      sumSquares += sample ** 2
      count += 1
    }
  }
  return { rms: Math.sqrt(sumSquares / count), peak }
}

test('combustion voices stay bounded and quiet engine is quieter than performance engines', () => {
  const voices = [
    ['quiet', 4], ['smooth', 6], ['muscle', 8], ['turbo', 4],
    ['twin-turbo', 6], ['supercharged', 8], ['vtec', 4],
  ]
  const levels = Object.fromEntries(voices.map(([profile, cylinders]) =>
    [profile, render(profile, cylinders)]))
  for (const [profile, level] of Object.entries(levels)) {
    assert.ok(level.rms > 0.005, `${profile} is silent`)
    assert.ok(level.peak < 0.8, `${profile} clips`)
  }
  assert.ok(levels.quiet.rms < levels.muscle.rms)
  assert.ok(levels.quiet.rms < levels['twin-turbo'].rms)
  assert.notEqual(levels.turbo.rms.toFixed(3), levels['twin-turbo'].rms.toFixed(3))
})

test('turbo release and gear change create short transient effects', () => {
  const processor = new Processor()
  processor.port.onmessage({ data: { type: 'engine', profile: 'turbo', cylinders: 4, maxRpm: 7200, volume: 1 } })
  const output = new Float32Array(128)
  processor.process([], [[output]], { rpm: [4000], throttle: [0.8], boost: [0.8] })
  processor.process([], [[output]], { rpm: [4000], throttle: [0.1], boost: [0.8] })
  assert.ok(processor.wastegate > 0)
  processor.port.onmessage({ data: { type: 'shift', direction: 'up' } })
  processor.process([], [[output]], { rpm: [4000], throttle: [0.8], boost: [0.8] })
  assert.ok(processor.shiftPop > 0 && processor.shiftPop < 1)
})
