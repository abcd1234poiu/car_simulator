import { Gauge } from './Gauge.jsx'
import '../styles/dashboard.css'

const SHIFT_LIGHTS = 6

function formatTime(seconds) {
  const total = Math.floor(seconds)
  const minutes = Math.floor(total / 60)
  const secs = total % 60
  return `${minutes}:${String(secs).padStart(2, '0')}`
}

function Pedal({ label, value, tone }) {
  return (
    <div className={`pedal pedal-${tone}`}>
      <span className="pedal-label">{label}</span>
      <span className="pedal-track">
        <span className="pedal-fill" style={{ transform: `scaleY(${Math.max(0.02, value)})` }} />
      </span>
      <span className="pedal-value">{Math.round(value * 100)}</span>
    </div>
  )
}

export function Dashboard({
  car, engine, aspiration, transmission, telemetry, shiftPulse, ignitionSweep = 0, tyre, onRefuel,
}) {
  const rpmFraction = telemetry.rpmFraction ?? 0
  const litLights = Math.round(
    Math.max(0, (rpmFraction - 0.55) / 0.45) * SHIFT_LIGHTS,
  )
  const automatic = telemetry.gearboxMode === 'D'
  const inNeutral = telemetry.gear === 0
  const inReverse = telemetry.gear === -1
  const ignitionOff = telemetry.ignition === false
  const engineBraking = !ignitionOff && (telemetry.engineBraking ?? 0) > 0.05
  const shiftShock = !ignitionOff && (telemetry.mechanicalShock ?? 0) > 0.08
  const handbrakeOn = !ignitionOff && telemetry.handbrake
  const drifting = !ignitionOff && (telemetry.speedKmh ?? 0) > 25 &&
    Math.abs(telemetry.slipAngle ?? 0) > 0.14
  const fuel = telemetry.fuel ?? 0
  const fuelCapacity = telemetry.fuelCapacity ?? 0
  const fuelFraction = fuelCapacity > 0 ? fuel / fuelCapacity : 0
  const fuelPercent = Math.round(fuelFraction * 100)
  const fuelLow = fuelFraction < 0.15
  const fuelEmpty = telemetry.fuelStarved || fuelFraction <= 0.001
  const consumption = telemetry.fuelConsumption ?? 0

  return (
    <section className="dashboard" aria-label="Driving dashboard">
      <div className="dash-identity">
        <div className="dash-car" style={{ '--car-color': car.color }}>
          {car.name}
        </div>
        <div className="dash-car-meta">{car.className}</div>
        <div className="dash-chips">
          <span className="chip chip-engine">{engine.badge}</span>
          {aspiration && <span className="chip chip-aspiration">{aspiration.badge}</span>}
          <span className="chip">{car.drivetrain}</span>
          {tyre && <span className="chip chip-tyre">{tyre.shortName} · {Math.round((1 - (telemetry.tyreWear ?? 0)) * 100)}%</span>}
          {telemetry.suspension && <span className="chip">SPR {Math.round(telemetry.suspension.spring * 100)} · DMP {Math.round(telemetry.suspension.damper * 100)}</span>}
        </div>
        <div className="dash-mode">
          {transmission.shortName} · {telemetry.driveMode?.toUpperCase()} · {inNeutral ? 'NEUTRAL' : inReverse ? 'REVERSE' : automatic ? 'DRIVE' : 'MANUAL'}
          {transmission.type === 'manual' && (telemetry.clutch ?? 0) > 0.1 ? ' · CLUTCH' : ''}
        </div>
      </div>

      <div className="dash-gauges">
        <Gauge
          value={telemetry.speedKmh ?? 0}
          max={Math.max(400, Math.ceil(((telemetry.speedKmh ?? 0) + 1) / 100) * 100)}
          majorStep={100}
          label="SPEED"
          unit="km/h"
          displayValue={String(Math.round(telemetry.speedKmh ?? 0))}
          color="#34e1c8"
          colorEnd="#7c8cff"
          valueSize={50}
          sweepKey={ignitionSweep}
        />

        <div className="dash-center">
          <div className={`shift-lights ${telemetry.limiter ? 'is-limiter' : ''}`}>
            {Array.from({ length: SHIFT_LIGHTS }, (_, index) => (
              <span
                key={index}
                className={`shift-light ${index < litLights ? 'is-lit' : ''} ${
                  index >= SHIFT_LIGHTS - 2 ? 'is-red' : ''
                }`}
              />
            ))}
          </div>

          <div className="gear-block">
            <span className={`gear-prefix ${inNeutral || inReverse ? 'is-ghost' : ''}`}>
              {automatic ? 'D' : 'M'}
            </span>
            <span key={shiftPulse} className="gear-value">
              {inNeutral ? 'N' : inReverse ? 'R' : telemetry.gear ?? 1}
            </span>
            <span className={`gear-total ${inNeutral || inReverse ? 'is-ghost' : ''}`}>
              / {telemetry.gearCount ?? transmission.gearRatios.length}
            </span>
          </div>
          <div className="gear-caption">
            {inNeutral ? 'NEUTRAL · ENGINE DISCONNECTED' : inReverse ? 'REVERSE · DRIVE BACKWARD' :
              telemetry.shiftActive ? `${transmission.shortName.toUpperCase()} · SHIFTING` :
              transmission.type === 'cvt' && automatic ? 'CVT · VIRTUAL RATIO' :
                automatic ? `${transmission.shortName.toUpperCase()} · AUTO` :
                  'GEAR · E / Q TO SHIFT'}
          </div>

          <div
            className={`fuel-meter ${fuelLow ? 'is-low' : ''} ${fuelEmpty ? 'is-empty' : ''}`}
            title={`${fuel.toFixed(1)} L / ${fuelCapacity} L${
              telemetry.fuelRangeKm ? ` · about ${Math.round(telemetry.fuelRangeKm)} km range` : ''
            }`}
          >
            <div className="fuel-line">
              <span className="fuel-label">FUEL</span>
              <span className="fuel-track"><span style={{ width: `${fuelPercent}%` }} /></span>
              <span className="fuel-value">{fuel.toFixed(1)} L</span>
              <button
                type="button"
                className="fuel-refuel"
                onClick={onRefuel}
                title="Refuel (U)"
              >
                REFUEL
              </button>
            </div>
            <div className="fuel-sub">
              <span>{fuelEmpty ? 'EMPTY' : `${fuelPercent}%`}</span>
              <span>{consumption > 0.1 ? `AVG ${consumption.toFixed(1)} L/100km` : 'AVG —'}</span>
            </div>
          </div>

          <div className="dash-pedals">
            <Pedal label="THR" value={telemetry.throttle ?? 0} tone="throttle" />
            {transmission.type === 'manual' && <Pedal label="CLT" value={telemetry.clutch ?? 0} tone="clutch" />}
            <Pedal label="BRK" value={telemetry.brake ?? 0} tone="brake" />
          </div>
        </div>

        <Gauge
          value={telemetry.rpm ?? engine.idleRpm}
          max={engine.maxRpm}
          redline={engine.redline}
          majorStep={1000}
          label="RPM"
          unit="rpm"
          displayValue={String(Math.round((telemetry.rpm ?? engine.idleRpm) / 10) * 10)}
          color="#7c8cff"
          colorEnd="#ff4d5e"
          valueSize={38}
          sweepKey={ignitionSweep}
        />
      </div>

      <div className="dash-stats">
        <div className="stat">
          <span className="stat-label">Distance</span>
          <span className="stat-value">
            {(telemetry.distanceKm ?? 0).toFixed(2)}
            <small>km</small>
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">Drive time</span>
          <span className="stat-value">{formatTime(telemetry.elapsed ?? 0)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Top speed</span>
          <span className="stat-value">
            {Math.round(telemetry.maxSpeedKmh ?? 0)}
            <small>km/h</small>
          </span>
        </div>
        <div className="stat stat-status">
          <span className="stat-label">System</span>
          <span className={`stat-value status-value ${
            ignitionOff ? 'is-ignition-off'
              : shiftShock ? 'is-shock'
                : drifting ? 'is-handbrake'
                : handbrakeOn ? 'is-handbrake'
                  : engineBraking ? 'is-engine-brake'
                    : telemetry.tractionLimited ? 'is-active' : ''
          }`}>
            {ignitionOff
              ? 'IGNITION OFF'
              : shiftShock
                ? 'SHIFT SHOCK'
                : drifting
                  ? `DRIFT ${Math.round(Math.abs(telemetry.slipAngle) * 180 / Math.PI)}°`
                : handbrakeOn
                  ? 'HANDBRAKE'
                  : engineBraking
                    ? 'ENGINE BRAKE'
                    : telemetry.tractionControl
                      ? (telemetry.tractionLimited ? 'TSC ACTIVE' : 'TSC ON')
                      : 'TSC OFF'}
          </span>
        </div>
      </div>
    </section>
  )
}
