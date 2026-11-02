/**
 * Hybrid Web Audio engine: combustion synthesis, bundled engine loops and
 * speed-dependent intake, tyre and wind layers.
 */

import { defaultAspirationForEngine } from '../constants/config.js'

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

// Keep the recorded loop quiet at idle (where its fixed cadence is most
// noticeable) and let it open up with engine load and RPM.
export function engineSampleLevel(rpm, throttle, maxRpm, volume = 1, quiet = false) {
  const rev = clamp((rpm - 900) / Math.max(1, maxRpm - 900), 0, 1)
  const load = clamp(throttle, 0, 1)
  return (0.07 + rev * 0.19 + load * 0.34) * volume * (quiet ? 0.75 : 1)
}

export function drivingNoiseLevels(speedKmh, offRoad = false) {
  const speed = clamp(Math.abs(speedKmh), 0, 400)
  const roll = clamp(speed / 90, 0, 1)
  const wind = clamp((speed - 45) / 190, 0, 1)
  return {
    tyre: roll * (offRoad ? 0.075 : 0.024),
    wind: wind * 0.033,
  }
}

const SAMPLE_BY_PROFILE = {
  quiet: 2,
  smooth: 2,
  muscle: 0,
  turbo: 3,
  'twin-turbo': 4,
  supercharged: 1,
  vtec: 5,
}

const ASPIRATION_PROFILE = {
  na: 'smooth',
  turbo: 'turbo',
  'twin-turbo': 'twin-turbo',
  supercharger: 'supercharged',
  vtec: 'vtec',
}

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
    this.volume = 1.45
    this.workletNode = null
    this.ignitionTimer = null
    this.starterGain = null
    this.starterSources = []
    this.ignitionCatch = false
    this.ignitionRevAt = null
    this.sampleBuffers = null
    this.sampleLoadPromise = null
    this.sampleSource = null
    this.sampleGain = null
    this.sampleFilter = null
    this.lastThrottle = 0
    this.lastRpm = 0
    this.popCooldown = 0
    this.lastState = null
    this.shiftDuckingUntil = 0
    this.aspiration = null
    this.baseAspiration = null
    this.voiceSound = null
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
    compressor.threshold.value = -16
    compressor.knee.value = 22
    compressor.ratio.value = 4.5
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

    // These layers bypass the oscillator/worklet crossfade, so they remain
    // audible when the higher-quality combustion worklet is available.
    const intakeFilter = ctx.createBiquadFilter()
    intakeFilter.type = 'bandpass'
    intakeFilter.frequency.value = 1500
    intakeFilter.Q.value = 0.65
    const intakeGain = ctx.createGain()
    intakeGain.gain.value = 0
    noise.connect(intakeFilter)
    intakeFilter.connect(intakeGain)
    intakeGain.connect(master)

    const tyreFilter = ctx.createBiquadFilter()
    tyreFilter.type = 'lowpass'
    tyreFilter.frequency.value = 560
    const tyreGain = ctx.createGain()
    tyreGain.gain.value = 0
    noise.connect(tyreFilter)
    tyreFilter.connect(tyreGain)
    tyreGain.connect(master)

    const windFilter = ctx.createBiquadFilter()
    windFilter.type = 'highpass'
    windFilter.frequency.value = 1100
    const windGain = ctx.createGain()
    windGain.gain.value = 0
    noise.connect(windFilter)
    windFilter.connect(windGain)
    windGain.connect(master)

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
      intakeFilter,
      intakeGain,
      tyreGain,
      windGain,
      osc2Gain,
      subGain,
      whine,
      whineGain,
      compressor,
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

  setAspiration(aspiration) {
    this.aspiration = aspiration ?? null
    this.configureVoice()
  }

  configureVoice() {
    if (!this.nodes || !this.engine) return
    const baseSound = this.engine.sound
    this.baseAspiration = defaultAspirationForEngine(this.engine)
    if (!this.aspiration) this.aspiration = this.baseAspiration
    const custom = this.aspiration.id !== this.baseAspiration.id
    const profile = custom
      ? ASPIRATION_PROFILE[this.aspiration.id] ?? baseSound.profile
      : baseSound.profile
    const aspirationSound = custom ? this.aspiration.sound : null
    this.voiceSound = {
      ...baseSound,
      profile,
      brightness: baseSound.brightness * (aspirationSound?.brightness ?? 1),
      noise: baseSound.noise * (aspirationSound?.noise ?? 1),
    }
    this.nodes.osc1.type = profile === 'quiet' || profile === 'smooth' ? 'triangle' :
      profile === 'muscle' || profile === 'supercharged' ? 'square' : 'sawtooth'
    this.nodes.osc2.type = profile === 'quiet' ? 'sine' :
      profile === 'vtec' || profile === 'twin-turbo' ? 'sawtooth' : 'triangle'
    this.nodes.drive.curve = createDriveCurve(baseSound.drive)
    this.workletNode?.port.postMessage({
      type: 'engine', profile, cylinders: this.engine.cylinders,
      maxRpm: this.engine.maxRpm, volume: this.voiceSound.volume,
    })
  }

  ensureEngineSamples(ctx) {
    if (this.sampleBuffers) return Promise.resolve(this.sampleBuffers)
    if (this.sampleLoadPromise) return this.sampleLoadPromise
    this.sampleLoadPromise = Promise.all(
      [0, 1, 2, 3, 4, 5].map(async (index) => {
        const response = await fetch(`/audio/engine/loop_${index}.wav`)
        if (!response.ok) throw new Error(`engine sample ${index}: HTTP ${response.status}`)
        return ctx.decodeAudioData(await response.arrayBuffer())
      }),
    ).then((buffers) => {
      if (this.context !== ctx) return null
      this.sampleBuffers = buffers
      if (this.started) this.startSampleEngine()
      return buffers
    }).catch((error) => {
      console.warn('Engine sample pack unavailable; keeping synthesized audio', error)
      this.sampleLoadPromise = null
      return null
    })
    return this.sampleLoadPromise
  }

  startSampleEngine() {
    if (!this.context || !this.nodes || !this.sampleBuffers || !this.started) return
    this.stopSampleEngine()
    const profile = this.voiceSound?.profile ?? 'smooth'
    const buffer = this.sampleBuffers[SAMPLE_BY_PROFILE[profile] ?? 2] ?? this.sampleBuffers[0]
    if (!buffer) return
    const source = this.context.createBufferSource()
    source.buffer = buffer
    source.loop = true
    source.playbackRate.value = 0.8
    const filter = this.context.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 1500
    filter.Q.value = 0.8
    const gain = this.context.createGain()
    gain.gain.value = 0
    source.connect(filter)
    filter.connect(gain)
    gain.connect(this.nodes.master)
    source.start()
    this.sampleSource = source
    this.sampleGain = gain
    this.sampleFilter = filter
  }

  stopSampleEngine() {
    if (this.sampleSource) {
      try { this.sampleSource.stop() } catch { /* already stopped */ }
      this.sampleSource.disconnect()
    }
    this.sampleFilter?.disconnect()
    this.sampleGain?.disconnect()
    this.sampleSource = null
    this.sampleGain = null
    this.sampleFilter = null
  }

  start(engine, aspiration) {
    this.engine = engine ?? this.engine
    if (!this.engine) return false
    this.setAspiration(aspiration ?? this.aspiration)
    const ctx = this.ensureContext()
    if (!ctx) return false
    this.configureVoice()

    this.stopPreview()
    this.started = true
    this.paused = false
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})

    const flare = this.ignitionCatch
    this.ignitionCatch = false
    this.ensureEngineSamples(ctx)
    if (this.sampleBuffers) this.startSampleEngine()
    this.update({
      rpm: this.engine.idleRpm + (flare ? 420 : 0),
      throttle: flare ? 0.35 : 0.18,
    })
    this.applyMasterGain(0.9, 0.35)
    if (flare) {
      const profile = this.voiceSound?.profile ?? this.engine.sound?.profile
      const hot = ['muscle', 'turbo', 'twin-turbo', 'supercharged', 'vtec'].includes(profile)
      this.playExhaustPop(hot ? 0.6 : 0.3)
      this.popCooldown = this.context.currentTime + 0.5
    }
    return true
  }

  playStarter() {
    if (!this.context || !this.nodes) return
    const ctx = this.context
    const now = ctx.currentTime
    const out = ctx.createGain()
    out.gain.setValueAtTime(0, now)
    out.gain.linearRampToValueAtTime(0.26, now + 0.045)
    out.gain.setValueAtTime(0.23, now + 0.52)
    out.gain.exponentialRampToValueAtTime(0.001, now + 0.86)
    out.connect(this.nodes.master)

    // Low starter-motor rumble.
    const motor = ctx.createOscillator()
    motor.type = 'sawtooth'
    motor.frequency.setValueAtTime(46, now)
    motor.frequency.linearRampToValueAtTime(92, now + 0.72)
    const motorFilter = ctx.createBiquadFilter()
    motorFilter.type = 'lowpass'
    motorFilter.frequency.setValueAtTime(180, now)
    motorFilter.frequency.linearRampToValueAtTime(340, now + 0.7)
    motorFilter.Q.value = 2.2
    const motorGain = ctx.createGain()
    motorGain.gain.value = 0.085
    motor.connect(motorFilter)
    motorFilter.connect(motorGain)
    motorGain.connect(out)

    // Starter gear whine.
    const whine = ctx.createOscillator()
    whine.type = 'triangle'
    whine.frequency.setValueAtTime(280, now)
    whine.frequency.linearRampToValueAtTime(560, now + 0.7)
    const whineFilter = ctx.createBiquadFilter()
    whineFilter.type = 'bandpass'
    whineFilter.frequency.value = 720
    whineFilter.Q.value = 2.6
    const whineGain = ctx.createGain()
    whineGain.gain.value = 0.022
    whine.connect(whineFilter)
    whineFilter.connect(whineGain)
    whineGain.connect(out)

    // Gear-mesh noise, deliberately rolled off at the top so it does not sound
    // like a harsh buzz.
    const noise = ctx.createBufferSource()
    noise.buffer = createNoiseBuffer(ctx, 0.9)
    const noiseBand = ctx.createBiquadFilter()
    noiseBand.type = 'bandpass'
    noiseBand.frequency.value = 1350
    noiseBand.Q.value = 1.35
    const noiseLow = ctx.createBiquadFilter()
    noiseLow.type = 'lowpass'
    noiseLow.frequency.value = 2100
    const noiseGain = ctx.createGain()
    noiseGain.gain.value = 0.055
    noise.connect(noiseBand)
    noiseBand.connect(noiseLow)
    noiseLow.connect(noiseGain)
    noiseGain.connect(out)

    // Rhythmic crank pulses.
    const lfo = ctx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 9.4
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 0.03
    lfo.connect(lfoGain)
    lfoGain.connect(out.gain)

    // Firing attempts as the engine begins to catch.
    const firing = ctx.createOscillator()
    firing.type = 'triangle'
    firing.frequency.setValueAtTime(48, now)
    firing.frequency.linearRampToValueAtTime(74, now + 0.8)
    const firingGain = ctx.createGain()
    firingGain.gain.setValueAtTime(0, now)
    firingGain.gain.setValueAtTime(0, now + 0.34)
    firingGain.gain.linearRampToValueAtTime(0.07, now + 0.46)
    firingGain.gain.linearRampToValueAtTime(0.035, now + 0.68)
    firingGain.gain.exponentialRampToValueAtTime(0.001, now + 0.82)
    firing.connect(firingGain)
    firingGain.connect(out)

    // A soft compression thump as the engine catches.
    const catchOsc = ctx.createOscillator()
    catchOsc.type = 'sine'
    catchOsc.frequency.setValueAtTime(92, now + 0.58)
    catchOsc.frequency.exponentialRampToValueAtTime(54, now + 0.9)
    const catchGain = ctx.createGain()
    catchGain.gain.setValueAtTime(0, now)
    catchGain.gain.setValueAtTime(0, now + 0.56)
    catchGain.gain.linearRampToValueAtTime(0.09, now + 0.62)
    catchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.92)
    catchOsc.connect(catchGain)
    catchGain.connect(out)

    for (const source of [motor, whine, noise, lfo, firing, catchOsc]) {
      source.start(now)
      source.stop(now + 0.95)
    }

    this.starterGain = out
    this.starterSources = [motor, whine, noise, lfo, firing, catchOsc]
  }

  playExhaustPop(intensity = 1) {
    if (!this.context || !this.nodes) return
    const ctx = this.context
    const now = ctx.currentTime
    const out = ctx.createGain()
    out.gain.setValueAtTime(0, now)
    out.gain.linearRampToValueAtTime(0.4 * intensity, now + 0.005)
    out.gain.exponentialRampToValueAtTime(0.001, now + 0.16)
    out.connect(this.nodes.master)

    const noise = ctx.createBufferSource()
    noise.buffer = createNoiseBuffer(ctx, 0.2)
    const band = ctx.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = 150 + Math.random() * 320
    band.Q.value = 1.15
    const low = ctx.createBiquadFilter()
    low.type = 'lowpass'
    low.frequency.value = 1800
    const drive = ctx.createWaveShaper()
    drive.curve = createDriveCurve(2.4)
    drive.oversample = '2x'
    noise.connect(band)
    band.connect(low)
    low.connect(drive)
    drive.connect(out)

    const thump = ctx.createOscillator()
    thump.type = 'sine'
    thump.frequency.setValueAtTime(72 + Math.random() * 45, now)
    thump.frequency.exponentialRampToValueAtTime(42, now + 0.18)
    const thumpGain = ctx.createGain()
    thumpGain.gain.setValueAtTime(0, now)
    thumpGain.gain.linearRampToValueAtTime(0.2 * intensity, now + 0.008)
    thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2)
    thump.connect(thumpGain)
    thumpGain.connect(out)

    noise.start(now)
    noise.stop(now + 0.22)
    thump.start(now)
    thump.stop(now + 0.22)
  }

  startIgnition(engine, aspiration) {
    this.engine = engine ?? this.engine
    if (!this.engine) return false
    this.setAspiration(aspiration ?? this.aspiration)
    const ctx = this.ensureContext()
    if (!ctx) return false
    this.configureVoice()
    this.stopPreview()
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    this.started = false
    this.paused = false
    this.ignitionCatch = true
    this.applyMasterGain(0.9, 0.03)
    this.playStarter()
    window.clearTimeout(this.ignitionTimer)
    this.ignitionTimer = window.setTimeout(() => {
      this.ignitionTimer = null
      this.start(engine, aspiration)
      this.ignitionRevAt = performance.now()
    }, 820)
    return true
  }

  stop() {
    this.stopPreview()
    this.stopSampleEngine()
    window.clearTimeout(this.ignitionTimer)
    this.ignitionTimer = null
    if (this.starterGain) {
      const now = this.context?.currentTime ?? 0
      try {
        this.starterGain.gain.cancelScheduledValues(now)
        this.starterGain.gain.setTargetAtTime(0, now, 0.02)
      } catch {
        // The context may already be closed.
      }
      for (const source of this.starterSources) {
        try { source.stop() } catch { /* already stopped */ }
      }
      this.starterGain = null
      this.starterSources = []
    }
    this.started = false
    this.ignitionCatch = false
    this.ignitionRevAt = null
    this.popCooldown = 0
    this.shiftDuckingUntil = 0
    this.applyMasterGain(0, 0.15)
  }

  setMuted(muted) {
    this.muted = muted
    this.applyMasterGain(this.started ? 0.9 : 0)
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

  update({ rpm = 900, throttle = 0, boost = 0, limiter = false,
    shiftEvent = null, speedKmh = 0, offRoad = false }) {
    if (!this.started || !this.context || !this.engine || !this.nodes) return

    // Short engine blip when the engine catches after ignition.
    if (this.ignitionRevAt !== null) {
      const elapsed = performance.now() - this.ignitionRevAt
      const duration = 950
      if (elapsed < duration) {
        const t = elapsed / duration
        const blip = Math.sin(t * Math.PI) ** 1.35
        rpm = this.engine.idleRpm +
          blip * (this.engine.redline * 0.42 - this.engine.idleRpm)
        throttle = Math.max(throttle, 0.2 + blip * 0.6)
        boost = Math.max(boost, blip * 0.55)
      } else {
        this.ignitionRevAt = null
      }
    }

    this.lastState = { rpm, throttle, boost, limiter, speedKmh, offRoad }
    const nodes = this.nodes
    const now = this.context.currentTime
    const sound = this.voiceSound ?? this.engine.sound

    const performanceProfile = ['muscle', 'turbo', 'twin-turbo', 'supercharged', 'vtec']
      .includes(sound.profile)
    const throttleDrop = this.lastThrottle - throttle
    const overrun = throttle < 0.12 && rpm > 2200
    if (now >= this.popCooldown) {
      if (performanceProfile) {
        if (shiftEvent || throttleDrop > 0.55 || (overrun && Math.random() < 0.02)) {
          this.playExhaustPop(shiftEvent ? 0.95 : 0.55 + Math.random() * 0.45)
          this.popCooldown = now + (shiftEvent ? 0.12 : 0.22 + Math.random() * 0.45)
        }
      } else if (overrun && (throttleDrop > 0.6 || Math.random() < 0.012)) {
        // Even a quiet engine burbles softly when you lift off at revs.
        this.playExhaustPop(0.32 + Math.random() * 0.22)
        this.popCooldown = now + 0.55 + Math.random() * 0.7
      }
    }
    this.lastThrottle = throttle
    this.lastRpm = rpm
    if (shiftEvent) this.shiftDuckingUntil = now + 0.11
    const audibleThrottle = throttle * (now < this.shiftDuckingUntil ? 0.48 : 1)

    if (this.workletNode) {
      this.workletNode.parameters.get('rpm').setTargetAtTime(clamp(rpm, 300, 12000), now, 0.025)
      this.workletNode.parameters.get('throttle').setTargetAtTime(clamp(audibleThrottle, 0, 1), now, 0.035)
      this.workletNode.parameters.get('boost').setTargetAtTime(clamp(boost, 0, 1), now, 0.055)
      this.workletNode.parameters.get('limiter').setTargetAtTime(limiter ? 1 : 0, now, 0.012)
      if (shiftEvent) this.workletNode.port.postMessage({ type: 'shift', direction: shiftEvent })
    }

    const safeRpm = clamp(rpm, 400, 12000)
    const firing = (safeRpm / 60) * (this.engine.cylinders / 2)
    const base = clamp(firing, 18, 500)
    const load = clamp(audibleThrottle, 0, 1)
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

    const engineLevel = (0.09 + load * 0.2 + revRatio * 0.09 + highCam * 0.045) * sound.volume
    nodes.engineGain.gain.setTargetAtTime(engineLevel, now, 0.045)

    if (this.sampleSource && this.sampleGain && this.sampleFilter) {
      const sampleLevel = engineSampleLevel(safeRpm, load, this.engine.maxRpm,
        sound.volume ?? 1, sound.profile === 'quiet')
      this.sampleGain.gain.setTargetAtTime(sampleLevel, now, 0.08)
      this.sampleFilter.frequency.setTargetAtTime(
        clamp(550 + load * 1500 + revRatio * 1650, 500, 4800),
        now,
        0.08,
      )
      this.sampleSource.playbackRate.setTargetAtTime(
        clamp(safeRpm / 3000, 0.45, 2.05),
        now,
        0.08,
      )
    }

    const cutoff = clamp(360 + base * 6.5 + load * 2400 + revRatio * 900, 400, 8000)
    nodes.filter.frequency.setTargetAtTime(cutoff * sound.brightness * (1 + highCam * 0.35), now, 0.05)
    nodes.filter.Q.setTargetAtTime(1.1 + load * 1.4, now, 0.08)

    nodes.noiseFilter.frequency.setTargetAtTime(clamp(base * 4 + 240, 220, 3800), now, 0.06)
    nodes.noiseGain.gain.setTargetAtTime((0.01 + load * 0.05) * sound.noise, now, 0.06)
    nodes.intakeFilter.frequency.setTargetAtTime(
      clamp(800 + safeRpm * 0.38, 850, 4000), now, 0.07)
    nodes.intakeGain.gain.setTargetAtTime(
      (0.003 + load * 0.027) * sound.noise, now, 0.065)
    const roadNoise = drivingNoiseLevels(speedKmh, offRoad)
    nodes.tyreGain.gain.setTargetAtTime(roadNoise.tyre, now, 0.18)
    nodes.windGain.gain.setTargetAtTime(roadNoise.wind, now, 0.22)
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
  preview(engine, aspiration) {
    this.engine = engine
    this.aspiration = aspiration ?? this.aspiration
    const ctx = this.ensureContext()
    if (!ctx) return false
    this.configureVoice()
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})

    this.stopPreview()
    this.started = true
    this.paused = false
    this.ensureEngineSamples(ctx)
    if (this.sampleBuffers) this.startSampleEngine()
    this.applyMasterGain(0.85, 0.2)

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
    this.stopSampleEngine()
  }

  dispose() {
    this.stopPreview()
    this.stopSampleEngine()
    window.clearTimeout(this.ignitionTimer)
    this.ignitionTimer = null
    if (this.context) {
      this.context.close().catch(() => {})
      this.context = null
      this.nodes = null
      this.workletNode = null
    }
  }
}
