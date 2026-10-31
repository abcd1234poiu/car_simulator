// A deterministic winding route. Sampling the same function keeps the in-car
// road, minimap and roadside stops aligned for the full endless shift.
const SEGMENT_METRES = 160

const anchor = (index, seed) => {
  const phase = seed * 0.0137
  return Math.sin(index * 1.17 + 0.45 + phase) * 17 +
    Math.sin(index * 2.39 - 0.8 + phase * 1.71) * 7
}

export function roadCenter(distance, seed = 0) {
  const segment = Math.floor(distance / SEGMENT_METRES)
  const t = (distance - segment * SEGMENT_METRES) / SEGMENT_METRES
  const a = anchor(segment - 1, seed)
  const b = anchor(segment, seed)
  const c = anchor(segment + 1, seed)
  const d = anchor(segment + 2, seed)
  // Catmull-Rom interpolation gives connected bends without sharp corners.
  return 0.5 * ((2 * b) + (-a + c) * t +
    (2 * a - 5 * b + 4 * c - d) * t * t +
    (-a + 3 * b - 3 * c + d) * t * t * t)
}

export function roadHeading(distance, seed = 0) {
  const slope = (roadCenter(distance + 1, seed) - roadCenter(distance - 1, seed)) / 2
  return Math.atan(slope)
}

/** Position a road point in the car's tangent-aligned local scene. */
export function roadLocalPoint(roadDistance, carDistance, lateral = 0, seed = 0) {
  const heading = roadHeading(carDistance, seed)
  const pointHeading = roadHeading(roadDistance, seed)
  const deltaX = roadCenter(roadDistance, seed) - roadCenter(carDistance, seed)
  const deltaDistance = roadDistance - carDistance
  const relativeHeading = pointHeading - heading
  return {
    x: deltaX * Math.cos(heading) - deltaDistance * Math.sin(heading) +
      lateral * Math.cos(relativeHeading),
    z: -deltaX * Math.sin(heading) - deltaDistance * Math.cos(heading) +
      lateral * Math.sin(relativeHeading),
  }
}
