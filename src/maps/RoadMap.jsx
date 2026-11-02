import { useEffect, useRef } from 'react'
import {
  BRIDGE, DISTRICTS, ROAD_SEGMENTS, WATERWAY, WORLD_BOUNDS, cityLabelAt,
  nearestRoad, streetRoute,
} from './roadWorld.js'

const VARIANTS = {
  hud: { width: 184, height: 184, rotating: true, round: true },
  phone: { width: 286, height: 180, rotating: false, round: false },
  overview: { width: 900, height: 640, rotating: false, round: false },
}

function drawLine(context, points, project, color, width) {
  if (points.length < 2) return
  context.beginPath()
  points.forEach((point, index) => {
    const screen = project(point.x, point.z)
    if (index === 0) context.moveTo(screen.x, screen.y)
    else context.lineTo(screen.x, screen.y)
  })
  context.strokeStyle = color
  context.lineWidth = width
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.stroke()
}

function drawMap(canvas, { telemetry, ticket, status, variant, destination }) {
  const context = canvas.getContext('2d')
  if (!context) return null
  const config = VARIANTS[variant] ?? VARIANTS.hud
  const width = Math.max(1, Math.round(canvas.clientWidth || config.width))
  const height = Math.max(1, Math.round(canvas.clientHeight || config.height))
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
  }
  context.setTransform(dpr, 0, 0, dpr, 0, 0)
  context.clearRect(0, 0, width, height)

  const x = telemetry?.x ?? 0
  const z = telemetry?.z ?? 1080
  const heading = telemetry?.heading ?? 0
  const target = status === 'pickup' ? ticket?.pickup : status === 'trip' ? ticket?.dropoff : null
  const route = target ? streetRoute({ x, z }, target) : []
  const destinationRoute = destination ? streetRoute({ x, z }, destination) : []
  const centerX = width / 2
  const centerY = height / 2
  const worldWidth = WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX
  const worldHeight = WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ
  let viewX = x
  let viewZ = z
  let scale = Math.min(width / 460, height / 460)
  if (variant === 'overview') {
    viewX = (WORLD_BOUNDS.minX + WORLD_BOUNDS.maxX) / 2
    viewZ = (WORLD_BOUNDS.minZ + WORLD_BOUNDS.maxZ) / 2
    scale = Math.min((width - 42) / worldWidth, (height - 42) / worldHeight)
  } else if (variant === 'phone') {
    const points = [{ x, z }, ...route, ...destinationRoute]
    if (ticket?.pickup) points.push(ticket.pickup)
    if (ticket?.dropoff) points.push(ticket.dropoff)
    if (destination) points.push(destination)
    const minX = Math.min(...points.map((point) => point.x))
    const maxX = Math.max(...points.map((point) => point.x))
    const minZ = Math.min(...points.map((point) => point.z))
    const maxZ = Math.max(...points.map((point) => point.z))
    viewX = (minX + maxX) / 2
    viewZ = (minZ + maxZ) / 2
    scale = Math.min((width - 36) / Math.max(420, (maxX - minX) * 1.2),
      (height - 32) / Math.max(280, (maxZ - minZ) * 1.2))
  }
  const rotation = config.rotating ? -heading : 0
  const cos = Math.cos(rotation)
  const sin = Math.sin(rotation)
  const project = (worldX, worldZ) => {
    const dx = (worldX - viewX) * scale
    const dz = (worldZ - viewZ) * scale
    return { x: centerX + dx * cos - dz * sin, y: centerY + dx * sin + dz * cos }
  }

  context.save()
  context.beginPath()
  if (config.round) context.arc(centerX, centerY, Math.min(width, height) / 2, 0, Math.PI * 2)
  else context.rect(0, 0, width, height)
  context.clip()
  context.fillStyle = '#1b2b27'
  context.fillRect(0, 0, width, height)

  const landNW = project(-2880, -3100)
  const landSW = project(-2880, 2700)
  const waterEdge = Math.min(landNW.x, landSW.x)
  context.fillStyle = '#17415a'
  context.fillRect(0, 0, waterEdge, height)
  const south = project(0, 2500)
  if (variant !== 'hud') context.fillRect(0, south.y, width, height - south.y)

  const riverCorners = [
    project(WATERWAY.xMin, WATERWAY.zMin),
    project(WATERWAY.xMax, WATERWAY.zMin),
    project(WATERWAY.xMax, WATERWAY.zMax),
    project(WATERWAY.xMin, WATERWAY.zMax),
  ]
  context.beginPath()
  riverCorners.forEach((point, index) => {
    if (index === 0) context.moveTo(point.x, point.y)
    else context.lineTo(point.x, point.y)
  })
  context.closePath()
  context.fillStyle = '#17415a'
  context.fill()

  // All road classes use the same source geometry as the 3D scene and physics.
  for (const road of ROAD_SEGMENTS) {
    const a = project(road.a.x, road.a.z)
    const b = project(road.b.x, road.b.z)
    if (Math.max(a.x, b.x) < -20 || Math.min(a.x, b.x) > width + 20 ||
      Math.max(a.y, b.y) < -20 || Math.min(a.y, b.y) > height + 20) continue
    context.beginPath()
    context.moveTo(a.x, a.y)
    context.lineTo(b.x, b.y)
    context.lineCap = 'round'
    context.strokeStyle = '#0a151c'
    context.lineWidth = Math.max(1.2, (road.halfWidth * 2 + 3) * scale)
    context.stroke()
    context.strokeStyle = road.bridge ? '#a7c9cf' : road.kind === 'freeway' ? '#6c9aab' :
      road.kind === 'highway' ? '#aa9c76' : '#8b9692'
    context.lineWidth = Math.max(0.9, road.halfWidth * 2 * scale)
    context.stroke()
  }

  if (variant === 'overview') {
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.font = '700 10px ui-monospace, monospace'
    for (const district of DISTRICTS) {
      const point = project(district.x, district.z)
      context.lineWidth = 3
      context.strokeStyle = '#0c171b'
      context.fillStyle = '#e1ece8'
      context.strokeText(district.name.toUpperCase(), point.x, point.y)
      context.fillText(district.name.toUpperCase(), point.x, point.y)
    }
    const bridge = project((BRIDGE.xMin + BRIDGE.xMax) / 2, BRIDGE.z - 130)
    context.fillStyle = '#b6dfe3'
    context.fillText('A7 RIVER BRIDGE', bridge.x, bridge.y)
  }

  drawLine(context, route, project, '#071b24', 9)
  drawLine(context, route, project, '#5cf3d5', 4)
  drawLine(context, destinationRoute, project, '#071b24', 8)
  drawLine(context, destinationRoute, project, '#69bbff', 3)

  const drawPin = (point, label, color) => {
    if (!point) return
    const screen = project(point.x, point.z)
    const margin = 14
    const px = clamp(screen.x, margin, width - margin)
    const py = clamp(screen.y, margin, height - margin)
    context.beginPath()
    context.arc(px, py, 7, 0, Math.PI * 2)
    context.fillStyle = color
    context.fill()
    context.lineWidth = 2
    context.strokeStyle = '#07131a'
    context.stroke()
    context.fillStyle = '#07131a'
    context.font = '700 9px ui-monospace, monospace'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(label, px, py + 0.5)
  }
  drawPin(ticket?.pickup, 'P', '#f9c86a')
  drawPin(ticket?.dropoff, 'D', '#fb7185')
  drawPin(destination, 'X', '#69bbff')

  const car = project(x, z)
  context.save()
  context.translate(car.x, car.y)
  context.rotate(config.rotating ? 0 : heading)
  context.beginPath()
  context.moveTo(0, -10)
  context.lineTo(7, 8)
  context.lineTo(0, 5)
  context.lineTo(-7, 8)
  context.closePath()
  context.fillStyle = '#f5faf9'
  context.strokeStyle = '#07131a'
  context.lineWidth = 2.5
  context.stroke()
  context.fill()
  context.restore()
  context.restore()
  return { viewX, viewZ, scale, centerX, centerY }
}

const clamp = (value, low, high) => Math.max(low, Math.min(high, value))

export function RoadMap({ telemetry, ticket, status = 'available', variant = 'hud',
  destination = null, onPickDestination }) {
  const canvasRef = useRef(null)
  const viewRef = useRef(null)
  useEffect(() => {
    if (!canvasRef.current) return
    viewRef.current = drawMap(canvasRef.current, { telemetry, ticket, status, variant, destination })
  }, [telemetry, ticket, status, variant, destination])

  const handleClick = (event) => {
    if (variant !== 'overview' || !onPickDestination || !viewRef.current) return
    const rect = event.currentTarget.getBoundingClientRect()
    const view = viewRef.current
    const x = view.viewX + ((event.clientX - rect.left) / rect.width * event.currentTarget.clientWidth - view.centerX) / view.scale
    const z = view.viewZ + ((event.clientY - rect.top) / rect.height * event.currentTarget.clientHeight - view.centerY) / view.scale
    const snapped = nearestRoad(x, z, true)
    if (snapped) onPickDestination({ x: snapped.x, z: snapped.z })
  }

  if (variant === 'hud') return (
    <div className="minimap" aria-hidden="true">
      <canvas ref={canvasRef} className="minimap-canvas" />
    </div>
  )
  return (
    <div className={`city-map city-map-${variant}`}>
      <canvas ref={canvasRef}
        className={`city-map-canvas ${onPickDestination && variant === 'overview' ? 'is-pickable' : ''}`}
        aria-hidden="true" onClick={handleClick} />
      <div className="city-map-legend">
        <span><i className="map-dot map-you" /> You</span>
        <span><i className="map-dot map-pickup" /> Pickup</span>
        <span><i className="map-dot map-dropoff" /> Drop-off</span>
        {destination && <span><i className="map-dot map-destination" /> Destination</span>}
        {variant === 'overview' && telemetry &&
          <span className="city-map-district">{cityLabelAt(telemetry.x, telemetry.z)}</span>}
      </div>
    </div>
  )
}
