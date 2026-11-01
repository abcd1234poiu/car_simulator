// Deterministic city-road path and road geometry.
// The route is a connected urban loop with actual road width and lane bounds,
// making the player vehicle respect a real drivable surface instead of a strip.

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

function buildCityLoop(seed = 0) {
  const points = []
  const samples = 96
  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples
    const x = -300 + t * 600
    const z = 12 * Math.sin(t * Math.PI * 2.6 + seed * 0.7) + 8 * Math.cos(t * Math.PI * 5.4 + seed * 0.4)
    points.push({ x, z })
  }

  const lengths = []
  let total = 0
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i]
    const b = points[i + 1]
    const length = Math.hypot(b.x - a.x, b.z - a.z)
    lengths.push(length)
    total += length
  }

  return { points, lengths, total }
}

function sampleCityRoad(distance, seed = 0) {
  const { points, lengths, total } = buildCityLoop(seed)
  const wrapped = ((distance % total) + total) % total
  let travelled = 0

  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i]
    const b = points[i + 1]
    const segmentLength = lengths[i]
    if (wrapped <= travelled + segmentLength) {
      const t = segmentLength === 0 ? 0 : (wrapped - travelled) / segmentLength
      const x = a.x + (b.x - a.x) * t
      const z = a.z + (b.z - a.z) * t
      const dx = b.x - a.x
      const dz = b.z - a.z
      const heading = Math.atan2(dz, dx)
      return { x, z, heading }
    }
    travelled += segmentLength
  }

  const last = points[points.length - 2]
  const end = points[points.length - 1]
  return { x: end.x, z: end.z, heading: Math.atan2(end.z - last.z, end.x - last.x) }
}

export function roadSample(distance, seed = 0) {
  return sampleCityRoad(distance, seed)
}

export function roadCenter(distance, seed = 0) {
  return sampleCityRoad(distance, seed).x
}

export function roadHeading(distance, seed = 0) {
  return sampleCityRoad(distance, seed).heading
}

export function roadWidth(distance, seed = 0) {
  const width = 22 + Math.sin(distance * 0.05 + seed * 0.2) * 2.4
  return clamp(width, 18, 26)
}

export function roadBounds(distance, seed = 0) {
  const half = roadWidth(distance, seed) * 0.5
  return { left: -half, right: half }
}

export function roadLocalPoint(roadDistance, carDistance, lateral = 0, seed = 0) {
  const carSample = sampleCityRoad(carDistance, seed)
  const roadSamplePoint = sampleCityRoad(roadDistance, seed)

  const dx = roadSamplePoint.x - carSample.x
  const dz = roadSamplePoint.z - carSample.z
  const heading = carSample.heading
  const relativeHeading = roadSamplePoint.heading - heading

  const localX = dx * Math.cos(heading) + dz * Math.sin(heading) + lateral * Math.cos(relativeHeading)
  const localZ = -dx * Math.sin(heading) + dz * Math.cos(heading) + lateral * Math.sin(relativeHeading)

  return { x: localX, z: localZ }
}
