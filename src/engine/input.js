/**
 * Keyboard + touch input, smoothed into analog controls.
 */

const approach = (current, target, dt, rate) =>
  current + (target - current) * (1 - Math.exp(-rate * dt))

const PREVENT_DEFAULT = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
])

export class InputController {
  constructor() {
    this.keys = new Set()
    this.touch = { throttle: 0, brake: 0, clutch: 0, steer: 0, handbrake: false }
    this.throttle = 0
    this.brake = 0
    this.clutch = 0
    this.steer = 0
    this.onPause = null
    this.onReset = null
    this.onMute = null
    this.onShift = null
    this.onGearboxMode = null
    this.onRange = null
    this.onDriveMode = null
    this.onTractionControl = null
    this.onIgnition = null
    this.attached = false

    this.handleKeyDown = this.handleKeyDown.bind(this)
    this.handleKeyUp = this.handleKeyUp.bind(this)
    this.handleBlur = this.handleBlur.bind(this)
  }

  attach(target = window, handlers = {}) {
    if (this.attached) return
    this.attached = true
    this.target = target
    this.onPause = handlers.onPause ?? null
    this.onReset = handlers.onReset ?? null
    this.onMute = handlers.onMute ?? null
    this.onShift = handlers.onShift ?? null
    this.onGearboxMode = handlers.onGearboxMode ?? null
    this.onRange = handlers.onRange ?? null
    this.onDriveMode = handlers.onDriveMode ?? null
    this.onTractionControl = handlers.onTractionControl ?? null
    this.onIgnition = handlers.onIgnition ?? null
    target.addEventListener('keydown', this.handleKeyDown)
    target.addEventListener('keyup', this.handleKeyUp)
    target.addEventListener('blur', this.handleBlur)
  }

  detach() {
    if (!this.attached) return
    this.attached = false
    this.target.removeEventListener('keydown', this.handleKeyDown)
    this.target.removeEventListener('keyup', this.handleKeyUp)
    this.target.removeEventListener('blur', this.handleBlur)
    this.keys.clear()
  }

  handleKeyDown(event) {
    if (PREVENT_DEFAULT.has(event.code)) event.preventDefault()
    if (event.repeat) return

    switch (event.code) {
      case 'KeyE':
      case 'ShiftLeft':
      case 'ShiftRight':
        this.onShift?.('up')
        return
      case 'KeyQ':
      case 'ControlLeft':
      case 'ControlRight':
        this.onShift?.('down')
        return
      case 'KeyR':
        this.onReset?.()
        return
      case 'Escape':
      case 'KeyP':
        this.onPause?.()
        return
      case 'KeyM':
        this.onMute?.()
        return
      case 'KeyG':
        this.onGearboxMode?.()
        return
      case 'KeyV':
        this.onRange?.('R')
        return
      case 'KeyN':
        this.onRange?.('N')
        return
      case 'KeyF':
        this.onRange?.('D')
        return
      case 'Digit1':
      case 'Digit2':
      case 'Digit3':
        this.onDriveMode?.({ Digit1: 'eco', Digit2: 'normal', Digit3: 'sport' }[event.code])
        return
      case 'KeyT':
        this.onTractionControl?.()
        return
      case 'KeyI':
        this.onIgnition?.()
        return
      default:
        this.keys.add(event.code)
    }
  }

  handleKeyUp(event) {
    this.keys.delete(event.code)
  }

  handleBlur() {
    this.keys.clear()
    this.touch = { throttle: 0, brake: 0, clutch: 0, steer: 0, handbrake: false }
  }

  setTouch(control, value) {
    if (!(control in this.touch)) return
    this.touch[control] = ['throttle', 'brake', 'clutch'].includes(control)
      ? Math.min(1, Math.max(0, Number(value) || 0))
      : control === 'steer'
        ? Math.min(1, Math.max(-1, Number(value) || 0))
        : Boolean(value)
  }

  clear() {
    this.keys.clear()
    this.touch = { throttle: 0, brake: 0, clutch: 0, steer: 0, handbrake: false }
    this.throttle = 0
    this.brake = 0
    this.clutch = 0
    this.steer = 0
  }

  update(dt) {
    const keys = this.keys
    const wantThrottle = Math.max(keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0, this.touch.throttle)
    const wantBrake = Math.max(keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0, this.touch.brake)
    const wantClutch = Math.max(keys.has('KeyC') ? 1 : 0, this.touch.clutch)
    const keySteer = (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) -
      (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0)
    const wantSteer = keySteer !== 0 ? keySteer : this.touch.steer

    this.throttle = approach(this.throttle, wantThrottle, dt, wantThrottle ? 12 : 10)
    this.brake = approach(this.brake, wantBrake, dt, wantBrake ? 15 : 14)
    this.clutch = approach(this.clutch, wantClutch, dt, wantClutch ? 30 : 15)
    this.steer = approach(this.steer, wantSteer, dt, 12)

    return {
      throttle: this.throttle,
      brake: this.brake,
      clutch: this.clutch,
      steer: this.steer,
      handbrake: keys.has('Space') || this.touch.handbrake,
    }
  }
}
