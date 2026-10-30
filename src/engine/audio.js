/**
 * Synthesized engine audio built with the Web Audio API.
 * No samples or copyrighted recordings — the note is generated live from RPM.
 */

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

function createNoiseBuffer(context, seconds = 2) {
  const length = Math.floor(context.sampleRate * seconds)
  const buffer = context.createBuffer(1, length, context.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i += 1) {
    data[i] = Math.random() * 2 - 1
  }
  return buffer
}

function createDriveCurve(amount = 1.5) {
  const samples = 44100
  const curve = new Float32Array(samples)
  const k = amount * 30
  for (let i = 0; i < samples; i += 1) {
    const x = (i * 2) / samples - 1
    curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x))
  }
  return curve
}

export class EngineAudio {
  constructor() {
    this.context = null
    this.nodes = null
    this.engine = null
    this.started = false
    this.paused = false
    this.muted = false
    this.previewFrame = null
    this.volume = 0.8
    this.workletNode = null
    this.lastState = null
  }

  ensureContext() {
    if (this.context) return this.context
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return null

    const ctx = new AudioContextClass()

    const master = ctx.createGain()
    master.gain.value = 0

    const fallbackGain = ctx.createGain()
    fallbackGain.gain.value = 1
    fallbackGain.connect(master)
    const workletGain = ctx.createGain()
    workletGain.gain.value = 0
    workletGain.connect(master)

    const compressor = ctx.createDynamicsCompressor()
    compressor.threshold.value = -20
    compressor.knee.value = 24
    compressor.ratio.value = 5
    compressor.attack.value = 0.004
    compressor.release.value = 0.25

    master.connect(compressor)
    compressor.connect(ctx.destination)

    const engineGain = ctx.createGain()
    engineGain.gain.value = 0

    const drive = ctx.createWaveShaper()
    drive.curve = createDriveCurve(1.6)
    drive.oversample = '2x'

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 900
    filter.Q.value = 1.4

    const tremolo = ctx.createGain()
    tremolo.gain.value = 1

    engineGain.connect(drive)
    drive.connect(filter)
    filter.connect(tremolo)
    tremolo.connect(fallbackGain)

    const osc1 = ctx.createOscillator()
    osc1.type = 'sawtooth'
    const osc1Gain = ctx.createGain()
    osc1Gain.gain.value = 0.5

    const osc2 = ctx.createOscillator()
    osc2.type = 'square'
    osc2.detune.value = 8
    const osc2Gain = ctx.createGain()
    osc2Gain.gain.value = 0.16

    const sub = ctx.createOscillator()
    sub.type = 'sine'
    const subGain = ctx.createGain()
    subGain.gain.value = 0.34

    osc1.connect(osc1Gain)
    osc1Gain.connect(engineGain)
    osc2.connect(osc2Gain)
    osc2Gain.connect(engineGain)
    sub.connect(subGain)
    subGain.connect(engineGain)

    const whine = ctx.createOscillator()
    whine.type = 'sine'
    const whineGain = ctx.createGain()
    whineGain.gain.value = 0
    whine.connect(whineGain)
    whineGain.connect(fallbackGain)

    const lfo = ctx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 24
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 0.06
    lfo.connect(lfoGain)
    lfoGain.connect(tremolo.gain)

    const noise = ctx.createBufferSource()
    noise.buffer = createNoiseBuffer(ctx, 2.5)
    noise.loop = true
    const noiseFilter = ctx.createBiquadFilter()
    noiseFilter.type = 'bandpass'
    noiseFilter.frequency.value = 420
    noiseFilter.Q.value = 0.9
    const noiseGain = ctx.createGain()
    noiseGain.gain.value = 0
    noise.connect(noiseFilter)
    noiseFilter.connect(noiseGain)
    noiseGain.connect(fallbackGain)

    osc1.start()
    osc2.start()
    sub.start()
    whine.start()
    lfo.start()
    noise.start()

    this.context = ctx
    this.nodes = {
      master,
      fallbackGain,
      workletGain,
      engineGain,
      drive,
      filter,
      tremolo,
      lfo,
      lfoGain,
      osc1,
      osc2,
      sub,
      noiseFilter,
      noiseGain,
      osc2Gain,
      subGain,
      whine,
      whineGain,
    }
    this.applyMasterGain(0)
    this.loadWorklet(ctx)

    return ctx
  }

  async loadWorklet(ctx) {
    if (!ctx.audioWorklet || !window.AudioWorkletNode) return
    try {
      await ctx.audioWorklet.addModule(new URL('./combustion-worklet.js', import.meta.url))
      if (this.context !== ctx || !this.nodes) return
      const node = new window.AudioWorkletNode(ctx, 'combustion-engine', {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [1],
      })
      node.connect(this.nodes.workletGain)
      this.workletNode = node
      this.configureVoice()
      if (this.lastState) this.update(this.lastState)
      const now = ctx.currentTime
      this.nodes.workletGain.gain.setTargetAtTime(1, now, 0.1)
      this.nodes.fallbackGain.gain.setTargetAtTime(0, now, 0.1)
    } catch (error) {
      console.warn('Combustion audio unavailable; using oscillator fallback', error)
    }
  }

  applyMasterGain(value, timeConstant = 0.12) {
    if (!this.context || !this.nodes) return
    const now = this.context.currentTime
    const target = this.muted ? 0 : value * this.volume
    this.nodes.master.gain.cancelScheduledValues(now)
    this.nodes.master.gain.setTargetAtTime(target, now, timeConstant)
  }

  setEngine(engine) {
    this.engine = engine
    this.configureVoice()
  }

  configureVoice() {
    if (!this.nodes || !this.engine) return
    const { sound } = this.engine
    const profile = sound.profile
    this.nodes.osc1.type = profile === 'quiet' || profile === 'smooth' ? 'triangle' :
      profile === 'muscle' || profile === 'supercharged' ? 'square' : 'sawtooth'
    this.nodes.osc2.type = profile === 'quiet' ? 'sine' :
      profile === 'vtec' || profile === 'twin-turbo' ? 'sawtooth' : 'triangle'
    this.nodes.drive.curve = createDriveCurve(sound.drive)
    this.workletNode?.port.postMessage({
      type: 'engine', profile, cylinders: this.engine.cylinders,
      maxRpm: this.engine.maxRpm, volume: sound.volume,
    })
  }

  start(engine) {
    this.engine = engine ?? this.engine
    if (!this.engine) return false
    const ctx = this.ensureContext()
    if (!ctx) return false
    this.configureVoice()

    this.stopPreview()
    this.started = true
    this.paused = false
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})

    this.update({ rpm: this.engine.idleRpm, throttle: 0.18 })
    this.applyMasterGain(0.75, 0.35)
    return true
  }

  stop() {
    this.stopPreview()
    this.started = false
    this.applyMasterGain(0, 0.15)
  }

  setMuted(muted) {
    this.muted = muted
    this.applyMasterGain(this.started ? 0.75 : 0)
  }

  setPaused(paused) {
    if (!this.context || this.paused === paused) return
    this.paused = paused
    if (paused) {
      this.context.suspend().catch(() => {})
    } else {
      this.context.resume().catch(() => {})
    }
  }

  update({ rpm = 900, throttle = 0, boost = 0, limiter = false, shiftEvent = null }) {
    if (!this.started || !this.context || !this.engine || !this.nodes) return
    this.lastState = { rpm, throttle, boost, limiter }
    const nodes = this.nodes
    const now = this.context.currentTime
    const sound = this.engine.sound

    if (this.workletNode) {
      this.workletNode.parameters.get('rpm').setTargetAtTime(clamp(rpm, 300, 12000), now, 0.025)
      this.workletNode.parameters.get('throttle').setTargetAtTime(clamp(throttle, 0, 1), now, 0.035)
      this.workletNode.parameters.get('boost').setTargetAtTime(clamp(boost, 0, 1), now, 0.055)
      this.workletNode.parameters.get('limiter').setTargetAtTime(limiter ? 1 : 0, now, 0.012)
      if (shiftEvent) this.workletNode.port.postMessage({ type: 'shift', direction: shiftEvent })
    }

    const safeRpm = clamp(rpm, 400, 12000)
    const firing = (safeRpm / 60) * (this.engine.cylinders / 2)
    const base = clamp(firing, 18, 500)
    const load = clamp(throttle, 0, 1)
    const revRatio = safeRpm / this.engine.maxRpm

    nodes.osc1.frequency.setTargetAtTime(base, now, 0.03)
    nodes.osc2.frequency.setTargetAtTime(base * sound.harmonic, now, 0.03)
    nodes.sub.frequency.setTargetAtTime(base * 0.5, now, 0.04)
    const highCam = sound.profile === 'vtec' && safeRpm > 5500 ? 1 : 0
    nodes.osc2Gain.gain.setTargetAtTime((0.06 + load * 0.12 + highCam * 0.18) *
      (sound.profile === 'quiet' ? 0.35 : 1), now, 0.05)
    nodes.subGain.gain.setTargetAtTime((sound.profile === 'quiet' ? 0.055 : 0.2) + load * sound.sub, now, 0.05)
    nodes.lfo.frequency.setTargetAtTime(sound.lfoRate + revRatio * 22, now, 0.1)
    nodes.lfoGain.gain.setTargetAtTime(0.04 + load * 0.05, now, 0.1)

    const engineLevel = (0.045 + load * 0.15 + revRatio * 0.06 + highCam * 0.035) * sound.volume
    nodes.engineGain.gain.setTargetAtTime(engineLevel, now, 0.045)

    const cutoff = clamp(360 + base * 6.5 + load * 2400 + revRatio * 900, 400, 8000)
    nodes.filter.frequency.setTargetAtTime(cutoff * sound.brightness * (1 + highCam * 0.35), now, 0.05)
    nodes.filter.Q.setTargetAtTime(1.1 + load * 1.4, now, 0.08)

    nodes.noiseFilter.frequency.setTargetAtTime(clamp(base * 4 + 240, 220, 3800), now, 0.06)
    nodes.noiseGain.gain.setTargetAtTime((0.01 + load * 0.05) * sound.noise, now, 0.06)
    const forced = ['turbo', 'twin-turbo', 'supercharged'].includes(sound.profile)
    const whineLevel = sound.profile === 'supercharged' ? 0.07 :
      sound.profile === 'twin-turbo' ? 0.045 : 0.028
    nodes.whine.frequency.setTargetAtTime(
      sound.profile === 'supercharged' ? 280 + safeRpm * 0.22 : 620 + safeRpm * 0.12,
      now, 0.04)
    nodes.whineGain.gain.setTargetAtTime(forced ? whineLevel * load *
      (sound.profile === 'supercharged' ? revRatio : clamp(boost, 0, 1)) : 0, now, 0.06)
  }

  /** Looping rev animation used on the car-selection screen. */
  preview(engine) {
    this.engine = engine
    const ctx = this.ensureContext()
    if (!ctx) return false
    this.configureVoice()
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})

    this.stopPreview()
    this.started = true
    this.paused = false
    this.applyMasterGain(0.7, 0.2)

    const startedAt = performance.now()
    const tick = (now) => {
      const t = (now - startedAt) / 1000
      const cycle = (t % 1.5) / 1.5
      const rev = Math.sin(cycle * Math.PI) ** 1.4
      const rpm = engine.idleRpm + rev * (engine.redline * 0.96 - engine.idleRpm)
      this.update({ rpm, throttle: 0.15 + rev * 0.85, boost: rev })
      this.previewFrame = requestAnimationFrame(tick)
    }
    this.previewFrame = requestAnimationFrame(tick)
    return true
  }

  stopPreview() {
    if (this.previewFrame) {
      cancelAnimationFrame(this.previewFrame)
      this.previewFrame = null
    }
  }

  dispose() {
    this.stopPreview()
    if (this.context) {
      this.context.close().catch(() => {})
      this.context = null
      this.nodes = null
      this.workletNode = null
    }
  }
}
