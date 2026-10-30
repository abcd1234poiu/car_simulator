import { useEffect, useMemo, useState } from 'react'
import {
  ChevronRight,
  Gauge,
  Music2,
  Play,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { CARS, ENGINES, TRANSMISSIONS, getCar, getEngine, getTransmission, DEFAULT_SELECTION } from '../constants/config.js'
import { peakPowerHp, peakTorqueNm, performanceSummary } from '../engine/specs.js'
import { CarSilhouette } from '../components/CarSilhouette.jsx'
import '../styles/select.css'

export function SelectView({ audio, muted, onToggleMute, onStart }) {
  const [carId, setCarId] = useState(DEFAULT_SELECTION.carId)
  const [engineId, setEngineId] = useState(DEFAULT_SELECTION.engineId)
  const [transmissionId, setTransmissionId] = useState(DEFAULT_SELECTION.transmissionId)
  const [preview, setPreview] = useState({ engineId: null, active: false })

  const car = getCar(carId)
  const engine = getEngine(engineId)
  const transmission = getTransmission(transmissionId)
  const previewing = preview.active && preview.engineId === engine.id
  const specs = useMemo(
    () => performanceSummary(car, engine, transmission),
    [car, engine, transmission],
  )

  const stopPreview = () => {
    audio.stopPreview()
    audio.stop()
    setPreview({ engineId: null, active: false })
  }

  const selectCar = (nextCar) => {
    stopPreview()
    setCarId(nextCar.id)
    if (!nextCar.engines.includes(engineId)) setEngineId(nextCar.defaultEngine)
    if (!nextCar.transmissions.includes(transmissionId)) {
      setTransmissionId(nextCar.defaultTransmission)
    }
  }

  const selectEngine = (nextEngineId) => {
    stopPreview()
    setEngineId(nextEngineId)
  }

  useEffect(() => () => audio.stopPreview(), [audio])

  const togglePreview = () => {
    if (previewing) {
      stopPreview()
    } else {
      const ok = audio.preview(engine)
      setPreview({ engineId: engine.id, active: ok })
    }
  }

  const start = () => {
    audio.stopPreview()
    onStart(car, engine, transmission)
  }

  return (
    <div className="select-screen">
      <div className="glow glow-a" aria-hidden="true" />
      <div className="glow glow-b" aria-hidden="true" />

      <header className="site-nav">
        <div className="brand">
          <span className="brand-mark">
            <Gauge size={18} />
          </span>
          <span className="brand-text">
            APEX<span>DRIVE</span>
          </span>
          <span className="brand-tag">WEB SIM</span>
        </div>
        <div className="nav-actions">
          <span className="nav-note">Endless highway · synthesized sound</span>
          <button
            type="button"
            className="icon-button"
            onClick={onToggleMute}
            aria-label={muted ? 'Unmute sound' : 'Mute sound'}
            title={muted ? 'Unmute sound' : 'Mute sound'}
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>
      </header>

      <main className="select-main">
        <div className="select-column">
          <section className="hero">
            <span className="eyebrow">
              <span className="pulse-dot" />
              BROWSER DRIVING SIMULATOR
            </span>
            <h1>
              Build your machine.
              <br />
              <span className="accent-text">Own the road.</span>
            </h1>
            <p className="hero-copy">
              Choose a chassis, dial in the powertrain and take on an endless highway.
              Every engine note is synthesized live from RPM — no samples, no downloads,
              just pure combustion math.
            </p>
            <div className="hero-stats">
              <div>
                <strong>{CARS.length}</strong>
                <span>Cars</span>
              </div>
              <div>
                <strong>{Object.keys(ENGINES).length}</strong>
                <span>Engines</span>
              </div>
              <div>
                <strong>{Object.keys(TRANSMISSIONS).length}</strong>
                <span>Gearboxes</span>
              </div>
            </div>
          </section>

          <section className="section">
            <div className="section-head">
              <span className="step">01</span>
              <h2>Choose your car</h2>
              <span className="section-hint">Tap a card to select</span>
            </div>

            <div className="car-grid">
              {CARS.map((candidate) => {
                const active = candidate.id === car.id
                return (
                  <button
                    key={candidate.id}
                    type="button"
                    className={`car-card ${active ? 'is-active' : ''}`}
                    style={{
                      '--car-color': candidate.color,
                      '--car-accent': candidate.accent,
                    }}
                    onClick={() => selectCar(candidate)}
                    aria-pressed={active}
                  >
                    <div className="car-card-top">
                      <span className="car-class">{candidate.className}</span>
                      <span className="car-selected">
                        {active ? 'SELECTED' : 'SELECT'}
                        <ChevronRight size={13} />
                      </span>
                    </div>

                    <CarSilhouette car={candidate} />

                    <div className="car-card-name">{candidate.name}</div>
                    <p className="car-tagline">{candidate.tagline}</p>

                    <div className="car-card-specs">
                      <span>{candidate.mass.toLocaleString('en-US')} kg</span>
                      <span>{candidate.drivetrain}</span>
                      <span>{candidate.seats} seats</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </section>

          <p className="footnote">
            Original audio, generated in your browser with the Web Audio API. No recordings
            or copyrighted samples are used.
          </p>
        </div>

        <aside className="configurator">
          <div className="config-summary" style={{ '--car-color': car.color }}>
            <div className="summary-top">
              <span className="summary-label">YOUR BUILD</span>
              <span className="summary-class">{car.className}</span>
            </div>
            <CarSilhouette car={car} />
            <div className="summary-name">{car.name}</div>
            <div className="summary-line">
              {engine.name} · {transmission.shortName} · {car.drivetrain}
            </div>
          </div>

          <section className="config-section">
            <div className="config-head">
              <span className="step">02</span>
              <h3>Engine</h3>
              <span className="config-hint">{car.engines.length} available</span>
            </div>

            <div className="engine-list">
              {car.engines.map((id) => {
                const option = ENGINES[id]
                const active = option.id === engine.id
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`engine-option ${active ? 'is-active' : ''}`}
                    onClick={() => selectEngine(option.id)}
                    aria-pressed={active}
                  >
                    <span className="engine-badge">{option.badge}</span>
                    <span className="engine-copy">
                      <strong>{option.name}</strong>
                      <small>
                        {peakPowerHp(option)} hp · {peakTorqueNm(option)} Nm ·{' '}
                        {option.redline.toLocaleString('en-US')} rpm
                      </small>
                    </span>
                    <span className="radio" />
                  </button>
                )
              })}
            </div>

            <p className="engine-note">{engine.character}</p>

            <button
              type="button"
              className={`preview-button ${previewing ? 'is-live' : ''}`}
              onClick={togglePreview}
            >
              <Music2 size={16} />
              {previewing ? 'Stop engine preview' : 'Rev engine preview'}
              {previewing && <span className="preview-bars" aria-hidden="true"><i /><i /><i /></span>}
            </button>
          </section>

          <section className="config-section">
            <div className="config-head">
              <span className="step">03</span>
              <h3>Transmission</h3>
            </div>

            <div className="transmission-toggle">
              {car.transmissions.map((id) => {
                const option = TRANSMISSIONS[id]
                const active = option.id === transmission.id
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`transmission-option ${active ? 'is-active' : ''}`}
                    onClick={() => setTransmissionId(option.id)}
                    aria-pressed={active}
                  >
                    <strong>{option.shortName}</strong>
                    <small>{option.gearRatios.length} gears</small>
                  </button>
                )
              })}
            </div>
            <p className="transmission-note">{transmission.description}</p>
          </section>

          <div className="start-panel">
            <dl className="final-specs">
              <div>
                <dt>Power</dt>
                <dd>
                  {specs.powerHp}
                  <small>hp</small>
                </dd>
              </div>
              <div>
                <dt>0–100</dt>
                <dd>
                  {specs.zeroTo100 ? specs.zeroTo100.toFixed(1) : '—'}
                  <small>s</small>
                </dd>
              </div>
              <div>
                <dt>Top speed</dt>
                <dd>
                  {specs.topSpeedKmh}
                  <small>km/h</small>
                </dd>
              </div>
            </dl>

            <button type="button" className="start-button" onClick={start}>
              <Play size={20} fill="currentColor" />
              Start driving
              <ChevronRight size={20} />
            </button>
            <p className="start-hint">
              Sound on for the full experience · WASD or arrow keys · Click or drag pedals
              on any device
            </p>
          </div>
        </aside>
      </main>
    </div>
  )
}
