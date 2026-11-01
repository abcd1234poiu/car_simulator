import { useEffect, useMemo, useState } from 'react'
import {
  ChevronRight,
  Gauge,
  Music2,
  Play,
  Volume2,
  VolumeX,
} from 'lucide-react'
import {
  ASPIRATIONS,
  ALL_TRANSMISSIONS,
  CARS,
  ENGINES,
  TRANSMISSIONS,
  TYRES,
  TYRE_ORDER,
  DEFAULT_TYRE,
  DEFAULT_SELECTION,
  defaultAspirationForEngine,
  getAspiration,
  getCar,
  getEngine,
  getTransmission,
} from '../constants/config.js'
import { peakPowerHp, peakTorqueNm, performanceSummary } from '../engine/specs.js'
import { CarSilhouette } from '../components/CarSilhouette.jsx'
import '../styles/select.css'

export function SelectView({ audio, muted, onToggleMute, onStart }) {
  const [carId, setCarId] = useState(DEFAULT_SELECTION.carId)
  const [engineId, setEngineId] = useState(DEFAULT_SELECTION.engineId)
  const [aspirationId, setAspirationId] = useState(
    () => defaultAspirationForEngine(getEngine(DEFAULT_SELECTION.engineId)).id,
  )
  const [transmissionId, setTransmissionId] = useState(DEFAULT_SELECTION.transmissionId)
  const [tyreId, setTyreId] = useState(DEFAULT_TYRE)
  const [preview, setPreview] = useState({ engineId: null, aspirationId: null, active: false })

  const car = getCar(carId)
  const engine = getEngine(engineId)
  const aspiration = getAspiration(aspirationId)
  const transmission = getTransmission(transmissionId)
  const tyre = TYRES[tyreId] ?? TYRES[DEFAULT_TYRE]
  const factoryAspiration = defaultAspirationForEngine(engine)
  const previewing = preview.active && preview.engineId === engine.id &&
    preview.aspirationId === aspiration.id
  const specs = useMemo(
    () => performanceSummary(car, engine, transmission, aspiration),
    [car, engine, transmission, aspiration],
  )

  const stopPreview = () => {
    audio.stopPreview()
    audio.stop()
    setPreview({ engineId: null, aspirationId: null, active: false })
  }

  const selectCar = (nextCar) => {
    stopPreview()
    setCarId(nextCar.id)
    const nextEngineId = nextCar.engines.includes(engineId) ? engineId : nextCar.defaultEngine
    setEngineId(nextEngineId)
    setAspirationId(defaultAspirationForEngine(getEngine(nextEngineId)).id)
    if (!ALL_TRANSMISSIONS.includes(transmissionId)) {
      setTransmissionId(nextCar.defaultTransmission)
    }
  }

  const selectEngine = (nextEngineId) => {
    stopPreview()
    setEngineId(nextEngineId)
    setAspirationId(defaultAspirationForEngine(getEngine(nextEngineId)).id)
  }

  const selectAspiration = (nextAspirationId) => {
    stopPreview()
    setAspirationId(nextAspirationId)
  }

  useEffect(() => () => audio.stopPreview(), [audio])

  const togglePreview = () => {
    if (previewing) {
      stopPreview()
    } else {
      const ok = audio.preview(engine, aspiration)
      setPreview({ engineId: engine.id, aspirationId: aspiration.id, active: ok })
    }
  }

  const start = () => {
    audio.stopPreview()
    onStart(car, engine, transmission, aspiration, tyre)
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
            METRO<span>CAB</span>
          </span>
          <span className="brand-tag">DRIVER SIM</span>
        </div>
        <div className="nav-actions">
          <span className="nav-note">Open-city free roam · dispatch fares on the live city map</span>
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
              TAXI DRIVER SIMULATOR
            </span>
            <h1>
              Take the wheel.
              <br />
              <span className="accent-text">Pick up the city.</span>
            </h1>
            <p className="hero-copy">
              Choose your cab, then head straight into the open world. Accept a fare on
              the dispatch phone whenever you like, follow the live map to each pickup
              and drop-off, and explore Metro City plus the A1-linked towns of Riverside,
              Northgate, Southport, Highland and Suncoast — plus the Genting and Batang
              mountain passes. Taxi work and free roam are the same session.
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
                <strong>{Object.keys(ASPIRATIONS).length}</strong>
                <span>Aspiration</span>
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
              <h2>Choose your fleet car</h2>
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
              <span className="summary-label">YOUR TAXI</span>
              <span className="summary-class">{car.className}</span>
            </div>
            <CarSilhouette car={car} />
            <div className="summary-name">{car.name}</div>
            <div className="summary-line">
              {aspiration.shortName} {engine.name} · {transmission.shortName} · {tyre.shortName} · {car.drivetrain}
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
                        {peakPowerHp(option, aspiration)} hp ·{' '}
                        {peakTorqueNm(option, aspiration)} Nm ·{' '}
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
              <h3>Aspiration</h3>
              <span className="config-hint">{aspiration.badge}</span>
            </div>

            <div className="aspiration-grid">
              {Object.values(ASPIRATIONS).map((option) => {
                const active = option.id === aspiration.id
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`aspiration-option ${active ? 'is-active' : ''}`}
                    onClick={() => selectAspiration(option.id)}
                    aria-pressed={active}
                    title={option.description}
                  >
                    <span className="aspiration-badge">{option.badge}</span>
                    <strong>{option.shortName}</strong>
                  </button>
                )
              })}
            </div>
            <p className="transmission-note">
              {aspiration.description}
              {aspiration.id !== factoryAspiration.id
                ? ` Factory tune for this engine is ${factoryAspiration.shortName}.`
                : ' Factory tune for this engine.'}
            </p>
          </section>

          <section className="config-section">
            <div className="config-head">
              <span className="step">04</span>
              <h3>Transmission</h3>
              <span className="config-hint">{ALL_TRANSMISSIONS.length} available</span>
            </div>

            <div className="transmission-toggle">
              {ALL_TRANSMISSIONS.map((id) => {
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

          <section className="config-section">
            <div className="config-head">
              <span className="step">05</span>
              <h3>Tyres</h3>
              <span className="config-hint">{tyre.badge}</span>
            </div>

            <div className="aspiration-grid">
              {TYRE_ORDER.map((id) => {
                const option = TYRES[id]
                const active = option.id === tyre.id
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`aspiration-option ${active ? 'is-active' : ''}`}
                    onClick={() => setTyreId(option.id)}
                    aria-pressed={active}
                    title={option.description}
                  >
                    <span className="aspiration-badge">{option.badge}</span>
                    <strong>{option.shortName}</strong>
                  </button>
                )
              })}
            </div>
            <p className="transmission-note">
              {tyre.description} Grip {Math.round(tyre.grip * 100)}% · wear rate {tyre.wearRate.toFixed(1)}×.
            </p>
          </section>

          <div className="start-panel">
            <div className="session-brief">
              <span className="session-brief-badge">CITY SHIFT</span>
              <strong>Free roam + taxi dispatch</strong>
              <small>
                Explore Metro City, Riverside, Northgate, Southport, Highland and
                Suncoast, linked by the A1 autobahn and exit links. Accept fares from
                the in-game phone whenever you want — one world, one map, no mode
                switch.
              </small>
            </div>

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
              Enter the city
              <ChevronRight size={20} />
            </button>
            <p className="start-hint">
              Accept jobs on the dispatch phone · WASD or arrow keys · Click or drag pedals on any device
            </p>
          </div>
        </aside>
      </main>
    </div>
  )
}
