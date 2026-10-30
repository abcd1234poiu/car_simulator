/**
 * Longitudinal + lateral vehicle simulation.
 * Units are SI: metres, seconds, kilograms, newtons, radians.
 */

const G = 9.81
const AIR_DENSITY = 1.225
const DRIVETRAIN_EFFICIENCY = 0.88
const MAX_STEP = 0.05
const ROAD_EDGE = 5.05
const SHOULDER_EDGE = 8.2
// The right-hand lane centre sits this far from the road's painted centre line.
const LANE_OFFSET = 1.9

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
export const lerp = (a, b, t) => a + (b - a) * t

const approach = (current, target, dt, rate) =>
  current + (target - current) * (1 - Math.exp(-rate * dt))

export function torqueAtRpm(engine, rpm) {
  const curve = engine.torqueCurve
  if (rpm <= curve[0].rpm) return curve[0].torque
  const last = curve[curve.length - 1]
  if (rpm >= last.rpm) return last.torque

  for (let i = 1; i < curve.length; i += 1) {
    if (rpm <= curve[i].rpm) {
      const previous = curve[i - 1]
      const next = curve[i]
      const t = (rpm - previous.rpm) / (next.rpm - previous.rpm)
      return lerp(previous.torque, next.torque, t)
    }
  }
  return last.torque
}

export class VehiclePhysics {
  constructor({ car, engine, transmission }) {
    this.car = car
    this.engine = engine
    this.transmission = transmission
    this.gearCount = transmission.gearRatios.length
    this.dragFactor = 0.5 * AIR_DENSITY * car.dragCd * car.frontalArea
    this.rollingResistance = 0.014 * car.mass * G
    this.maxTractionForce = car.grip * car.mass * G
    this.shiftUpRpm = engine.redline * transmission.shiftUpFraction
    this.shiftDownRpm = engine.redline * transmission.shiftDownFraction
    this.reset()
  }

  reset() {
    this.speed = 0
    this.lateral = LANE_OFFSET
    this.lateralVelocity = 0
    this.distance = 0
    this.elapsed = 0
    this.maxSpeed = 0
    this.gear = 1
    this.rpm = this.engine.idleRpm
    this.throttle = 0
    this.brake = 0
    this.steer = 0
    this.offRoad = false
    this.limiter = false
    this.shiftCooldown = 0
    this.shiftEvent = null
  }

  rpmForSpeed(speed, gear = this.gear) {
    const ratio = this.transmission.gearRatios[gear - 1] * this.transmission.finalDrive
    return (Math.abs(speed) / this.car.wheelRadius) * ratio * (60 / (2 * Math.PI))
  }

  shiftUp() {
    if (this.transmission.type !== 'manual') {
      return { ok: false, message: 'Automatic gearbox shifts by itself' }
    }
    if (this.gear >= this.gearCount) {
      return { ok: false, message: 'Already in top gear' }
    }
    this.gear += 1
    this.shiftCooldown = 0.2
    return { ok: true, message: `Gear ${this.gear}` }
  }

  shiftDown() {
    if (this.transmission.type !== 'manual') {
      return { ok: false, message: 'Automatic gearbox shifts by itself' }
    }
    if (this.gear <= 1) {
      return { ok: false, message: 'Already in first gear' }
    }
    const targetGear = this.gear - 1
    const resultingRpm = this.rpmForSpeed(Math.max(this.speed, 4), targetGear)
    if (resultingRpm > this.engine.maxRpm) {
      return { ok: false, message: 'Over-rev — too fast for that gear' }
    }
    this.gear = targetGear
    this.shiftCooldown = 0.2
    return { ok: true, message: `Gear ${this.gear}` }
  }

  update(dt, controls = {}) {
    const step = clamp(dt, 0.001, MAX_STEP)
    const throttleTarget = clamp(controls.throttle ?? 0, 0, 1)
    const brakeTarget = clamp(controls.brake ?? 0, 0, 1)
    const steerTarget = clamp(controls.steer ?? 0, -1, 1)
    const handbrake = Boolean(controls.handbrake)

    this.throttle = approach(this.throttle, throttleTarget, step, throttleTarget > this.throttle ? 7 : 11)
    this.brake = approach(this.brake, brakeTarget, step, brakeTarget > this.brake ? 12 : 16)
    this.steer = approach(this.steer, steerTarget, step, 9)
    this.shiftCooldown = Math.max(0, this.shiftCooldown - step)
    this.shiftEvent = null

    // --- Engine speed ------------------------------------------------------
    const wheelRpm = this.rpmForSpeed(this.speed)
    const launchRpm =
      this.engine.idleRpm + this.throttle * (this.engine.redline * 0.5 - this.engine.idleRpm)
    const clutchBlend = clamp(this.speed / 7, 0, 1)
    let rpmTarget = lerp(launchRpm, Math.max(wheelRpm, this.engine.idleRpm), clutchBlend)
    rpmTarget = clamp(rpmTarget, this.engine.idleRpm, this.engine.maxRpm)
    this.rpm = approach(this.rpm, rpmTarget, step, 9)
    this.rpm = clamp(this.rpm, this.engine.idleRpm, this.engine.maxRpm)

    this.limiter = this.rpm >= this.engine.redline - 40

    // --- Automatic shifting ------------------------------------------------
    if (this.transmission.type === 'automatic' && this.shiftCooldown <= 0) {
      if (this.rpm > this.shiftUpRpm && this.gear < this.gearCount && this.throttle > 0.1) {
        this.gear += 1
        this.shiftCooldown = 0.42
        this.shiftEvent = 'up'
      } else if (
        this.rpm < this.shiftDownRpm &&
        this.gear > 1 &&
        this.speed > 1.5 &&
        this.throttle < 0.85
      ) {
        this.gear -= 1
        this.shiftCooldown = 0.55
        this.shiftEvent = 'down'
      }
    }

    // --- Forces ------------------------------------------------------------
    const gearRatio = this.transmission.gearRatios[this.gear - 1] * this.transmission.finalDrive
    let engineTorque = torqueAtRpm(this.engine, this.rpm) * this.throttle
    if (this.limiter) engineTorque *= 0.12
    let driveForce = (engineTorque * gearRatio * DRIVETRAIN_EFFICIENCY) / this.car.wheelRadius
    driveForce = Math.min(driveForce, this.maxTractionForce)

    let resistance = this.dragFactor * this.speed * this.speed + this.rollingResistance
    if (this.offRoad) resistance += 620 + this.speed * 26

    let acceleration = (driveForce - resistance) / this.car.mass
    acceleration -= this.brake * 9.6
    if (handbrake) acceleration -= 4.2

    this.speed = Math.max(0, this.speed + acceleration * step)
    this.distance += this.speed * step
    this.elapsed += step
    this.maxSpeed = Math.max(this.maxSpeed, this.speed)

    // --- Lateral movement --------------------------------------------------
    const steerAuthority = clamp(this.speed / 14, 0, 1)
    const lateralTarget = this.steer * 7.2 * steerAuthority
    this.lateralVelocity = approach(this.lateralVelocity, lateralTarget, step, 7)
    this.lateral += this.lateralVelocity * step

    if (Math.abs(this.lateral) > SHOULDER_EDGE) {
      this.lateral = Math.sign(this.lateral) * SHOULDER_EDGE
      this.lateralVelocity *= -0.2
    }
    this.offRoad = Math.abs(this.lateral) > ROAD_EDGE

    return this.snapshot()
  }

  snapshot() {
    const rpmFraction = this.rpm / this.engine.maxRpm
    return {
      speed: this.speed,
      speedKmh: this.speed * 3.6,
      rpm: Math.round(this.rpm),
      rpmFraction,
      redlineFraction: this.engine.redline / this.engine.maxRpm,
      limiter: this.limiter,
      gear: this.gear,
      gearCount: this.gearCount,
      gearRatio: this.transmission.gearRatios[this.gear - 1] * this.transmission.finalDrive,
      distance: this.distance,
      distanceKm: this.distance / 1000,
      elapsed: this.elapsed,
      maxSpeedKmh: this.maxSpeed * 3.6,
      throttle: this.throttle,
      brake: this.brake,
      steer: this.steer,
      lateral: this.lateral,
      offRoad: this.offRoad,
      shiftEvent: this.shiftEvent,
      transmissionType: this.transmission.type,
    }
  }
}
