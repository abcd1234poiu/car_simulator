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

export function Dashboard({ car, engine, transmission, telemetry, shiftPulse }) {
  const rpmFraction = telemetry.rpmFraction ?? 0
  const litLights = Math.round(
    Math.max(0, (rpmFraction - 0.55) / 0.45) * SHIFT_LIGHTS,
  )
  const automatic = transmission.type === 'automatic'

  return (
    <section className="dashboard" aria-label="Driving dashboard">
      <div className="dash-identity">
        <div className="dash-car" style={{ '--car-color': car.color }}>
          {car.name}
        </div>
        <div className="dash-car-meta">{car.className}</div>
        <div className="dash-chips">
          <span className="chip chip-engine">{engine.badge}</span>
          <span className="chip">{car.drivetrain}</span>
        </div>
        <div className="dash-mode">{automatic ? 'AUTOMATIC' : 'MANUAL'}</div>
      </div>

      <div className="dash-gauges">
        <Gauge
          value={telemetry.speedKmh ?? 0}
          max={300}
          redline={260}
          majorStep={50}
          label="SPEED"
          unit="km/h"
          displayValue={String(Math.round(telemetry.speedKmh ?? 0))}
          color="#34e1c8"
          colorEnd="#7c8cff"
          valueSize={50}
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
            <span className="gear-prefix">{automatic ? 'D' : 'M'}</span>
            <span key={shiftPulse} className="gear-value">
              {telemetry.gear ?? 1}
            </span>
            <span className="gear-total">/ {telemetry.gearCount ?? transmission.gearRatios.length}</span>
          </div>
          <div className="gear-caption">
            {automatic ? 'GEAR · AUTO' : 'GEAR · E / Q TO SHIFT'}
          </div>

          <div className="dash-pedals">
            <Pedal label="THR" value={telemetry.throttle ?? 0} tone="throttle" />
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
      </div>
    </section>
  )
}
