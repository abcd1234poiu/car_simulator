/**
 * Three.js road scene: winding route, roadside props and a parametric car.
 */

import * as THREE from 'three'
import { roadCenter, roadHeading, roadLocalPoint } from '../taxi/road.js'

const ROAD_LENGTH = 900
const ROAD_WIDTH = 12
const TILE_LENGTH = 20
const RECYCLE_AHEAD = 30
const RECYCLE_BEHIND = -ROAD_LENGTH + RECYCLE_AHEAD

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const damp = (current, target, dt, rate) => current + (target - current) * (1 - Math.exp(-rate * dt))

const ROAD_SEGMENTS = 90
const ROAD_START = -45

function createRoadRibbon(width, offset, material) {
  const geometry = new THREE.BufferGeometry()
  const positions = new Float32Array((ROAD_SEGMENTS + 1) * 2 * 3)
  const normals = new Float32Array(positions.length)
  const uvs = new Float32Array((ROAD_SEGMENTS + 1) * 2 * 2)
  const indices = []
  for (let i = 0; i <= ROAD_SEGMENTS; i += 1) {
    normals[i * 6 + 1] = 1
    normals[i * 6 + 4] = 1
    const v = (ROAD_START + i * ROAD_LENGTH / ROAD_SEGMENTS) / ROAD_LENGTH
    uvs[i * 4] = 0
    uvs[i * 4 + 1] = v
    uvs[i * 4 + 2] = 1
    uvs[i * 4 + 3] = v
    if (i < ROAD_SEGMENTS) {
      const a = i * 2
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  const mesh = new THREE.Mesh(geometry, material)
  mesh.userData.ribbon = { width, offset }
  return mesh
}

function createStopMarker(label, color) {
  const group = new THREE.Group()
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 4.2, 10),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.42, depthWrite: false }),
  )
  beacon.position.y = 2.1
  group.add(beacon)
  const base = new THREE.Mesh(
    new THREE.RingGeometry(0.9, 1.55, 32),
    new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.8 }),
  )
  base.rotation.x = -Math.PI / 2
  base.position.y = 0.04
  group.add(base)
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 144
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = label === 'PICKUP' ? '#f9c86a' : '#fb7185'
  ctx.fillRect(5, 5, 502, 134)
  ctx.fillStyle = '#17202a'
  ctx.font = '900 76px Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, 256, 75)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }))
  sign.position.y = 5.0
  sign.scale.set(5.8, 1.63, 1)
  group.add(sign)
  group.userData.sign = sign
  if (label === 'PICKUP') {
    const coat = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.29, 1.12, 10),
      new THREE.MeshStandardMaterial({ color: 0x56bfc0, roughness: 0.88 }),
    )
    coat.position.set(-1.25, 0.95, 0)
    group.add(coat)
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.21, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xc58e6d, roughness: 0.9 }),
    )
    head.position.set(-1.25, 1.72, 0)
    group.add(head)
  }
  group.visible = false
  return group
}

function createRoadTexture(renderer) {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')

  const asphalt = ctx.createLinearGradient(0, 0, 512, 0)
  asphalt.addColorStop(0, '#14171d')
  asphalt.addColorStop(0.5, '#24282f')
  asphalt.addColorStop(1, '#14171d')
  ctx.fillStyle = asphalt
  ctx.fillRect(0, 0, 512, 512)

  for (let i = 0; i < 3200; i += 1) {
    const shade = 26 + Math.floor(Math.random() * 42)
    ctx.fillStyle = `rgba(${shade},${shade + 2},${shade + 6},${0.12 + Math.random() * 0.22})`
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2)
  }

  ctx.fillStyle = 'rgba(232, 240, 255, 0.7)'
  ctx.fillRect(22, 0, 7, 512)
  ctx.fillRect(483, 0, 7, 512)

  ctx.fillStyle = 'rgba(244, 248, 255, 0.62)'
  ctx.fillRect(252, 22, 8, 100)
  ctx.fillRect(252, 278, 8, 100)

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(1, ROAD_LENGTH / TILE_LENGTH)
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy()
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function createSunTexture() {
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

function createEnvironment(renderer) {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 256
  const ctx = canvas.getContext('2d')

  const sky = ctx.createLinearGradient(0, 0, 0, 256)
  sky.addColorStop(0, '#070b18')
  sky.addColorStop(0.4, '#16233d')
  sky.addColorStop(0.5, '#4a3850')
  sky.addColorStop(0.56, '#b4744f')
  sky.addColorStop(0.61, '#2a2028')
  sky.addColorStop(1, '#05070c')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, 512, 256)

  const sun = ctx.createRadialGradient(398, 122, 4, 398, 122, 90)
  sun.addColorStop(0, 'rgba(255, 226, 176, 0.95)')
  sun.addColorStop(0.45, 'rgba(255, 150, 90, 0.4)')
  sun.addColorStop(1, 'rgba(255, 120, 70, 0)')
  ctx.fillStyle = sun
  ctx.fillRect(0, 0, 512, 256)

  const texture = new THREE.CanvasTexture(canvas)
  texture.mapping = THREE.EquirectangularReflectionMapping
  texture.colorSpace = THREE.SRGBColorSpace

  const pmrem = new THREE.PMREMGenerator(renderer)
  const environment = pmrem.fromEquirectangular(texture).texture
  texture.dispose()
  pmrem.dispose()
  return environment
}

function createStars() {
  const count = 320
  const positions = new Float32Array(count * 3)
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * 1100
    positions[i * 3 + 1] = 40 + Math.random() * 260
    positions[i * 3 + 2] = -150 - Math.random() * 850
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const material = new THREE.PointsMaterial({
    color: 0xbfd4ff,
    size: 1.6,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
    fog: false,
  })
  return new THREE.Points(geometry, material)
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

function profileGeometry(points, width, bevel) {
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

function createCarModel(car) {
  const group = new THREE.Group()
  const wheels = []

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(car.color),
    metalness: 0.5,
    roughness: 0.28,
  })
  const glassMaterial = new THREE.MeshStandardMaterial({
    color: 0x0a101a,
    metalness: 0.85,
    roughness: 0.08,
  })
  const trimMaterial = new THREE.MeshStandardMaterial({
    color: 0x0d1014,
    metalness: 0.4,
    roughness: 0.55,
  })
  const tireMaterial = new THREE.MeshStandardMaterial({ color: 0x121418, roughness: 0.92 })
  const rimMaterial = new THREE.MeshStandardMaterial({
    color: 0xc7d2e4,
    metalness: 0.9,
    roughness: 0.28,
  })
  const headlightMaterial = new THREE.MeshStandardMaterial({
    color: 0xfff4d6,
    emissive: 0xfff0c8,
    emissiveIntensity: 2.6,
    roughness: 0.3,
  })
  const brakeLightMaterial = new THREE.MeshStandardMaterial({
    color: 0x7a0d12,
    emissive: 0xff2531,
    emissiveIntensity: 0.35,
    roughness: 0.4,
  })
  const reverseLightMaterial = new THREE.MeshStandardMaterial({
    color: 0xcbd4d4,
    emissive: 0xffffff,
    emissiveIntensity: 0.04,
    roughness: 0.35,
  })

  const shape = CAR_SHAPES[car.bodyStyle] ?? CAR_SHAPES.coupe
  const { length } = shape

  const body = new THREE.Mesh(profileGeometry(shape.body, shape.width, 0.05), bodyMaterial)
  body.rotation.y = -Math.PI / 2
  body.castShadow = true
  group.add(body)

  const cabin = new THREE.Mesh(
    profileGeometry(shape.glass, shape.glassWidth, 0.025),
    glassMaterial,
  )
  cabin.rotation.y = -Math.PI / 2
  group.add(cabin)

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(shape.roof.width, 0.05, shape.roof.length),
    bodyMaterial,
  )
  roof.position.set(0, shape.roof.y, shape.roof.z)
  group.add(roof)

  if (car.taxi) {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.68, 0.18, 0.24),
      new THREE.MeshStandardMaterial({ color: 0xffefbd, emissive: 0xffdc78, emissiveIntensity: 0.65 }),
    )
    sign.position.set(0, shape.roof.y + 0.12, shape.roof.z)
    group.add(sign)
    const signStripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.055, 0.25),
      new THREE.MeshStandardMaterial({ color: 0x171c20, roughness: 0.7 }),
    )
    signStripe.position.set(0, shape.roof.y + 0.22, shape.roof.z)
    group.add(signStripe)
  }

  // Mirrors and side sills.
  for (const side of [-1, 1]) {
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.08, 0.12), bodyMaterial)
    mirror.position.set(side * (shape.width / 2 + 0.02), shape.roof.y - 0.2, -length / 2 + 1.42)
    group.add(mirror)

    const sill = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.11, length * 0.5), trimMaterial)
    sill.position.set(side * (shape.width / 2 - 0.01), 0.31, 0.02)
    group.add(sill)
  }

  const splitter = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.07, 0.26), trimMaterial)
  splitter.position.set(0, 0.29, -length / 2 - 0.03)
  group.add(splitter)

  const grille = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.17, 0.09), trimMaterial)
  grille.position.set(0, 0.52, -length / 2 - 0.02)
  group.add(grille)

  const headlightGeometry = new THREE.BoxGeometry(0.4, 0.1, 0.14)
  for (const side of [-1, 1]) {
    const light = new THREE.Mesh(headlightGeometry, headlightMaterial)
    light.position.set(side * 0.58, 0.68, -length / 2 + 0.01)
    group.add(light)
  }

  const brakeBar = new THREE.Mesh(
    new THREE.BoxGeometry(1.34, 0.085, 0.07),
    brakeLightMaterial,
  )
  brakeBar.position.set(0, 0.73, length / 2 + 0.01)
  group.add(brakeBar)
  for (const side of [-1, 1]) {
    const reverseLamp = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.075, 0.075), reverseLightMaterial)
    reverseLamp.position.set(side * 0.49, 0.69, length / 2 + 0.075)
    group.add(reverseLamp)
  }

  const tailLink = new THREE.Mesh(
    new THREE.BoxGeometry(0.58, 0.03, 0.05),
    brakeLightMaterial,
  )
  tailLink.position.set(0, 0.69, length / 2 + 0.01)
  group.add(tailLink)

  const plateMaterial = new THREE.MeshStandardMaterial({
    color: 0xd8e0ee,
    emissive: 0x8f9db3,
    emissiveIntensity: 0.16,
    roughness: 0.5,
  })
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.11, 0.02), plateMaterial)
  plate.position.set(0, 0.55, length / 2 + 0.02)
  group.add(plate)

  const valance = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.17, 0.12), trimMaterial)
  valance.position.set(0, 0.36, length / 2 + 0.02)
  group.add(valance)

  const exhaustMaterial = new THREE.MeshStandardMaterial({
    color: 0x9aa4b4,
    metalness: 0.95,
    roughness: 0.25,
  })
  const exhaustGeometry = new THREE.CylinderGeometry(0.055, 0.055, 0.16, 12)
  for (const side of [-1, 1]) {
    const exhaust = new THREE.Mesh(exhaustGeometry, exhaustMaterial)
    exhaust.rotation.x = Math.PI / 2
    exhaust.position.set(side * 0.34, 0.32, length / 2 + 0.03)
    group.add(exhaust)
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
    scoop.position.set(0, 0.99, -length / 2 + 1.12)
    group.add(scoop)
  }

  // Wheel arch lips.
  const archGeometry = new THREE.TorusGeometry(car.wheelRadius + 0.045, 0.032, 6, 22)
  const archMaterial = new THREE.MeshStandardMaterial({
    color: 0x0c0f14,
    metalness: 0.3,
    roughness: 0.7,
  })
  const wheelGeometry = new THREE.CylinderGeometry(car.wheelRadius, car.wheelRadius, 0.26, 24)
  const rimGeometry = new THREE.CylinderGeometry(car.wheelRadius * 0.58, car.wheelRadius * 0.58, 0.28, 20)
  const axleZ = length / 2 - 0.92

  for (const side of [-1, 1]) {
    for (const axle of [-1, 1]) {
      const pivot = new THREE.Group()
      pivot.position.set(side * 0.9, car.wheelRadius, axle * axleZ)

      const spin = new THREE.Group()
      const tire = new THREE.Mesh(wheelGeometry, tireMaterial)
      tire.rotation.z = Math.PI / 2
      const rim = new THREE.Mesh(rimGeometry, rimMaterial)
      rim.rotation.z = Math.PI / 2
      spin.add(tire, rim)
      pivot.add(spin)
      group.add(pivot)

      const arch = new THREE.Mesh(archGeometry, archMaterial)
      arch.rotation.y = Math.PI / 2
      arch.position.set(side * (shape.width / 2 - 0.02), car.wheelRadius, axle * axleZ)
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
    new THREE.PlaneGeometry(2.4, 5.2),
    new THREE.MeshBasicMaterial({
      map: shadowTexture,
      transparent: true,
      depthWrite: false,
      opacity: 0.75,
    }),
  )
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = 0.015
  group.add(shadow)

  const headlight = new THREE.SpotLight(0xfff0d0, 45, 95, Math.PI / 5, 0.6, 1.5)
  headlight.position.set(0, 0.8, -length / 2)
  headlight.target.position.set(0, 0, -40)
  group.add(headlight)
  group.add(headlight.target)

  return { group, wheels, brakeLightMaterial, reverseLightMaterial, headlight }
}

function createPole(side) {
  const group = new THREE.Group()
  const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x2a303b, roughness: 0.6, metalness: 0.55 })
  const lampMaterial = new THREE.MeshStandardMaterial({
    color: 0xffe9b8,
    emissive: 0xffd27a,
    emissiveIntensity: 2.2,
    roughness: 0.4,
  })

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 5.8, 8), poleMaterial)
  pole.position.y = 2.9
  group.add(pole)

  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.09, 0.09), poleMaterial)
  arm.position.set(side * -0.65, 5.7, 0)
  group.add(arm)

  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.14, 0.24), lampMaterial)
  lamp.position.set(side * -1.28, 5.62, 0)
  group.add(lamp)

  return group
}

function createTree() {
  const group = new THREE.Group()
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x2b2119, roughness: 1 })
  const leafMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHSL(0.36 + Math.random() * 0.06, 0.35, 0.12 + Math.random() * 0.06),
    roughness: 1,
    flatShading: true,
  })

  const scale = 0.75 + Math.random() * 0.9
  const trunkHeight = 2.4 * scale
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16 * scale, 0.24 * scale, trunkHeight, 6),
    trunkMaterial,
  )
  trunk.position.y = trunkHeight / 2
  group.add(trunk)

  const foliage = new THREE.Mesh(
    new THREE.ConeGeometry(1.5 * scale, 4.4 * scale, 7),
    leafMaterial,
  )
  foliage.position.y = trunkHeight + 1.6 * scale
  group.add(foliage)

  const top = new THREE.Mesh(
    new THREE.ConeGeometry(1.05 * scale, 3.1 * scale, 7),
    leafMaterial,
  )
  top.position.y = trunkHeight + 3.3 * scale
  group.add(top)

  group.rotation.y = Math.random() * Math.PI
  return group
}

export class RoadScene {
  constructor(canvas, car, roadSeed = 0) {
    this.canvas = canvas
    this.roadSeed = roadSeed
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.16

    this.scene = new THREE.Scene()
    this.scene.environment = createEnvironment(this.renderer)
    this.scene.environmentIntensity = 0.6
    this.scene.fog = new THREE.Fog(0x141a2a, 110, 560)

    this.camera = new THREE.PerspectiveCamera(54, 1, 0.1, 1600)
    this.camera.position.set(1.56, 2.0, 9.3)
    this.camera.lookAt(1.25, 0.9, -18)

    this.clock = 0
    this.lateral = 1.9
    this.shake = 0

    const hemi = new THREE.HemisphereLight(0x9fb6ff, 0x0b0d12, 1.3)
    this.scene.add(hemi)

    const key = new THREE.DirectionalLight(0xffb583, 2.45)
    key.position.set(-32, 46, -38)
    this.scene.add(key)

    const rim = new THREE.DirectionalLight(0x8fbcff, 1.55)
    rim.position.set(28, 18, 30)
    this.scene.add(rim)

    this.scene.add(createStars())

    const sun = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: createSunTexture(),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0.55,
        fog: false,
      }),
    )
    sun.position.set(210, 52, -820)
    sun.scale.set(300, 300, 1)
    this.scene.add(sun)

    this.roadTexture = createRoadTexture(this.renderer)

    const roadMaterial = new THREE.MeshStandardMaterial({
      map: this.roadTexture,
      roughness: 0.94,
      metalness: 0.02,
    })
    this.ribbons = []
    const road = createRoadRibbon(ROAD_WIDTH, 0, roadMaterial)
    this.scene.add(road)
    this.ribbons.push(road)

    const shoulderMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1d20, roughness: 1 })
    for (const side of [-1, 1]) {
      const shoulder = createRoadRibbon(2.6, side * (ROAD_WIDTH / 2 + 1.3), shoulderMaterial)
      shoulder.position.y = -0.005
      this.scene.add(shoulder)
      this.ribbons.push(shoulder)
    }

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1400, 1400),
      new THREE.MeshStandardMaterial({ color: 0x0b1715, roughness: 1 }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.set(0, -0.03, -ROAD_LENGTH / 2)
    this.scene.add(ground)

    this.movingProps = []
    this.populateProps()
    this.intersections = []
    const crossingMaterial = new THREE.MeshStandardMaterial({ color: 0x283139, roughness: 0.95 })
    for (let i = 0; i < 7; i += 1) {
      const crossing = new THREE.Mesh(new THREE.PlaneGeometry(48, 11), crossingMaterial)
      crossing.rotation.x = -Math.PI / 2
      crossing.userData.roadDistance = i * 180
      crossing.position.y = 0.015
      this.scene.add(crossing)
      this.intersections.push(crossing)
    }

    this.stopMarkers = {
      pickup: createStopMarker('PICKUP', 0xf9c86a),
      dropoff: createStopMarker('DROP OFF', 0xfb7185),
    }
    this.stopDistances = { pickup: null, dropoff: null }
    this.scene.add(this.stopMarkers.pickup, this.stopMarkers.dropoff)

    const carModel = createCarModel(car)
    this.carGroup = carModel.group
    this.wheels = carModel.wheels
    this.brakeLightMaterial = carModel.brakeLightMaterial
    this.reverseLightMaterial = carModel.reverseLightMaterial
    this.scene.add(this.carGroup)

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(canvas.parentElement ?? canvas)
    this.resize()
    this.update(0, {})
  }

  populateProps() {
    const poleSpacing = 52
    for (let z = RECYCLE_AHEAD; z > RECYCLE_BEHIND; z -= poleSpacing) {
      const side = Math.round(z / poleSpacing) % 2 === 0 ? 1 : -1
      const pole = createPole(side)
      pole.position.set(side * 7.7, 0, z)
      pole.rotation.y = side === 1 ? Math.PI : 0
      pole.userData.roadDistance = -z
      pole.userData.lateralOffset = side * 7.7
      pole.userData.baseRotation = pole.rotation.y
      this.scene.add(pole)
      this.movingProps.push(pole)
    }

    for (let i = 0; i < 46; i += 1) {
      const tree = createTree()
      const side = i % 2 === 0 ? 1 : -1
      const z = RECYCLE_AHEAD - Math.random() * (RECYCLE_AHEAD - RECYCLE_BEHIND)
      tree.position.set(side * (11 + Math.random() * 16), 0, z)
      tree.userData.roadDistance = -z
      tree.userData.lateralOffset = tree.position.x
      tree.userData.baseRotation = tree.rotation.y
      this.scene.add(tree)
      this.movingProps.push(tree)
    }
  }

  resize() {
    const parent = this.canvas.parentElement
    const width = parent?.clientWidth || this.canvas.clientWidth || 1
    const height = parent?.clientHeight || this.canvas.clientHeight || 1
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  setStops(pickupDistance, dropoffDistance, status) {
    this.stopDistances.pickup = status === 'trip' || status === 'completed' ? null : pickupDistance
    this.stopDistances.dropoff = status === 'completed' ? null : dropoffDistance
  }

  updateRoad(distance) {
    const heading = roadHeading(distance, this.roadSeed)
    const center = roadCenter(distance, this.roadSeed)
    const cos = Math.cos(heading)
    const sin = Math.sin(heading)
    for (let i = 0; i <= ROAD_SEGMENTS; i += 1) {
      const sampleDistance = distance + ROAD_START + i * ROAD_LENGTH / ROAD_SEGMENTS
      const deltaX = roadCenter(sampleDistance, this.roadSeed) - center
      const deltaDistance = sampleDistance - distance
      const baseX = deltaX * cos - deltaDistance * sin
      const baseZ = -deltaX * sin - deltaDistance * cos
      const relativeHeading = roadHeading(sampleDistance, this.roadSeed) - heading
      const rightX = Math.cos(relativeHeading)
      const rightZ = Math.sin(relativeHeading)
      for (const mesh of this.ribbons) {
        const { width, offset } = mesh.userData.ribbon
        const positions = mesh.geometry.attributes.position
        const left = offset - width / 2
        const right = offset + width / 2
        positions.setXYZ(i * 2, baseX + left * rightX, 0.005, baseZ + left * rightZ)
        positions.setXYZ(i * 2 + 1, baseX + right * rightX, 0.005, baseZ + right * rightZ)
      }
    }
    for (const mesh of this.ribbons) {
      const positions = mesh.geometry.attributes.position
      positions.needsUpdate = true
      mesh.geometry.computeBoundingSphere()
    }
  }

  update(dt, telemetry) {
    const step = clamp(dt, 0, 0.05)
    const speed = telemetry?.speed ?? 0
    const steer = telemetry?.steer ?? 0
    const lateral = telemetry?.lateral ?? 0
    const lateralVelocity = telemetry?.lateralVelocity ?? 0
    const distance = telemetry?.distance ?? 0
    const braking = telemetry?.brake ?? 0
    const offRoad = Boolean(telemetry?.offRoad)

    this.clock += step

    // The road bends around the stationary, tangent-aligned car.
    this.roadTexture.offset.y = distance / TILE_LENGTH
    this.updateRoad(distance)

    for (const prop of this.movingProps) {
      while (prop.userData.roadDistance < distance - 45) prop.userData.roadDistance += ROAD_LENGTH
      while (prop.userData.roadDistance >= distance - 45 + ROAD_LENGTH) prop.userData.roadDistance -= ROAD_LENGTH
      const point = roadLocalPoint(prop.userData.roadDistance, distance, prop.userData.lateralOffset, this.roadSeed)
      prop.position.set(point.x, 0, point.z)
      prop.rotation.y = prop.userData.baseRotation + roadHeading(prop.userData.roadDistance, this.roadSeed) - roadHeading(distance, this.roadSeed)
    }
    for (const crossing of this.intersections) {
      while (crossing.userData.roadDistance < distance - 35) crossing.userData.roadDistance += 7 * 180
      while (crossing.userData.roadDistance >= distance - 35 + 7 * 180) crossing.userData.roadDistance -= 7 * 180
      const point = roadLocalPoint(crossing.userData.roadDistance, distance, 0, this.roadSeed)
      crossing.position.x = point.x
      crossing.position.z = point.z
      crossing.rotation.set(-Math.PI / 2, roadHeading(crossing.userData.roadDistance, this.roadSeed) - roadHeading(distance, this.roadSeed), 0, 'YXZ')
    }
    for (const [kind, marker] of Object.entries(this.stopMarkers)) {
      const stopDistance = this.stopDistances[kind]
      const point = stopDistance === null ? null : roadLocalPoint(stopDistance, distance, -5.9, this.roadSeed)
      marker.visible = point !== null && point.z > -550 && point.z < 30
      if (marker.visible) {
        marker.position.set(point.x, 0, point.z)
        const scale = 1 + clamp(-point.z / 100, 0, 2.8)
        marker.userData.sign.scale.set(5.8 * scale, 1.63 * scale, 1)
      }
    }

    this.lateral = damp(this.lateral, lateral, step, 9)
    this.carGroup.position.x = this.lateral
    this.carGroup.rotation.y = -Math.atan2(lateralVelocity, Math.max(Math.abs(speed), 3))
    this.carGroup.rotation.z = -steer * 0.03

    const spin = (speed * step) / 0.34
    for (const wheel of this.wheels) {
      wheel.spin.rotation.x -= spin
      if (wheel.front) wheel.pivot.rotation.y = -steer * 0.32
    }

    this.brakeLightMaterial.emissiveIntensity = braking > 0.08 ? 2.6 : 0.35
    this.reverseLightMaterial.emissiveIntensity = telemetry?.gear === -1 ? 2.8 : 0.04

    const speedFactor = clamp(Math.abs(speed) / 70, 0, 1)
    this.shake = offRoad ? 0.07 : 0.006 + speedFactor * 0.012

    // Follow only part of the lateral movement so the car visibly changes lanes.
    this.camera.position.x = 0.55 + this.lateral * 0.35 + Math.sin(this.clock * 37) * this.shake
    this.camera.position.y = 2.0 + Math.sin(this.clock * 23) * this.shake * 0.55
    this.camera.position.z = 9.3 - speedFactor * 0.45
    this.camera.lookAt(0.25 + this.lateral * 0.12, 0.9, -18)

    const targetFov = 54 + speedFactor * 11
    if (Math.abs(this.camera.fov - targetFov) > 0.01) {
      this.camera.fov = damp(this.camera.fov, targetFov, step, 2.5)
      this.camera.updateProjectionMatrix()
    }

    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    this.resizeObserver?.disconnect()
    this.scene.traverse((object) => {
      if (object.geometry) object.geometry.dispose()
      if (object.material) {
        const materials = Array.isArray(object.material) ? object.material : [object.material]
        for (const material of materials) {
          if (material.map) material.map.dispose()
          material.dispose()
        }
      }
    })
    this.renderer.dispose()
  }
}
