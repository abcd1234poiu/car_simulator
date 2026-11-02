import { useEffect, useId, useState } from 'react'

const START_ANGLE = -135
const SWEEP = 270
const CX = 120
const CY = 120
const RADIUS = 96

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

function polar(angleDeg, radius) {
  const angle = (angleDeg * Math.PI) / 180
  return {
    x: CX + Math.sin(angle) * radius,
    y: CY - Math.cos(angle) * radius,
  }
}

function arcPath(fromAngle, toAngle) {
  const start = polar(fromAngle, RADIUS)
  const end = polar(toAngle, RADIUS)
  const largeArc = Math.abs(toAngle - fromAngle) > 180 ? 1 : 0
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`
}

export function Gauge({
  value,
  max,
  redline,
  label,
  unit,
  displayValue,
  color = '#34e1c8',
  colorEnd,
  majorStep,
  valueSize = 46,
  sweepKey = 0,
}) {
  const gradientId = useId().replace(/[^a-zA-Z0-9]/g, '')
  const [sweep, setSweep] = useState(0)
  const fraction = clamp(value / max, 0, 1)
  const hasRedline = Number.isFinite(redline)
  const redlineFraction = hasRedline ? clamp(redline / max, 0, 1) : 2
  const displayedFraction = fraction + (1 - fraction) * sweep
  const needleAngle = START_ANGLE + displayedFraction * SWEEP
  const endColor = colorEnd ?? color

  useEffect(() => {
    if (!sweepKey) return undefined
    let frame = 0
    const startedAt = performance.now()
    const duration = 1250
    const tick = (now) => {
      const t = Math.min(1, (now - startedAt) / duration)
      setSweep(Math.sin(t * Math.PI))
      if (t < 1) frame = requestAnimationFrame(tick)
      else setSweep(0)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [sweepKey])

  const majors = []
  const steps = Math.max(1, Math.round(max / majorStep))
  for (let i = 0; i <= steps; i += 1) {
    const majorValue = i * majorStep
    if (majorValue > max) break
    const majorFraction = majorValue / max
    majors.push({
      value: majorValue,
      angle: START_ANGLE + majorFraction * SWEEP,
      inRedline: hasRedline && majorValue >= redline,
    })
  }

  const shownValue = sweep > 0.001
    ? Math.round(value + (max - value) * sweep).toLocaleString('en-US')
    : (displayValue ?? value.toLocaleString('en-US'))

  return (
    <div className="gauge">
      <svg
        viewBox="0 0 240 240"
        role="img"
        aria-label={`${label}: ${shownValue} ${unit}`}
        className="gauge-svg"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={endColor} />
          </linearGradient>
        </defs>

        <path
          d={arcPath(START_ANGLE, START_ANGLE + SWEEP)}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth="10"
          strokeLinecap="round"
        />

        {hasRedline && <path
          d={arcPath(START_ANGLE + redlineFraction * SWEEP, START_ANGLE + SWEEP)}
          fill="none"
          stroke="rgba(255,77,94,0.55)"
          strokeWidth="10"
          strokeLinecap="round"
        />}

        <path
          d={arcPath(START_ANGLE, Math.max(START_ANGLE + 0.5, needleAngle))}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="10"
          strokeLinecap="round"
        />

        {majors.map((major) => {
          const outer = polar(major.angle, 84)
          const inner = polar(major.angle, 75)
          const text = polar(major.angle, 63)
          return (
            <g key={major.value}>
              <line
                x1={outer.x}
                y1={outer.y}
                x2={inner.x}
                y2={inner.y}
                stroke={major.inRedline ? 'rgba(255,77,94,0.85)' : 'rgba(255,255,255,0.32)'}
                strokeWidth="2"
                strokeLinecap="round"
              />
              <text
                x={text.x}
                y={text.y}
                textAnchor="middle"
                dominantBaseline="central"
                className="gauge-tick-label"
                fill={major.inRedline ? 'rgba(255,120,132,0.9)' : 'rgba(214,226,241,0.5)'}
              >
                {major.value >= 1000 ? major.value / 1000 : major.value}
              </text>
            </g>
          )
        })}

        <g transform={`rotate(${needleAngle} ${CX} ${CY})`}>
          <line
            x1={CX}
            y1={CY}
            x2={CX}
            y2={CY - 68}
            stroke={displayedFraction >= redlineFraction ? '#ff6b78' : endColor}
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <circle cx={CX} cy={CY - 68} r="3" fill={displayedFraction >= redlineFraction ? '#ff6b78' : endColor} />
        </g>
        <circle cx={CX} cy={CY} r="6" fill="#0b1119" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />

        <text
          x={CX}
          y={CY + 26}
          textAnchor="middle"
          className="gauge-value"
          style={{ fontSize: `${valueSize}px` }}
        >
          {shownValue}
        </text>
        <text x={CX} y={CY + 48} textAnchor="middle" className="gauge-unit">
          {unit}
        </text>
        <text x={CX} y={CY + 76} textAnchor="middle" className="gauge-label">
          {label}
        </text>
      </svg>
    </div>
  )
}
