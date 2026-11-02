import { useEffect, useRef } from 'react'
import {
  ALL_BLOCK_CENTERS,
  AUTOBAHN,
  BUILDINGS,
  CITY_LIMIT,
  CITY_LINKS,
  COSTA_COAST,
  DISTRICT_LABELS,
  FIELDS,
  GENTING,
  GENTING_ACCESSES,
  GENTING_ROUTES,
  LOT_HALF,
  PARKS,
  PARKED_CARS,
  PLAZAS,
  RIVER,
  ROAD_LINES,
  SIDEWALK,
  TOWNS,
  WORLD_BOUNDS,
  cityLabelAt,
  distanceBetween,
  districtAt,
  roadHalfAt,
  streetRoute,
  townRoadHalfAt,
} from './city.js'

const VARIANTS = {
  hud: { fallbackWidth: 184, fallbackHeight: 184, rotating: true, round: true, padding: 20 },
  phone: { fallbackWidth: 286, fallbackHeight: 180, rotating: false, round: false, padding: 18 },
  overview: { fallbackWidth: 900, fallbackHeight: 640, rotating: false, round: false, padding: 26 },
}

const currentTarget = (ticket, status) => {
  if (!ticket) return null
  if (status === 'pickup') return ticket.pickup
  if (status === 'trip') return ticket.dropoff
  return null
}

function boundsOf(points) {
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const point of points) {
    minX = Math.min(minX, point.x)
    maxX = Math.max(maxX, point.x)
    minZ = Math.min(minZ, point.z)
    maxZ = Math.max(maxZ, point.z)
  }
  return { minX, maxX, minZ, maxZ, width: maxX - minX, height: maxZ - minZ }
}

function drawMap(canvas, { telemetry, ticket, status, variant, destination }) {
  const context = canvas.getContext('2d')
  if (!context) return
  const config = VARIANTS[variant] ?? VARIANTS.hud
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const width = Math.max(1, Math.round(canvas.clientWidth || config.fallbackWidth))
  const height = Math.max(1, Math.round(canvas.clientHeight || config.fallbackHeight))

  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
  }
  context.setTransform(dpr, 0, 0, dpr, 0, 0)
  context.clearRect(0, 0, width, height)

  const centerX = width / 2
  const centerY = height / 2
  const radius = Math.min(width, height) / 2
  const x = telemetry?.x ?? 0
  const z = telemetry?.z ?? 0
  const heading = telemetry?.heading ?? 0
  const target = currentTarget(ticket, status)
  const stops = ticket
    ? [
        ticket.pickup && { stop: ticket.pickup, label: 'P', color: '#f9c86a', kind: 'pickup' },
        ticket.dropoff && { stop: ticket.dropoff, label: 'D', color: '#fb7185', kind: 'dropoff' },
      ].filter(Boolean)
    : []
  const route = target ? streetRoute({ x, z }, target) : []
  const destinationRoute = destination ? streetRoute({ x, z }, destination) : []

  let scale
  const worldWidth = WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX
  const worldHeight = WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ
  if (variant === 'overview') {
    scale = Math.min(
      (width - config.padding * 2) / (worldWidth + 60),
      (height - config.padding * 2) / (worldHeight + 60),
    )
  } else if (variant === 'phone') {
    const points = [
      { x, z },
      ...route,
      ...destinationRoute,
      ...stops.map((entry) => entry.stop),
      ...(destination ? [destination] : []),
    ]
    const box = boundsOf(points)
    const spanX = Math.max(240, box.width * 1.18)
    const spanZ = Math.max(180, box.height * 1.18)
    scale = Math.min(
      (width - config.padding * 2) / spanX,
      (height - config.padding * 2) / spanZ,
    )
  } else {
    const distance = target ? distanceBetween({ x, z }, target) : 0
    const span = target ? Math.max(280, Math.min(distance * 2.35, 2400)) : 340
    scale = (Math.min(width, height) - config.padding * 2) / span
  }
  scale = Math.max(scale, 0.0001)

  const viewX = variant === 'overview' ? (WORLD_BOUNDS.minX + WORLD_BOUNDS.maxX) / 2 : x
  const viewZ = variant === 'overview' ? (WORLD_BOUNDS.minZ + WORLD_BOUNDS.maxZ) / 2 : z
  const theta = config.rotating ? -heading : 0
  const cos = Math.cos(theta)
  const sin = Math.sin(theta)
  const project = (worldX, worldZ) => {
    const dx = (worldX - viewX) * scale
    const dz = (worldZ - viewZ) * scale
    return {
      x: centerX + dx * cos - dz * sin,
      y: centerY + dx * sin + dz * cos,
    }
  }

  context.save()
  context.beginPath()
  if (config.round) context.arc(centerX, centerY, radius, 0, Math.PI * 2)
  else context.rect(0, 0, width, height)
  context.clip()

  if (config.round) {
    const backdrop = context.createRadialGradient(centerX, centerY, 8, centerX, centerY, radius)
    backdrop.addColorStop(0, '#10202a')
    backdrop.addColorStop(1, '#070d13')
    context.fillStyle = backdrop
  } else {
    context.fillStyle = '#0b1822'
  }
  context.fillRect(0, 0, width, height)

  context.save()
  context.translate(centerX, centerY)
  context.rotate(theta)
  context.scale(scale, scale)
  context.translate(-viewX, -viewZ)

  // World base.
  context.fillStyle = '#0b1612'
  context.fillRect(
    WORLD_BOUNDS.minX,
    WORLD_BOUNDS.minZ,
    worldWidth,
    worldHeight,
  )

  // Costa Vista coastline.
  const { ocean, beach } = COSTA_COAST
  context.fillStyle = '#0b3446'
  context.fillRect(ocean.minX, ocean.minZ, ocean.maxX - ocean.minX, ocean.maxZ - ocean.minZ)
  context.fillStyle = '#6f6248'
  context.fillRect(beach.minX, beach.minZ, beach.maxX - beach.minX, beach.maxZ - beach.minZ)

  // Fields and open land.
  for (const field of FIELDS) {
    context.fillStyle = field.color
    context.fillRect(
      field.x - field.width / 2,
      field.z - field.depth / 2,
      field.width,
      field.depth,
    )
  }

  // River and embankments.
  context.fillStyle = '#0e3a4d'
  context.fillRect(
    RIVER.x - RIVER.halfWidth,
    RIVER.zMin,
    RIVER.halfWidth * 2,
    RIVER.zMax - RIVER.zMin,
  )
  context.strokeStyle = 'rgba(120, 160, 168, 0.45)'
  context.lineWidth = 2
  for (const side of [-1, 1]) {
    context.beginPath()
    context.moveTo(RIVER.x + side * (RIVER.halfWidth + 1.5), RIVER.zMin)
    context.lineTo(RIVER.x + side * (RIVER.halfWidth + 1.5), RIVER.zMax)
    context.stroke()
  }

  // Genting-style mountain terrain and contour rings.
  const mountainGradient = context.createRadialGradient(80, -1900, 60, 80, -1900, 980)
  mountainGradient.addColorStop(0, 'rgba(95, 98, 86, 0.5)')
  mountainGradient.addColorStop(0.45, 'rgba(52, 72, 48, 0.44)')
  mountainGradient.addColorStop(1, 'rgba(18, 32, 22, 0)')
  context.fillStyle = mountainGradient
  context.fillRect(
    GENTING.bounds.minX,
    GENTING.bounds.minZ,
    GENTING.bounds.maxX - GENTING.bounds.minX,
    GENTING.bounds.maxZ - GENTING.bounds.minZ,
  )
  const secondHill = context.createRadialGradient(-2600, -1800, 60, -2600, -1800, 1100)
  secondHill.addColorStop(0, 'rgba(95, 98, 86, 0.45)')
  secondHill.addColorStop(0.45, 'rgba(52, 72, 48, 0.4)')
  secondHill.addColorStop(1, 'rgba(18, 32, 22, 0)')
  context.fillStyle = secondHill
  context.fillRect(
    GENTING.bounds.minX,
    GENTING.bounds.minZ,
    GENTING.bounds.maxX - GENTING.bounds.minX,
    GENTING.bounds.maxZ - GENTING.bounds.minZ,
  )
  context.strokeStyle = 'rgba(142, 170, 138, 0.14)'
  context.lineWidth = 1.4
  for (const radius of [180, 340, 520, 700]) {
    context.beginPath()
    context.ellipse(80, -1950, radius, radius * 0.72, 0, 0, Math.PI * 2)
    context.stroke()
    context.beginPath()
    context.ellipse(-2600, -1800, radius, radius * 0.72, 0, 0, Math.PI * 2)
    context.stroke()
  }

  // Parks and paved plazas sit under the street grid.
  context.fillStyle = '#1d3a29'
  for (const park of PARKS) {
    context.fillRect(park.x - park.size / 2, park.z - park.size / 2, park.size, park.size)
  }
  context.fillStyle = '#414646'
  for (const plaza of PLAZAS) {
    context.fillRect(plaza.x - plaza.size / 2, plaza.z - plaza.size / 2, plaza.size, plaza.size)
  }

  // Metro City grid.
  context.lineCap = 'butt'
  context.strokeStyle = '#2b3139'
  for (const line of ROAD_LINES) {
    context.lineWidth = roadHalfAt(line) * 2
    context.beginPath()
    context.moveTo(line, -CITY_LIMIT)
    context.lineTo(line, CITY_LIMIT)
    context.stroke()
    context.beginPath()
    context.moveTo(-CITY_LIMIT, line)
    context.lineTo(CITY_LIMIT, line)
    context.stroke()
  }

  // Satellite town grids.
  for (const town of TOWNS) {
    const bounds = town.bounds
    for (const line of town.xLines) {
      context.lineWidth = townRoadHalfAt(town, line) * 2
      context.beginPath()
      context.moveTo(line, bounds.minZ)
      context.lineTo(line, bounds.maxZ)
      context.stroke()
    }
    for (const line of town.zLines) {
      context.lineWidth = townRoadHalfAt(town, line) * 2
      context.beginPath()
      context.moveTo(bounds.minX, line)
      context.lineTo(bounds.maxX, line)
      context.stroke()
    }
  }

  // Mountain access and the winding Genting-style road.
  for (const access of GENTING_ACCESSES) {
    context.lineWidth = access.halfWidth * 2
    context.beginPath()
    access.points.forEach((point, index) => {
      if (index === 0) context.moveTo(point.x, point.z)
      else context.lineTo(point.x, point.z)
    })
    context.stroke()
  }

  context.lineWidth = GENTING.halfWidth * 2
  for (const route of GENTING_ROUTES) {
    context.beginPath()
    route.samples.forEach((sample, index) => {
      if (index === 0) context.moveTo(sample.x, sample.z)
      else context.lineTo(sample.x, sample.z)
    })
    context.stroke()
  }

  // Autobahn exit links and the A1 itself.
  for (const link of CITY_LINKS) {
    context.lineWidth = link.halfWidth * 2
    context.beginPath()
    context.moveTo(link.xMin, link.z)
    context.lineTo(link.xMax, link.z)
    context.stroke()
  }

  context.lineWidth = AUTOBAHN.halfWidth * 2
  context.beginPath()
  context.moveTo(AUTOBAHN.x, AUTOBAHN.zMin)
  context.lineTo(AUTOBAHN.x, AUTOBAHN.zMax)
  context.stroke()

  // In the full-world view, solid block fills read like a city map instead of
  // thousands of tiny building dots. Close-up views keep the real footprints.
  const viewRange = variant === 'overview' ? Infinity : Math.hypot(width, height) / scale
  if (variant === 'overview') {
    const blockColors = {
      downtown: '#2b3744',
      'costa-downtown': '#293543',
      midtown: '#2b3239',
      'costa-east': '#303840',
      residential: '#26362f',
      'costa-southside': '#2d3830',
      oldtown: '#382f29',
      industrial: '#302f2c',
      'costa-airport': '#2d3236',
      harbor: '#2f3336',
      university: '#2b3533',
      riverside: '#2c3733',
      northgate: '#2d343a',
      southport: '#313633',
      highland: '#30373c',
      suncoast: '#343730',
      'costa-beach': '#3a3731',
      'costa-south-beach': '#38362f',
    }
    const blockSize = (LOT_HALF + SIDEWALK) * 2
    for (const block of ALL_BLOCK_CENTERS) {
      const district = districtAt(block.x, block.z)
      context.fillStyle = blockColors[district.id] ?? '#2b3733'
      context.fillRect(
        block.x - blockSize / 2,
        block.z - blockSize / 2,
        blockSize,
        blockSize,
      )
    }
    for (const building of BUILDINGS) {
      if (building.height < 55) continue
      const lift = Math.min(1, building.height / 140)
      context.fillStyle = `rgba(${130 + lift * 46}, ${148 + lift * 42}, ${166 + lift * 36}, 0.9)`
      context.fillRect(
        building.x - building.width / 2,
        building.z - building.depth / 2,
        building.width,
        building.depth,
      )
    }
  } else {
    for (const building of BUILDINGS) {
      if (Math.abs(building.x - viewX) > viewRange || Math.abs(building.z - viewZ) > viewRange) continue
      const lift = Math.min(1, building.height / 130)
      context.fillStyle = `rgba(${92 + lift * 52}, ${106 + lift * 48}, ${126 + lift * 42}, 0.85)`
      context.fillRect(
        building.x - building.width / 2,
        building.z - building.depth / 2,
        building.width,
        building.depth,
      )
    }
  }

  if (scale > 0.2) {
    context.fillStyle = 'rgba(170, 184, 201, 0.7)'
    for (const car of PARKED_CARS) {
      if (Math.abs(car.x - viewX) > viewRange || Math.abs(car.z - viewZ) > viewRange) continue
      context.fillRect(car.x - 1.1, car.z - 1.1, 2.2, 2.2)
    }

    // Painted road markings.
    context.strokeStyle = 'rgba(224, 234, 245, 0.28)'
    context.lineWidth = 0.7
    context.setLineDash([5, 7])
    for (const line of ROAD_LINES) {
      context.beginPath()
      context.moveTo(line, -CITY_LIMIT)
      context.lineTo(line, CITY_LIMIT)
      context.stroke()
      context.beginPath()
      context.moveTo(-CITY_LIMIT, line)
      context.lineTo(CITY_LIMIT, line)
      context.stroke()
    }
    for (const town of TOWNS) {
      const bounds = town.bounds
      for (const line of town.xLines) {
        context.beginPath()
        context.moveTo(line, bounds.minZ)
        context.lineTo(line, bounds.maxZ)
        context.stroke()
      }
      for (const line of town.zLines) {
        context.beginPath()
        context.moveTo(bounds.minX, line)
        context.lineTo(bounds.maxX, line)
        context.stroke()
      }
    }
    context.setLineDash([])

    // Centre line on the mountain pass.
    context.strokeStyle = 'rgba(224, 234, 245, 0.42)'
    context.lineWidth = 0.9
    context.setLineDash([5, 6])
    for (const route of GENTING_ROUTES) {
      context.beginPath()
      route.samples.forEach((sample, index) => {
        if (index === 0) context.moveTo(sample.x, sample.z)
        else context.lineTo(sample.x, sample.z)
      })
      context.stroke()
    }
    context.setLineDash([])

    context.strokeStyle = 'rgba(246, 225, 160, 0.55)'
    context.lineWidth = 1
    context.setLineDash([7, 9])
    for (const link of CITY_LINKS) {
      context.beginPath()
      context.moveTo(link.xMin, link.z)
      context.lineTo(link.xMax, link.z)
      context.stroke()
    }
    context.beginPath()
    context.moveTo(AUTOBAHN.x, AUTOBAHN.zMin)
    context.lineTo(AUTOBAHN.x, AUTOBAHN.zMax)
    context.stroke()
    context.setLineDash([])
  }

  context.restore()

  if (variant === 'overview') {
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.font = '800 10px ui-monospace, monospace'
    context.lineWidth = 3
    context.strokeStyle = 'rgba(3, 10, 14, 0.9)'
    context.fillStyle = 'rgba(196, 224, 226, 0.88)'
    const placedLabels = []
    for (const area of DISTRICT_LABELS) {
      const point = project(area.x, area.z)
      const text = area.name.toUpperCase()
      const textWidth = context.measureText(text).width
      const labelX = Math.min(width - textWidth / 2 - 8, Math.max(textWidth / 2 + 8, point.x))
      const labelY = Math.min(height - 22, Math.max(16, point.y))
      const box = {
        x: labelX - textWidth / 2 - 4,
        y: labelY - 9,
        w: textWidth + 8,
        h: 18,
      }
      if (placedLabels.some((other) =>
        box.x < other.x + other.w && box.x + box.w > other.x &&
        box.y < other.y + other.h && box.y + box.h > other.y)) continue
      placedLabels.push(box)
      context.strokeText(text, labelX, labelY)
      context.fillText(text, labelX, labelY)
    }
  }

  // Route, always drawn in screen space so it stays legible at any zoom.
  if (route.length > 1) {
    const screen = route.map((point) => project(point.x, point.z))
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.beginPath()
    screen.forEach((point, index) => {
      if (index === 0) context.moveTo(point.x, point.y)
      else context.lineTo(point.x, point.y)
    })
    context.strokeStyle = 'rgba(4, 18, 24, 0.9)'
    context.lineWidth = 9
    context.stroke()
    context.beginPath()
    screen.forEach((point, index) => {
      if (index === 0) context.moveTo(point.x, point.y)
      else context.lineTo(point.x, point.y)
    })
    context.strokeStyle = '#5cf3d5'
    context.lineWidth = 4
    context.stroke()
  }

  if (variant === 'overview') {
    // Keep the real Genting road readable when the whole world is zoomed out.
    context.lineJoin = 'round'
    context.lineCap = 'round'
    for (const route of GENTING_ROUTES) {
      context.strokeStyle = 'rgba(4, 18, 24, 0.9)'
      context.lineWidth = 5
      context.beginPath()
      route.samples.forEach((sample, index) => {
        const point = project(sample.x, sample.z)
        if (index === 0) context.moveTo(point.x, point.y)
        else context.lineTo(point.x, point.y)
      })
      context.stroke()
      context.strokeStyle = 'rgba(127, 224, 204, 0.85)'
      context.lineWidth = 2.2
      context.stroke()
    }

    context.strokeStyle = 'rgba(127, 224, 204, 0.62)'
    context.lineWidth = 1.7
    for (const access of GENTING_ACCESSES) {
      context.beginPath()
      access.points.forEach((entry, index) => {
        const point = project(entry.x, entry.z)
        if (index === 0) context.moveTo(point.x, point.y)
        else context.lineTo(point.x, point.y)
      })
      context.stroke()
    }
  }

  // User-selected destination route.
  if (destinationRoute.length > 1) {
    const screen = destinationRoute.map((point) => project(point.x, point.z))
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.beginPath()
    screen.forEach((point, index) => {
      if (index === 0) context.moveTo(point.x, point.y)
      else context.lineTo(point.x, point.y)
    })
    context.strokeStyle = 'rgba(4, 18, 24, 0.9)'
    context.lineWidth = 8
    context.stroke()
    context.beginPath()
    screen.forEach((point, index) => {
      if (index === 0) context.moveTo(point.x, point.y)
      else context.lineTo(point.x, point.y)
    })
    context.strokeStyle = '#69bbff'
    context.lineWidth = 3
    context.stroke()
  }

  // Stop pins, clamped to the edge when they are off-screen.
  const clampMargin = config.round ? radius - 14 : 17
  const drawPin = (stop, label, color, active) => {
    const point = project(stop.x, stop.z)
    let px = point.x
    let py = point.y
    const dx = px - centerX
    const dy = py - centerY
    const limit = config.round
      ? clampMargin
      : Math.min(width / 2 - clampMargin, height / 2 - clampMargin)
    const length = Math.hypot(dx, dy)
    const clamped = length > limit
    if (clamped) {
      px = centerX + (dx / length) * limit
      py = centerY + (dy / length) * limit
    }
    const size = clamped ? 7 : active ? 10 : 8

    context.globalAlpha = clamped ? 0.82 : 1
    context.fillStyle = color
    context.strokeStyle = '#fff6e4'
    context.lineWidth = clamped ? 1.5 : 2
    context.beginPath()
    context.arc(px, py, size, 0, Math.PI * 2)
    context.fill()
    context.stroke()
    context.fillStyle = '#17202a'
    context.font = `900 ${clamped ? 7 : active ? 10 : 8}px ui-monospace, monospace`
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(label, px, py + 0.5)
    context.globalAlpha = 1

    if (active) {
      const metres = Math.round(distanceBetween({ x, z }, stop))
      context.font = '700 8px ui-monospace, monospace'
      const text = metres >= 1000 ? `${(metres / 1000).toFixed(1)} km` : `${metres} m`
      const textWidth = context.measureText(text).width + 8
      const labelY = Math.min(height - 8, py + size + 9)
      context.fillStyle = 'rgba(4, 17, 24, 0.85)'
      context.fillRect(px - textWidth / 2, labelY - 6, textWidth, 12)
      context.fillStyle = '#dceff3'
      context.fillText(text, px, labelY)
    }
  }

  const pickupActive = status === 'pickup'
  const dropoffActive = status === 'trip'
  if (ticket?.pickup && status !== 'completed') {
    drawPin(ticket.pickup, 'P', '#f9c86a', pickupActive)
  }
  if (ticket?.dropoff && status !== 'completed') {
    drawPin(ticket.dropoff, 'D', '#fb7185', dropoffActive)
  }
  if (destination) {
    drawPin(destination, 'G', '#69bbff', true)
  }

  // Player arrow: centred in chase views, projected onto the overview map.
  const carPoint = variant === 'overview' ? project(x, z) : { x: centerX, y: centerY }
  context.save()
  context.translate(carPoint.x, carPoint.y)
  if (!config.rotating) context.rotate(heading)
  context.fillStyle = '#34e1c8'
  context.shadowColor = 'rgba(52, 225, 200, 0.9)'
  context.shadowBlur = 8
  context.beginPath()
  context.moveTo(0, -8)
  context.lineTo(5.5, 6)
  context.lineTo(0, 3)
  context.lineTo(-5.5, 6)
  context.closePath()
  context.fill()
  context.restore()

  if (config.round) {
    context.strokeStyle = 'rgba(255, 255, 255, 0.16)'
    context.lineWidth = 1
    context.beginPath()
    context.arc(centerX, centerY, radius - 0.5, 0, Math.PI * 2)
    context.stroke()
  } else {
    context.strokeStyle = 'rgba(120, 200, 210, 0.18)'
    context.lineWidth = 1
    context.strokeRect(0.5, 0.5, width - 1, height - 1)
  }

  // North marker: fixed for north-up maps, orbiting for the rotating minimap.
  const north = config.rotating
    ? {
        x: centerX - Math.sin(heading) * (radius - 10),
        y: centerY - Math.cos(heading) * (radius - 10),
      }
    : { x: width - 15, y: 14 }
  context.fillStyle = 'rgba(8, 14, 20, 0.78)'
  context.beginPath()
  context.arc(north.x, north.y, 7, 0, Math.PI * 2)
  context.fill()
  context.fillStyle = 'rgba(214, 226, 241, 0.85)'
  context.font = '700 8px ui-monospace, monospace'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText('N', north.x, north.y + 0.5)

  context.restore()

  return { viewX, viewZ, scale, centerX, centerY, width, height, rotating: config.rotating }
}

export function Minimap({
  telemetry,
  ticket,
  status = 'available',
  variant = 'hud',
  destination = null,
  onPickDestination,
}) {
  const canvasRef = useRef(null)
  const viewRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    viewRef.current = drawMap(canvas, {
      telemetry,
      ticket,
      status,
      variant,
      destination,
    })
  }, [telemetry, ticket, status, variant, destination])

  const handleClick = (event) => {
    if (variant !== 'overview' || !onPickDestination) return
    const view = viewRef.current
    const canvas = canvasRef.current
    if (!view || !canvas) return
    const rect = canvas.getBoundingClientRect()
    const px = (event.clientX - rect.left) * (canvas.clientWidth / Math.max(1, rect.width))
    const py = (event.clientY - rect.top) * (canvas.clientHeight / Math.max(1, rect.height))
    const worldX = view.viewX + (px - view.centerX) / view.scale
    const worldZ = view.viewZ + (py - view.centerY) / view.scale
    onPickDestination({ x: worldX, z: worldZ })
  }

  if (variant === 'hud') {
    return (
      <div className="minimap" aria-hidden="true">
        <canvas ref={canvasRef} className="minimap-canvas" />
      </div>
    )
  }

  return (
    <div className={`city-map city-map-${variant}`}>
      <canvas
        ref={canvasRef}
        className={`city-map-canvas ${onPickDestination && variant === 'overview' ? 'is-pickable' : ''}`}
        aria-hidden="true"
        onClick={handleClick}
      />
      <div className="city-map-legend">
        <span><i className="map-dot map-you" /> You</span>
        <span><i className="map-dot map-pickup" /> Pickup</span>
        <span><i className="map-dot map-dropoff" /> Drop-off</span>
        {destination && <span><i className="map-dot map-destination" /> Destination</span>}
        {variant === 'overview' && telemetry && (
          <span className="city-map-district">{cityLabelAt(telemetry.x, telemetry.z)}</span>
        )}
      </div>
    </div>
  )
}
