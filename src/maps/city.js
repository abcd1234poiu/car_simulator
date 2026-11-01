/**
 * Deterministic open-world layout.
 *
 * Metro City is the main 14 x 14-block grid. An A1 autobahn runs north-south to
 * the east, a river separates the towns, and an east link connects the whole
 * network. A real-world Genting Highlands road and elevation profile is
 * converted into a drivable mountain pass north of the city.
 *
 * Pure data + maths, shared by the renderer, physics, dispatch and maps.
 *
 * World axes: X runs east, Z runs north. Heading 0 faces -Z.
 */

import { GENTING_ROAD_DATA } from './gentingRoad.js'
import { BATANG_ROAD_DATA } from './batangRoad.js'

export const GRID_BLOCKS = 14
export const BLOCK_SIZE = 120
export const ROAD_HALF = 9
export const MAJOR_ROAD_HALF = 14
export const ROAD_WIDTH = ROAD_HALF * 2
export const SIDEWALK = 5
/** Half-width of the buildable lot inside a block. */
export const LOT_HALF = (BLOCK_SIZE - MAJOR_ROAD_HALF * 2) / 2 - SIDEWALK // 41 m
export const CITY_HALF_SPAN = (GRID_BLOCKS * BLOCK_SIZE) / 2
export const CITY_LIMIT = CITY_HALF_SPAN + BLOCK_SIZE / 2
export const SPAWN = Object.freeze({ x: 4.2, z: 60, heading: 0 })

export const ROAD_LINES = Object.freeze(
  Array.from({ length: GRID_BLOCKS + 1 }, (_, index) => -CITY_HALF_SPAN + index * BLOCK_SIZE),
)
export const BLOCK_CENTERS = Object.freeze(
  ROAD_LINES.slice(0, -1).map((line) => line + BLOCK_SIZE / 2),
)

const CENTER_INDEX = GRID_BLOCKS / 2
const MAJOR_INDICES = new Set(
  ROAD_LINES.map((_, index) => index).filter(
    (index) =>
      index === 0 ||
      index === GRID_BLOCKS ||
      Math.abs(index - CENTER_INDEX) % 4 === 0,
  ),
)
export const MAJOR_ROADS = Object.freeze(
  new Set(ROAD_LINES.filter((_, index) => MAJOR_INDICES.has(index))),
)

function makeTown({ id, name, xLines, zLines, roadHalf, mainRoadHalf, mainZ }) {
  return Object.freeze({
    id,
    name,
    xLines: Object.freeze(xLines),
    zLines: Object.freeze(zLines),
    roadHalf,
    mainRoadHalf,
    mainZ,
    bounds: Object.freeze({
      minX: xLines[0] - BLOCK_SIZE / 2,
      maxX: xLines[xLines.length - 1] + BLOCK_SIZE / 2,
      minZ: zLines[0] - BLOCK_SIZE / 2,
      maxZ: zLines[zLines.length - 1] + BLOCK_SIZE / 2,
    }),
  })
}

export const RIVERSIDE = makeTown({
  id: 'riverside',
  name: 'Riverside',
  xLines: [1560, 1680, 1800, 1920, 2040, 2160],
  zLines: [-480, -360, -240, -120, 0, 120, 240, 360, 480],
  roadHalf: 7,
  mainRoadHalf: 12,
  mainZ: 0,
})
export const NORTHGATE = makeTown({
  id: 'northgate',
  name: 'Northgate',
  xLines: [1500, 1620, 1740, 1860, 1980, 2100],
  zLines: [-1500, -1380, -1260, -1140, -1020, -900],
  roadHalf: 7,
  mainRoadHalf: 12,
  mainZ: -1020,
})
export const SOUTHPORT = makeTown({
  id: 'southport',
  name: 'Southport',
  xLines: [1620, 1740, 1860, 1980, 2100, 2220],
  zLines: [900, 1020, 1140, 1260, 1380, 1500],
  roadHalf: 7,
  mainRoadHalf: 12,
  mainZ: 1020,
})
export const HIGHLAND = makeTown({
  id: 'highland',
  name: 'Highland',
  xLines: [2520, 2640, 2760, 2880, 3000, 3120],
  zLines: [-480, -360, -240, -120, 0, 120, 240, 360, 480],
  roadHalf: 7,
  mainRoadHalf: 12,
  mainZ: 0,
})
export const SUNCOAST = makeTown({
  id: 'suncoast',
  name: 'Suncoast',
  xLines: [3360, 3480, 3600, 3720, 3840, 3960],
  zLines: [-480, -360, -240, -120, 0, 120, 240, 360, 480],
  roadHalf: 7,
  mainRoadHalf: 12,
  mainZ: 0,
})
export const TOWNS = Object.freeze([
  RIVERSIDE,
  NORTHGATE,
  SOUTHPORT,
  HIGHLAND,
  SUNCOAST,
])
export const TOWN_BY_ID = new Map(TOWNS.map((town) => [town.id, town]))

export function townBlockCenters(town) {
  return town.xLines.slice(0, -1).flatMap((x, bx) =>
    town.zLines.slice(0, -1).map((z, bz) => ({
      x: x + BLOCK_SIZE / 2,
      z: z + BLOCK_SIZE / 2,
      bx,
      bz,
    })),
  )
}

export const RIVERSIDE_BLOCK_CENTERS = Object.freeze(townBlockCenters(RIVERSIDE))
export const NORTHGATE_BLOCK_CENTERS = Object.freeze(townBlockCenters(NORTHGATE))
export const SOUTHPORT_BLOCK_CENTERS = Object.freeze(townBlockCenters(SOUTHPORT))
export const HIGHLAND_BLOCK_CENTERS = Object.freeze(townBlockCenters(HIGHLAND))
export const SUNCOAST_BLOCK_CENTERS = Object.freeze(townBlockCenters(SUNCOAST))
export const ALL_BLOCK_CENTERS = Object.freeze([
  ...BLOCK_CENTERS.flatMap((x, bx) =>
    BLOCK_CENTERS.map((z, bz) => ({ x, z, bx, bz }))),
  ...TOWNS.flatMap((town) => townBlockCenters(town)),
])
export const METRO_BLOCK_CENTERS = Object.freeze(
  BLOCK_CENTERS.flatMap((x, bx) =>
    BLOCK_CENTERS.map((z, bz) => ({ x, z, bx, bz }))),
)

export const AUTOBAHN = Object.freeze({
  id: 'a1',
  name: 'A1 Autobahn',
  x: 1120,
  halfWidth: 22,
  zMin: -1620,
  zMax: 1620,
})
export const CITY_LINKS = Object.freeze([
  Object.freeze({
    id: 'east-link',
    name: 'A1 East Link',
    z: 0,
    halfWidth: 16,
    xMin: 840,
    xMax: 4020,
    bridge: true,
  }),
  Object.freeze({
    id: 'north-link',
    name: 'Northgate Link',
    z: NORTHGATE.mainZ,
    halfWidth: 12,
    xMin: AUTOBAHN.x,
    xMax: NORTHGATE.bounds.maxX,
    bridge: true,
  }),
  Object.freeze({
    id: 'south-link',
    name: 'Southport Link',
    z: SOUTHPORT.mainZ,
    halfWidth: 12,
    xMin: AUTOBAHN.x,
    xMax: SOUTHPORT.bounds.maxX,
    bridge: true,
  }),
])
export const EAST_LINK = CITY_LINKS[0]
export const RIVER = Object.freeze({
  id: 'river',
  name: 'Metro River',
  x: 1350,
  halfWidth: 45,
  zMin: -1620,
  zMax: 1620,
  bridgeHalfWidth: 38,
})
/** Pedestrian skybridges spanning the main avenues. */
export const FLYOVERS = Object.freeze([
  Object.freeze({ id: 'central-north', x: 0, z: -252, span: 46, width: 3.6, height: 7.2, rotation: 0 }),
  Object.freeze({ id: 'central-south', x: 0, z: 252, span: 46, width: 3.6, height: 7.2, rotation: 0 }),
  Object.freeze({ id: 'midtown-east', x: 252, z: 0, span: 46, width: 3.6, height: 7.2, rotation: Math.PI / 2 }),
  Object.freeze({ id: 'midtown-west', x: -252, z: 0, span: 46, width: 3.6, height: 7.2, rotation: Math.PI / 2 }),
])

const GENTING_START_INDEX = 57
const GENTING_POINTS = GENTING_ROAD_DATA.points.slice(GENTING_START_INDEX)
const GENTING_BASE_ELEVATION = GENTING_POINTS[0][2]

export const GENTING = Object.freeze({
  id: 'genting',
  name: 'Genting Pass',
  bounds: Object.freeze({ minX: -4200, maxX: 1100, minZ: -4000, maxZ: -900 }),
  halfWidth: 18,
})
export const GENTING_ACCESS = Object.freeze({
  halfWidth: 14,
  points: Object.freeze([
    { x: 0, z: -840 },
    { x: 18, z: -965 },
    Object.freeze({ x: GENTING_POINTS[0][0], z: GENTING_POINTS[0][1] }),
  ]),
})
export const GENTING_ROAD_SAMPLES = (() => {
  return GENTING_POINTS.map(([x, z, y], index) => {
    const previous = GENTING_POINTS[Math.max(0, index - 1)]
    const next = GENTING_POINTS[Math.min(GENTING_POINTS.length - 1, index + 1)]
    const dx = next[0] - previous[0]
    const dz = next[1] - previous[1]
    return {
      x,
      z,
      y: y - GENTING_BASE_ELEVATION,
      heading: Math.atan2(dx, -dz),
    }
  })
})()

const BATANG_POINTS = BATANG_ROAD_DATA.points
const BATANG_ROAD_SAMPLES = BATANG_POINTS.map(([x, z, y], index) => {
  const previous = BATANG_POINTS[Math.max(0, index - 1)]
  const next = BATANG_POINTS[Math.min(BATANG_POINTS.length - 1, index + 1)]
  const dx = next[0] - previous[0]
  const dz = next[1] - previous[1]
  return { x, z, y, heading: Math.atan2(dx, -dz) }
})
const BATANG_ACCESS = Object.freeze({
  halfWidth: 14,
  points: Object.freeze([
    { x: -840, z: 0 },
    { x: -1000, z: -500 },
    Object.freeze({
      x: BATANG_ROAD_SAMPLES[0].x,
      z: BATANG_ROAD_SAMPLES[0].z,
    }),
  ]),
})
const RIDGE_POINTS = [
  { x: 397, z: -3774, y: 295 },
  { x: 180, z: -3580, y: 300 },
  { x: -240, z: -3540, y: 310 },
  { x: -650, z: -3450, y: 305 },
  { x: -1050, z: -3300, y: 312 },
  { x: -1450, z: -3120, y: 318 },
  { x: -1800, z: -2940, y: 310 },
  { x: -2200, z: -2740, y: 315 },
  { x: -2600, z: -2520, y: 318 },
  { x: -3000, z: -2300, y: 310 },
  { x: -3400, z: -2140, y: 305 },
  { x: -3700, z: -2030, y: 300 },
  { x: -3946.86, z: -1973.6, y: 300.6 },
]
const RIDGE_ROAD_SAMPLES = (() => {
  const samples = []
  const steps = 10
  for (let index = 0; index < RIDGE_POINTS.length - 1; index += 1) {
    const a = RIDGE_POINTS[index]
    const b = RIDGE_POINTS[index + 1]
    for (let step = 0; step < steps; step += 1) {
      const t = step / steps
      samples.push({
        x: a.x + (b.x - a.x) * t,
        z: a.z + (b.z - a.z) * t,
        y: a.y + (b.y - a.y) * t,
      })
    }
  }
  samples.push(RIDGE_POINTS[RIDGE_POINTS.length - 1])
  return samples.map((point, index) => {
    const previous = samples[Math.max(0, index - 1)]
    const next = samples[Math.min(samples.length - 1, index + 1)]
    return {
      ...point,
      heading: Math.atan2(next.x - previous.x, -(next.z - previous.z)),
    }
  })
})()

export const GENTING_ROUTES = Object.freeze([
  Object.freeze({
    id: 'genting',
    name: 'Genting Pass',
    samples: GENTING_ROAD_SAMPLES,
    access: GENTING_ACCESS,
  }),
  Object.freeze({
    id: 'batang',
    name: 'Batang Pass',
    samples: BATANG_ROAD_SAMPLES,
    access: BATANG_ACCESS,
  }),
  Object.freeze({
    id: 'ridge',
    name: 'Ridge Road',
    samples: RIDGE_ROAD_SAMPLES,
    access: null,
  }),
])
export const GENTING_ACCESSES = Object.freeze([
  GENTING_ACCESS,
  BATANG_ACCESS,
])
const ALL_GENTING_SAMPLES = Object.freeze([
  ...GENTING_ROAD_SAMPLES,
  ...BATANG_ROAD_SAMPLES,
  ...RIDGE_ROAD_SAMPLES,
])
export const BATANG_BOUNDS = Object.freeze({
  minX: -4300,
  maxX: -1100,
  minZ: -2500,
  maxZ: -1100,
})

const clampUnit = (value) => Math.max(0, Math.min(1, value))
const smoothUnit = (edge0, edge1, value) => {
  const t = clampUnit((value - edge0) / Math.max(0.0001, edge1 - edge0))
  return t * t * (3 - 2 * t)
}

function segmentDistance(x, z, ax, az, bx, bz) {
  const dx = bx - ax
  const dz = bz - az
  const lengthSq = dx * dx + dz * dz
  if (!lengthSq) return Math.hypot(x - ax, z - az)
  const t = clampUnit(((x - ax) * dx + (z - az) * dz) / lengthSq)
  return Math.hypot(x - (ax + dx * t), z - (az + dz * t))
}

function nearestAccessInfo(x, z) {
  let best = null
  for (const access of GENTING_ACCESSES) {
    const points = access.points
    for (let index = 1; index < points.length; index += 1) {
      const a = points[index - 1]
      const b = points[index]
      const distance = segmentDistance(x, z, a.x, a.z, b.x, b.z)
      if (!best || distance < best.distance) {
        best = {
          distance,
          halfWidth: access.halfWidth,
          heading: Math.atan2(b.x - a.x, -(b.z - a.z)),
        }
      }
    }
  }
  return best
}

function nearestGentingSample(x, z) {
  let best = null
  let bestDistance = Infinity
  for (const sample of ALL_GENTING_SAMPLES) {
    const distance = (sample.x - x) ** 2 + (sample.z - z) ** 2
    if (distance < bestDistance) {
      bestDistance = distance
      best = sample
    }
  }
  return best ? { ...best, distance: Math.sqrt(bestDistance) } : null
}

/**
 * Terrain around the converted Genting road. The road elevation is real SRTM
 * data; off-road terrain falls away from the nearest road point so the road
 * sits on a believable mountain ridge without requiring a heightmap download.
 */
export function mountainHeightAt(x, z) {
  const bounds = GENTING.bounds
  if (x <= bounds.minX || x >= bounds.maxX || z <= bounds.minZ || z >= bounds.maxZ) return 0
  const nearest = nearestGentingSample(x, z)
  if (!nearest) return 0
  const edgeX = smoothUnit(bounds.minX, bounds.minX + 130, x) *
    (1 - smoothUnit(bounds.maxX - 130, bounds.maxX, x))
  const edgeZ = smoothUnit(bounds.minZ, bounds.minZ + 130, z)
  const distance = nearest.distance
  const ridgeBump = (8 * Math.sin(x / 90) + 6 * Math.cos(z / 115)) *
    Math.min(1, distance / 70)
  const hillside = Math.max(0, nearest.y - distance * 0.17 + ridgeBump)
  const flatCorridor = nearest.y
  const blend = smoothUnit(GENTING.halfWidth + 8, GENTING.halfWidth + 48, distance)
  let height = flatCorridor + (hillside - flatCorridor) * blend

  // Flatten the access road corridor so the approach to the pass is visible.
  const access = nearestAccessInfo(x, z)
  if (access) {
    const accessBlend = smoothUnit(
      access.halfWidth + 2,
      access.halfWidth + 42,
      access.distance,
    )
    height *= accessBlend
  }
  return height * edgeX * edgeZ
}

const TERRAIN_COLS = 300
const TERRAIN_ROWS = 320
const terrainHeights = new Float32Array((TERRAIN_COLS + 1) * (TERRAIN_ROWS + 1))
for (let row = 0; row <= TERRAIN_ROWS; row += 1) {
  const z = GENTING.bounds.minZ +
    (row / TERRAIN_ROWS) * (GENTING.bounds.maxZ - GENTING.bounds.minZ)
  for (let col = 0; col <= TERRAIN_COLS; col += 1) {
    const x = GENTING.bounds.minX +
      (col / TERRAIN_COLS) * (GENTING.bounds.maxX - GENTING.bounds.minX)
    terrainHeights[row * (TERRAIN_COLS + 1) + col] = mountainHeightAt(x, z)
  }
}

export const GENTING_TERRAIN = Object.freeze({
  cols: TERRAIN_COLS,
  rows: TERRAIN_ROWS,
  minX: GENTING.bounds.minX,
  maxX: GENTING.bounds.maxX,
  minZ: GENTING.bounds.minZ,
  maxZ: GENTING.bounds.maxZ,
  heights: terrainHeights,
})

/** Bilinear terrain height matching the rendered mountain mesh. */
export function terrainHeightAt(x, z) {
  const { minX, maxX, minZ, maxZ } = GENTING_TERRAIN
  if (x <= minX || x >= maxX || z <= minZ || z >= maxZ) return 0
  const fx = ((x - minX) / (maxX - minX)) * TERRAIN_COLS
  const fz = ((z - minZ) / (maxZ - minZ)) * TERRAIN_ROWS
  const col = Math.min(TERRAIN_COLS - 1, Math.max(0, Math.floor(fx)))
  const row = Math.min(TERRAIN_ROWS - 1, Math.max(0, Math.floor(fz)))
  const tx = fx - col
  const tz = fz - row
  const stride = TERRAIN_COLS + 1
  const h00 = terrainHeights[row * stride + col]
  const h10 = terrainHeights[row * stride + col + 1]
  const h01 = terrainHeights[(row + 1) * stride + col]
  const h11 = terrainHeights[(row + 1) * stride + col + 1]
  const top = h00 + (h10 - h00) * tx
  const bottom = h01 + (h11 - h01) * tx
  return top + (bottom - top) * tz
}

function gentingRoadSurfaceHeight(x, z) {
  const sample = nearestGentingRoad(x, z)
  if (sample && sample.distance <= GENTING.halfWidth + 0.5) return sample.y + 0.12
  const access = nearestAccessInfo(x, z)
  if (access && access.distance <= access.halfWidth + 0.5) return 0.12
  return null
}

export function surfaceHeightAt(x, z) {
  const roadHeight = gentingRoadSurfaceHeight(x, z)
  return roadHeight ?? terrainHeightAt(x, z)
}

export function surfaceSlopeAlong(x, z, heading, distance = 2.4) {
  const aheadX = x + Math.sin(heading) * distance
  const aheadZ = z - Math.cos(heading) * distance
  return (surfaceHeightAt(aheadX, aheadZ) - surfaceHeightAt(x, z)) / distance
}

export function nearestGentingRoad(x, z) {
  if (x < GENTING.bounds.minX - 20 || x > GENTING.bounds.maxX + 20 ||
    z < GENTING.bounds.minZ - 20 || z > GENTING.bounds.maxZ + 20) return null
  const sample = nearestGentingSample(x, z)
  return sample && sample.distance <= GENTING.halfWidth + 12 ? sample : null
}

export function isOnGentingRoad(x, z) {
  const sample = nearestGentingRoad(x, z)
  if (sample && sample.distance <= GENTING.halfWidth) return true
  const access = nearestAccessInfo(x, z)
  return Boolean(access && access.distance <= access.halfWidth)
}

/** Fast-travel points used by the map teleport panel. */
export const TELEPORT_POINTS = Object.freeze([
  Object.freeze({ id: 'metro', name: 'Metro City', x: SPAWN.x, z: SPAWN.z, heading: SPAWN.heading }),
  ...TOWNS.map((town) => Object.freeze({
    id: town.id,
    name: town.name,
    x: town.xLines[2],
    z: town.mainZ,
    heading: 0,
  })),
  Object.freeze({
    id: 'genting',
    name: 'Genting Pass',
    x: GENTING_ROAD_SAMPLES[0].x,
    z: GENTING_ROAD_SAMPLES[0].z,
    heading: GENTING_ROAD_SAMPLES[0].heading,
  }),
  Object.freeze({
    id: 'batang',
    name: 'Batang Pass',
    x: BATANG_ROAD_SAMPLES[0].x,
    z: BATANG_ROAD_SAMPLES[0].z,
    heading: BATANG_ROAD_SAMPLES[0].heading,
  }),
  Object.freeze({ id: 'east-link', name: 'A1 East Link', x: 1200, z: 0, heading: Math.PI / 2 }),
])

export const WORLD_BOUNDS = Object.freeze({
  minX: -4300,
  maxX: 4020,
  minZ: -4000,
  maxZ: 1620,
})

/** Half width of a Metro City road centred on one of the ROAD_LINES values. */
export function roadHalfAt(line) {
  return MAJOR_ROADS.has(line) ? MAJOR_ROAD_HALF : ROAD_HALF
}

/** Half width of a road in one of the satellite towns. */
export function townRoadHalfAt(town, line) {
  return line === town.mainZ ? town.mainRoadHalf : town.roadHalf
}

/** Backwards-compatible Riverside helper. */
export function riversideRoadHalfAt(line) {
  return townRoadHalfAt(RIVERSIDE, line)
}

export const DISTRICTS = Object.freeze([
  {
    id: 'downtown',
    name: 'Downtown Core',
    palettes: ['glass', 'modern'],
    height: [48, 188],
    singleChance: 0.18,
    parkChance: 0.03,
    treeChance: 0.35,
    landmarks: ['Central Station', 'Grand Market', 'Civic Hall', 'Exchange Tower', 'Opera House', 'City Library'],
  },
  {
    id: 'midtown',
    name: 'Midtown',
    palettes: ['modern', 'glass', 'concrete'],
    height: [22, 92],
    singleChance: 0.24,
    parkChance: 0.07,
    treeChance: 0.55,
    landmarks: ['Metro Arena', 'Union Square', 'Museum Row', 'Tech Campus', 'River Terrace', 'Broadway Plaza'],
  },
  {
    id: 'oldtown',
    name: 'Old Town',
    palettes: ['brick', 'concrete'],
    height: [9, 36],
    singleChance: 0.42,
    parkChance: 0.11,
    treeChance: 0.62,
    landmarks: ['Old Town Gate', 'Cathedral Steps', 'Clocktower Lane', 'Heritage Market', 'Cobbled Row'],
  },
  {
    id: 'harbor',
    name: 'Harbor District',
    palettes: ['concrete', 'modern'],
    height: [12, 52],
    singleChance: 0.48,
    parkChance: 0.09,
    treeChance: 0.48,
    landmarks: ['Harbor Terminal', 'Dock Seven', 'Fisherman Wharf', 'Ferry Landing', 'Container Yard'],
  },
  {
    id: 'university',
    name: 'University Quarter',
    palettes: ['brick', 'concrete', 'glass'],
    height: [10, 48],
    singleChance: 0.4,
    parkChance: 0.15,
    treeChance: 0.72,
    landmarks: ['University Gate', 'Science Park', 'Student Union', 'Botanic Gardens', 'Lecture Hall'],
  },
  {
    id: 'industrial',
    name: 'Industrial Park',
    palettes: ['concrete', 'modern'],
    height: [8, 30],
    singleChance: 0.58,
    parkChance: 0.04,
    treeChance: 0.3,
    landmarks: ['Freight Depot', 'Power Works', 'Foundry Road', 'Logistics Hub', 'Warehouse Row'],
  },
  {
    id: 'residential',
    name: 'Garden Suburbs',
    palettes: ['brick', 'concrete'],
    height: [7, 26],
    singleChance: 0.55,
    parkChance: 0.14,
    treeChance: 0.7,
    landmarks: ['Garden District', 'Rosewood Park', 'Northgate', 'Eastside Green', 'Maple Crescent'],
  },
  {
    id: 'riverside',
    name: 'Riverside',
    palettes: ['brick', 'concrete', 'modern'],
    height: [8, 42],
    singleChance: 0.5,
    parkChance: 0.18,
    treeChance: 0.78,
    landmarks: ['Riverside Plaza', 'Bridge Market', 'Eastbank', 'Ferry Steps', 'Cedar Park', 'Mill Yard'],
  },
  {
    id: 'northgate',
    name: 'Northgate',
    palettes: ['modern', 'concrete', 'glass'],
    height: [12, 58],
    singleChance: 0.38,
    parkChance: 0.12,
    treeChance: 0.6,
    landmarks: ['Northgate Exchange', 'Aurora Park', 'Civic Stadium', 'North Mall', 'Pine Heights'],
  },
  {
    id: 'southport',
    name: 'Southport',
    palettes: ['brick', 'concrete', 'modern'],
    height: [9, 46],
    singleChance: 0.44,
    parkChance: 0.15,
    treeChance: 0.72,
    landmarks: ['Southport Docks', 'Sunset Pier', 'Marina Walk', 'Saltworks', 'Bayfront Market'],
  },
  {
    id: 'highland',
    name: 'Highland',
    palettes: ['modern', 'glass', 'concrete'],
    height: [16, 78],
    singleChance: 0.34,
    parkChance: 0.1,
    treeChance: 0.58,
    landmarks: ['Highland Summit', 'North Ridge', 'Alpine Court', 'Cable Car Square', 'Viewpoint Park'],
  },
  {
    id: 'suncoast',
    name: 'Suncoast',
    palettes: ['glass', 'modern', 'brick'],
    height: [14, 68],
    singleChance: 0.4,
    parkChance: 0.16,
    treeChance: 0.76,
    landmarks: ['Suncoast Marina', 'Palm Promenade', 'Bay Hotel', 'Lighthouse Point', 'Coral Market'],
  },
])

export const GREENBELT = Object.freeze({ id: 'greenbelt', name: 'Green Belt' })
const DISTRICT_BY_ID = new Map(DISTRICTS.map((district) => [district.id, district]))
export const TOWN_DISTRICT = new Map(TOWNS.map((town) => [town.id, DISTRICT_BY_ID.get(town.id)]))

/** The satellite town that contains a world point, or null for Metro City. */
export function townAt(x, z) {
  for (const town of TOWNS) {
    const bounds = town.bounds
    if (x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ) {
      return town
    }
  }
  return null
}

function blockDistrict(bx, bz, blocks = GRID_BLOCKS) {
  const dx = bx - (blocks - 1) / 2
  const dz = bz - (blocks - 1) / 2
  const ring = Math.max(Math.abs(dx), Math.abs(dz))

  if (ring <= 2.5) return DISTRICT_BY_ID.get('downtown')
  if (ring <= 4.5) return DISTRICT_BY_ID.get('midtown')
  if (bx <= 3 && bz <= 3) return DISTRICT_BY_ID.get('oldtown')
  if (bx >= blocks - 4 && bz >= blocks - 4) return DISTRICT_BY_ID.get('harbor')
  if (bx <= 3 && bz >= blocks - 4) return DISTRICT_BY_ID.get('university')
  if (bx >= blocks - 4 && bz <= 3) return DISTRICT_BY_ID.get('industrial')
  return DISTRICT_BY_ID.get('residential')
}

/** District for a world point. Includes satellite towns and the green belt. */
export function districtAt(x, z) {
  const town = townAt(x, z)
  if (town) return TOWN_DISTRICT.get(town.id)
  if (x > CITY_LIMIT || Math.abs(z) > CITY_LIMIT) return GREENBELT
  const bx = Math.min(
    GRID_BLOCKS - 1,
    Math.max(0, Math.floor((x + CITY_HALF_SPAN) / BLOCK_SIZE)),
  )
  const bz = Math.min(
    GRID_BLOCKS - 1,
    Math.max(0, Math.floor((z + CITY_HALF_SPAN) / BLOCK_SIZE)),
  )
  return blockDistrict(bx, bz)
}

/** Human-readable location label for the HUD and map. */
export function cityLabelAt(x, z) {
  const town = townAt(x, z)
  if (town) return town.name
  if (Math.abs(x - RIVER.x) <= RIVER.halfWidth + 6) return 'River Crossing'
  if (Math.abs(x - AUTOBAHN.x) <= AUTOBAHN.halfWidth + 8) return AUTOBAHN.name
  if (x >= EAST_LINK.xMin && x <= EAST_LINK.xMax &&
    Math.abs(z - EAST_LINK.z) <= EAST_LINK.halfWidth + 4) return EAST_LINK.name
  if (x > BATANG_BOUNDS.minX && x < BATANG_BOUNDS.maxX &&
    z > BATANG_BOUNDS.minZ && z < BATANG_BOUNDS.maxZ) return 'Batang Pass'
  if (x > GENTING.bounds.minX && x < GENTING.bounds.maxX &&
    z > GENTING.bounds.minZ && z < GENTING.bounds.maxZ) return GENTING.name
  return districtAt(x, z).name
}

const PALETTES = ['glass', 'modern', 'concrete', 'brick']
const ROOF_COLORS = ['#343a44', '#2f3742', '#3a3630', '#2b333a', '#41474f']
const LANDMARK_PARKS = new Set(['6,6', '7,6', '8,8', '2,10', '10,2', '4,11', '11,4'])
const RIVERSIDE_PARKS = new Set(['2,4', '1,7', '3,2'])

function mulberry32(seed) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle(list, rng) {
  const copy = list.slice()
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function addBuilding(list, x, z, width, depth, height, district, rng) {
  const palettes = district?.palettes ?? PALETTES
  const style = palettes[Math.floor(rng() * palettes.length)]
  const tiers = []
  let roofX = x
  let roofZ = z
  let roofWidth = width
  let roofDepth = depth

  // Tall towers get a wider podium and a slimmer shaft so the skyline is not a
  // stack of identical extruded boxes.
  if (height > 50 && rng() < 0.72) {
    const podiumHeight = Math.max(10, Math.min(height * 0.3, 28))
    tiers.push({ x, z, width, depth, y: 0, height: podiumHeight })
    const shaftWidth = width * (0.52 + rng() * 0.22)
    const shaftDepth = depth * (0.52 + rng() * 0.22)
    const offsetX = (rng() - 0.5) * Math.max(0, width - shaftWidth) * 0.4
    const offsetZ = (rng() - 0.5) * Math.max(0, depth - shaftDepth) * 0.4
    tiers.push({
      x: x + offsetX,
      z: z + offsetZ,
      width: shaftWidth,
      depth: shaftDepth,
      y: podiumHeight,
      height: height - podiumHeight,
    })
    roofX = x + offsetX
    roofZ = z + offsetZ
    roofWidth = shaftWidth
    roofDepth = shaftDepth
  } else {
    tiers.push({ x, z, width, depth, y: 0, height })
  }

  const roofType = district?.id === 'residential' && height < 18
    ? 'gable'
    : district?.id === 'industrial' && height < 18
      ? 'sawtooth'
      : 'flat'

  list.push({
    x,
    z,
    width,
    depth,
    height,
    style,
    roof: ROOF_COLORS[Math.floor(rng() * ROOF_COLORS.length)],
    district: district?.id ?? 'residential',
    seed: Math.floor(rng() * 4096),
    tiers,
    roofType,
    roofX,
    roofZ,
    roofWidth,
    roofDepth,
  })
}

function addTree(trees, x, z, rng, scaleBase = 0.6, scaleSpread = 0.5) {
  trees.push({
    x,
    z,
    scale: scaleBase + rng() * scaleSpread,
    round: rng() < 0.5,
  })
}

function nearAnyRoad(x, z) {
  return isOnRoad(x, z)
}

function buildBlockSet(centers, resolveDistrict, seedBase, parkKeys) {
  const buildings = []
  const parks = []
  const plazas = []
  const trees = []

  centers.forEach((center) => {
    const { x: centerX, z: centerZ, bx, bz } = center
    const district = resolveDistrict(bx, bz)
    const rng = mulberry32(seedBase + bx * 733 + bz * 137)
    const key = `${bx},${bz}`
    const isPark = parkKeys.has(key) || rng() < district.parkChance
    const isPlaza = !isPark && rng() < 0.06

    if (isPlaza) {
      const size = LOT_HALF * 2
      plazas.push({ x: centerX, z: centerZ, size, district: district.id })
      for (const px of [-LOT_HALF * 0.72, LOT_HALF * 0.72]) {
        for (const pz of [-LOT_HALF * 0.72, LOT_HALF * 0.72]) {
          addTree(trees, centerX + px, centerZ + pz, rng, 0.55, 0.35)
        }
      }
      return
    }

    if (isPark) {
      const size = LOT_HALF * 2
      parks.push({ x: centerX, z: centerZ, size, district: district.id })
      const count = 12 + Math.floor(rng() * 9)
      for (let i = 0; i < count; i += 1) {
        const treeX = centerX + (rng() - 0.5) * (size - 10)
        const treeZ = centerZ + (rng() - 0.5) * (size - 10)
        if (!nearAnyRoad(treeX, treeZ)) addTree(trees, treeX, treeZ, rng, 0.7, 0.7)
      }
      return
    }

    const single = rng() < district.singleChance
    const [low, high] = district.height
    const ring = bx < GRID_BLOCKS ? Math.max(
      Math.abs(bx - (GRID_BLOCKS - 1) / 2),
      Math.abs(bz - (GRID_BLOCKS - 1) / 2),
    ) : 0
    const skylineBoost = district.id === 'riverside' ? 0 : Math.max(0, 1 - ring / 7) * 26

    const push = (width, depth, x, z) => {
      const height = low + rng() * (high - low) + skylineBoost * rng()
      addBuilding(buildings, x, z, width, depth, height, district, rng)
    }

    if (single) {
      push(42 + rng() * 16, 42 + rng() * 16, centerX, centerZ)
    } else {
      for (const px of [-20, 20]) {
        for (const pz of [-20, 20]) {
          if (rng() < (1 - district.treeChance) * 0.22) {
            const treeX = centerX + px + (rng() - 0.5) * 8
            const treeZ = centerZ + pz + (rng() - 0.5) * 8
            if (!nearAnyRoad(treeX, treeZ)) addTree(trees, treeX, treeZ, rng)
            continue
          }
          push(
            21 + rng() * 12,
            21 + rng() * 12,
            centerX + px + (rng() - 0.5) * 2.6,
            centerZ + pz + (rng() - 0.5) * 2.6,
          )
        }
      }
    }

    if (rng() < district.treeChance * 0.85) {
      const side = Math.floor(rng() * 4)
      const along = (rng() - 0.5) * (LOT_HALF * 1.2)
      const offset = LOT_HALF + SIDEWALK * 0.55
      const treeX = centerX + (side === 0 ? along : side === 1 ? offset : -offset)
      const treeZ = centerZ + (side === 2 ? along : side === 3 ? offset : -offset)
      if (!nearAnyRoad(treeX, treeZ)) addTree(trees, treeX, treeZ, rng, 0.55, 0.4)
    }
  })

  return { buildings, parks, plazas, trees }
}

const metroGenerated = buildBlockSet(METRO_BLOCK_CENTERS, blockDistrict, 9001, LANDMARK_PARKS)
const TOWN_PARK_KEYS = {
  riverside: RIVERSIDE_PARKS,
  northgate: new Set(['2,1', '1,3']),
  southport: new Set(['3,2', '1,4']),
  highland: new Set(['1,2', '3,3']),
  suncoast: new Set(['2,3', '4,1']),
}
const TOWN_GENERATED = TOWNS.map((town, index) => buildBlockSet(
  townBlockCenters(town),
  () => TOWN_DISTRICT.get(town.id),
  30_001 + index * 20_000,
  TOWN_PARK_KEYS[town.id] ?? new Set(),
))

// Rural trees in the green belt and around Riverside. They give the map a less
// urban, more organic edge without adding collisions.
const ruralGenerated = (() => {
  const trees = []
  const rng = mulberry32(77_713)
  for (let i = 0; i < 260; i += 1) {
    const x = 900 + rng() * 3000
    const z = -3200 + rng() * 6400
    if (Math.abs(x - AUTOBAHN.x) < 44) continue
    if (Math.abs(x - RIVER.x) < RIVER.halfWidth + 14) continue
    if (CITY_LINKS.some((link) => Math.abs(z - link.z) < link.halfWidth + 8)) continue
    if (TOWNS.some((town) => x > town.bounds.minX && x < town.bounds.maxX &&
      z > town.bounds.minZ && z < town.bounds.maxZ)) continue
    addTree(trees, x, z, rng, 0.7, 0.9)
  }
  return trees
})()

export const BUILDINGS = [
  ...metroGenerated.buildings,
  ...TOWN_GENERATED.flatMap((generated) => generated.buildings),
]
export const PARKS = [
  ...metroGenerated.parks,
  ...TOWN_GENERATED.flatMap((generated) => generated.parks),
]
export const PLAZAS = [
  ...metroGenerated.plazas,
  ...TOWN_GENERATED.flatMap((generated) => generated.plazas),
]
export const TREES = [
  ...metroGenerated.trees,
  ...TOWN_GENERATED.flatMap((generated) => generated.trees),
  ...ruralGenerated,
]

/**
 * Label anchors for the overview map. Ring-shaped districts have symmetric
 * centroids, so fixed anchors keep every name readable.
 */
export const DISTRICT_LABELS = Object.freeze([
  { id: 'oldtown', name: 'Old Town', x: -CITY_HALF_SPAN * 0.72, z: -CITY_HALF_SPAN * 0.72 },
  { id: 'industrial', name: 'Industrial Park', x: CITY_HALF_SPAN * 0.72, z: -CITY_HALF_SPAN * 0.72 },
  { id: 'university', name: 'University Quarter', x: -CITY_HALF_SPAN * 0.72, z: CITY_HALF_SPAN * 0.72 },
  { id: 'harbor', name: 'Harbor District', x: CITY_HALF_SPAN * 0.72, z: CITY_HALF_SPAN * 0.72 },
  { id: 'downtown', name: 'Downtown Core', x: 0, z: 0 },
  { id: 'midtown', name: 'Midtown', x: 0, z: -CITY_HALF_SPAN * 0.42 },
  { id: 'residential', name: 'Garden Suburbs', x: 0, z: CITY_HALF_SPAN * 0.52 },
  { id: 'riverside', name: 'Riverside', x: 1860, z: 0 },
  { id: 'northgate', name: 'Northgate', x: 1800, z: -1200 },
  { id: 'southport', name: 'Southport', x: 1920, z: 1200 },
  { id: 'highland', name: 'Highland', x: 2820, z: 0 },
  { id: 'suncoast', name: 'Suncoast', x: 3660, z: 0 },
  { id: 'autobahn', name: 'A1 Autobahn', x: AUTOBAHN.x, z: -1320 },
  { id: 'eastlink', name: 'A1 East Link', x: 1200, z: 45 },
  { id: 'genting', name: 'Genting Pass', x: 420, z: -3750 },
  { id: 'batang', name: 'Batang Pass', x: -2600, z: -1800 },
  { id: 'ridge', name: 'Ridge Road', x: -1100, z: -3300 },
  { id: 'greenbelt', name: 'Green Belt', x: 980, z: 760 },
])

/** Fields and open land between the two cities. */
export const FIELDS = Object.freeze([
  { x: 1000, z: -900, width: 260, depth: 700, color: '#1d3324' },
  { x: 1000, z: 900, width: 260, depth: 700, color: '#263a25' },
  { x: 1240, z: -1100, width: 220, depth: 520, color: '#21301f' },
  { x: 1240, z: 1100, width: 220, depth: 520, color: '#1b2d20' },
  { x: 2300, z: -800, width: 260, depth: 900, color: '#1f3224' },
  { x: 2300, z: 800, width: 260, depth: 900, color: '#263a2a' },
])

const PARKED_COLORS = ['#9aa6b5', '#2f3948', '#7a2d2a', '#2c4a5c', '#b8a06a', '#3f5a3d', '#6b3f78']

function createParkedCars({
  xLines, xCenters, zLines, zCenters, count, seed, halfFor, within,
}) {
  const rng = mulberry32(seed)
  const cars = []
  let guard = 0

  while (cars.length < count && guard < count * 12) {
    guard += 1
    const vertical = rng() < 0.5
    const lines = vertical ? xLines : zLines
    const centers = vertical ? zCenters : xCenters
    const line = lines[Math.floor(rng() * lines.length)]
    const segment = Math.floor(rng() * Math.max(1, centers.length))
    const along = centers[segment] + 18 + rng() * (BLOCK_SIZE - 36)
    const side = rng() < 0.5 ? 1 : -1
    const offset = halfFor(line) - 2.3

    const x = vertical ? line + side * offset : along
    const z = vertical ? along : line + side * offset
    if (!within(x, z)) continue
    if (!isOnRoad(x, z)) continue
    if (Math.abs(x - SPAWN.x) < 5 && Math.abs(z - SPAWN.z) < 42) continue
    if (cars.some((car) => Math.abs(car.x - x) < 10 && Math.abs(car.z - z) < 10)) continue

    cars.push({
      x,
      z,
      heading: vertical ? 0 : Math.PI / 2,
      width: vertical ? 2 : 4.5,
      depth: vertical ? 4.5 : 2,
      color: PARKED_COLORS[Math.floor(rng() * PARKED_COLORS.length)],
    })
  }

  return cars
}

function townCenters(town) {
  return {
    xCenters: town.xLines.slice(0, -1).map((x) => x + BLOCK_SIZE / 2),
    zCenters: town.zLines.slice(0, -1).map((z) => z + BLOCK_SIZE / 2),
  }
}

export const PARKED_CARS = [
  ...createParkedCars({
    xLines: ROAD_LINES,
    xCenters: BLOCK_CENTERS,
    zLines: ROAD_LINES,
    zCenters: BLOCK_CENTERS,
    count: 170,
    seed: 517517,
    halfFor: roadHalfAt,
    within: (x, z) => Math.abs(x) <= CITY_LIMIT && Math.abs(z) <= CITY_LIMIT,
  }),
  ...TOWNS.flatMap((town, index) => {
    const { xCenters, zCenters } = townCenters(town)
    return createParkedCars({
      xLines: town.xLines,
      xCenters,
      zLines: town.zLines,
      zCenters,
      count: 45,
      seed: 818181 + index * 9_999,
      halfFor: (line) => townRoadHalfAt(town, line),
      within: (x, z) => {
        const bounds = town.bounds
        return x >= bounds.minX && x <= bounds.maxX &&
          z >= bounds.minZ && z <= bounds.maxZ
      },
    })
  }),
]

function createStreetlights({ xLines, xCenters, zLines, zCenters, halfFor }) {
  const lamps = []
  xLines.forEach((line, lineIndex) => {
    zCenters.forEach((center, blockIndex) => {
      const side = (lineIndex + blockIndex) % 2 === 0 ? 1 : -1
      const half = halfFor(line)
      lamps.push({
        x: line + side * (half + 1.4),
        z: center,
        rotationY: side > 0 ? Math.PI : 0,
      })
    })
  })
  zLines.forEach((line, lineIndex) => {
    xCenters.forEach((center, blockIndex) => {
      const side = (lineIndex + blockIndex) % 2 === 0 ? 1 : -1
      const half = halfFor(line)
      lamps.push({
        x: center,
        z: line + side * (half + 1.4),
        rotationY: side > 0 ? Math.PI / 2 : -Math.PI / 2,
      })
    })
  })
  return lamps
}

export const STREETLIGHTS = [
  ...createStreetlights({
    xLines: ROAD_LINES,
    xCenters: BLOCK_CENTERS,
    zLines: ROAD_LINES,
    zCenters: BLOCK_CENTERS,
    halfFor: roadHalfAt,
  }),
  ...TOWNS.flatMap((town) => {
    const { xCenters, zCenters } = townCenters(town)
    return createStreetlights({
      xLines: town.xLines,
      xCenters,
      zLines: town.zLines,
      zCenters,
      halfFor: (line) => townRoadHalfAt(town, line),
    })
  }),
  ...CITY_LINKS.flatMap((link) => {
    const lamps = []
    for (let x = link.xMin + 60; x < link.xMax; x += 140) {
      for (const side of [-1, 1]) {
        lamps.push({
          x,
          z: link.z + side * (link.halfWidth + 1.4),
          rotationY: side > 0 ? Math.PI / 2 : -Math.PI / 2,
        })
      }
    }
    return lamps
  }),
]

/** Traffic signals at the major Metro City intersections plus Riverside. */
export const TRAFFIC_LIGHTS = (() => {
  const signals = []
  ROAD_LINES.forEach((x, xi) => {
    if (!MAJOR_INDICES.has(xi)) return
    ROAD_LINES.forEach((z, zi) => {
      if (!MAJOR_INDICES.has(zi)) return
      signals.push({ x: x + roadHalfAt(x) + 1.2, z: z + roadHalfAt(z) + 1.2, rotationY: Math.PI })
    })
  })
  for (const town of TOWNS) {
    for (const x of [town.xLines[1], town.xLines[3]]) {
      for (const z of [town.zLines[1], town.zLines[3], town.mainZ]) {
        if (z === undefined) continue
        signals.push({
          x: x + townRoadHalfAt(town, x) + 1.2,
          z: z + townRoadHalfAt(town, z) + 1.2,
          rotationY: Math.PI,
        })
      }
    }
  }
  return signals
})()

function createStopPool(linesX, linesZ, resolveDistrict) {
  const pools = new Map(DISTRICTS.map((district) => [district.id, []]))
  linesX.forEach((x, xi) => {
    linesZ.forEach((z, zi) => {
      if (xi === 0 || zi === 0 || xi === linesX.length - 1 || zi === linesZ.length - 1) return
      const district = resolveDistrict(x, z)
      const pool = pools.get(district.id)
      if (pool) pool.push({ x, z })
    })
  })
  return pools
}

/** Named landmarks at street corners, used as pickup and drop-off stops. */
export const CITY_STOPS = (() => {
  const primary = createStopPool(ROAD_LINES, ROAD_LINES, districtAt)
  const townPools = TOWNS.map((town) => createStopPool(
    town.xLines,
    town.zLines,
    () => TOWN_DISTRICT.get(town.id),
  ))
  const rng = mulberry32(424242)
  const stops = []

  for (const district of DISTRICTS) {
    const pool = shuffle([
      ...(primary.get(district.id) ?? []),
      ...townPools.flatMap((pools) => pools.get(district.id) ?? []),
    ], rng)
    district.landmarks.forEach((name, index) => {
      if (!pool.length) return
      const corner = pool[index % pool.length]
      const side = (index + district.id.length) % 2 === 0 ? 1 : -1
      const town = townAt(corner.x, corner.z)
      const half = town ? townRoadHalfAt(town, corner.x) : roadHalfAt(corner.x)
      stops.push({
        id: `${district.id}-${index}`,
        name,
        district: district.name,
        x: corner.x,
        z: corner.z + side * (half + 3.6),
        intersection: { x: corner.x, z: corner.z },
      })
    })
  }
  return stops
})()

/** Low concrete walls along both river banks, with a gap for the bridge. */
export const RIVER_BARRIERS = (() => {
  const barriers = []
  const gap = RIVER.bridgeHalfWidth + 18
  const segment = 40
  for (const bank of [RIVER.x - RIVER.halfWidth - 1.5, RIVER.x + RIVER.halfWidth + 1.5]) {
    for (let z = RIVER.zMin; z < RIVER.zMax; z += segment) {
      const center = z + segment / 2
      if (CITY_LINKS.some((link) => Math.abs(center - link.z) < gap)) continue
      barriers.push({ x: bank, z: center, width: 3, depth: segment })
    }
  }
  return barriers
})()

function nearestIn(lines, value) {
  let best = lines[0]
  for (const line of lines) {
    if (Math.abs(value - line) < Math.abs(value - best)) best = line
  }
  return best
}

/** Closest intersection in the Metro City grid. */
export function nearestIntersection(x, z) {
  return { x: nearestIn(ROAD_LINES, x), z: nearestIn(ROAD_LINES, z) }
}

function localStreetRoute(from, to, linesX, linesZ) {
  const start = { x: nearestIn(linesX, from.x), z: nearestIn(linesZ, from.z) }
  const end = { x: nearestIn(linesX, to.x), z: nearestIn(linesZ, to.z) }
  const points = [{ x: from.x, z: from.z }]

  if (Math.abs(from.x - start.x) < Math.abs(from.z - start.z)) {
    points.push({ x: from.x, z: start.z })
  } else {
    points.push({ x: start.x, z: from.z })
  }
  points.push(start)

  if (Math.abs(start.x - end.x) > 0.01) points.push({ x: end.x, z: start.z })
  if (Math.abs(start.z - end.z) > 0.01) points.push({ x: end.x, z: end.z })
  points.push({ x: to.x, z: to.z })
  return points
}

function dedupe(points) {
  return points.filter((point, index) => {
    if (index === 0) return true
    const previous = points[index - 1]
    return Math.abs(previous.x - point.x) > 0.01 || Math.abs(previous.z - point.z) > 0.01
  })
}

const METRO_GATE = Object.freeze({ x: CITY_HALF_SPAN, z: EAST_LINK.z })

function gateForTown(town) {
  if (!town) return METRO_GATE
  return { x: town.xLines[0], z: town.mainZ }
}

function gridForTown(town) {
  return town ?? { xLines: ROAD_LINES, zLines: ROAD_LINES }
}

/**
 * Street-following route between any two points. Same-city trips use the local
 * grid; cross-city trips use the nearest city gate, the A1 autobahn and the
 * corresponding exit link.
 */
export function streetRoute(from, to) {
  const fromTown = townAt(from.x, from.z)
  const toTown = townAt(to.x, to.z)

  if (fromTown === toTown) {
    const grid = gridForTown(fromTown)
    return dedupe(localStreetRoute(from, to, grid.xLines, grid.zLines))
  }

  const fromGrid = gridForTown(fromTown)
  const toGrid = gridForTown(toTown)
  const fromGate = gateForTown(fromTown)
  const toGate = gateForTown(toTown)
  const points = localStreetRoute(from, fromGate, fromGrid.xLines, fromGrid.zLines)

  if (Math.abs(fromGate.z - toGate.z) < 0.01) {
    // Both gates sit on the same east-west trunk (East Link).
    points.push(toGate)
  } else {
    points.push({ x: AUTOBAHN.x, z: fromGate.z })
    points.push({ x: AUTOBAHN.x, z: toGate.z })
    points.push(toGate)
  }
  points.push(...localStreetRoute(toGate, to, toGrid.xLines, toGrid.zLines).slice(1))
  return dedupe(points)
}

/** Shortest street distance (Manhattan along the grid). */
export function streetDistance(from, to) {
  return Math.abs(from.x - to.x) + Math.abs(from.z - to.z)
}

/** Straight-line distance in metres. */
export function distanceBetween(from, to) {
  return Math.hypot(from.x - to.x, from.z - to.z)
}

function inGridBand(value, lines, halfFor) {
  const line = nearestIn(lines, value)
  return Math.abs(value - line) <= halfFor(line)
}

const normalizeAngle = (angle) => {
  let value = angle
  while (value > Math.PI) value -= Math.PI * 2
  while (value < -Math.PI) value += Math.PI * 2
  return value
}

/**
 * Heading of the road under the car. At junctions the direction closest to the
 * car's current heading is returned, which gives keyboard drivers a gentle
 * self-centering steer assist.
 */
export function nearestRoadHeading(x, z, heading = 0) {
  if (!isOnRoad(x, z)) return null
  const candidates = []
  const add = (value) => {
    if (!candidates.some((candidate) => Math.abs(normalizeAngle(candidate - value)) < 0.01)) {
      candidates.push(value)
    }
  }
  const addGrid = (linesX, linesZ, halfForX, halfForZ) => {
    const nearestX = nearestIn(linesX, x)
    if (Math.abs(x - nearestX) <= halfForX(nearestX) + 0.2) {
      add(0)
      add(Math.PI)
    }
    const nearestZ = nearestIn(linesZ, z)
    if (Math.abs(z - nearestZ) <= halfForZ(nearestZ) + 0.2) {
      add(Math.PI / 2)
      add(-Math.PI / 2)
    }
  }

  if (Math.abs(x) <= CITY_LIMIT && Math.abs(z) <= CITY_LIMIT) {
    addGrid(ROAD_LINES, ROAD_LINES, roadHalfAt, roadHalfAt)
  }
  for (const town of TOWNS) {
    const bounds = town.bounds
    if (x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ) {
      addGrid(
        town.xLines,
        town.zLines,
        (line) => townRoadHalfAt(town, line),
        (line) => townRoadHalfAt(town, line),
      )
    }
  }
  for (const link of CITY_LINKS) {
    if (Math.abs(z - link.z) <= link.halfWidth + 0.2 &&
      x >= link.xMin - link.halfWidth && x <= link.xMax) {
      add(Math.PI / 2)
      add(-Math.PI / 2)
    }
  }
  if (Math.abs(x - AUTOBAHN.x) <= AUTOBAHN.halfWidth + 0.2 &&
    z >= AUTOBAHN.zMin && z <= AUTOBAHN.zMax) {
    add(0)
    add(Math.PI)
  }
  const genting = nearestGentingRoad(x, z)
  if (genting && genting.distance <= GENTING.halfWidth + 0.3) {
    add(genting.heading)
    add(genting.heading + Math.PI)
  }
  const access = nearestAccessInfo(x, z)
  if (access && access.distance <= access.halfWidth + 0.2) {
    add(access.heading)
    add(access.heading + Math.PI)
  }

  if (!candidates.length) return null
  return candidates.reduce((best, candidate) =>
    Math.abs(normalizeAngle(candidate - heading)) < Math.abs(normalizeAngle(best - heading))
      ? candidate : best, candidates[0])
}

/** True when the point lies on asphalt anywhere in the world. */
export function isOnRoad(x, z) {
  if (x < WORLD_BOUNDS.minX || x > WORLD_BOUNDS.maxX ||
    z < WORLD_BOUNDS.minZ || z > WORLD_BOUNDS.maxZ) return false

  if (Math.abs(x) <= CITY_LIMIT && Math.abs(z) <= CITY_LIMIT &&
    (inGridBand(x, ROAD_LINES, roadHalfAt) || inGridBand(z, ROAD_LINES, roadHalfAt))) {
    return true
  }

  for (const town of TOWNS) {
    const bounds = town.bounds
    if (x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ &&
      (inGridBand(x, town.xLines, (line) => townRoadHalfAt(town, line)) ||
        inGridBand(z, town.zLines, (line) => townRoadHalfAt(town, line)))) {
      return true
    }
  }

  for (const link of CITY_LINKS) {
    if (Math.abs(z - link.z) <= link.halfWidth &&
      x >= link.xMin - link.halfWidth && x <= link.xMax) {
      return true
    }
  }

  if (Math.abs(x - AUTOBAHN.x) <= AUTOBAHN.halfWidth &&
    z >= AUTOBAHN.zMin && z <= AUTOBAHN.zMax) {
    return true
  }

  if (isOnGentingRoad(x, z)) return true

  return false
}

/** True when the point is on a paved walkway beside a road. */
export function isOnSidewalk(x, z) {
  if (isOnRoad(x, z)) return false
  if (Math.abs(x) <= CITY_LIMIT && Math.abs(z) <= CITY_LIMIT) {
    const nearestX = nearestIn(ROAD_LINES, x)
    const nearestZ = nearestIn(ROAD_LINES, z)
    if (Math.abs(x - nearestX) <= roadHalfAt(nearestX) + SIDEWALK) return true
    if (Math.abs(z - nearestZ) <= roadHalfAt(nearestZ) + SIDEWALK) return true
  }
  for (const town of TOWNS) {
    const bounds = town.bounds
    if (x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ) {
      const nearestX = nearestIn(town.xLines, x)
      const nearestZ = nearestIn(town.zLines, z)
      if (Math.abs(x - nearestX) <= townRoadHalfAt(town, nearestX) + 4) return true
      if (Math.abs(z - nearestZ) <= townRoadHalfAt(town, nearestZ) + 4) return true
    }
  }
  if (CITY_LINKS.some((link) => Math.abs(z - link.z) <= link.halfWidth + 3 &&
    x >= link.xMin && x <= link.xMax)) return true
  return Math.abs(x - AUTOBAHN.x) <= AUTOBAHN.halfWidth + 3
}

/*
 * Spatial hash for collision queries.
 */
const HASH_CELL = 32
const COLLIDER_HASH = new Map()

function hashKey(cx, cz) {
  return `${cx}:${cz}`
}

function registerCollider(box) {
  const minX = Math.floor((box.x - box.width / 2) / HASH_CELL)
  const maxX = Math.floor((box.x + box.width / 2) / HASH_CELL)
  const minZ = Math.floor((box.z - box.depth / 2) / HASH_CELL)
  const maxZ = Math.floor((box.z + box.depth / 2) / HASH_CELL)
  for (let cx = minX; cx <= maxX; cx += 1) {
    for (let cz = minZ; cz <= maxZ; cz += 1) {
      const key = hashKey(cx, cz)
      const bucket = COLLIDER_HASH.get(key)
      if (bucket) bucket.push(box)
      else COLLIDER_HASH.set(key, [box])
    }
  }
}

for (const building of BUILDINGS) registerCollider(building)
for (const car of PARKED_CARS) registerCollider(car)
for (const barrier of RIVER_BARRIERS) registerCollider(barrier)

/**
 * Circle-vs-AABB resolution against nearby buildings, parked cars, river walls
 * and the world boundary. Returns the corrected position and a normal, or null.
 */
export function resolveCollision(x, z, radius) {
  let hit = null
  let bestDepth = 0

  const pushOut = (box) => {
    const halfW = box.width / 2
    const halfD = box.depth / 2
    const dx = x - box.x
    const dz = z - box.z
    const overlapX = halfW + radius - Math.abs(dx)
    if (overlapX <= 0) return
    const overlapZ = halfD + radius - Math.abs(dz)
    if (overlapZ <= 0) return

    if (overlapX < overlapZ) {
      if (overlapX > bestDepth) {
        bestDepth = overlapX
        hit = {
          x: box.x + Math.sign(dx || 1) * (halfW + radius),
          z,
          nx: Math.sign(dx || 1),
          nz: 0,
        }
      }
    } else if (overlapZ > bestDepth) {
      bestDepth = overlapZ
      hit = {
        x,
        z: box.z + Math.sign(dz || 1) * (halfD + radius),
        nx: 0,
        nz: Math.sign(dz || 1),
      }
    }
  }

  const cellX = Math.floor(x / HASH_CELL)
  const cellZ = Math.floor(z / HASH_CELL)
  const seen = new Set()
  for (let ox = -1; ox <= 1; ox += 1) {
    for (let oz = -1; oz <= 1; oz += 1) {
      const bucket = COLLIDER_HASH.get(hashKey(cellX + ox, cellZ + oz))
      if (!bucket) continue
      for (let i = 0; i < bucket.length; i += 1) {
        if (seen.has(bucket[i])) continue
        seen.add(bucket[i])
        pushOut(bucket[i])
      }
    }
  }

  if (x > WORLD_BOUNDS.maxX - radius) {
    hit = { x: WORLD_BOUNDS.maxX - radius, z, nx: -1, nz: 0 }
  } else if (x < WORLD_BOUNDS.minX + radius) {
    hit = { x: WORLD_BOUNDS.minX + radius, z, nx: 1, nz: 0 }
  }
  if (z > WORLD_BOUNDS.maxZ - radius) {
    hit = { x, z: WORLD_BOUNDS.maxZ - radius, nx: 0, nz: -1 }
  } else if (z < WORLD_BOUNDS.minZ + radius) {
    hit = { x, z: WORLD_BOUNDS.minZ + radius, nx: 0, nz: 1 }
  }

  return hit
}

/** Straight-line distance to the nearest primary road centre line. */
export function distanceToRoad(x, z) {
  let best = Infinity
  for (const line of ROAD_LINES) {
    best = Math.min(best, Math.abs(x - line), Math.abs(z - line))
  }
  return best
}
