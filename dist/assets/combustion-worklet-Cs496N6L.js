/* global AudioWorkletProcessor, registerProcessor, sampleRate */

// Combustion pulses excite two exhaust resonances. Unlike a pitched oscillator,
// every firing can vary slightly in strength, giving each layout its own cadence.
const VOICES = {
  quiet: { pipe: [130, 370], mix: [0.48, 0.18], pulse: 0.12, air: 0.08, whine: 0, grit: 0.05, level: 0.4, pattern: [1, 0.96, 1, 0.94] },
  smooth: { pipe: [155, 480], mix: [0.46, 0.3], pulse: 0.12, air: 0.14, whine: 0, grit: 0.1, level: 0.72, pattern: [1, 0.94, 1.03, 0.96, 1.01, 0.95] },
  muscle: { pipe: [92, 265], mix: [0.8, 0.31], pulse: 0.23, air: 0.17, whine: 0, grit: 0.3, level: 0.9, pattern: [1, 0.61, 0.92, 0.7, 1.03, 0.62, 0.88, 0.73] },
  turbo: { pipe: [175, 670], mix: [0.45, 0.4], pulse: 0.13, air: 0.26, whine: 0.055, grit: 0.17, level: 0.78, pattern: [1, 0.9, 0.99, 0.88] },
  'twin-turbo': { pipe: [165, 720], mix: [0.49, 0.43], pulse: 0.15, air: 0.32, whine: 0.075, grit: 0.2, level: 0.82, pattern: [1, 0.91, 1.04, 0.94, 0.98, 0.92] },
  supercharged: { pipe: [105, 380], mix: [0.72, 0.34], pulse: 0.21, air: 0.22, whine: 0.13, grit: 0.25, level: 0.94, pattern: [1, 0.66, 0.95, 0.72, 1.03, 0.63, 0.92, 0.7] },
  vtec: { pipe: [250, 930], mix: [0.35, 0.51], pulse: 0.09, air: 0.36, whine: 0, grit: 0.12, level: 0.75, pattern: [1, 0.94, 1.01, 0.93] },
}

const TAU = Math.PI * 2
const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

class CombustionProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'rpm', defaultValue: 800, minValue: 300, maxValue: 12000, automationRate: 'a-rate' },
      { name: 'throttle', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'a-rate' },
      { name: 'boost', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'limiter', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
    ]
  }

  constructor() {
    super()
    this.voice = VOICES.smooth
    this.cylinders = 6
    this.maxRpm = 7500
    this.volume = 0.9
    this.firingPhase = 0
    this.firingIndex = 0
    this.pulse = 0
    this.low1 = 0
    this.band1 = 0
    this.low2 = 0
    this.band2 = 0
    this.airLow = 0
    this.airHigh = 0
    this.whinePhase = 0
    this.shiftPop = 0
    this.wastegate = 0
    this.previousThrottle = 0
    this.limiterPhase = 0
    this.randomState = 0x72c38a91
    this.port.onmessage = ({ data }) => {
      if (data.type === 'engine') {
        this.voice = VOICES[data.profile] ?? VOICES.smooth
        this.cylinders = data.cylinders
        this.maxRpm = data.maxRpm
        this.volume = data.volume
        this.firingIndex = 0
      } else if (data.type === 'shift') {
        this.shiftPop = data.direction === 'up' ? 1 : 0.55
      }
    }
  }

  noise() {
    let x = this.randomState
    x ^= x << 13
    x ^= x >>> 17
    x ^= x << 5
    this.randomState = x
    return x / 0x80000000
  }

  process(_inputs, outputs, parameters) {
    const channels = outputs[0]
    if (!channels?.length) return true
    const output = channels[0]
    const voice = this.voice
    const f1 = clamp(2 * Math.sin(Math.PI * voice.pipe[0] / sampleRate), 0, 0.95)
    const f2 = clamp(2 * Math.sin(Math.PI * voice.pipe[1] / sampleRate), 0, 0.95)
    const pulseDecay = Math.exp(-1 / (sampleRate * 0.0045))
    const popDecay = Math.exp(-1 / (sampleRate * 0.018))
    const wasteDecay = Math.exp(-1 / (sampleRate * 0.22))

    for (let i = 0; i < output.length; i += 1) {
      const rpm = parameters.rpm.length === 1 ? parameters.rpm[0] : parameters.rpm[i]
      const throttle = parameters.throttle.length === 1 ? parameters.throttle[0] : parameters.throttle[i]
      const boost = parameters.boost.length === 1 ? parameters.boost[0] : parameters.boost[i]
      const limiter = parameters.limiter?.length === 1 ? parameters.limiter[0] :
        parameters.limiter?.[i] ?? 0
      const rev = clamp(rpm / this.maxRpm, 0, 1)
      const highCam = voice === VOICES.vtec ? clamp((rpm - 5300) / 700, 0, 1) : 0
      const load = clamp(throttle, 0, 1)
      this.limiterPhase = limiter > 0.5
        ? (this.limiterPhase + 13 / sampleRate) % 1 : 0
      const fuelCut = limiter > 0.5 && this.limiterPhase < 0.3 ? 0.18 : 1

      if (this.previousThrottle > 0.48 && load < 0.25 && boost > 0.3 &&
          (voice === VOICES.turbo || voice === VOICES['twin-turbo'])) this.wastegate = 1
      this.previousThrottle = load

      this.firingPhase += (rpm / 60) * (this.cylinders / 2) / sampleRate
      if (this.firingPhase >= 1) {
        this.firingPhase -= 1
        const strength = voice.pattern[this.firingIndex % voice.pattern.length]
        this.firingIndex += 1
        this.pulse += strength * (0.55 + load * 0.55) * (0.96 + this.noise() * 0.04)
      }
      this.pulse *= pulseDecay

      // Two damped pipe resonances and a small direct exhaust component.
      const excitation = this.pulse * (1 + voice.grit * this.noise())
      this.low1 += f1 * this.band1
      this.band1 += f1 * (excitation - this.low1 - 0.46 * this.band1)
      this.low2 += f2 * this.band2
      this.band2 += f2 * (excitation - this.low2 - 0.68 * this.band2)
      const exhaust = this.band1 * voice.mix[0] +
        this.band2 * voice.mix[1] * (1 + highCam * 0.8) +
        (excitation - this.low1) * voice.pulse

      const white = this.noise()
      this.airLow += 0.32 * (white - this.airLow)
      this.airHigh += 0.018 * (white - this.airHigh)
      const intake = (this.airLow - this.airHigh) * voice.air *
        (0.08 + load * (0.35 + rev * 0.5 + highCam * 0.8))

      const forced = voice.whine > 0
      const whineHz = voice === VOICES.supercharged ? 220 + rpm * 0.2 : 550 + rpm * 0.11
      this.whinePhase += TAU * whineHz / sampleRate
      if (this.whinePhase >= TAU) this.whinePhase -= TAU
      const whine = forced ? Math.sin(this.whinePhase) * voice.whine *
        (voice === VOICES.supercharged ? rev * load : boost * load) : 0

      const shift = this.shiftPop * (this.noise() * 0.3 + this.pulse * 0.18)
      const waste = this.wastegate * (this.airLow - this.airHigh) * 0.28
      this.shiftPop *= popDecay
      this.wastegate *= wasteDecay

      const raw = exhaust * (0.7 + load * 0.65) * fuelCut + intake + whine + shift + waste
      const sample = Math.tanh(raw * (1.35 + voice.grit + highCam * 0.3)) *
        0.38 * voice.level * this.volume
      output[i] = sample
      for (let channel = 1; channel < channels.length; channel += 1) channels[channel][i] = sample
    }
    return true
  }
}

registerProcessor('combustion-engine', CombustionProcessor)
