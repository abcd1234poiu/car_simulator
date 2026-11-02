/**
 * Free-roam extension of the vehicle simulation.
 *
 * The taxi sim drives along a generated route; this subclass keeps the same
 * engine, gearbox, clutch, range and traction logic but replaces the
 * route-relative lateral model with a world-space kinematic bicycle. The car
 * can now steer anywhere on the replacement road network, slide when grip
 * runs out and collide with the playable world's boundary.
 */

import { VehiclePhysics, clamp } from './physics.js'
import {
  SPAWN,
  WORLD_BOUNDS,
  isOnRoad,
  nearestRoadHeading,
  resolveCollision,
  surfaceHeightAt,
  surfaceSlopeAlong,
} from '../maps/roadWorld.js'

const G = 9.81
const WHEELBASE = 2.62
const COLLISION_RADIUS = 1.35

const approach = (current, target, dt, rate) =>
  current + (target - current) * (1 - Math.exp(-rate * dt))

const normalizeAngle = (angle) => {
  let value = angle
  while (value > Math.PI) value -= Math.PI * 2
  while (value < -Math.PI) value += Math.PI * 2
  return value
}

export class FreeRoamVehiclePhysics extends VehiclePhysics {
  reset() {
    super.reset()
    this.x = SPAWN.x
    this.z = SPAWN.z
    this.y = surfaceHeightAt(SPAWN.x, SPAWN.z)
    this.heading = SPAWN.heading
    this.yawRate = 0
    this.slipAngle = 0
    this.impact = 0
    this.wheelspin = false
    this.filteredSteer = 0
    this.suspensionTravel = 0
    this.chassisY = this.y
    this.verticalVelocity = 0
    this.bodyPitch = 0
    this.bodyRoll = 0
  }

  teleport(x, z, heading = this.heading) {
    this.x = x
    this.z = z
    this.heading = heading
    this.speed = 0
    this.lateralVelocity = 0
    this.yawRate = 0
    this.slipAngle = 0
    this.impact = 0
    this.directionShock = 0
    this.mechanicalShock = 0
    this.shiftEvent = null
    this.pendingShiftEvent = null
    this.y = surfaceHeightAt(x, z)
    this.chassisY = this.y
    this.verticalVelocity = 0
    this.suspensionTravel = 0
    this.bodyPitch = 0
    this.bodyRoll = 0
    this.filteredSteer = 0
    this.offRoad = !isOnRoad(x, z)
    return this.snapshot()
  }

  integrateMotion(step, driveForce, stoppingAcceleration, handbrake = false) {
    const previousSpeed = this.speed
    const throttleLift = this.gear === 0 && this.throttle < 0.08 ? 0.7 : 0

    if (this.gear === 0) {
      const coastSpeed = Math.max(0, Math.abs(this.speed) - stoppingAcceleration * step)
      this.speed = coastSpeed === 0 ? 0 : Math.sign(this.speed) * coastSpeed
    } else if (this.gear === -1) {
      if (this.speed > 0) {
        this.speed = Math.max(0, this.speed - (stoppingAcceleration + 18) * step)
      } else {
        const acceleration = driveForce / this.car.mass + stoppingAcceleration
        this.speed = Math.max(-8.33, Math.min(0, this.speed + acceleration * step))
      }
    } else {
      if (this.speed < 0) {
        this.speed = Math.min(0, this.speed + (stoppingAcceleration + 18) * step)
      } else {
        const acceleration = driveForce / this.car.mass - stoppingAcceleration - throttleLift
        this.speed = Math.max(0, this.speed + acceleration * step)
      }
    }
    // Drag, gearing and engine power determine top speed; there is no
    // arbitrary forward speed ceiling.

    const speedAbs = Math.abs(this.speed)
    // Keyboard steering should not command near-parking-lot wheel lock on a
    // highway. A progressive rack leaves low-speed turns available but makes
    // small corrections predictable at 80-120 km/h.
    const maxSteer = 0.68 / (1 + (speedAbs / 13) ** 1.25)
    this.filteredSteer = approach(this.filteredSteer, this.steer, step,
      Math.abs(this.steer) < Math.abs(this.filteredSteer) ? 18 : 12)
    // The shared input controller reports left as positive; the bicycle model
    // below uses right as positive, so invert here.
    const steerAngle = -this.filteredSteer * maxSteer
    const kinematicYaw = speedAbs > 0.15 ? (this.speed / WHEELBASE) * Math.tan(steerAngle) : 0

    const powerOversteer = this.car.drivetrain === 'RWD' && !this.tractionControl &&
      this.throttle > 0.55 && speedAbs > 8
      ? clamp((this.throttle - 0.55) * speedAbs / 22, 0, 0.35) : 0
    const lateralGrip = (this.effectiveGrip ?? this.car.grip) * G * (this.offRoad ? 0.7 : 1) *
      (handbrake ? 0.38 : 1) * (this.tractionControl ? 1 : 0.88) *
      (0.9 + this.suspension.spring * 0.16) * (1 - powerOversteer)
    let yawTarget
    if (speedAbs < 2.2) {
      yawTarget = clamp(kinematicYaw, -2.1, 2.1)
    } else {
      const yawLimit = (lateralGrip / speedAbs) * 1.5
      yawTarget = clamp(kinematicYaw, -yawLimit, yawLimit)
      // Handbrake yaw assist must follow the same handedness as the steering
      // input (left is positive steer, which produces a negative yaw).
      if (handbrake) yawTarget -= this.filteredSteer * Math.sign(this.speed) * 0.95 *
        clamp(speedAbs / 12, 0, 1)

      // Keyboard steer assist: when the driver is not actively steering, ease
      // the heading back toward the road direction under the car. This makes
      // arrow-key driving much less twitchy without taking control away.
      if (!handbrake && !this.offRoad && Math.abs(this.steer) < 0.08 &&
        Math.abs(this.slipAngle) < 0.09 && Math.abs(this.yawRate) < 0.35) {
        const roadHeading = nearestRoadHeading(this.x, this.z, this.heading)
        if (roadHeading !== null) {
          const error = normalizeAngle(roadHeading - this.heading)
          // Never auto-turn across an intersection or fight an intentional
          // lane change; only trim small heading errors on a straight road.
          if (Math.abs(error) < 0.28) {
            yawTarget += clamp(error * 0.65, -0.15, 0.15) *
              clamp(speedAbs / 16, 0, 1)
          }
        }
      }

      const allowedYaw = handbrake ? yawLimit + 0.75 : yawLimit * 1.35
      yawTarget = clamp(yawTarget, -allowedYaw, allowedYaw)
    }

    this.yawRate = approach(this.yawRate, yawTarget, step,
      handbrake ? 5.5 : 4.5 + this.suspension.damper * 5)
    this.heading += this.yawRate * step

    const requiredLateral = this.yawRate * this.speed
    const excess = Math.max(0, Math.abs(requiredLateral) - lateralGrip)
    let slipTarget = 0
    if (excess > 0) {
      slipTarget =
        -Math.sign(requiredLateral) *
        Math.min(excess / Math.max(lateralGrip, 1), 2.2) *
        Math.min(speedAbs * 0.34, 8)
    }
    this.lateralVelocity = approach(this.lateralVelocity, slipTarget, step,
      handbrake ? 3.2 : 2.5 + this.suspension.damper * 4)
    this.slipAngle = Math.atan2(this.lateralVelocity, Math.max(speedAbs, 1.2))

    const sin = Math.sin(this.heading)
    const cos = Math.cos(this.heading)
    const forwardX = sin
    const forwardZ = -cos
    const rightX = cos
    const rightZ = sin
    const velocityX = forwardX * this.speed + rightX * this.lateralVelocity
    const velocityZ = forwardZ * this.speed + rightZ * this.lateralVelocity

    let nextX = this.x + velocityX * step
    let nextZ = this.z + velocityZ * step
    this.impact = Math.max(0, this.impact - step * 2.4)

    const hit = resolveCollision(nextX, nextZ, COLLISION_RADIUS)
    if (hit) {
      nextX = hit.x
      nextZ = hit.z
      const normalSpeed = velocityX * hit.nx + velocityZ * hit.nz
      if (normalSpeed < 0) {
        const tangentX = velocityX - normalSpeed * hit.nx
        const tangentZ = velocityZ - normalSpeed * hit.nz
        this.speed = tangentX * forwardX + tangentZ * forwardZ
        this.lateralVelocity = tangentX * rightX + tangentZ * rightZ
        this.speed *= 0.72
        this.lateralVelocity *= 0.65
        this.yawRate *= -0.2
        this.impact = Math.min(1, Math.abs(normalSpeed) / 14)
      }
    }

    const travelled = Math.hypot(nextX - this.x, nextZ - this.z)
    this.x = clamp(nextX, WORLD_BOUNDS.minX, WORLD_BOUNDS.maxX)
    this.z = clamp(nextZ, WORLD_BOUNDS.minZ, WORLD_BOUNDS.maxZ)
    this.y = surfaceHeightAt(this.x, this.z)
    this.slope = surfaceSlopeAlong(this.x, this.z, this.heading)
    // A spring/damper absorber follows the road while filtering bumps. Spring
    // stiffness changes travel; damping changes how quickly it settles.
    const roughness = Math.sin(this.odometer * (this.offRoad ? 2.4 : 0.8)) *
      (this.offRoad ? 0.055 : 0.008)
    const targetY = this.y + roughness
    const springForce = (targetY - this.chassisY) * (17 + this.suspension.spring * 28)
    const dampingForce = this.verticalVelocity * (4 + this.suspension.damper * 10)
    this.verticalVelocity += (springForce - dampingForce) * step
    this.chassisY = clamp(this.chassisY + this.verticalVelocity * step,
      this.y - 0.08, this.y + 0.3)
    this.suspensionTravel = this.chassisY - this.y
    const acceleration = (this.speed - previousSpeed) / Math.max(step, 0.001)
    this.bodyPitch = approach(this.bodyPitch,
      clamp(acceleration * 0.009 / (0.7 + this.suspension.spring), -0.075, 0.075),
      step, 3 + this.suspension.damper * 5)
    this.bodyRoll = approach(this.bodyRoll,
      clamp(-this.yawRate * speedAbs * 0.008 / (0.7 + this.suspension.spring), -0.11, 0.11),
      step, 3 + this.suspension.damper * 5)
    this.distance += travelled
    this.odometer += Math.abs(this.speed) * step
    this.elapsed += step
    this.maxSpeed = Math.max(this.maxSpeed, Math.abs(this.speed))
    this.offRoad = !isOnRoad(this.x, this.z)
    this.wheelspin = this.tractionLimited && (!this.tractionControl || handbrake)
  }

  snapshot() {
    const snapshot = super.snapshot()
    return {
      ...snapshot,
      x: this.x,
      y: this.y,
      z: this.z,
      heading: this.heading,
      slope: this.slope,
      signedSpeed: this.speed,
      slipAngle: this.slipAngle,
      impact: this.impact,
      wheelspin: this.wheelspin,
      suspensionTravel: this.suspensionTravel,
      bodyPitch: this.bodyPitch,
      bodyRoll: this.bodyRoll,
      suspension: this.suspension,
      distance: this.distance,
      distanceKm: this.odometer / 1000,
    }
  }
}
