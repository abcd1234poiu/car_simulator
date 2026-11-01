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
    transparent: true,
    opacity: 0.9,
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
  const { length, width } = shape
  const axleZ = length / 2 - 0.92
  const wheelRadius = car.wheelRadius

  // Main body with a slightly softer bevel and a subtle tumblehome for a more
  // rounded, production-car silhouette.
  const bodyGeometry = profileGeometry(shape.body, width, 0.075)
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
      fender.scale.set(0.15, 0.4, 0.76)
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

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(shape.roof.width, 0.06, shape.roof.length),
    paintMaterial,
  )
  roof.position.set(0, shape.roof.y, shape.roof.z)
  group.add(roof)

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

    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.045, 0.2), chromeMaterial)
    handle.position.set(side * (width / 2 + 0.012), 0.82, 0.12)
    group.add(handle)

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

  const grilleFrame = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.3, 0.1), chromeMaterial)
  grilleFrame.position.set(0, 0.55, frontZ + 0.015)
  group.add(grilleFrame)
  const grille = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.22, 0.11), trimMaterial)
  grille.position.set(0, 0.55, frontZ + 0.03)
  group.add(grille)
  for (let i = -3; i <= 3; i += 1) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.19, 0.03), chromeMaterial)
    slat.position.set(i * 0.15, 0.55, frontZ + 0.085)
    group.add(slat)
  }

  for (const side of [-1, 1]) {
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.18, 0.1), trimMaterial)
    housing.position.set(side * 0.63, 0.73, frontZ + 0.035)
    group.add(housing)
    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.115, 0.045), headlightMaterial)
    lens.position.set(side * 0.63, 0.74, frontZ + 0.002)
    group.add(lens)
    const drl = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.03, 0.035), drlMaterial)
    drl.position.set(side * 0.63, 0.665, frontZ - 0.005)
    group.add(drl)
    const fog = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.04, 16), headlightMaterial)
    fog.rotation.x = Math.PI / 2
    fog.position.set(side * 0.7, 0.43, frontZ + 0.01)
    group.add(fog)
  }

  // Rear bumper, tail-light bar and exhaust tips.
  const rearZ = length / 2
  const valance = new THREE.Mesh(new THREE.BoxGeometry(width * 0.94, 0.16, 0.22), trimMaterial)
  valance.position.set(0, 0.35, rearZ + 0.01)
  group.add(valance)

  const tailHousing = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.19, 0.08), trimMaterial)
  tailHousing.position.set(0, 0.76, rearZ + 0.015)
  group.add(tailHousing)
  const brakeBar = new THREE.Mesh(new THREE.BoxGeometry(1.34, 0.075, 0.055), brakeLightMaterial)
  brakeBar.position.set(0, 0.765, rearZ + 0.055)
  group.add(brakeBar)
  for (const side of [-1, 1]) {
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
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.17, 0.24), signMaterial)
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
  const spokeGeometry = new THREE.BoxGeometry(0.055, wheelRadius * 0.92, 0.065)
  const sidewallGeometry = new THREE.TorusGeometry(wheelRadius * 0.72, wheelRadius * 0.16, 8, 24)
  sidewallGeometry.rotateY(Math.PI / 2)

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

      const rim = new THREE.Mesh(rimGeometry, rimMaterial)
      spin.add(rim)
      const rimFace = new THREE.Mesh(rimFaceGeometry, rimMaterial)
      rimFace.position.x = side * 0.145
      spin.add(rimFace)
      const hub = new THREE.Mesh(hubGeometry, chromeMaterial)
      hub.position.x = side * 0.155
      spin.add(hub)

      for (let index = 0; index < 5; index += 1) {
        const spoke = new THREE.Mesh(spokeGeometry, rimMaterial)
        spoke.rotation.x = (index / 5) * Math.PI * 2
        spoke.position.x = side * 0.152
        spin.add(spoke)
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
