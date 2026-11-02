/**
 * Hand-authored Southern California road world with a connected second city.
 * This is original, hand-authored geometry, not extracted GTA V map data.
 * X increases east; Z increases south. One world unit is approximately 1 m.
 */

export const WORLD_BOUNDS = Object.freeze({ minX: -3300, maxX: 8100, minZ: -3400, maxZ: 2700 })
export const SPAWN = Object.freeze({ x: 0, z: 1080, heading: 0 })

const hill = (x, z, cx, cz, rx, rz, height) =>
  height * Math.exp(-(((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2) * 1.6)
const smoothStep = (a, b, value) => {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** Shared landscape profile for terrain mesh, vehicle height and road grades. */
export function terrainHeightAt(x, z) {
  const uplands =
    // Two close-to-town crests put a visible climb on ordinary city streets
    // and on the A7, not only on remote mountain roads.
    hill(x, z, -1080, 480, 510, 650, 46) +
    hill(x, z, 5760, 1080, 760, 490, 40) +
    hill(x, z, -700, -1050, 1100, 1050, 155) +
    hill(x, z, -1950, -1850, 850, 950, 92) +
    hill(x, z, 680, -2350, 1050, 650, 88) +
    hill(x, z, 2670, -1050, 1150, 900, 96) +
    hill(x, z, 6200, -830, 1450, 900, 118)
  const river = smoothStep(3250, 3440, x) * (1 - smoothStep(3800, 3990, x)) *
    smoothStep(-1000, -800, z) * (1 - smoothStep(2200, 2400, z))
  return Math.max(-10, uplands - river * 9)
}

// The landscape is drawn as 100 m triangles. Its rendered height is not
// necessarily terrainHeightAt(x, z) between vertices; using the exact triangle
// interpolation lets roads clear the *visible* ground, including at Chumash.
export function terrainMeshHeightAt(x, z) {
  const step = 100
  const gridX = (x - WORLD_BOUNDS.minX) / step
  const gridZ = (z - WORLD_BOUNDS.minZ) / step
  const ix = Math.floor(gridX)
  const iz = Math.floor(gridZ)
  const u = gridX - ix
  const v = gridZ - iz
  const x0 = WORLD_BOUNDS.minX + ix * step
  const z0 = WORLD_BOUNDS.minZ + iz * step
  const a = terrainHeightAt(x0, z0) - 0.12
  const b = terrainHeightAt(x0 + step, z0) - 0.12
  const c = terrainHeightAt(x0, z0 + step) - 0.12
  if (u + v <= 1) return a * (1 - u - v) + b * u + c * v
  const d = terrainHeightAt(x0 + step, z0 + step) - 0.12
  return d * (u + v - 1) + b * (1 - v) + c * (1 - u)
}

export const WATERWAY = Object.freeze({ xMin: 3420, xMax: 3800, zMin: -820, zMax: 2280, level: -3 })
const ROAD_WIDTH_SCALE = 0.62
export const ROAD_SHOULDER_WIDTH = 1.5
export const BRIDGE = Object.freeze({ id: 'a7-bridge', name: 'A7 River Bridge', z: 1080,
  xMin: 3240, xMax: 3960, halfWidth: 20 * ROAD_WIDTH_SCALE })

export const DISTRICTS = Object.freeze([
  { id: 'paleto', name: 'Paleto Bay', x: -520, z: -2580, radiusX: 900, radiusZ: 420 },
  { id: 'sandy', name: 'Sandy Shores', x: 850, z: -1580, radiusX: 850, radiusZ: 520 },
  { id: 'chumash', name: 'Chumash Coast', x: -2400, z: -1200, radiusX: 650, radiusZ: 1050 },
  { id: 'vinewood', name: 'Vinewood Hills', x: -150, z: -420, radiusX: 1300, radiusZ: 720 },
  { id: 'del-perro', name: 'Del Perro', x: -1770, z: 280, radiusX: 700, radiusZ: 550 },
  { id: 'vespucci', name: 'Vespucci', x: -1740, z: 1230, radiusX: 760, radiusZ: 690 },
  { id: 'downtown', name: 'Downtown Los Santos', x: 40, z: 740, radiusX: 830, radiusZ: 680 },
  { id: 'mirror-park', name: 'Mirror Park', x: 1480, z: 360, radiusX: 750, radiusZ: 650 },
  { id: 'east-ls', name: 'East Los Santos', x: 1510, z: 1340, radiusX: 850, radiusZ: 850 },
  { id: 'south-ls', name: 'South Los Santos', x: 140, z: 1750, radiusX: 1050, radiusZ: 600 },
  { id: 'airport', name: 'Los Santos Airport', x: -990, z: 2100, radiusX: 680, radiusZ: 430 },
  { id: 'bayview-north', name: 'Bayview Heights', x: 5850, z: -300, radiusX: 1500, radiusZ: 1000 },
  { id: 'bayview', name: 'Bayview City', x: 5750, z: 940, radiusX: 1450, radiusZ: 850 },
  { id: 'bayview-south', name: 'Bayview Harbor', x: 6220, z: 1940, radiusX: 1550, radiusZ: 700 },
])

const segments = []
const addRoad = (name, kind, halfWidth, points) => {
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1]
    const b = points[index]
    if (a[0] === b[0] && a[1] === b[1]) continue
    segments.push(Object.freeze({
      id: `${name}-${segments.length}`,
      name,
      kind,
      halfWidth: halfWidth * ROAD_WIDTH_SCALE,
      bridge: a.length > 2 || b.length > 2,
      a: Object.freeze({ x: a[0], z: a[1], y: a[2] ?? terrainHeightAt(a[0], a[1]) }),
      b: Object.freeze({ x: b[0], z: b[1], y: b[2] ?? terrainHeightAt(b[0], b[1]) }),
    }))
  }
}

const cityX = Array.from({ length: 25 }, (_, index) => -2160 + index * 180)
const cityZ = Array.from({ length: 14 }, (_, index) => -180 + index * 180)
const cityCell = (x, z) => {
  if (z < 0) return Math.abs(x) <= 1080
  if (z > 2160) return false
  const width = z > 1800 ? 1530 : z < 360 ? 1800 : 2250
  if (Math.abs(x) > width) return false
  if (z > 1620 && x < -1620) return false // airport and docks replace the southwest grid
  return true
}

// Street grid with deliberate gaps, retaining continuous arterial corridors.
for (let xi = 0; xi < cityX.length; xi += 1) {
  for (let zi = 0; zi < cityZ.length; zi += 1) {
    const x = cityX[xi]
    const z = cityZ[zi]
    if (!cityCell(x, z)) continue
    const arterialX = xi % 3 === 0
    const arterialZ = zi % 3 === 1
    if (xi + 1 < cityX.length && cityCell(cityX[xi + 1], z) &&
      (arterialZ || (xi * 7 + zi * 11) % 17 !== 0)) {
      addRoad(`Los Santos St ${zi}`, arterialZ ? 'arterial' : 'street', arterialZ ? 10 : 6.8,
        [[x, z], [cityX[xi + 1], z]])
    }
    if (zi + 1 < cityZ.length && cityCell(x, cityZ[zi + 1]) &&
      (arterialX || (xi * 13 + zi * 5) % 19 !== 0)) {
      addRoad(`Los Santos Ave ${xi}`, arterialX ? 'arterial' : 'street', arterialX ? 10 : 6.8,
        [[x, z], [x, cityZ[zi + 1]]])
    }
  }
}

// Major urban corridors and the west/east freeway pair. Points intentionally
// meet existing grid intersections so navigation and the visible roads agree.
addRoad('Olympic Freeway', 'freeway', 17, [[-2160, 1080], [-1620, 1080], [-1080, 1080], [-540, 1080], [0, 1080], [540, 1080], [1080, 1080], [1620, 1080], [2160, 1080]])
addRoad('La Puerta Freeway', 'freeway', 16, [[-1080, 2160], [-1080, 1620], [-1080, 1080], [-1080, 540], [-1080, 0], [-1080, -180]])
addRoad('Los Santos Freeway', 'freeway', 16, [[1080, 2160], [1080, 1620], [1080, 1080], [1080, 540], [1080, 0], [1080, -180]])
addRoad('Vespucci Boulevard', 'arterial', 12, [[-2160, 540], [-1620, 540], [-1080, 540], [-540, 540], [0, 540], [540, 540], [1080, 540], [1620, 540], [2160, 540]])

// Great Ocean Highway follows the western coast toward Paleto Bay.
addRoad('Great Ocean Highway', 'highway', 11, [
  [-1080, -180], [-1440, -360], [-1800, -540], [-2160, -720], [-2520, -900],
  [-2700, -1260], [-2520, -1620], [-2340, -1980], [-1980, -2340],
  [-1440, -2520], [-900, -2700], [-540, -2700], [0, -2700],
])
// Senora Freeway runs up the eastern side of the state.
addRoad('Senora Freeway', 'freeway', 14, [
  [1080, -180], [1260, -360], [1440, -720], [1620, -1080], [1800, -1440],
  [1620, -1800], [1260, -2160], [900, -2520], [540, -2700], [0, -2700],
])
addRoad('Route 68', 'highway', 10, [
  [-2520, -900], [-2160, -1080], [-1800, -1260], [-1260, -1440],
  [-720, -1620], [-180, -1620], [360, -1620], [900, -1620],
  [1080, -1620], [1440, -1620], [1800, -1440],
])
addRoad('Vinewood Hills Road', 'hill', 8, [
  [0, -180], [-180, -360], [-540, -540], [-720, -720], [-540, -900],
  [-180, -1080], [180, -1260], [360, -1620],
])
addRoad('Tongva Valley Road', 'hill', 7.5, [
  [-1800, -540], [-1620, -720], [-1440, -900], [-1260, -1080],
  [-1080, -1260], [-1260, -1440],
])
addRoad('Zancudo River Road', 'hill', 7.5, [
  [-1980, -2340], [-1620, -2160], [-1260, -1980], [-900, -1800],
  [-720, -1620],
])

// Two smaller northern towns, with their intersections shared by through roads.
const addTownGrid = (name, xs, zs) => {
  for (const z of zs) for (let i = 1; i < xs.length; i += 1) {
    addRoad(`${name} St`, 'street', 6.5, [[xs[i - 1], z], [xs[i], z]])
  }
  for (const x of xs) for (let i = 1; i < zs.length; i += 1) {
    addRoad(`${name} Ave`, 'street', 6.5, [[x, zs[i - 1]], [x, zs[i]]])
  }
}
addTownGrid('Paleto Bay', [-900, -720, -540, -360, -180, 0, 180, 360, 540], [-2700, -2520, -2340])
addTownGrid('Sandy Shores', [360, 540, 720, 900, 1080], [-1800, -1620, -1440])
addRoad('Sandy Shores Connector', 'highway', 9, [[1080, -1620], [1440, -1620]])
addRoad('Paleto Connector', 'highway', 9, [[540, -2700], [900, -2520]])

// Bayview is a second, substantially sized city rather than a small satellite.
// The two cities are connected by a long, elevated A7 autobahn across the river.
const bayviewX = Array.from({ length: 19 }, (_, index) => 4320 + index * 180)
const bayviewZ = Array.from({ length: 15 }, (_, index) => -360 + index * 180)
for (let xi = 0; xi < bayviewX.length; xi += 1) {
  for (let zi = 0; zi < bayviewZ.length; zi += 1) {
    const x = bayviewX[xi]
    const z = bayviewZ[zi]
    const majorX = xi % 4 === 0
    const majorZ = zi % 3 === 2
    if (xi + 1 < bayviewX.length && (majorZ || (xi * 5 + zi * 7) % 23 !== 0)) {
      addRoad(`Bayview St ${zi}`, majorZ ? 'arterial' : 'street', majorZ ? 10 : 7,
        [[x, z], [bayviewX[xi + 1], z]])
    }
    if (zi + 1 < bayviewZ.length && (majorX || (xi * 11 + zi * 3) % 29 !== 0)) {
      addRoad(`Bayview Ave ${xi}`, majorX ? 'arterial' : 'street', majorX ? 10 : 7,
        [[x, z], [x, bayviewZ[zi + 1]]])
    }
  }
}
addRoad('A7 Autobahn', 'freeway', 20, [
  [2160, 1080, terrainHeightAt(2160, 1080)], [2520, 1080, terrainHeightAt(2520, 1080)],
  [2880, 1080, 4], [3240, 1080, 13], [3600, 1080, 20],
  [3960, 1080, 12], [4320, 1080, terrainHeightAt(4320, 1080)],
  [4860, 1080], [5400, 1080], [5940, 1080], [6480, 1080],
  [7020, 1080], [7560, 1080],
])
addRoad('Bayview Ring Autobahn', 'freeway', 16, [
  [4860, 1080], [4860, 540], [4860, 0], [5400, 0], [5940, 0],
  [6480, 0], [7020, 0], [7020, 540], [7020, 1080],
  [7020, 1620], [6480, 1620], [5940, 1620], [5400, 1620],
  [4860, 1620], [4860, 1080],
])
// A hillier northern alternative gives the player another intercity route.
addRoad('Highland Parkway', 'highway', 11, [
  [1800, -1440], [2340, -1260], [2880, -1080], [3420, -1080],
  [3960, -1080], [3960, -720], [4320, -360], [4860, -360],
])

export const ROAD_SEGMENTS = Object.freeze(segments)

/** One physical road-deck profile shared by the scene and vehicle. */
export function roadDeckHeightAt(road, t) {
  const progress = Math.max(0, Math.min(1, t))
  if (road.bridge) return road.a.y + (road.b.y - road.a.y) * progress
  const x = road.a.x + (road.b.x - road.a.x) * progress
  const z = road.a.z + (road.b.z - road.a.z) * progress
  const length = Math.hypot(road.b.x - road.a.x, road.b.z - road.a.z)
  const nx = -(road.b.z - road.a.z) / length * (road.halfWidth + ROAD_SHOULDER_WIDTH)
  const nz = (road.b.x - road.a.x) / length * (road.halfWidth + ROAD_SHOULDER_WIDTH)
  return Math.max(
    terrainHeightAt(x, z),
    terrainMeshHeightAt(x, z),
    terrainMeshHeightAt(x + nx, z + nz),
    terrainMeshHeightAt(x - nx, z - nz),
  ) + 0.38
}

export const TELEPORT_POINTS = Object.freeze([
  { id: 'downtown', name: 'Downtown LS', x: 0, z: 1080, heading: 0 },
  { id: 'vespucci', name: 'Vespucci', x: -1800, z: 1080, heading: 0 },
  { id: 'vinewood', name: 'Vinewood', x: 0, z: -180, heading: 0 },
  { id: 'vinewood-summit', name: 'Vinewood Summit', x: -540, z: -900, heading: 0 },
  { id: 'city-crest', name: 'City Crest Climb', x: -1080, z: 1080, heading: 0 },
  { id: 'east-ls', name: 'East LS', x: 1800, z: 1080, heading: 0 },
  { id: 'airport', name: 'Airport', x: -1080, z: 2160, heading: 0 },
  { id: 'sandy', name: 'Sandy Shores', x: 900, z: -1620, heading: 0 },
  { id: 'paleto', name: 'Paleto Bay', x: -540, z: -2700, heading: 0 },
  { id: 'coast', name: 'Great Ocean Hwy', x: -2520, z: -900, heading: 0 },
  { id: 'a7', name: 'A7 Autobahn', x: 2880, z: 1080, heading: Math.PI / 2 },
  { id: 'bridge', name: 'River Bridge', x: 3600, z: 1080, heading: Math.PI / 2 },
  { id: 'bayview', name: 'Bayview City', x: 5760, z: 1080, heading: 0 },
  { id: 'bayview-rise', name: 'Bayview Rise', x: 5040, z: 1080, heading: Math.PI / 2 },
  { id: 'bayview-harbor', name: 'Bayview Harbor', x: 6480, z: 1980, heading: 0 },
  { id: 'highland-parkway', name: 'Highland Parkway', x: 2880, z: -1080, heading: Math.PI / 2 },
])

const stopPoints = [
  ['Downtown Station', 0, 1080], ['Legion Square', 180, 720], ['Pillbox Hill', -180, 540],
  ['Vespucci Beach', -1980, 1260], ['Vespucci Canals', -1620, 1080],
  ['Del Perro', -1980, 360], ['Del Perro Pier', -2160, 540],
  ['Vinewood Boulevard', 0, 0], ['Vinewood Hills', -540, -540],
  ['Mirror Park', 1620, 360], ['East LS', 1800, 1080], ['La Mesa', 1260, 720],
  ['South LS', 0, 1800], ['Strawberry', 540, 1620], ['Los Santos Airport', -1080, 2160],
  ['Chumash Coast', -2520, -900], ['Tongva Valley', -1440, -900],
  ['Route 68 West', -1260, -1440], ['Route 68 East', 1440, -1620],
  ['Sandy Shores', 900, -1620], ['Sandy Airfield', 540, -1440],
  ['Senora Desert', 1620, -1080], ['Grapeseed Road', 1260, -2160],
  ['Paleto Bay', -540, -2700], ['Paleto Market', 0, -2520],
  ['Great Ocean North', -1980, -2340],
  ['A7 Rest Stop', 2880, 1080], ['River Bridge East', 3960, 1080],
  ['Bayview Central', 5760, 1080], ['Bayview Station', 5400, 720],
  ['Bayview Heights', 5940, -180], ['Bayview Marina', 7020, 1800],
  ['Bayview South', 5760, 1980], ['Bayview Ring', 7020, 540],
]
export const CITY_STOPS = Object.freeze(stopPoints.map(([name, x, z], index) =>
  Object.freeze({ id: `stop-${index}`, name, x, z })))

export const distanceBetween = (a, b) => Math.hypot(a.x - b.x, a.z - b.z)

export function districtAt(x, z) {
  let best = null
  let bestScore = Infinity
  for (const district of DISTRICTS) {
    const score = ((x - district.x) / district.radiusX) ** 2 +
      ((z - district.z) / district.radiusZ) ** 2
    if (score < bestScore) { best = district; bestScore = score }
  }
  return best
}
export const cityLabelAt = (x, z) => districtAt(x, z)?.name ?? 'San Andreas'

const graph = new Map()
const routeCache = new Map()
const nodeKey = (point) => `${point.x},${point.z}`
function addEdge(a, b, length) {
  const key = nodeKey(a)
  if (!graph.has(key)) graph.set(key, { ...a, edges: [] })
  graph.get(key).edges.push({ key: nodeKey(b), length })
}
for (const segment of ROAD_SEGMENTS) {
  const length = distanceBetween(segment.a, segment.b)
  addEdge(segment.a, segment.b, length)
  addEdge(segment.b, segment.a, length)
}

const HASH_SIZE = 180
const roadHash = new Map()
const hashKey = (x, z) => `${x},${z}`
for (const segment of ROAD_SEGMENTS) {
  const reach = segment.halfWidth + ROAD_SHOULDER_WIDTH
  const minX = Math.floor((Math.min(segment.a.x, segment.b.x) - reach) / HASH_SIZE)
  const maxX = Math.floor((Math.max(segment.a.x, segment.b.x) + reach) / HASH_SIZE)
  const minZ = Math.floor((Math.min(segment.a.z, segment.b.z) - reach) / HASH_SIZE)
  const maxZ = Math.floor((Math.max(segment.a.z, segment.b.z) + reach) / HASH_SIZE)
  for (let x = minX; x <= maxX; x += 1) for (let z = minZ; z <= maxZ; z += 1) {
    const key = hashKey(x, z)
    if (!roadHash.has(key)) roadHash.set(key, [])
    roadHash.get(key).push(segment)
  }
}

export function nearestRoad(x, z, searchAll = false) {
  const cx = Math.floor(x / HASH_SIZE)
  const cz = Math.floor(z / HASH_SIZE)
  let best = null
  let bestDistance = Infinity
  const inspect = (candidates) => {
    for (const segment of candidates) {
      const vx = segment.b.x - segment.a.x
      const vz = segment.b.z - segment.a.z
      const t = Math.max(0, Math.min(1, ((x - segment.a.x) * vx + (z - segment.a.z) * vz) / (vx * vx + vz * vz)))
      const px = segment.a.x + vx * t
      const pz = segment.a.z + vz * t
      const distance = Math.hypot(x - px, z - pz)
      if (distance < bestDistance) {
        best = { x: px, z: pz, distance, heading: Math.atan2(vx, -vz), segment, t }
        bestDistance = distance
      }
    }
  }
  if (!searchAll) {
    for (let dx = -1; dx <= 1; dx += 1) for (let dz = -1; dz <= 1; dz += 1) {
      inspect(roadHash.get(hashKey(cx + dx, cz + dz)) ?? [])
    }
  }
  // Map clicks can be far from a road; always give them a useful snap point.
  if (!best || searchAll) inspect(ROAD_SEGMENTS)
  return best
}

const forEachRoadAt = (x, z, visit) => {
  const candidates = roadHash.get(hashKey(Math.floor(x / HASH_SIZE), Math.floor(z / HASH_SIZE))) ?? []
  for (const road of candidates) {
    const vx = road.b.x - road.a.x
    const vz = road.b.z - road.a.z
    const t = Math.max(0, Math.min(1, ((x - road.a.x) * vx + (z - road.a.z) * vz) /
      (vx * vx + vz * vz)))
    const px = road.a.x + vx * t
    const pz = road.a.z + vz * t
    if (Math.hypot(x - px, z - pz) <= road.halfWidth + ROAD_SHOULDER_WIDTH + 0.3)
      visit(road, t)
  }
}
export const isOnRoad = (x, z) => {
  let found = false
  forEachRoadAt(x, z, () => { found = true })
  return found
}
export function surfaceHeightAt(x, z) {
  // At junctions several ribbons overlap. Use the highest deck so the car
  // cannot sink into a freeway merely because a lower crossing street was
  // inserted first in the spatial hash.
  let deck = -Infinity
  forEachRoadAt(x, z, (road, t) => { deck = Math.max(deck, roadDeckHeightAt(road, t)) })
  return deck === -Infinity ? terrainHeightAt(x, z) : deck
}
export function surfaceSlopeAlong(x, z, heading, distance = 4) {
  const dx = Math.sin(heading) * distance
  const dz = -Math.cos(heading) * distance
  return (surfaceHeightAt(x + dx, z + dz) - surfaceHeightAt(x - dx, z - dz)) / (2 * distance)
}

// Buildings are deliberately set inside road blocks, never on the driving
// surface. Deterministic dimensions and colors make both cities recognizable.
const random = (x, z, seed = 0) => {
  const value = Math.sin(x * 0.017 + z * 0.031 + seed * 12.37) * 43758.5453
  return value - Math.floor(value)
}
const buildings = []
const addBuildingBlocks = (xs, zs, cityId) => {
  for (let xi = 0; xi < xs.length - 1; xi += 1) for (let zi = 0; zi < zs.length - 1; zi += 1) {
    const blockX = (xs[xi] + xs[xi + 1]) / 2
    const blockZ = (zs[zi] + zs[zi + 1]) / 2
    if (cityId === 'los-santos' && !cityCell(blockX, blockZ)) continue
    for (const side of [-1, 1]) {
      if (random(xi, zi, side) < 0.16) continue
      const x = blockX + side * 39
      const z = blockZ + (random(xi, zi, side + 4) - 0.5) * 24
      const width = 46 + random(xi, zi, side + 8) * 16
      const depth = 74 + random(xi, zi, side + 12) * 23
      const road = nearestRoad(x, z)
      if (road && road.distance < Math.min(width, depth) / 2 + road.segment.halfWidth + 4) continue
      const downtown = cityId === 'los-santos'
        ? Math.exp(-(((x - 100) / 1100) ** 2 + ((z - 750) / 900) ** 2))
        : Math.exp(-(((x - 5700) / 1050) ** 2 + ((z - 950) / 900) ** 2))
      const height = 11 + random(xi, zi, side + 16) * (25 + downtown * 90)
      buildings.push(Object.freeze({
        id: `${cityId}-${xi}-${zi}-${side}`,
        x, z, width, depth, height,
        baseY: terrainHeightAt(x, z),
        colorIndex: Math.floor(random(xi, zi, side + 20) * 5),
      }))
    }
  }
}
addBuildingBlocks(cityX, cityZ, 'los-santos')
addBuildingBlocks(bayviewX, bayviewZ, 'bayview')
export const BUILDINGS = Object.freeze(buildings)

const BUILDING_CELL = 120
const buildingHash = new Map()
for (const building of BUILDINGS) {
  const minX = Math.floor((building.x - building.width / 2) / BUILDING_CELL)
  const maxX = Math.floor((building.x + building.width / 2) / BUILDING_CELL)
  const minZ = Math.floor((building.z - building.depth / 2) / BUILDING_CELL)
  const maxZ = Math.floor((building.z + building.depth / 2) / BUILDING_CELL)
  for (let x = minX; x <= maxX; x += 1) for (let z = minZ; z <= maxZ; z += 1) {
    const key = hashKey(x, z)
    if (!buildingHash.has(key)) buildingHash.set(key, [])
    buildingHash.get(key).push(building)
  }
}

export function nearestRoadHeading(x, z, heading = 0) {
  const normalize = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle))
  const cx = Math.floor(x / HASH_SIZE)
  const cz = Math.floor(z / HASH_SIZE)
  let best = null
  let bestTurn = Infinity
  const seen = new Set()
  for (let dx = -1; dx <= 1; dx += 1) for (let dz = -1; dz <= 1; dz += 1) {
    for (const segment of roadHash.get(hashKey(cx + dx, cz + dz)) ?? []) {
      if (seen.has(segment)) continue
      seen.add(segment)
      const vx = segment.b.x - segment.a.x
      const vz = segment.b.z - segment.a.z
      const t = Math.max(0, Math.min(1,
        ((x - segment.a.x) * vx + (z - segment.a.z) * vz) / (vx * vx + vz * vz)))
      const distance = Math.hypot(x - segment.a.x - vx * t, z - segment.a.z - vz * t)
      if (distance > segment.halfWidth + 1) continue
      const forward = Math.atan2(vx, -vz)
      for (const candidate of [forward, normalize(forward + Math.PI)]) {
        const turn = Math.abs(normalize(candidate - heading))
        if (turn < bestTurn) { bestTurn = turn; best = candidate }
      }
    }
  }
  return best
}

export function resolveCollision(x, z, radius) {
  if (x < WORLD_BOUNDS.minX + radius) return { x: WORLD_BOUNDS.minX + radius, z, nx: 1, nz: 0 }
  if (x > WORLD_BOUNDS.maxX - radius) return { x: WORLD_BOUNDS.maxX - radius, z, nx: -1, nz: 0 }
  if (z < WORLD_BOUNDS.minZ + radius) return { x, z: WORLD_BOUNDS.minZ + radius, nx: 0, nz: 1 }
  if (z > WORLD_BOUNDS.maxZ - radius) return { x, z: WORLD_BOUNDS.maxZ - radius, nx: 0, nz: -1 }
  // Sea is not drivable. The playable coastline is deliberately simplified.
  if (x < -2880 && z > -2400) return { x: -2880, z, nx: 1, nz: 0 }
  if (z > 2500) return { x, z: 2500, nx: 0, nz: -1 }
  if (x > BRIDGE.xMin && x < BRIDGE.xMax &&
    Math.abs(z - BRIDGE.z) > BRIDGE.halfWidth - radius &&
    Math.abs(z - BRIDGE.z) < BRIDGE.halfWidth + 4 + radius) {
    const side = Math.sign(z - BRIDGE.z)
    return { x, z: BRIDGE.z + side * (BRIDGE.halfWidth - radius), nx: 0, nz: -side }
  }
  if (x > WATERWAY.xMin && x < WATERWAY.xMax && z > WATERWAY.zMin &&
    z < WATERWAY.zMax && !isOnRoad(x, z)) {
    return x < (WATERWAY.xMin + WATERWAY.xMax) / 2
      ? { x: WATERWAY.xMin - radius, z, nx: -1, nz: 0 }
      : { x: WATERWAY.xMax + radius, z, nx: 1, nz: 0 }
  }
  const cellX = Math.floor(x / BUILDING_CELL)
  const cellZ = Math.floor(z / BUILDING_CELL)
  for (let dx = -1; dx <= 1; dx += 1) for (let dz = -1; dz <= 1; dz += 1) {
    for (const building of buildingHash.get(hashKey(cellX + dx, cellZ + dz)) ?? []) {
      const overlapX = building.width / 2 + radius - Math.abs(x - building.x)
      const overlapZ = building.depth / 2 + radius - Math.abs(z - building.z)
      if (overlapX <= 0 || overlapZ <= 0) continue
      if (overlapX < overlapZ) {
        const side = Math.sign(x - building.x) || 1
        return { x: building.x + side * (building.width / 2 + radius), z, nx: side, nz: 0 }
      }
      const side = Math.sign(z - building.z) || 1
      return { x, z: building.z + side * (building.depth / 2 + radius), nx: 0, nz: side }
    }
  }
  return null
}

function nearestGraphNode(point) {
  const road = nearestRoad(point.x, point.z)
  if (!road) return null
  const a = road.segment.a
  const b = road.segment.b
  return distanceBetween(point, a) <= distanceBetween(point, b) ? a : b
}

/** A* over the actual road segments, also used by both navigation maps. */
export function streetRoute(from, to) {
  const start = nearestGraphNode(from)
  const end = nearestGraphNode(to)
  if (!start || !end) return [from, to]
  const startKey = nodeKey(start)
  const endKey = nodeKey(end)
  const cacheKey = `${startKey}|${endKey}`
  const cached = routeCache.get(cacheKey)
  if (cached) return [{ x: from.x, z: from.z }, ...cached, { x: to.x, z: to.z }]
  const frontier = [{ key: startKey, score: distanceBetween(start, end) }]
  const cost = new Map([[startKey, 0]])
  const previous = new Map()
  const visited = new Set()
  while (frontier.length) {
    frontier.sort((a, b) => b.score - a.score)
    const current = frontier.pop().key
    if (visited.has(current)) continue
    if (current === endKey) break
    visited.add(current)
    for (const edge of graph.get(current)?.edges ?? []) {
      const nextCost = cost.get(current) + edge.length
      if (nextCost >= (cost.get(edge.key) ?? Infinity)) continue
      cost.set(edge.key, nextCost)
      previous.set(edge.key, current)
      const next = graph.get(edge.key)
      frontier.push({ key: edge.key, score: nextCost + distanceBetween(next, end) })
    }
  }
  if (startKey !== endKey && !previous.has(endKey)) return [from, to]
  const keys = [endKey]
  while (keys[0] !== startKey) keys.unshift(previous.get(keys[0]))
  const points = keys.map((key) => ({ x: graph.get(key).x, z: graph.get(key).z }))
  // HUD and phone maps query the same route every UI refresh. Reusing the
  // graph path avoids repeatedly sorting the A* frontier during driving.
  if (routeCache.size >= 128) routeCache.delete(routeCache.keys().next().value)
  routeCache.set(cacheKey, points)
  return [{ x: from.x, z: from.z }, ...points, { x: to.x, z: to.z }]
}

export function streetDistance(from, to) {
  const route = streetRoute(from, to)
  let distance = 0
  for (let i = 1; i < route.length; i += 1) distance += distanceBetween(route[i - 1], route[i])
  return distance
}
