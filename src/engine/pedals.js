/** A vertical pedal: bottom is barely pressed, top is fully pressed. */
export function pedalLevelAt(clientY, top, height) {
  if (height <= 0) return 0
  return Math.min(1, Math.max(0.05, 1 - (clientY - top) / height))
}
