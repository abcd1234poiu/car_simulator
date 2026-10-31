import { useId } from 'react'
import { formatDistance } from '../taxi/dispatch.js'
import { roadCenter } from '../taxi/road.js'

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

export function TaxiMap({ ticket, distance, lateral = 0, status, roadSeed = 0, compact = false }) {
  const blocksId = useId()
  const origin = Math.min(ticket.originDistance, distance)
  const span = Math.max(300, ticket.dropoff.distance - origin)
  const yAt = (metres) => clamp(226 - ((metres - origin) / span) * 188, 30, 228)
  const xAt = (metres) => 150 + (roadCenter(metres, roadSeed) - roadCenter(origin, roadSeed)) * 2.25
  const pathBetween = (start, end) => Array.from({ length: 41 }, (_, index) => {
    const metres = start + (end - start) * index / 40
    return `${index ? 'L' : 'M'}${xAt(metres).toFixed(1)} ${yAt(metres).toFixed(1)}`
  }).join(' ')
  const playerY = yAt(distance)
  const playerX = xAt(distance) + lateral * 2.25
  const pickupY = yAt(ticket.pickup.distance)
  const pickupX = xAt(ticket.pickup.distance)
  const dropoffY = yAt(ticket.dropoff.distance)
  const dropoffX = xAt(ticket.dropoff.distance)
  const roadPath = pathBetween(origin, ticket.dropoff.distance)
  const branchStops = Array.from({ length: Math.ceil(span / 180) + 1 }, (_, index) =>
    Math.ceil(origin / 180) * 180 + index * 180).filter((metres) => metres <= ticket.dropoff.distance)

  return (
    <div className={`taxi-map ${compact ? 'taxi-map-compact' : ''}`}
      role="img" aria-label={`Route map: ${ticket.pickup.name} pickup, ${ticket.dropoff.name} drop-off; current position ${formatDistance(Math.max(0, (status === 'trip' ? ticket.dropoff.distance : ticket.pickup.distance) - distance))} from next stop`}>
      <svg viewBox="0 0 300 260" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <pattern id={blocksId} width="66" height="46" patternUnits="userSpaceOnUse">
            <rect x="3" y="3" width="59" height="39" rx="5" fill="#142735" />
            <rect x="10" y="9" width="22" height="12" rx="2" fill="#1b3b46" />
            <rect x="36" y="9" width="17" height="26" rx="2" fill="#1b3b46" />
            <rect x="10" y="25" width="20" height="10" rx="2" fill="#214c49" />
          </pattern>
        </defs>
        <rect width="300" height="260" fill="#0c1e2a" />
        <rect width="300" height="260" fill={`url(#${blocksId})`} />
        {branchStops.map((metres, index) => {
          const x = xAt(metres)
          const y = yAt(metres)
          const branch = index % 3 === 0
            ? `M16 ${y + 5} L${x} ${y} L284 ${y - 9}`
            : `M16 ${y - 5} L${x} ${y} L284 ${y + 8}`
          return <path key={metres} d={branch} stroke="#394d58" strokeWidth="13" fill="none" strokeLinejoin="round" />
        })}
        <path d={roadPath} stroke="#60717b" strokeWidth="27" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d={roadPath} stroke="#d5d4ac" strokeWidth="1.3" strokeDasharray="5 9" fill="none" opacity="0.75" />
        <path d={pathBetween(status === 'trip' ? distance : ticket.pickup.distance, ticket.dropoff.distance)} stroke="#52efd4" strokeWidth="10" fill="none" strokeLinecap="round" opacity="0.25" />
        <path d={pathBetween(status === 'trip' ? distance : ticket.pickup.distance, ticket.dropoff.distance)} stroke="#5cf3d5" strokeWidth="4" fill="none" strokeLinecap="round" />
        {status !== 'trip' && <path d={pathBetween(distance, ticket.pickup.distance)} stroke="#f9c86a" strokeWidth="3" strokeDasharray="5 5" fill="none" />}
        {status !== 'trip' && (
          <g transform={`translate(${pickupX} ${pickupY})`}>
            <circle r="12" fill="#f9c86a" stroke="#fff1c9" strokeWidth="2" />
            <text y="4" textAnchor="middle" fontSize="11" fontWeight="900" fill="#22210e">P</text>
          </g>
        )}
        <g transform={`translate(${dropoffX} ${dropoffY})`}>
          <circle r="12" fill="#fb7185" stroke="#ffe2e8" strokeWidth="2" />
          <text y="4" textAnchor="middle" fontSize="11" fontWeight="900" fill="#2b0d15">D</text>
        </g>
        <g transform={`translate(${playerX} ${playerY})`}>
          <circle r="16" fill="#061a22" opacity="0.65" />
          <circle r="10" fill="#69bbff" stroke="white" strokeWidth="2.5" />
          <path d="M0 -4L3 4H-3Z" fill="#103148" />
        </g>
      </svg>
      <div className="taxi-map-legend"><span><i className="map-dot map-you" /> You</span><span><i className="map-dot map-pickup" /> Pickup</span><span><i className="map-dot map-dropoff" /> Drop-off</span></div>
    </div>
  )
}
