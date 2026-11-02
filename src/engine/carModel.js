// Three.js helpers for the player's parametric car and sun sprite.

import * as THREE from 'three'

export function createSunTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  const gradient = ctx.createRadialGradient(128, 128, 8, 128, 128, 128)
  gradient.addColorStop(0, 'rgba(255, 226, 176, 1)')
  gradient.addColorStop(0.28, 'rgba(255, 168, 108, 0.85)')
  gradient.addColorStop(0.6, 'rgba(226, 110, 96, 0.25)')
  gradient.addColorStop(1, 'rgba(226, 110, 96, 0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 256, 256)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/**
 * Side profiles are defined in metres with X running front (-) to rear (+)
 * and Y as height. They are extruded across the car's width and rotated so
 * the profile's X axis becomes world Z.
 */
const CAR_SHAPES = {
  sedan: {
    length: 4.75,
    width: 1.87,
    body: [
      [-2.36, 0.3], [-2.37, 0.55], [-2.22, 0.76], [-1.5, 0.86],
      [-0.8, 0.9], [0.95, 0.91], [1.8, 0.87], [2.32, 0.77],
      [2.37, 0.54], [2.28, 0.31], [1.1, 0.26], [-1.45, 0.26],
    ],
    glass: [[-1.25, 0.89], [-0.69, 1.25], [0.8, 1.25], [1.52, 0.88]],
    glassWidth: 1.61,
    roof: { z: 0.05, y: 1.25, length: 1.48, width: 1.68 },
    spoiler: null,
    scoop: false,
  },
  coupe: {
    length: 4.42,
    width: 1.86,
    body: [
      [-2.2, 0.3],
      [-2.22, 0.58],
      [-2.1, 0.78],
      [-1.5, 0.86],
      [-0.8, 0.89],
      [0.9, 0.9],
      [1.7, 0.88],
      [2.1, 0.84],
      [2.16, 0.6],
      [2.05, 0.32],
      [1.1, 0.26],
      [-1.4, 0.26],
    ],
    glass: [
      [-0.95, 0.9],
      [-0.5, 1.16],
      [0.18, 1.2],
      [0.95, 0.92],
    ],
    glassWidth: 1.6,
    roof: { z: -0.16, y: 1.19, length: 0.86, width: 1.7 },
    spoiler: { z: 1.68, y: 1.0 },
    scoop: false,
  },
  muscle: {
    length: 4.78,
    width: 1.94,
    body: [
      [-2.36, 0.32],
      [-2.38, 0.62],
      [-2.25, 0.82],
      [-1.55, 0.9],
      [-0.75, 0.93],
      [1.0, 0.94],
      [1.9, 0.92],
      [2.3, 0.88],
      [2.36, 0.62],
      [2.25, 0.34],
      [1.2, 0.28],
      [-1.5, 0.28],
    ],
    glass: [
      [-0.92, 0.94],
      [-0.42, 1.2],
      [0.2, 1.23],
      [1.05, 0.96],
    ],
    glassWidth: 1.66,
    roof: { z: -0.1, y: 1.225, length: 0.86, width: 1.76 },
    spoiler: { z: 1.95, y: 1.04 },
    scoop: true,
  },
  gt: {
    length: 4.95,
    width: 1.9,
    body: [
      [-2.44, 0.3],
      [-2.46, 0.56],
      [-2.33, 0.76],
      [-1.6, 0.84],
      [-0.8, 0.88],
      [1.2, 0.9],
      [2.05, 0.88],
      [2.4, 0.82],
      [2.47, 0.56],
      [2.35, 0.32],
      [1.3, 0.26],
      [-1.6, 0.26],
    ],
    glass: [
      [-1.0, 0.88],
      [-0.45, 1.14],
      [0.35, 1.18],
      [1.25, 0.92],
    ],
    glassWidth: 1.62,
    roof: { z: 0, y: 1.175, length: 0.98, width: 1.72 },
    spoiler: null,
    scoop: false,
  },
  hatch: {
    length: 3.98,
    width: 1.82,
    body: [
      [-1.97, 0.3],
      [-1.99, 0.58],
      [-1.88, 0.8],
      [-1.5, 0.86],
      [-0.9, 0.9],
      [0.7, 0.92],
      [1.55, 0.9],
      [1.93, 0.86],
      [1.99, 0.6],
      [1.88, 0.34],
      [1.0, 0.28],
      [-1.4, 0.28],
    ],
    glass: [
      [-1.05, 0.9],
      [-0.55, 1.2],
      [0.45, 1.26],
      [1.5, 0.96],
    ],
    glassWidth: 1.56,
    roof: { z: 0.05, y: 1.26, length: 1.05, width: 1.7 },
    spoiler: { z: 1.58, y: 1.16 },
    scoop: false,
  },
}

export function profileGeometry(points, width, bevel) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)))
  const depth = Math.max(0.02, width - bevel * 2)
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    steps: 1,
    curveSegments: 4,
  })
  geometry.translate(0, 0, -depth / 2)
  geometry.computeVertexNormals()
  return geometry
}

/** Narrow the upper part of an extruded body/cabin so sides are not slab-flat. */
function taperUpperBody(geometry, amount, startY, endY) {
  const position = geometry.attributes.position
  const clamp01 = (value) => Math.min(1, Math.max(0, value))
  for (let index = 0; index < position.count; index += 1) {
    const y = position.getY(index)
    const t = clamp01((y - startY) / Math.max(0.001, endY - startY))
    const scale = 1 - amount * t * t
    position.setZ(index, position.getZ(index) * scale)
  }
  position.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}

/** Narrow nose and tail in plan view; a constant-width extrusion looks toy-like. */
function sculptBodyPlan(geometry, length) {
  const position = geometry.attributes.position
  for (let index = 0; index < position.count; index += 1) {
    const normalized = Math.min(1, Math.abs(position.getX(index)) / (length / 2))
    const shoulder = 1 - 0.085 * normalized * normalized
    position.setZ(index, position.getZ(index) * shoulder)
  }
  position.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}

export function createCarModel(car) {
  const group = new THREE.Group()
  const wheels = []

  const paintMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(car.color),
    metalness: 0.55,
    roughness: 0.24,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    envMapIntensity: 1.15,
  })
  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x071017,
    metalness: 0.55,
    roughness: 0.06,
    // Opaque dark glazing avoids sorting/z-fighting between the cabin shell,
    // windshields and roof when seen from the chase camera.
    transparent: false,
    envMapIntensity: 1.45,
  })
  const trimMaterial = new THREE.MeshStandardMaterial({
    color: 0x0b0d10,
    metalness: 0.35,
    roughness: 0.6,
  })
  const chromeMaterial = new THREE.MeshStandardMaterial({
    color: 0xc9d3df,
    metalness: 0.95,
    roughness: 0.18,
  })
  const darkChromeMaterial = new THREE.MeshStandardMaterial({
    color: 0x2b323a,
    metalness: 0.8,
    roughness: 0.3,
  })
  const tireMaterial = new THREE.MeshStandardMaterial({ color: 0x101216, roughness: 0.95 })
  const rimMaterial = new THREE.MeshStandardMaterial({
    color: 0xb8c3d2,
    metalness: 0.95,
    roughness: 0.2,
  })
  const brakeDiscMaterial = new THREE.MeshStandardMaterial({
    color: 0x555b61,
    metalness: 0.7,
    roughness: 0.45,
  })
  const caliperMaterial = new THREE.MeshStandardMaterial({
    color: 0xc42a2a,
    metalness: 0.35,
    roughness: 0.4,
  })
  const headlightMaterial = new THREE.MeshStandardMaterial({
    color: 0xfff8e5,
    emissive: 0xfff0c8,
    emissiveIntensity: 3.2,
    roughness: 0.22,
  })
  const drlMaterial = new THREE.MeshStandardMaterial({
    color: 0xcfe8ff,
    emissive: 0xa8d8ff,
    emissiveIntensity: 2.4,
    roughness: 0.25,
  })
  const lampLensMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x56728a,
    metalness: 0.28,
    roughness: 0.12,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
  })
  const brakeLightMaterial = new THREE.MeshStandardMaterial({
    color: 0x6b0a10,
    emissive: 0xff2531,
    emissiveIntensity: 0.35,
    roughness: 0.35,
  })
  const reverseLightMaterial = new THREE.MeshStandardMaterial({
    color: 0xcbd4d4,
    emissive: 0xffffff,
    emissiveIntensity: 0.04,
    roughness: 0.35,
  })

  const shape = CAR_SHAPES[car.bodyStyle] ?? CAR_SHAPES.coupe
  const isGT = car.bodyStyle === 'gt'
  const gtChromeMaterial = isGT ? chromeMaterial.clone() : null
  const gtTrimMaterial = isGT ? trimMaterial.clone() : null
  const gtLensMaterial = isGT ? lampLensMaterial.clone() : null
  if (isGT) {
    gtChromeMaterial.side = THREE.DoubleSide
    gtTrimMaterial.side = THREE.DoubleSide
    gtLensMaterial.side = THREE.DoubleSide
  }
  const { length, width } = shape
  const axleZ = length / 2 - 0.92
  const wheelRadius = car.wheelRadius

  const addRod = (start, end, radius, material) => {
    const a = new THREE.Vector3(...start)
    const b = new THREE.Vector3(...end)
    const direction = new THREE.Vector3().subVectors(b, a)
    const rod = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, direction.length(), 6), material)
    rod.position.copy(a).add(b).multiplyScalar(0.5)
    rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())
    group.add(rod)
    return rod
  }

  // Main body with a slightly softer bevel and a subtle tumblehome for a more
  // rounded, production-car silhouette.
  const bodyGeometry = profileGeometry(shape.body, width, 0.075)
  sculptBodyPlan(bodyGeometry, length)
  taperUpperBody(bodyGeometry, 0.065, 0.3, 0.95)
  const body = new THREE.Mesh(bodyGeometry, paintMaterial)
  body.rotation.y = -Math.PI / 2
  body.castShadow = true
  group.add(body)

  // Rocker panels and underbody give the body some thickness below the sill.
  const underbody = new THREE.Mesh(
    new THREE.BoxGeometry(width - 0.16, 0.18, length - 0.6),
    trimMaterial,
  )
  underbody.position.y = 0.27
  group.add(underbody)

  // Sculpted fenders over each wheel break up the flat extruded side.
  const fenderGeometry = new THREE.SphereGeometry(1, 18, 10)
  for (const side of [-1, 1]) {
    for (const axle of [-1, 1]) {
      const fender = new THREE.Mesh(fenderGeometry, paintMaterial)
      fender.scale.set(isGT ? 0.19 : 0.15, isGT ? 0.43 : 0.4, 0.76)
      fender.position.set(side * (width / 2 - 0.035), wheelRadius + 0.16, axle * axleZ)
      group.add(fender)
    }
  }

  // Chrome beltline and door seams.
  for (const side of [-1, 1]) {
    const beltline = new THREE.Mesh(
      new THREE.BoxGeometry(0.024, 0.026, length * 0.66),
      chromeMaterial,
    )
    beltline.position.set(side * (width / 2 + 0.004), 0.69, 0.02)
    group.add(beltline)

    for (const z of [-0.22, 0.92]) {
      const seam = new THREE.Mesh(
        new THREE.BoxGeometry(0.014, 0.44, 0.012),
        trimMaterial,
      )
      seam.position.set(side * (width / 2 + 0.003), 0.53, z)
      group.add(seam)
    }

    const indicator = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, 0.055, 0.16),
      new THREE.MeshStandardMaterial({
        color: 0xffb45e,
        emissive: 0xff9a3d,
        emissiveIntensity: 0.9,
        roughness: 0.3,
      }),
    )
    indicator.position.set(side * (width / 2 + 0.012), 0.66, -length / 2 + 0.55)
    group.add(indicator)
  }

  const cabinGeometry = profileGeometry(shape.glass, shape.glassWidth, 0.03)
  taperUpperBody(cabinGeometry, 0.2, 0.92, 1.28)
  const cabin = new THREE.Mesh(cabinGeometry, glassMaterial)
  cabin.rotation.y = -Math.PI / 2
  group.add(cabin)

  // Actual sloped front and rear glazing, rather than relying on the dark
  // extruded cabin alone. The panels and A/C pillars make the roof read as a
  // production-car greenhouse from the chase camera.
  const addGlassPanel = (bottom, top) => {
    const halfBottom = shape.glassWidth * 0.48
    const halfTop = shape.roof.width * 0.46
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([
      -halfBottom, bottom[1] + 0.025, bottom[0],
      halfBottom, bottom[1] + 0.025, bottom[0],
      -halfTop, top[1] + 0.025, top[0],
      halfBottom, bottom[1] + 0.025, bottom[0],
      halfTop, top[1] + 0.025, top[0],
      -halfTop, top[1] + 0.025, top[0],
    ], 3))
    geometry.computeVertexNormals()
    group.add(new THREE.Mesh(geometry, new THREE.MeshPhysicalMaterial({
      color: 0x10212d, metalness: 0.42, roughness: 0.08,
      side: THREE.DoubleSide,
      clearcoat: 1, clearcoatRoughness: 0.03,
    })))
  }
  addGlassPanel(shape.glass[0], shape.glass[1])
  addGlassPanel(shape.glass[3], shape.glass[2])

  const addPillar = (start, end, side) => {
    const a = new THREE.Vector3(side * shape.glassWidth * 0.48, start[1], start[0])
    const b = new THREE.Vector3(side * shape.roof.width * 0.46, end[1], end[0])
    const direction = new THREE.Vector3().subVectors(b, a)
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035,
      direction.length(), 8), trimMaterial)
    pillar.position.copy(a).add(b).multiplyScalar(0.5)
    pillar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())
    group.add(pillar)
  }
  for (const side of [-1, 1]) {
    addPillar(shape.glass[0], shape.glass[1], side)
    addPillar(shape.glass[3], shape.glass[2], side)
  }

  // Seals around the front and rear glass, with two blades resting on the
  // lower windshield. The separate dark edges make the glazing read as real
  // panels rather than one featureless black cabin.
  for (const [bottom, top] of [[shape.glass[0], shape.glass[1]],
    [shape.glass[3], shape.glass[2]]]) {
    addRod([-shape.glassWidth * 0.48, bottom[1] + 0.033, bottom[0]],
      [shape.glassWidth * 0.48, bottom[1] + 0.033, bottom[0]], 0.012, trimMaterial)
    addRod([-shape.roof.width * 0.46, top[1] + 0.033, top[0]],
      [shape.roof.width * 0.46, top[1] + 0.033, top[0]], 0.012, trimMaterial)
  }
  for (const side of [-1, 1]) {
    const lower = shape.glass[0]
    const upper = shape.glass[1]
    const glassPoint = (fraction, x) => [x,
      lower[1] + (upper[1] - lower[1]) * fraction + 0.045,
      lower[0] + (upper[0] - lower[0]) * fraction - 0.018]
    addRod(glassPoint(0.09, side * shape.glassWidth * 0.36),
      glassPoint(0.23, side * shape.glassWidth * 0.06), 0.012, trimMaterial)
    addRod(glassPoint(0.09, side * shape.glassWidth * 0.36),
      glassPoint(0.05, side * shape.glassWidth * 0.42), 0.009, darkChromeMaterial)
  }

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(shape.roof.width, 0.06, shape.roof.length),
    paintMaterial,
  )
  roof.position.set(0, shape.roof.y, shape.roof.z)
  group.add(roof)
  for (const side of [-1, 1]) {
    addRod([side * (shape.roof.width / 2 - 0.045), shape.roof.y + 0.045,
      shape.roof.z - shape.roof.length / 2 + 0.04],
    [side * (shape.roof.width / 2 - 0.045), shape.roof.y + 0.045,
      shape.roof.z + shape.roof.length / 2 - 0.04], 0.011, darkChromeMaterial)
  }

  // Hood creases and a center brake lamp add scale cues without licensed
  // emblems or brand-specific bodywork.
  for (const side of [-1, 1]) {
    if (isGT) {
      addRod([side * width * 0.23, 0.8, -2.07],
        [side * width * 0.23, 0.875, -1.2], 0.006, darkChromeMaterial)
      const hoodVent = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 0.009, 0.12), trimMaterial)
      hoodVent.position.set(side * 0.38, 0.876, -1.13)
      group.add(hoodVent)
    } else {
      const crease = new THREE.Mesh(
        new THREE.BoxGeometry(0.012, 0.012, Math.max(0.5, length * 0.19)),
        darkChromeMaterial,
      )
      crease.position.set(side * width * 0.23, 0.905, -length / 2 + 0.72)
      group.add(crease)
    }
  }
  const highBrake = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.025, 0.025), brakeLightMaterial,
  )
  highBrake.position.set(0, shape.roof.y + 0.052, shape.roof.z + shape.roof.length / 2 + 0.02)
  group.add(highBrake)

  // B-pillar splitting the side glass into front and rear windows.
  const bPillar = new THREE.Mesh(
    new THREE.BoxGeometry(shape.glassWidth + 0.015, 0.3, 0.065),
    trimMaterial,
  )
  bPillar.position.set(0, shape.roof.y - 0.09, 0.02)
  group.add(bPillar)

  // Door handles and window sills.
  for (const side of [-1, 1]) {
    const sill = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.07, length * 0.44), darkChromeMaterial)
    sill.position.set(side * (width / 2 - 0.005), 0.39, 0.02)
    group.add(sill)

    if (isGT) {
      // A recessed gill immediately behind the front wheel and a lower sill
      // are prominent cues in the reference's two-seat grand tourer.
      const vent = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.18, 0.25), trimMaterial)
      vent.name = 'gt-side-vent'
      vent.position.set(side * (width / 2 + 0.025), 0.65, -0.58)
      group.add(vent)
      for (let stripe = 0; stripe < 3; stripe += 1) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.014, 0.2), darkChromeMaterial)
        fin.position.set(side * (width / 2 + 0.045), 0.59 + stripe * 0.054, -0.58)
        group.add(fin)
      }
      const rocker = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.085, 1.45), paintMaterial)
      rocker.position.set(side * (width / 2 + 0.005), 0.35, 0.28)
      group.add(rocker)
    }

    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.045, 0.2), chromeMaterial)
    handle.position.set(side * (width / 2 + 0.012), 0.82, 0.12)
    group.add(handle)

    // Lower door shut line and a recessed handle pocket give the side a
    // readable front/rear-door silhouette without texture decals.
    addRod([side * (width / 2 + 0.008), 0.43, -0.2],
      [side * (width / 2 + 0.008), 0.43, 0.92], 0.006, trimMaterial)
    const handlePocket = new THREE.Mesh(
      new THREE.BoxGeometry(0.012, 0.056, 0.23), trimMaterial)
    handlePocket.position.set(side * (width / 2 + 0.008), 0.82, 0.12)
    group.add(handlePocket)
    handle.position.x = side * (width / 2 + 0.022)

    const mirrorArm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.055, 0.055), trimMaterial)
    mirrorArm.position.set(side * (width / 2 + 0.055), shape.roof.y - 0.22, -length / 2 + 1.45)
    group.add(mirrorArm)

    const mirrorShell = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.11, 0.14), paintMaterial)
    mirrorShell.position.set(side * (width / 2 + 0.14), shape.roof.y - 0.2, -length / 2 + 1.45)
    group.add(mirrorShell)

    const mirrorGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.075), glassMaterial)
    mirrorGlass.rotation.y = side * Math.PI / 2
    mirrorGlass.position.set(side * (width / 2 + 0.245), shape.roof.y - 0.2, -length / 2 + 1.45)
    group.add(mirrorGlass)
  }

  // Front bumper, splitter, grille and lights.
  const frontZ = -length / 2
  const splitter = new THREE.Mesh(new THREE.BoxGeometry(width * 0.94, 0.075, 0.32), trimMaterial)
  splitter.position.set(0, 0.3, frontZ - 0.03)
  group.add(splitter)

  if (isGT) {
    const fascia = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), paintMaterial)
    fascia.scale.set(width * 0.48, 0.21, 0.16)
    fascia.position.set(0, 0.67, frontZ + 0.035)
    group.add(fascia)

    // Rounded vertical grille, set ahead of the nose. A black inset and fine
    // vertical vanes replace the generic rectangular grille.
    const grilleOutline = new THREE.Shape()
    grilleOutline.moveTo(-0.48, 0.21)
    grilleOutline.quadraticCurveTo(-0.59, 0.17, -0.56, 0.07)
    grilleOutline.lineTo(-0.47, -0.17)
    grilleOutline.quadraticCurveTo(0, -0.29, 0.47, -0.17)
    grilleOutline.lineTo(0.56, 0.07)
    grilleOutline.quadraticCurveTo(0.59, 0.17, 0.48, 0.21)
    grilleOutline.quadraticCurveTo(0, 0.28, -0.48, 0.21)
    const frame = new THREE.Mesh(new THREE.ShapeGeometry(grilleOutline), gtChromeMaterial)
    frame.name = 'gt-grille-frame'
    frame.position.set(0, 0.58, frontZ - 0.13)
    group.add(frame)
    const grille = new THREE.Mesh(new THREE.ShapeGeometry(grilleOutline), gtTrimMaterial)
    grille.name = 'gt-grille'
    grille.scale.set(0.91, 0.88, 1)
    grille.position.set(0, 0.58, frontZ - 0.137)
    group.add(grille)
    for (let index = -5; index <= 5; index += 1) {
      const vane = new THREE.Mesh(
        new THREE.BoxGeometry(0.017, 0.34 + 0.09 * (1 - Math.abs(index) / 5), 0.015),
        darkChromeMaterial)
      vane.position.set(index * 0.085, 0.56, frontZ - 0.148)
      group.add(vane)
    }
    const lowerIntake = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 0.045, 0.04), trimMaterial)
    lowerIntake.position.set(0, 0.315, frontZ - 0.13)
    group.add(lowerIntake)
  } else {
    const grilleWidth = car.bodyStyle === 'muscle' ? 1.5 : car.bodyStyle === 'hatch' ? 1.02 : 1.24
    const grilleFrame = new THREE.Mesh(new THREE.BoxGeometry(grilleWidth, 0.3, 0.1), chromeMaterial)
    grilleFrame.position.set(0, 0.55, frontZ + 0.015)
    group.add(grilleFrame)
    const grille = new THREE.Mesh(new THREE.BoxGeometry(grilleWidth - 0.1, 0.22, 0.11), trimMaterial)
    grille.position.set(0, 0.55, frontZ + 0.03)
    group.add(grille)
    for (let i = -3; i <= 3; i += 1) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.19, 0.03), chromeMaterial)
      slat.position.set(i * 0.15, 0.55, frontZ + 0.085)
      group.add(slat)
    }
  }

  for (const side of [-1, 1]) {
    if (isGT) {
      const lampShape = new THREE.Shape()
      lampShape.moveTo(0.43, 0.69)
      lampShape.quadraticCurveTo(0.58, 0.84, 0.9, 0.87)
      lampShape.quadraticCurveTo(0.95, 0.79, 0.79, 0.7)
      lampShape.quadraticCurveTo(0.6, 0.65, 0.43, 0.69)
      const lamp = new THREE.Mesh(new THREE.ShapeGeometry(lampShape), gtTrimMaterial)
      lamp.name = 'gt-swept-headlight'
      lamp.scale.x = side
      lamp.position.z = frontZ - 0.125
      group.add(lamp)
      const lens = new THREE.Mesh(new THREE.ShapeGeometry(lampShape), gtLensMaterial)
      lens.scale.set(side * 0.86, 0.72, 1)
      lens.position.set(side * 0.092, 0.2, frontZ - 0.132)
      group.add(lens)
      const projector = new THREE.Mesh(
        new THREE.CylinderGeometry(0.052, 0.052, 0.025, 16), headlightMaterial)
      projector.rotation.x = Math.PI / 2
      projector.position.set(side * 0.66, 0.755, frontZ - 0.15)
      group.add(projector)
      addRod([side * 0.47, 0.7, frontZ - 0.16],
        [side * 0.75, 0.695, frontZ - 0.16], 0.012, drlMaterial)
      const intake = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.21, 0.035), trimMaterial)
      intake.position.set(side * 0.78, 0.43, frontZ - 0.11)
      group.add(intake)
      continue
    }
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.18, 0.1), trimMaterial)
    housing.position.set(side * 0.63, 0.73, frontZ + 0.035)
    group.add(housing)
    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.115, 0.045), lampLensMaterial)
    lens.position.set(side * 0.63, 0.74, frontZ + 0.002)
    group.add(lens)
    for (const offset of [-0.105, 0.105]) {
      const projector = new THREE.Mesh(
        new THREE.CylinderGeometry(0.038, 0.038, 0.026, 12), headlightMaterial)
      projector.rotation.x = Math.PI / 2
      projector.position.set(side * 0.63 + offset, 0.74, frontZ - 0.029)
      group.add(projector)
    }
    const drl = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.03, 0.035), drlMaterial)
    drl.position.set(side * 0.63, 0.665, frontZ - 0.005)
    group.add(drl)
    const fog = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.04, 16), headlightMaterial)
    fog.rotation.x = Math.PI / 2
    fog.position.set(side * 0.7, 0.43, frontZ + 0.01)
    group.add(fog)
    const intake = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.11, 0.08), trimMaterial)
    intake.position.set(side * (width / 2 - 0.19), 0.46, frontZ - 0.02)
    group.add(intake)
  }

  // Rear bumper, tail-light bar and exhaust tips.
  const rearZ = length / 2
  const valance = new THREE.Mesh(new THREE.BoxGeometry(width * 0.94, 0.16, 0.22), trimMaterial)
  valance.position.set(0, 0.35, rearZ + 0.01)
  group.add(valance)
  const diffuser = new THREE.Mesh(new THREE.BoxGeometry(width * 0.73, 0.045, 0.3), darkChromeMaterial)
  diffuser.position.set(0, 0.24, rearZ + 0.03)
  group.add(diffuser)

  const tailHousing = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.19, 0.08), trimMaterial)
  tailHousing.position.set(0, 0.76, rearZ + 0.015)
  group.add(tailHousing)
  const brakeBar = new THREE.Mesh(new THREE.BoxGeometry(1.34, 0.075, 0.055), brakeLightMaterial)
  brakeBar.position.set(0, 0.765, rearZ + 0.055)
  group.add(brakeBar)
  for (const side of [-1, 1]) {
    for (let segment = 0; segment < 3; segment += 1) {
      const led = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.031, 0.015), brakeLightMaterial)
      led.position.set(side * (0.46 + segment * 0.105), 0.81, rearZ + 0.063)
      group.add(led)
    }
    const reverseLamp = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.085, 0.04), reverseLightMaterial)
    reverseLamp.position.set(side * 0.55, 0.69, rearZ + 0.055)
    group.add(reverseLamp)
  }

  const plateMaterial = new THREE.MeshStandardMaterial({
    color: 0xd8e0ee,
    emissive: 0x8f9db3,
    emissiveIntensity: 0.16,
    roughness: 0.5,
  })
  const rearPlate = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.022), plateMaterial)
  rearPlate.position.set(0, 0.55, rearZ + 0.045)
  group.add(rearPlate)
  const frontPlate = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.11, 0.022), plateMaterial)
  frontPlate.position.set(0, 0.48, frontZ - 0.045)
  group.add(frontPlate)

  const exhaustMaterial = new THREE.MeshStandardMaterial({
    color: 0x9aa4b4,
    metalness: 0.95,
    roughness: 0.22,
  })
  const exhaustGeometry = new THREE.CylinderGeometry(0.06, 0.06, 0.18, 14)
  for (const side of [-1, 1]) {
    const exhaust = new THREE.Mesh(exhaustGeometry, exhaustMaterial)
    exhaust.rotation.x = Math.PI / 2
    exhaust.position.set(side * 0.36, 0.32, rearZ + 0.03)
    group.add(exhaust)
  }

  // Taxi roof sign.
  if (car.taxi) {
    const signCanvas = document.createElement('canvas')
    signCanvas.width = 256
    signCanvas.height = 64
    const signCtx = signCanvas.getContext('2d')
    signCtx.fillStyle = '#fff5cf'
    signCtx.fillRect(0, 0, 256, 64)
    signCtx.fillStyle = '#202018'
    signCtx.font = '900 36px Arial, sans-serif'
    signCtx.textAlign = 'center'
    signCtx.textBaseline = 'middle'
    signCtx.fillText('TAXI', 128, 34)
    const signTexture = new THREE.CanvasTexture(signCanvas)
    signTexture.colorSpace = THREE.SRGBColorSpace
    const signMaterial = new THREE.MeshStandardMaterial({
      map: signTexture,
      emissive: 0xffe9a8,
      emissiveMap: signTexture,
      emissiveIntensity: 0.62,
      roughness: 0.4,
    })
    const signEdgeMaterial = new THREE.MeshStandardMaterial({
      color: 0xfff5d3, emissive: 0xffe6a2, emissiveIntensity: 0.28, roughness: 0.45,
    })
    // Text belongs only on the front/back faces, not stretched over the top.
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.17, 0.24),
      [signEdgeMaterial, signEdgeMaterial, signEdgeMaterial, signEdgeMaterial,
        signMaterial, signMaterial])
    sign.position.set(0, shape.roof.y + 0.12, shape.roof.z)
    group.add(sign)
    const signBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.66, 0.045, 0.28),
      trimMaterial,
    )
    signBase.position.set(0, shape.roof.y + 0.035, shape.roof.z)
    group.add(signBase)
  }

  if (shape.spoiler) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.055, 0.28), trimMaterial)
    wing.position.set(0, shape.spoiler.y, shape.spoiler.z)
    group.add(wing)
    for (const side of [-1, 1]) {
      const support = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.11), trimMaterial)
      support.position.set(side * 0.5, shape.spoiler.y - 0.12, shape.spoiler.z)
      group.add(support)
    }
  }

  if (shape.scoop) {
    const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.14, 0.66), trimMaterial)
    scoop.position.set(0, 1.02, -length / 2 + 1.12)
    group.add(scoop)
  }

  // Shark-fin antenna.
  const antenna = new THREE.Mesh(
    new THREE.ConeGeometry(0.07, 0.24, 4),
    paintMaterial,
  )
  antenna.rotation.y = Math.PI / 4
  antenna.position.set(0, shape.roof.y + 0.08, shape.roof.z + shape.roof.length / 2 - 0.15)
  group.add(antenna)

  // Wheel-arch lips.
  const archGeometry = new THREE.TorusGeometry(car.wheelRadius + 0.06, 0.042, 7, 24)
  const archMaterial = new THREE.MeshStandardMaterial({
    color: 0x0b0e12,
    metalness: 0.35,
    roughness: 0.65,
  })

  const tireGeometry = new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.27, 30)
  tireGeometry.rotateZ(Math.PI / 2)
  const rimGeometry = new THREE.CylinderGeometry(wheelRadius * 0.64, wheelRadius * 0.64, 0.29, 26)
  rimGeometry.rotateZ(Math.PI / 2)
  const rimFaceGeometry = new THREE.CylinderGeometry(wheelRadius * 0.61, wheelRadius * 0.61, 0.035, 26)
  rimFaceGeometry.rotateZ(Math.PI / 2)
  const hubGeometry = new THREE.CylinderGeometry(wheelRadius * 0.17, wheelRadius * 0.17, 0.31, 16)
  hubGeometry.rotateZ(Math.PI / 2)
  const discGeometry = new THREE.CylinderGeometry(wheelRadius * 0.55, wheelRadius * 0.55, 0.025, 24)
  discGeometry.rotateZ(Math.PI / 2)
  const spokeCount = isGT ? 10 : 5
  const spokeGeometry = new THREE.BoxGeometry(isGT ? 0.026 : 0.055,
    wheelRadius * 0.92, isGT ? 0.038 : 0.065)
  const lugGeometry = new THREE.SphereGeometry(wheelRadius * 0.035, 6, 4)
  const sidewallGeometry = new THREE.TorusGeometry(wheelRadius * 0.72, wheelRadius * 0.16, 8, 24)
  sidewallGeometry.rotateY(Math.PI / 2)
  const tireGrooveGeometry = new THREE.TorusGeometry(wheelRadius * 0.95, 0.009, 5, 30)
  tireGrooveGeometry.rotateY(Math.PI / 2)

  for (const side of [-1, 1]) {
    for (const axle of [-1, 1]) {
      const pivot = new THREE.Group()
      pivot.position.set(side * (width / 2 - 0.03), wheelRadius, axle * axleZ)

      const spin = new THREE.Group()

      const tire = new THREE.Mesh(tireGeometry, tireMaterial)
      spin.add(tire)
      const sidewall = new THREE.Mesh(sidewallGeometry, tireMaterial)
      sidewall.position.x = side * 0.135
      spin.add(sidewall)
      for (const offset of [-0.08, 0, 0.08]) {
        const groove = new THREE.Mesh(tireGrooveGeometry, trimMaterial)
        groove.position.x = offset
        spin.add(groove)
      }

      const rim = new THREE.Mesh(rimGeometry, rimMaterial)
      spin.add(rim)
      const rimFace = new THREE.Mesh(rimFaceGeometry, rimMaterial)
      rimFace.position.x = side * 0.145
      spin.add(rimFace)
      const hub = new THREE.Mesh(hubGeometry, chromeMaterial)
      hub.position.x = side * 0.155
      spin.add(hub)

      for (let index = 0; index < spokeCount; index += 1) {
        const spoke = new THREE.Mesh(spokeGeometry, rimMaterial)
        spoke.rotation.x = (index / spokeCount) * Math.PI * 2
        spoke.position.x = side * 0.152
        spin.add(spoke)
        if (index % (spokeCount / 5) === 0) {
          const angle = (index / spokeCount) * Math.PI * 2
          const lug = new THREE.Mesh(lugGeometry, darkChromeMaterial)
          lug.position.set(side * 0.177, Math.cos(angle) * wheelRadius * 0.16,
            Math.sin(angle) * wheelRadius * 0.16)
          spin.add(lug)
        }
      }

      const disc = new THREE.Mesh(discGeometry, brakeDiscMaterial)
      disc.position.x = -side * 0.01
      spin.add(disc)

      const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.18, 0.09), caliperMaterial)
      caliper.position.set(-side * 0.02, 0.1, 0)
      pivot.add(caliper)

      pivot.add(spin)
      group.add(pivot)

      const arch = new THREE.Mesh(archGeometry, archMaterial)
      arch.rotation.y = Math.PI / 2
      arch.position.set(side * (width / 2 - 0.015), wheelRadius + 0.03, axle * axleZ)
      group.add(arch)

      wheels.push({ pivot, spin, front: axle === -1 })
    }
  }

  // Soft contact shadow underneath the car.
  const shadowCanvas = document.createElement('canvas')
  shadowCanvas.width = 128
  shadowCanvas.height = 128
  const shadowCtx = shadowCanvas.getContext('2d')
  const shadowGradient = shadowCtx.createRadialGradient(64, 64, 8, 64, 64, 62)
  shadowGradient.addColorStop(0, 'rgba(0,0,0,0.55)')
  shadowGradient.addColorStop(1, 'rgba(0,0,0,0)')
  shadowCtx.fillStyle = shadowGradient
  shadowCtx.fillRect(0, 0, 128, 128)
  const shadowTexture = new THREE.CanvasTexture(shadowCanvas)
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(width + 0.7, length + 0.7),
    new THREE.MeshBasicMaterial({
      map: shadowTexture,
      transparent: true,
      depthWrite: false,
      opacity: 0.78,
    }),
  )
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = 0.015
  group.add(shadow)

  const headlight = new THREE.SpotLight(0xfff0d0, 58, 105, Math.PI / 5, 0.62, 1.4)
  headlight.position.set(0, 0.82, -length / 2)
  headlight.target.position.set(0, 0, -42)
  group.add(headlight)
  group.add(headlight.target)

  return { group, wheels, brakeLightMaterial, reverseLightMaterial, headlight }
}
