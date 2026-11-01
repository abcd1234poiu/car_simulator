/**
 * Three.js open-city scene: a large grid of districts, roads, parks and towers
 * with the player's car in the middle and a heading-based chase camera. This is
 * the only driving scene now — taxi dispatch runs inside the same free-roam
 * city.
 */

import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import {
  ALL_BLOCK_CENTERS,
  AUTOBAHN,
  BUILDINGS,
  CITY_LIMIT,
  CITY_LINKS,
  FIELDS,
  FLYOVERS,
  GENTING,
  GENTING_ACCESSES,
  GENTING_ROUTES,
  GENTING_TERRAIN,
  LOT_HALF,
  PARKS,
  PARKED_CARS,
  PLAZAS,
  RIVER,
  RIVER_BARRIERS,
  ROAD_LINES,
  SIDEWALK,
  SPAWN,
  STREETLIGHTS,
  TOWNS,
  TRAFFIC_LIGHTS,
  TREES,
  WORLD_BOUNDS,
  nearestGentingRoad,
  surfaceHeightAt,
  terrainHeightAt,
  roadHalfAt,
  townRoadHalfAt,
} from '../maps/city.js'
import { createCarModel, createSunTexture } from './carModel.js'

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const damp = (current, target, dt, rate) => current + (target - current) * (1 - Math.exp(-rate * dt))
const TILE = 12

function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  draw(canvas.getContext('2d'), width, height)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function createSky(renderer) {
  const texture = canvasTexture(1024, 512, (ctx, width, height) => {
    const sky = ctx.createLinearGradient(0, 0, 0, height)
    sky.addColorStop(0, '#060b17')
    sky.addColorStop(0.36, '#16243f')
    sky.addColorStop(0.49, '#54405a')
    sky.addColorStop(0.535, '#c8805a')
    sky.addColorStop(0.565, '#4a3340')
    sky.addColorStop(0.68, '#1b1a26')
    sky.addColorStop(1, '#080a10')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, width, height)

    const sun = ctx.createRadialGradient(690, 268, 6, 690, 268, 150)
    sun.addColorStop(0, 'rgba(255, 232, 186, 0.96)')
    sun.addColorStop(0.32, 'rgba(255, 168, 104, 0.48)')
    sun.addColorStop(1, 'rgba(255, 120, 70, 0)')
    ctx.fillStyle = sun
    ctx.fillRect(0, 0, width, height)

    for (let i = 0; i < 220; i += 1) {
      const y = Math.random() * height * 0.34
      ctx.fillStyle = `rgba(190, 214, 255, ${0.08 + Math.random() * 0.22})`
      ctx.fillRect(Math.random() * width, y, 1.5, 1.5)
    }
  })
  texture.mapping = THREE.EquirectangularReflectionMapping

  const pmrem = new THREE.PMREMGenerator(renderer)
  const environment = pmrem.fromEquirectangular(texture).texture
  pmrem.dispose()
  return { texture, environment }
}

function createAsphaltTexture(renderer, base = '#252b33') {
  const texture = canvasTexture(256, 256, (ctx, width, height) => {
    ctx.fillStyle = base
    ctx.fillRect(0, 0, width, height)
    for (let i = 0; i < 5200; i += 1) {
      const shade = 22 + Math.floor(Math.random() * 34)
      ctx.fillStyle = `rgba(${shade},${shade + 2},${shade + 5},${0.1 + Math.random() * 0.25})`
      ctx.fillRect(Math.random() * width, Math.random() * height, 1.6, 1.6)
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.022)'
    ctx.lineWidth = 1
    for (let i = 0; i < 16; i += 1) {
      ctx.beginPath()
      ctx.moveTo(Math.random() * width, 0)
      ctx.lineTo(Math.random() * width, height)
      ctx.stroke()
    }
  })
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy()
  return texture
}

function createFacade(style) {
  const lit = () => {
    const roll = Math.random()
    if (roll < 0.32) return 'rgba(255, 214, 150, 0.95)'
    if (roll < 0.5) return 'rgba(140, 214, 255, 0.9)'
    if (roll < 0.62) return 'rgba(255, 170, 140, 0.9)'
    return 'rgba(28, 38, 52, 0.85)'
  }

  const config = {
    glass: { base: '#18242f', trim: '#24384a', window: '#3a6c86', cols: 6, rows: 7 },
    modern: { base: '#262a31', trim: '#333a44', window: '#4a4a52', cols: 5, rows: 8 },
    concrete: { base: '#33312d', trim: '#403c35', window: '#3c3a36', cols: 5, rows: 7 },
    brick: { base: '#382521', trim: '#4a2f29', window: '#3a2c28', cols: 5, rows: 7 },
  }[style]

  const cells = []
  const map = canvasTexture(128, 128, (ctx, width, height) => {
    ctx.fillStyle = config.base
    ctx.fillRect(0, 0, width, height)

    const marginX = 8
    const marginY = 5
    const cellW = (width - marginX * 2) / config.cols
    const cellH = (height - marginY * 2) / config.rows

    for (let row = 0; row < config.rows; row += 1) {
      for (let col = 0; col < config.cols; col += 1) {
        const x = marginX + col * cellW + 1.5
        const y = marginY + row * cellH + 2
        const on = Math.random()
        cells.push(on)
        ctx.fillStyle = on < 0.7 ? config.window : lit()
        ctx.fillRect(x, y, cellW - 3, cellH - 4)
        ctx.fillStyle = 'rgba(255,255,255,0.09)'
        ctx.fillRect(x, y, cellW - 3, 1)
      }
    }

    ctx.fillStyle = config.trim
    for (let row = 0; row < config.rows; row += 1) {
      ctx.fillRect(0, marginY + row * cellH - 1, width, 1.4)
    }
  })

  let index = 0
  const emissive = canvasTexture(128, 128, (ctx, width, height) => {
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, width, height)
    const marginX = 8
    const marginY = 5
    const cellW = (width - marginX * 2) / config.cols
    const cellH = (height - marginY * 2) / config.rows
    for (let row = 0; row < config.rows; row += 1) {
      for (let col = 0; col < config.cols; col += 1) {
        const on = cells[index]
        index += 1
        if (on === undefined || on < 0.7) continue
        const x = marginX + col * cellW + 1.5
        const y = marginY + row * cellH + 2
        ctx.fillStyle = on < 0.86 ? 'rgba(255, 206, 140, 1)' : 'rgba(130, 210, 255, 1)'
        ctx.fillRect(x, y, cellW - 3, cellH - 4)
      }
    }
  })

  for (const texture of [map, emissive]) {
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
  }
  return { map, emissive }
}

function createCrosswalkTexture() {
  const texture = canvasTexture(256, 64, (ctx, width, height) => {
    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = 'rgba(230, 236, 244, 0.8)'
    const stripe = width / 9
    for (let i = 0; i < 9; i += 2) {
      ctx.fillRect(i * stripe + 3, 4, stripe - 8, height - 8)
    }
  })
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  return texture
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
  base.position.y = 0.05
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

  group.visible = false
  return group
}

function scaleBoxUvs(geometry, width, height, depth) {
  const uv = geometry.attributes.uv
  const faces = [
    [depth, height],
    [depth, height],
    [width, depth],
    [width, depth],
    [width, height],
    [width, height],
  ]
  for (let face = 0; face < 6; face += 1) {
    const [uSize, vSize] = faces[face]
    for (let corner = 0; corner < 4; corner += 1) {
      const index = face * 4 + corner
      uv.setXY(index, uv.getX(index) * (uSize / TILE), uv.getY(index) * (vSize / TILE))
    }
  }
  uv.needsUpdate = true
}

function instanceMesh(geometry, material, transforms) {
  const mesh = new THREE.InstancedMesh(geometry, material, transforms.length)
  const dummy = new THREE.Object3D()
  transforms.forEach((transform, index) => {
    dummy.position.set(transform.x, transform.y ?? 0, transform.z)
    dummy.rotation.set(transform.rx ?? 0, transform.ry ?? 0, transform.rz ?? 0)
    dummy.scale.set(transform.sx ?? 1, transform.sy ?? 1, transform.sz ?? 1)
    dummy.updateMatrix()
    mesh.setMatrixAt(index, dummy.matrix)
    if (transform.color) mesh.setColorAt(index, transform.color)
  })
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  mesh.frustumCulled = false
  return mesh
}

function createStreetlights() {
  const group = new THREE.Group()
  const poleMaterial = new THREE.MeshStandardMaterial({
    color: 0x2b313b,
    roughness: 0.55,
    metalness: 0.6,
  })
  const lampMaterial = new THREE.MeshStandardMaterial({
    color: 0xffe9b8,
    emissive: 0xffd27a,
    emissiveIntensity: 3,
    roughness: 0.4,
  })

  const pole = new THREE.CylinderGeometry(0.09, 0.13, 6.2, 8)
  pole.translate(0, 3.1, 0)
  const arm = new THREE.BoxGeometry(1.9, 0.09, 0.09)
  arm.translate(0.95, 6.05, 0)
  const head = new THREE.BoxGeometry(0.62, 0.14, 0.26)
  head.translate(1.85, 5.98, 0)

  group.add(instanceMesh(pole, poleMaterial, STREETLIGHTS))
  group.add(instanceMesh(arm, poleMaterial, STREETLIGHTS))
  group.add(instanceMesh(head, lampMaterial, STREETLIGHTS))
  return group
}

function createTrafficLight() {
  const group = new THREE.Group()
  const metal = new THREE.MeshStandardMaterial({ color: 0x22272e, roughness: 0.6, metalness: 0.5 })
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 4.4, 8), metal)
  pole.position.y = 2.2
  group.add(pole)

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.86, 0.26), metal)
  head.position.set(0, 4.35, 0.16)
  group.add(head)

  const colors = [0xff3b45, 0xffc84a, 0x49e48c]
  colors.forEach((color, index) => {
    const lamp = new THREE.Mesh(
      new THREE.CircleGeometry(0.09, 12),
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: index === 2 ? 2.6 : 0.24,
        roughness: 0.4,
      }),
    )
    lamp.position.set(0, 4.62 - index * 0.26, 0.295)
    group.add(lamp)
  })
  return group
}

export class CityScene {
  constructor(canvas, car) {
    this.canvas = canvas
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.24

    this.scene = new THREE.Scene()
    const sky = createSky(this.renderer)
    this.scene.background = sky.texture
    this.scene.environment = sky.environment
    this.scene.environmentIntensity = 0.75
    this.scene.fog = new THREE.Fog(0x1a1c2a, 280, 2600)

    this.camera = new THREE.PerspectiveCamera(58, 1, 0.35, 6000)
    this.camera.position.set(SPAWN.x, 3.2, SPAWN.z + 9)
    this.lookTarget = new THREE.Vector3(SPAWN.x, 1.1, SPAWN.z - 8)
    this.camera.lookAt(this.lookTarget)

    this.clock = 0

    const hemi = new THREE.HemisphereLight(0x9db8ff, 0x11151a, 1.5)
    this.scene.add(hemi)

    const key = new THREE.DirectionalLight(0xffbb87, 2.4)
    key.position.set(-90, 120, -80)
    this.scene.add(key)

    const rim = new THREE.DirectionalLight(0x7fabff, 1.5)
    rim.position.set(90, 40, 110)
    this.scene.add(rim)

    const sun = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: createSunTexture(),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0.7,
        fog: false,
      }),
    )
    sun.position.set(1300, 260, -2600)
    sun.scale.set(760, 760, 1)
    this.scene.add(sun)

    this.buildGround()
    this.buildTerrain()
    this.buildMountain()
    this.buildRoads()
    this.buildHighway()
    this.buildBlocks()
    this.buildBuildings()
    this.buildParks()
    this.buildTrees()
    this.buildStreetFurniture()
    this.buildFlyovers()
    this.buildParkedCars()
    this.buildSkyline()

    const carModel = createCarModel(car)
    this.carGroup = carModel.group
    this.wheels = carModel.wheels
    this.brakeLightMaterial = carModel.brakeLightMaterial
    this.reverseLightMaterial = carModel.reverseLightMaterial
    this.carGroup.position.set(SPAWN.x, 0, SPAWN.z)
    this.scene.add(this.carGroup)
    this.createTyreSmoke()

    this.stopMarkers = {
      pickup: createStopMarker('PICKUP', 0xf9c86a),
      dropoff: createStopMarker('DROP OFF', 0xfb7185),
    }
    this.scene.add(this.stopMarkers.pickup, this.stopMarkers.dropoff)

    this.roll = 0
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(canvas.parentElement ?? canvas)
    this.resize()
    this.renderer.render(this.scene, this.camera)
  }

  createTyreSmoke() {
    const canvas = document.createElement('canvas')
    canvas.width = 96
    canvas.height = 96
    const ctx = canvas.getContext('2d')
    const gradient = ctx.createRadialGradient(48, 48, 3, 48, 48, 46)
    gradient.addColorStop(0, 'rgba(220, 226, 230, 0.55)')
    gradient.addColorStop(0.45, 'rgba(180, 190, 196, 0.28)')
    gradient.addColorStop(1, 'rgba(120, 130, 138, 0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 96, 96)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    this.tyreSmoke = []
    this.smokeAccumulator = 0
    for (let index = 0; index < 28; index += 1) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        opacity: 0,
      }))
      sprite.visible = false
      sprite.scale.set(0.5, 0.5, 1)
      this.scene.add(sprite)
      this.tyreSmoke.push({ sprite, life: 0, vx: 0, vz: 0 })
    }
  }

  updateTyreSmoke(step, telemetry, groundY) {
    if (!this.tyreSmoke) return
    const speed = Math.abs(telemetry?.signedSpeed ?? telemetry?.speed ?? 0)
    const slip = (telemetry?.tyreSlip ?? 0) +
      (telemetry?.handbrake ? 0.35 : 0) +
      (telemetry?.wheelspin ? 0.3 : 0)
    if (speed > 4 && slip > 0.2) {
      this.smokeAccumulator += step * (7 + slip * 24)
      const x = telemetry?.x ?? SPAWN.x
      const z = telemetry?.z ?? SPAWN.z
      const heading = telemetry?.heading ?? SPAWN.heading
      const rearX = x - Math.sin(heading) * 1.65
      const rearZ = z + Math.cos(heading) * 1.65
      while (this.smokeAccumulator >= 1) {
        this.smokeAccumulator -= 1
        const particle = this.tyreSmoke.find((entry) => entry.life <= 0)
        if (!particle) break
        const side = Math.random() < 0.5 ? -1 : 1
        const rightX = Math.cos(heading)
        const rightZ = Math.sin(heading)
        particle.life = 0.75
        particle.vx = (Math.random() - 0.5) * 0.5
        particle.vz = (Math.random() - 0.5) * 0.5
        particle.sprite.visible = true
        particle.sprite.position.set(
          rearX + rightX * side * 0.8,
          groundY + 0.35,
          rearZ + rightZ * side * 0.8,
        )
        particle.sprite.material.opacity = 0.22
        particle.sprite.scale.set(0.55, 0.55, 1)
      }
    }
    for (const particle of this.tyreSmoke) {
      if (particle.life <= 0) continue
      particle.life = Math.max(0, particle.life - step)
      particle.sprite.position.x += particle.vx * step
      particle.sprite.position.z += particle.vz * step
      particle.sprite.position.y += step * 1.1
      particle.sprite.scale.x += step * 1.8
      particle.sprite.scale.y += step * 1.8
      particle.sprite.material.opacity = Math.max(0, particle.life) * 0.3
      if (particle.life <= 0) particle.sprite.visible = false
    }
  }

  buildGround() {
    const width = (WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX) * 1.8
    const depth = (WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ) * 1.8
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      new THREE.MeshStandardMaterial({
        color: 0x141b18,
        roughness: 1,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.set(
      (WORLD_BOUNDS.minX + WORLD_BOUNDS.maxX) / 2,
      -0.04,
      (WORLD_BOUNDS.minZ + WORLD_BOUNDS.maxZ) / 2,
    )
    this.scene.add(ground)
  }

  buildTerrain() {
    // Open fields between the two towns.
    for (const field of FIELDS) {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(field.width, field.depth),
        new THREE.MeshStandardMaterial({ color: field.color, roughness: 1 }),
      )
      mesh.rotation.x = -Math.PI / 2
      mesh.position.set(field.x, -0.02, field.z)
      this.scene.add(mesh)
    }

    // River surface.
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(RIVER.halfWidth * 2, RIVER.zMax - RIVER.zMin),
      new THREE.MeshPhysicalMaterial({
        color: 0x0d3344,
        roughness: 0.18,
        metalness: 0.35,
        clearcoat: 1,
        clearcoatRoughness: 0.12,
        transparent: true,
        opacity: 0.94,
      }),
    )
    water.rotation.x = -Math.PI / 2
    water.position.set(RIVER.x, 0.006, (RIVER.zMin + RIVER.zMax) / 2)
    this.scene.add(water)

    // Concrete river embankments / guard walls, with a gap for the bridge.
    const wallGeometry = new THREE.BoxGeometry(1, 1, 1)
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x4b5252, roughness: 0.9 })
    this.scene.add(instanceMesh(
      wallGeometry,
      wallMaterial,
      RIVER_BARRIERS.map((barrier) => ({
        x: barrier.x,
        y: 0.5,
        z: barrier.z,
        sx: barrier.width,
        sy: 1,
        sz: barrier.depth,
      })),
    ))

    // Bridge deck railings on every river crossing.
    const railMaterial = new THREE.MeshStandardMaterial({
      color: 0x7c858c,
      metalness: 0.6,
      roughness: 0.4,
    })
    for (const link of CITY_LINKS) {
      for (const side of [-1, 1]) {
        const rail = new THREE.Mesh(
          new THREE.BoxGeometry(RIVER.halfWidth * 2 + 26, 0.7, 0.24),
          railMaterial,
        )
        rail.position.set(RIVER.x, 0.78, link.z + side * (link.halfWidth + 1.2))
        this.scene.add(rail)
      }
    }
  }

  buildMountain() {
    const bounds = GENTING.bounds
    const width = bounds.maxX - bounds.minX
    const depth = bounds.maxZ - bounds.minZ

    // Terrain heightfield built from the same grid used by the physics.
    const {
      cols, rows, minX, maxX, minZ, maxZ, heights,
    } = GENTING_TERRAIN
    const stride = cols + 1
    const terrainPositions = []
    const terrainColors = []
    const terrainIndices = []
    const low = new THREE.Color(0x24402e)
    const mid = new THREE.Color(0x4b623c)
    const high = new THREE.Color(0x8b8d82)
    const color = new THREE.Color()
    for (let row = 0; row <= rows; row += 1) {
      const z = minZ + (row / rows) * (maxZ - minZ)
      for (let col = 0; col <= cols; col += 1) {
        const x = minX + (col / cols) * (maxX - minX)
        const height = heights[row * stride + col]
        terrainPositions.push(x, height, z)
        const t = Math.min(1, Math.max(0, height / 290))
        if (t < 0.55) color.copy(low).lerp(mid, t / 0.55)
        else color.copy(mid).lerp(high, (t - 0.55) / 0.45)
        terrainColors.push(color.r, color.g, color.b)
      }
    }
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const a = row * stride + col
        const b = a + 1
        const c = a + stride
        const d = c + 1
        terrainIndices.push(a, c, b, b, c, d)
      }
    }
    const terrainGeometry = new THREE.BufferGeometry()
    terrainGeometry.setAttribute('position', new THREE.Float32BufferAttribute(terrainPositions, 3))
    terrainGeometry.setAttribute('color', new THREE.Float32BufferAttribute(terrainColors, 3))
    terrainGeometry.setIndex(terrainIndices)
    terrainGeometry.computeVertexNormals()
    const terrain = new THREE.Mesh(
      terrainGeometry,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 1,
        metalness: 0,
        flatShading: false,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
    )
    terrain.position.y = -0.03
    this.scene.add(terrain)

    // Mountain access roads from the city's ring roads to each real route.
    const accessMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a525c,
      roughness: 0.92,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    })
    for (const accessConfig of GENTING_ACCESSES) {
      const accessPoints = accessConfig.points
      for (let index = 1; index < accessPoints.length; index += 1) {
        const a = accessPoints[index - 1]
        const b = accessPoints[index]
        const dx = b.x - a.x
        const dz = b.z - a.z
        const length = Math.hypot(dx, dz)
        const access = new THREE.Mesh(
          new THREE.PlaneGeometry(accessConfig.halfWidth * 2, length + 2),
          accessMaterial,
        )
        access.rotation.x = -Math.PI / 2
        access.rotation.z = -Math.atan2(dz, dx)
        access.position.set((a.x + b.x) / 2, 0.14, (a.z + b.z) / 2)
        this.scene.add(access)
      }
    }

    for (const route of GENTING_ROUTES) {
      this.buildMountainRoute(route.samples)
    }

    // Forest on the mountain slopes, kept clear of the road.
    const treeTransforms = []
    let seed = 481516
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0
      return seed / 4294967296
    }
    for (let index = 0; index < 280; index += 1) {
      const x = bounds.minX + 60 + random() * (width - 120)
      const z = bounds.minZ + 80 + random() * (depth - 160)
      const height = terrainHeightAt(x, z)
      if (height < 4 || height > 275) continue
      const nearest = nearestGentingRoad(x, z)
      if (nearest && nearest.distance < 18) continue
      treeTransforms.push({
        x,
        y: height,
        z,
        sx: 0.7 + random() * 0.7,
        sy: 2.4 + random() * 3.2,
        sz: 0.7 + random() * 0.7,
        color: new THREE.Color().setHSL(0.29 + random() * 0.04, 0.4, 0.13 + random() * 0.08),
      })
    }
    const trunkGeometry = new THREE.CylinderGeometry(0.13, 0.22, 1, 6)
    trunkGeometry.translate(0, 0.5, 0)
    this.scene.add(instanceMesh(
      trunkGeometry,
      new THREE.MeshStandardMaterial({ color: 0x2d2117, roughness: 1 }),
      treeTransforms.map((tree) => ({
        ...tree,
        sy: tree.sy * 0.35,
      })),
    ))
    const foliageGeometry = new THREE.ConeGeometry(1, 1, 7)
    foliageGeometry.translate(0, 0.5, 0)
    this.scene.add(instanceMesh(
      foliageGeometry,
      new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }),
      treeTransforms.map((tree) => ({
        ...tree,
        y: tree.y + tree.sy * 0.3,
        sx: tree.sx * 1.4,
        sy: tree.sy,
        sz: tree.sz * 1.4,
      })),
    ))
  }

  buildMountainRoute(samples) {
    // Winding mountain road ribbon.
    const positions = []
    const uvs = []
    const indices = []
    let travelled = 0
    for (let index = 0; index < samples.length; index += 1) {
      const sample = samples[index]
      const previous = samples[Math.max(0, index - 1)]
      const next = samples[Math.min(samples.length - 1, index + 1)]
      const dx = next.x - previous.x
      const dz = next.z - previous.z
      const length = Math.hypot(dx, dz) || 1
      const rightX = -dz / length
      const rightZ = dx / length
      const half = GENTING.halfWidth
      const leftX = sample.x - rightX * half
      const leftZ = sample.z - rightZ * half
      const rightXWorld = sample.x + rightX * half
      const rightZWorld = sample.z + rightZ * half
      positions.push(
        leftX, sample.y + 0.12, leftZ,
        rightXWorld, sample.y + 0.12, rightZWorld,
      )
      if (index > 0) {
        const previousSample = samples[index - 1]
        travelled += Math.hypot(sample.x - previousSample.x, sample.z - previousSample.z)
      }
      const v = travelled / 12
      uvs.push(0, v, 1, v)
      if (index > 0) {
        const base = index * 2
        indices.push(base - 2, base - 1, base, base - 1, base + 1, base)
      }
    }
    const roadGeometry = new THREE.BufferGeometry()
    roadGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    roadGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    roadGeometry.setIndex(indices)
    roadGeometry.computeVertexNormals()
    const asphalt = createAsphaltTexture(this.renderer, '#4a525c')
    asphalt.repeat.set(1, 1)
    asphalt.needsUpdate = true
    const mountainRoad = new THREE.Mesh(
      roadGeometry,
      new THREE.MeshStandardMaterial({
        map: asphalt,
        color: 0xb8c0c8,
        emissive: 0x111820,
        emissiveIntensity: 0.55,
        roughness: 0.9,
        metalness: 0.03,
        polygonOffset: true,
        polygonOffsetFactor: -3,
        polygonOffsetUnits: -3,
      }),
    )
    this.scene.add(mountainRoad)

    // Bright centre line makes the narrow mountain road readable at night.
    const centrePositions = []
    const centreIndices = []
    for (let index = 0; index < samples.length; index += 1) {
      const sample = samples[index]
      const previous = samples[Math.max(0, index - 1)]
      const next = samples[Math.min(samples.length - 1, index + 1)]
      const dx = next.x - previous.x
      const dz = next.z - previous.z
      const length = Math.hypot(dx, dz) || 1
      const rightX = -dz / length
      const rightZ = dx / length
      const leftX = sample.x - rightX * 0.16
      const leftZ = sample.z - rightZ * 0.16
      const rightXWorld = sample.x + rightX * 0.16
      const rightZWorld = sample.z + rightZ * 0.16
      centrePositions.push(
        leftX, sample.y + 0.14, leftZ,
        rightXWorld, sample.y + 0.14, rightZWorld,
      )
      if (index > 0) {
        const base = index * 2
        centreIndices.push(base - 2, base - 1, base, base - 1, base + 1, base)
      }
    }
    const centreGeometry = new THREE.BufferGeometry()
    centreGeometry.setAttribute('position', new THREE.Float32BufferAttribute(centrePositions, 3))
    centreGeometry.setIndex(centreIndices)
    centreGeometry.computeVertexNormals()
    this.scene.add(new THREE.Mesh(
      centreGeometry,
      new THREE.MeshStandardMaterial({
        color: 0xe4edf5,
        emissive: 0xaab7c8,
        emissiveIntensity: 0.35,
        roughness: 0.7,
      }),
    ))

    const addOffsetRibbon = (offset, ribbonWidth, yOffset, material) => {
      const ribbonPositions = []
      const ribbonIndices = []
      for (let index = 0; index < samples.length; index += 1) {
        const sample = samples[index]
        const previous = samples[Math.max(0, index - 1)]
        const next = samples[Math.min(samples.length - 1, index + 1)]
        const dx = next.x - previous.x
        const dz = next.z - previous.z
        const length = Math.hypot(dx, dz) || 1
        const rightX = -dz / length
        const rightZ = dx / length
        const centerX = sample.x + rightX * offset
        const centerZ = sample.z + rightZ * offset
        const half = ribbonWidth / 2
        const leftX = centerX - rightX * half
        const leftZ = centerZ - rightZ * half
        const rightXWorld = centerX + rightX * half
        const rightZWorld = centerZ + rightZ * half
        ribbonPositions.push(
          leftX, sample.y + yOffset, leftZ,
          rightXWorld, sample.y + yOffset, rightZWorld,
        )
        if (index > 0) {
          const base = index * 2
          ribbonIndices.push(base - 2, base - 1, base, base - 1, base + 1, base)
        }
      }
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(ribbonPositions, 3))
      geometry.setIndex(ribbonIndices)
      geometry.computeVertexNormals()
      this.scene.add(new THREE.Mesh(geometry, material))
    }

    const lineMaterial = new THREE.MeshStandardMaterial({
      color: 0xf0f4f8,
      emissive: 0xaab7c8,
      emissiveIntensity: 0.55,
      roughness: 0.7,
      polygonOffset: true,
      polygonOffsetFactor: -5,
      polygonOffsetUnits: -5,
    })
    const edgeOffset = GENTING.halfWidth - 1.8
    addOffsetRibbon(-edgeOffset, 0.36, 0.12, lineMaterial)
    addOffsetRibbon(edgeOffset, 0.36, 0.12, lineMaterial)

    const railMaterial = new THREE.MeshStandardMaterial({
      color: 0xb8c0c6,
      emissive: 0x566069,
      emissiveIntensity: 0.4,
      metalness: 0.7,
      roughness: 0.35,
      polygonOffset: true,
      polygonOffsetFactor: -5,
      polygonOffsetUnits: -5,
    })
    addOffsetRibbon(-(GENTING.halfWidth + 1.8), 0.24, 0.82, railMaterial)
    addOffsetRibbon(GENTING.halfWidth + 1.8, 0.24, 0.82, railMaterial)

    // Sparse mountain-road lamps.
    const lampTransforms = []
    for (let index = 6; index < samples.length; index += 12) {
      const sample = samples[index]
      const previous = samples[Math.max(0, index - 1)]
      const next = samples[Math.min(samples.length - 1, index + 1)]
      const dx = next.x - previous.x
      const dz = next.z - previous.z
      const length = Math.hypot(dx, dz) || 1
      const side = (index % 24 === 6) ? 1 : -1
      const x = sample.x + side * (-dz / length) * (GENTING.halfWidth + 3)
      const z = sample.z + side * (dx / length) * (GENTING.halfWidth + 3)
      const y = sample.y + 0.25
      if (y < 1) continue
      lampTransforms.push({ x, y, z })
    }
    if (lampTransforms.length) {
      const poleGeometry = new THREE.CylinderGeometry(0.12, 0.18, 7, 8)
      const lampGeometry = new THREE.BoxGeometry(0.62, 0.18, 0.36)
      const metal = new THREE.MeshStandardMaterial({ color: 0x9aa1a4, metalness: 0.6, roughness: 0.45 })
      this.scene.add(instanceMesh(
        poleGeometry,
        metal,
        lampTransforms.map((lamp) => ({ x: lamp.x, y: lamp.y + 3.5, z: lamp.z })),
      ))
      this.scene.add(instanceMesh(
        lampGeometry,
        new THREE.MeshStandardMaterial({
          color: 0xffe9b8,
          emissive: 0xffd27a,
          emissiveIntensity: 3.5,
          roughness: 0.3,
        }),
        lampTransforms.map((lamp) => ({ x: lamp.x, y: lamp.y + 7, z: lamp.z })),
      ))
    }

    // Guard-rail posts.
    const postTransforms = []
    for (let index = 0; index < samples.length; index += 5) {
      const sample = samples[index]
      const previous = samples[Math.max(0, index - 1)]
      const next = samples[Math.min(samples.length - 1, index + 1)]
      const dx = next.x - previous.x
      const dz = next.z - previous.z
      const length = Math.hypot(dx, dz) || 1
      const rightX = -dz / length
      const rightZ = dx / length
      for (const side of [-1, 1]) {
        const x = sample.x + side * rightX * (GENTING.halfWidth + 1.2)
        const z = sample.z + side * rightZ * (GENTING.halfWidth + 1.2)
        postTransforms.push({
          x,
          y: sample.y + 0.5,
          z,
          sx: 0.12,
          sy: 1,
          sz: 0.12,
        })
      }
    }
    this.scene.add(instanceMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x9aa1a4, metalness: 0.55, roughness: 0.5 }),
      postTransforms,
    ))

  }

  buildRoads() {
    const asphalt = createAsphaltTexture(this.renderer)
    const roadCache = new Map()

    const roadEntry = (width, length) => {
      const key = `${width}:${length}`
      if (roadCache.has(key)) return roadCache.get(key)

      const texture = asphalt.clone()
      texture.repeat.set(width / 12, length / 12)
      texture.needsUpdate = true
      const entry = {
        geometry: new THREE.PlaneGeometry(width, length),
        material: new THREE.MeshStandardMaterial({
          map: texture,
          roughness: 0.95,
          metalness: 0.02,
        }),
      }
      roadCache.set(key, entry)
      return entry
    }

    const addAxisRoad = (x, z, width, length, vertical) => {
      const entry = roadEntry(width, length)
      const mesh = new THREE.Mesh(entry.geometry, entry.material)
      mesh.rotation.x = -Math.PI / 2
      if (vertical) {
        mesh.position.set(x, 0.012, z)
      } else {
        mesh.rotation.z = Math.PI / 2
        mesh.position.set(x, 0.016, z)
      }
      this.scene.add(mesh)
      return mesh
    }

    const primaryLength = CITY_LIMIT * 2 + 16
    for (const line of ROAD_LINES) {
      const width = roadHalfAt(line) * 2
      addAxisRoad(line, 0, width, primaryLength, true)
      addAxisRoad(0, line, width, primaryLength, false)
    }

    for (const town of TOWNS) {
      const bounds = town.bounds
      const townWidth = bounds.maxX - bounds.minX
      const townHeight = bounds.maxZ - bounds.minZ
      const townCenterX = (bounds.minX + bounds.maxX) / 2
      const townCenterZ = (bounds.minZ + bounds.maxZ) / 2
      for (const line of town.xLines) {
        addAxisRoad(line, townCenterZ, townRoadHalfAt(town, line) * 2, townHeight, true)
      }
      for (const line of town.zLines) {
        addAxisRoad(townCenterX, line, townRoadHalfAt(town, line) * 2, townWidth, false)
      }
    }

    // Dashed lane dividers on both street grids, skipping intersections.
    const dashTransforms = []
    const addGridDashes = (linesX, linesZ, halfFor, xMin, xMax, zMin, zMax) => {
      for (const line of linesX) {
        for (let along = zMin; along <= zMax; along += 12) {
          const nearCross = linesZ.some((cross) => Math.abs(along - cross) < halfFor(cross) + 5)
          if (!nearCross) dashTransforms.push({ x: line, y: 0.03, z: along })
        }
      }
      for (const line of linesZ) {
        for (let along = xMin; along <= xMax; along += 12) {
          const nearCross = linesX.some((cross) => Math.abs(along - cross) < halfFor(cross) + 5)
          if (!nearCross) dashTransforms.push({ x: along, y: 0.032, z: line, ry: Math.PI / 2 })
        }
      }
    }
    addGridDashes(ROAD_LINES, ROAD_LINES, roadHalfAt, -CITY_LIMIT, CITY_LIMIT, -CITY_LIMIT, CITY_LIMIT)
    for (const town of TOWNS) {
      addGridDashes(
        town.xLines,
        town.zLines,
        (line) => townRoadHalfAt(town, line),
        town.bounds.minX,
        town.bounds.maxX,
        town.bounds.minZ,
        town.bounds.maxZ,
      )
    }
    for (const link of CITY_LINKS) {
      for (let along = link.xMin + 20; along <= link.xMax; along += 16) {
        dashTransforms.push({ x: along, y: 0.034, z: link.z, ry: Math.PI / 2 })
      }
    }

    const dashGeometry = new THREE.PlaneGeometry(0.24, 3.4)
    const dashMaterial = new THREE.MeshStandardMaterial({
      color: 0xdfe7f2,
      emissive: 0x9fb2c8,
      emissiveIntensity: 0.24,
      roughness: 0.7,
    })
    const dashes = instanceMesh(dashGeometry, dashMaterial, dashTransforms)
    dashes.geometry.rotateX(-Math.PI / 2)
    this.scene.add(dashes)
    // Painted crosswalks on each approach to every intersection.
    const crosswalkTransforms = []
    const addCrosswalks = (linesX, linesZ, halfFor) => {
      for (const x of linesX) {
        for (const z of linesZ) {
          const xHalf = halfFor(x)
          const zHalf = halfFor(z)
          const offsetX = zHalf + 2.4
          const offsetZ = xHalf + 2.4
          const scaleX = (xHalf * 2) / 14.5
          const scaleZ = (zHalf * 2) / 14.5
          crosswalkTransforms.push({ x, y: 0.036, z: z - offsetZ, sx: scaleX })
          crosswalkTransforms.push({ x, y: 0.036, z: z + offsetZ, sx: scaleX })
          crosswalkTransforms.push({ x: x - offsetX, y: 0.036, z, ry: Math.PI / 2, sx: scaleZ })
          crosswalkTransforms.push({ x: x + offsetX, y: 0.036, z, ry: Math.PI / 2, sx: scaleZ })
        }
      }
    }
    addCrosswalks(ROAD_LINES, ROAD_LINES, roadHalfAt)
    for (const town of TOWNS) {
      addCrosswalks(town.xLines, town.zLines, (line) => townRoadHalfAt(town, line))
    }
    const crosswalkGeometry = new THREE.PlaneGeometry(14.5, 3.4)
    crosswalkGeometry.rotateX(-Math.PI / 2)
    const crosswalkMaterial = new THREE.MeshStandardMaterial({
      map: createCrosswalkTexture(),
      transparent: true,
      opacity: 0.75,
      roughness: 0.8,
      depthWrite: false,
    })
    this.scene.add(instanceMesh(crosswalkGeometry, crosswalkMaterial, crosswalkTransforms))

    // Autobahn exit links connect Metro City and the towns to the A1.
    for (const link of CITY_LINKS) {
      const surface = addAxisRoad(
        (link.xMin + link.xMax) / 2,
        link.z,
        link.halfWidth * 2,
        link.xMax - link.xMin,
        false,
      )
      surface.position.y = 0.018
    }

  }

  buildHighway() {
    const asphalt = createAsphaltTexture(this.renderer)
    const highwayLength = AUTOBAHN.zMax - AUTOBAHN.zMin
    const texture = asphalt.clone()
    texture.repeat.set(AUTOBAHN.halfWidth * 2 / 12, highwayLength / 12)
    texture.needsUpdate = true
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.93,
      metalness: 0.03,
    })

    const highway = new THREE.Mesh(
      new THREE.PlaneGeometry(AUTOBAHN.halfWidth * 2, highwayLength),
      material,
    )
    highway.rotation.x = -Math.PI / 2
    highway.position.set(AUTOBAHN.x, 0.02, (AUTOBAHN.zMin + AUTOBAHN.zMax) / 2)
    this.scene.add(highway)

    // Median barrier and guard rails.
    const barrierMaterial = new THREE.MeshStandardMaterial({
      color: 0x9aa1a4,
      metalness: 0.35,
      roughness: 0.55,
    })
    const barrierTransforms = []
    const railTransforms = []
    for (let z = AUTOBAHN.zMin + 20; z < AUTOBAHN.zMax - 20; z += 20) {
      if (CITY_LINKS.some((link) => Math.abs(z - link.z) < link.halfWidth + 7)) continue
      barrierTransforms.push({ x: AUTOBAHN.x, y: 0.55, z, sx: 0.8, sy: 1.1, sz: 20 })
      for (const side of [-1, 1]) {
        railTransforms.push({
          x: AUTOBAHN.x + side * (AUTOBAHN.halfWidth - 1.2),
          y: 0.55,
          z,
          sx: 0.28,
          sy: 0.7,
          sz: 20,
        })
      }
    }
    // A1 East Link: median and guard rails where it runs between the towns.
    const eastLink = CITY_LINKS.find((link) => link.id === 'east-link')
    if (eastLink) {
      for (let x = eastLink.xMin + 80; x < eastLink.xMax; x += 20) {
        const insideTown = TOWNS.some((town) => town.mainZ === eastLink.z &&
          x > town.bounds.minX && x < town.bounds.maxX)
        if (insideTown) continue
        if (Math.abs(x - AUTOBAHN.x) < eastLink.halfWidth + 18) continue
        barrierTransforms.push({ x, y: 0.55, z: eastLink.z, sx: 20, sy: 1.1, sz: 0.8 })
        for (const side of [-1, 1]) {
          railTransforms.push({
            x,
            y: 0.55,
            z: eastLink.z + side * (eastLink.halfWidth - 1.2),
            sx: 20,
            sy: 0.7,
            sz: 0.28,
          })
        }
      }
    }

    const box = new THREE.BoxGeometry(1, 1, 1)
    this.scene.add(instanceMesh(box, barrierMaterial, barrierTransforms))
    this.scene.add(instanceMesh(box, barrierMaterial, railTransforms))

    // Highway lamp posts.
    const lampTransforms = []
    for (let z = AUTOBAHN.zMin + 80; z < AUTOBAHN.zMax; z += 150) {
      for (const side of [-1, 1]) {
        lampTransforms.push({
          x: AUTOBAHN.x + side * (AUTOBAHN.halfWidth + 2),
          y: 0,
          z,
          ry: side > 0 ? Math.PI : 0,
        })
      }
    }
    const pole = new THREE.CylinderGeometry(0.12, 0.18, 9.5, 8)
    pole.translate(0, 4.75, 0)
    const arm = new THREE.BoxGeometry(3.6, 0.12, 0.12)
    arm.translate(1.8, 9.2, 0)
    const lampMaterial = new THREE.MeshStandardMaterial({
      color: 0xffe9b8,
      emissive: 0xffd27a,
      emissiveIntensity: 3,
      roughness: 0.4,
    })
    this.scene.add(instanceMesh(pole, barrierMaterial, lampTransforms))
    this.scene.add(instanceMesh(arm, barrierMaterial, lampTransforms))
    this.scene.add(instanceMesh(
      new THREE.BoxGeometry(0.7, 0.18, 0.36),
      lampMaterial,
      lampTransforms.map((lamp) => ({ ...lamp, x: lamp.x + (lamp.ry ? -3.4 : 3.4), y: 9.1 })),
    ))

    // Overhead gantries with destination boards.
    const signCanvas = document.createElement('canvas')
    signCanvas.width = 1024
    signCanvas.height = 256
    const ctx = signCanvas.getContext('2d')
    ctx.fillStyle = '#153d34'
    ctx.fillRect(0, 0, 1024, 256)
    ctx.strokeStyle = '#d7f2e5'
    ctx.lineWidth = 8
    ctx.strokeRect(8, 8, 1008, 240)
    ctx.fillStyle = '#f1fff8'
    ctx.font = '800 78px Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('A1  EXITS   →', 512, 92)
    ctx.font = '700 46px Arial, sans-serif'
    ctx.fillStyle = '#9ee8cd'
    ctx.fillText('ALL TOWNS · USE EXIT', 512, 182)
    const signTexture = new THREE.CanvasTexture(signCanvas)
    signTexture.colorSpace = THREE.SRGBColorSpace

    for (const z of [-1020, -300, 600, 1200]) {
      const gantry = new THREE.Group()
      gantry.position.set(AUTOBAHN.x, 0, z)
      const postMaterial = new THREE.MeshStandardMaterial({
        color: 0x4a5156,
        metalness: 0.55,
        roughness: 0.45,
      })
      for (const side of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 8.2, 8), postMaterial)
        post.position.set(side * (AUTOBAHN.halfWidth + 1), 4.1, 0)
        gantry.add(post)
      }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(AUTOBAHN.halfWidth * 2 + 2.6, 0.38, 0.38), postMaterial)
      beam.position.y = 8.2
      gantry.add(beam)
      const board = new THREE.Mesh(
        new THREE.PlaneGeometry(12, 3),
        new THREE.MeshStandardMaterial({
          map: signTexture,
          emissive: 0x6fe0bc,
          emissiveMap: signTexture,
          emissiveIntensity: 0.55,
          side: THREE.DoubleSide,
        }),
      )
      board.position.set(0, 7.2, 0.25)
      gantry.add(board)
      this.scene.add(gantry)
    }
  }

  buildBlocks() {
    const sidewalkTransforms = []
    const lotTransforms = []
    PARKS.forEach((park) => {
      lotTransforms.push({
        x: park.x,
        y: 0.07,
        z: park.z,
        sx: park.size,
        sy: 0.12,
        sz: park.size,
        color: new THREE.Color(0x1f3b2b),
      })
    })

    ALL_BLOCK_CENTERS.forEach(({ x, z }) => {
      sidewalkTransforms.push({
        x,
        y: 0.02,
        z,
        sx: (LOT_HALF + SIDEWALK) * 2,
        sy: 0.05,
        sz: (LOT_HALF + SIDEWALK) * 2,
        color: new THREE.Color(0x35383d),
      })
      const isPark = PARKS.some((park) => park.x === x && park.z === z)
      const isPlaza = PLAZAS.some((plaza) => plaza.x === x && plaza.z === z)
      if (!isPark) {
        lotTransforms.push({
          x,
          y: 0.055,
          z,
          sx: LOT_HALF * 2,
          sy: 0.09,
          sz: LOT_HALF * 2,
          color: new THREE.Color(isPlaza ? 0x4a4c4a : 0x2a2c2e),
        })
      }
    })

    const slab = new THREE.BoxGeometry(1, 1, 1)
    const slabMaterial = new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0.02 })
    this.scene.add(instanceMesh(slab, slabMaterial, sidewalkTransforms))
    this.scene.add(instanceMesh(slab, slabMaterial.clone(), lotTransforms))
  }

  buildBuildings() {
    const buckets = new Map()
    const roofTransforms = []
    const gableTransforms = []
    const unitTransforms = []
    const antennaTransforms = []

    for (const building of BUILDINGS) {
      for (const tier of building.tiers ?? [{ ...building, y: 0 }]) {
        const geometry = new THREE.BoxGeometry(tier.width, tier.height, tier.depth)
        scaleBoxUvs(geometry, tier.width, tier.height, tier.depth)
        geometry.translate(tier.x, tier.y + tier.height / 2, tier.z)

        const variant = building.seed % 3
        const bucketKey = `${building.style}:${variant}`
        if (!buckets.has(bucketKey)) buckets.set(bucketKey, [])
        buckets.get(bucketKey).push(geometry)
      }

      const roof = {
        x: building.roofX ?? building.x,
        y: building.height + 0.22,
        z: building.roofZ ?? building.z,
        sx: (building.roofWidth ?? building.width) + 0.55,
        sy: 0.44,
        sz: (building.roofDepth ?? building.depth) + 0.55,
        color: new THREE.Color(building.roof),
      }

      if (building.roofType === 'gable') {
        gableTransforms.push({
          x: roof.x,
          y: building.height + 1.4,
          z: roof.z,
          sx: (building.roofWidth ?? building.width) * 0.62,
          sy: 2.8,
          sz: (building.roofDepth ?? building.depth) * 0.62,
          ry: Math.PI / 4,
          color: new THREE.Color(building.roof),
        })
      } else {
        roofTransforms.push(roof)
      }

      if (building.height > 24) {
        unitTransforms.push({
          x: roof.x + ((building.seed % 5) - 2) * 1.4,
          y: building.height + 1.5,
          z: roof.z + (((building.seed >> 3) % 5) - 2) * 1.4,
          sx: Math.max(2.6, (building.roofWidth ?? building.width) * 0.26),
          sy: 2.4,
          sz: Math.max(2.6, (building.roofDepth ?? building.depth) * 0.26),
        })
      }

      if (building.height > 105 && building.seed % 3 === 0) {
        antennaTransforms.push({
          x: roof.x,
          y: building.height + 2,
          z: roof.z,
          sx: 1,
          sy: 6 + (building.seed % 7) * 1.4,
          sz: 1,
        })
      }
    }

    for (const [bucketKey, geometries] of buckets.entries()) {
      const style = bucketKey.split(':')[0]
      const facade = createFacade(style)
      const material = new THREE.MeshStandardMaterial({
        map: facade.map,
        emissive: 0xffffff,
        emissiveMap: facade.emissive,
        emissiveIntensity: 1.05,
        roughness: 0.58,
        metalness: 0.35,
      })
      const merged = mergeGeometries(geometries)
      geometries.forEach((geometry) => geometry.dispose())
      this.scene.add(new THREE.Mesh(merged, material))
    }

    const box = new THREE.BoxGeometry(1, 1, 1)
    const roofMaterial = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0.15 })
    this.scene.add(instanceMesh(box, roofMaterial, roofTransforms))

    // Pitched roofs for low residential houses and some riverside buildings.
    const gableGeometry = new THREE.ConeGeometry(1, 1, 4)
    this.scene.add(instanceMesh(
      gableGeometry,
      new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0.08 }),
      gableTransforms,
    ))

    const unitMaterial = new THREE.MeshStandardMaterial({
      color: 0x1f242b,
      roughness: 0.8,
      metalness: 0.2,
    })
    if (unitTransforms.length) {
      this.scene.add(instanceMesh(box, unitMaterial, unitTransforms))
    }

    if (antennaTransforms.length) {
      const antennaGeometry = new THREE.CylinderGeometry(0.08, 0.13, 1, 6)
      antennaGeometry.translate(0, 0.5, 0)
      this.scene.add(instanceMesh(
        antennaGeometry,
        new THREE.MeshStandardMaterial({ color: 0x8d9399, metalness: 0.8, roughness: 0.4 }),
        antennaTransforms,
      ))
    }
  }

  buildParks() {
    const pathMaterial = new THREE.MeshStandardMaterial({
      color: 0x5a564d,
      roughness: 0.95,
    })
    for (const park of PARKS) {
      const horizontal = new THREE.Mesh(new THREE.BoxGeometry(park.size, 0.05, 3.4), pathMaterial)
      horizontal.position.set(park.x, 0.075, park.z)
      this.scene.add(horizontal)
      const vertical = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.05, park.size), pathMaterial)
      vertical.position.set(park.x, 0.077, park.z)
      this.scene.add(vertical)
    }

    const stone = new THREE.MeshStandardMaterial({ color: 0x777a78, roughness: 0.8 })
    const water = new THREE.MeshPhysicalMaterial({
      color: 0x1d6574,
      roughness: 0.12,
      metalness: 0.2,
      clearcoat: 1,
    })
    for (const plaza of PLAZAS) {
      const basin = new THREE.Mesh(new THREE.CylinderGeometry(5.4, 5.8, 0.55, 20), stone)
      basin.position.set(plaza.x, 0.3, plaza.z)
      this.scene.add(basin)
      const pool = new THREE.Mesh(new THREE.CylinderGeometry(4.7, 4.7, 0.12, 20), water)
      pool.position.set(plaza.x, 0.62, plaza.z)
      this.scene.add(pool)
      const centerpiece = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 2.4, 10), stone)
      centerpiece.position.set(plaza.x, 1.55, plaza.z)
      this.scene.add(centerpiece)
    }
  }

  buildTrees() {
    const roundTrees = TREES.filter((tree) => tree.round)
    const coneTrees = TREES.filter((tree) => !tree.round)

    const trunkGeometry = new THREE.CylinderGeometry(0.16, 0.26, 1, 6)
    trunkGeometry.translate(0, 0.5, 0)
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x342619, roughness: 1 })
    const trunkTransforms = TREES.map((tree) => ({
      x: tree.x,
      y: 0.08,
      z: tree.z,
      sx: tree.scale,
      sy: 2.6 * tree.scale,
      sz: tree.scale,
    }))
    this.scene.add(instanceMesh(trunkGeometry, trunkMaterial, trunkTransforms))

    const foliageGeometry = new THREE.IcosahedronGeometry(1, 1)
    const foliageMaterial = new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true })
    const roundTransforms = roundTrees.map((tree, index) => ({
      x: tree.x,
      y: 2.9 * tree.scale,
      z: tree.z,
      sx: 1.7 * tree.scale,
      sy: 1.5 * tree.scale,
      sz: 1.7 * tree.scale,
      color: new THREE.Color().setHSL(0.29 + (index % 7) * 0.012, 0.42, 0.18),
    }))
    this.scene.add(instanceMesh(foliageGeometry, foliageMaterial, roundTransforms))

    const coneGeometry = new THREE.ConeGeometry(1, 3.4, 7)
    const coneMaterial = new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true })
    const coneTransforms = coneTrees.map((tree, index) => ({
      x: tree.x,
      y: 2.2 * tree.scale + 1.5 * tree.scale,
      z: tree.z,
      sx: 1.5 * tree.scale,
      sy: 1.5 * tree.scale,
      sz: 1.5 * tree.scale,
      color: new THREE.Color().setHSL(0.33 + (index % 5) * 0.014, 0.4, 0.16),
    }))
    this.scene.add(instanceMesh(coneGeometry, coneMaterial, coneTransforms))
  }

  buildStreetFurniture() {
    this.scene.add(createStreetlights())
    for (const signal of TRAFFIC_LIGHTS) {
      const light = createTrafficLight()
      light.position.set(signal.x, 0.06, signal.z)
      light.rotation.y = signal.rotationY
      this.scene.add(light)
    }
  }

  buildFlyovers() {
    const deckMaterial = new THREE.MeshStandardMaterial({
      color: 0x3a424a,
      metalness: 0.35,
      roughness: 0.55,
    })
    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x7ec6d8,
      metalness: 0.15,
      roughness: 0.08,
      transparent: true,
      opacity: 0.45,
      envMapIntensity: 1.2,
    })
    const trimMaterial = new THREE.MeshStandardMaterial({
      color: 0x9aa4ad,
      metalness: 0.75,
      roughness: 0.3,
    })

    for (const flyover of FLYOVERS) {
      const group = new THREE.Group()
      group.position.set(flyover.x, 0, flyover.z)
      group.rotation.y = flyover.rotation

      const deck = new THREE.Mesh(
        new THREE.BoxGeometry(flyover.span, 0.42, flyover.width),
        deckMaterial,
      )
      deck.position.y = flyover.height
      group.add(deck)

      for (const side of [-1, 1]) {
        const glass = new THREE.Mesh(
          new THREE.BoxGeometry(flyover.span, 1.15, 0.08),
          glassMaterial,
        )
        glass.position.set(0, flyover.height + 0.72, side * flyover.width / 2)
        group.add(glass)

        const rail = new THREE.Mesh(
          new THREE.BoxGeometry(flyover.span, 0.08, 0.12),
          trimMaterial,
        )
        rail.position.set(0, flyover.height + 1.3, side * flyover.width / 2)
        group.add(rail)

        const column = new THREE.Mesh(
          new THREE.BoxGeometry(1.5, flyover.height, 2.2),
          deckMaterial,
        )
        column.position.set(side * (flyover.span / 2 - 1.2), flyover.height / 2, 0)
        group.add(column)
      }

      this.scene.add(group)
    }
  }

  buildParkedCars() {
    const bodyTransforms = PARKED_CARS.map((car) => ({
      x: car.x,
      y: 0,
      z: car.z,
      ry: car.heading,
      color: new THREE.Color(car.color),
    }))
    const cabinTransforms = PARKED_CARS.map((car) => ({
      x: car.x,
      y: 0,
      z: car.z,
      ry: car.heading,
    }))

    const bodyGeometry = new THREE.BoxGeometry(1.9, 0.58, 4.4)
    bodyGeometry.translate(0, 0.62, 0)
    const bodyMaterial = new THREE.MeshStandardMaterial({
      metalness: 0.5,
      roughness: 0.35,
    })
    this.scene.add(instanceMesh(bodyGeometry, bodyMaterial, bodyTransforms))

    const cabinGeometry = new THREE.BoxGeometry(1.64, 0.5, 2.1)
    cabinGeometry.translate(0, 1.14, 0.12)
    const cabinMaterial = new THREE.MeshStandardMaterial({
      color: 0x0b121a,
      metalness: 0.75,
      roughness: 0.15,
    })
    this.scene.add(instanceMesh(cabinGeometry, cabinMaterial, cabinTransforms))

    const wheelTransforms = []
    const tailTransforms = []
    for (const car of PARKED_CARS) {
      const cos = Math.cos(car.heading)
      const sin = Math.sin(car.heading)
      for (const localX of [-0.86, 0.86]) {
        for (const localZ of [-1.42, 1.42]) {
          wheelTransforms.push({
            x: car.x + localX * cos + localZ * sin,
            y: 0.32,
            z: car.z - localX * sin + localZ * cos,
            ry: car.heading,
          })
        }
      }
      for (const localX of [-0.56, 0.56]) {
        tailTransforms.push({
          x: car.x + localX * cos + 2.2 * sin,
          y: 0.8,
          z: car.z - localX * sin + 2.2 * cos,
          ry: car.heading,
        })
      }
    }

    const wheelGeometry = new THREE.CylinderGeometry(0.31, 0.31, 0.21, 12)
    wheelGeometry.rotateZ(Math.PI / 2)
    const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x111418, roughness: 0.9 })
    this.scene.add(instanceMesh(wheelGeometry, wheelMaterial, wheelTransforms))

    const tailGeometry = new THREE.BoxGeometry(0.34, 0.12, 0.06)
    const tailMaterial = new THREE.MeshStandardMaterial({
      color: 0x5c1012,
      emissive: 0xff3540,
      emissiveIntensity: 1.2,
      roughness: 0.4,
    })
    this.scene.add(instanceMesh(tailGeometry, tailMaterial, tailTransforms))
  }

  buildSkyline() {
    const transforms = []
    const clusters = [
      { x: 0, z: 0, count: 160, min: 1050, max: 1650 },
      ...TOWNS.map((town) => ({
        x: (town.bounds.minX + town.bounds.maxX) / 2,
        z: (town.bounds.minZ + town.bounds.maxZ) / 2,
        count: 55,
        min: 560,
        max: 860,
      })),
      { x: 1600, z: 0, count: 110, min: 4600, max: 5800 },
    ]
    for (const cluster of clusters) {
      for (let i = 0; i < cluster.count; i += 1) {
        const angle = Math.random() * Math.PI * 2
        const radius = cluster.min + Math.random() * (cluster.max - cluster.min)
        const height = 35 + Math.random() * 210
        const x = cluster.x + Math.cos(angle) * radius
        const z = cluster.z + Math.sin(angle) * radius
        if (x > GENTING.bounds.minX && x < GENTING.bounds.maxX &&
          z > GENTING.bounds.minZ && z < GENTING.bounds.maxZ) continue
        if (TOWNS.some((town) => x > town.bounds.minX && x < town.bounds.maxX &&
          z > town.bounds.minZ && z < town.bounds.maxZ)) continue
        transforms.push({
          x,
          y: height / 2,
          z,
          sx: 22 + Math.random() * 44,
          sy: height,
          sz: 22 + Math.random() * 44,
          color: new THREE.Color().setHSL(0.6, 0.2, 0.06 + Math.random() * 0.06),
        })
      }
    }
    const geometry = new THREE.BoxGeometry(1, 1, 1)
    const material = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0.1 })
    this.scene.add(instanceMesh(geometry, material, transforms))
  }

  setStops(pickup, dropoff, status) {
    const pickupVisible = Boolean(pickup) && status === 'pickup'
    const dropoffVisible = Boolean(dropoff) && status === 'trip'

    this.stopMarkers.pickup.visible = pickupVisible
    if (pickup) this.stopMarkers.pickup.position.set(pickup.x, 0.06, pickup.z)

    this.stopMarkers.dropoff.visible = dropoffVisible
    if (dropoff) this.stopMarkers.dropoff.position.set(dropoff.x, 0.06, dropoff.z)
  }

  resize() {
    const parent = this.canvas.parentElement
    const width = parent?.clientWidth || this.canvas.clientWidth || 1
    const height = parent?.clientHeight || this.canvas.clientHeight || 1
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  update(dt, telemetry) {
    const step = clamp(dt, 0, 0.05)
    const x = telemetry?.x ?? SPAWN.x
    const z = telemetry?.z ?? SPAWN.z
    const heading = telemetry?.heading ?? SPAWN.heading
    const speed = telemetry?.speed ?? 0
    const signedSpeed = telemetry?.signedSpeed ?? speed
    const steer = telemetry?.steer ?? 0
    const braking = telemetry?.brake ?? 0
    const offRoad = Boolean(telemetry?.offRoad)
    const slip = telemetry?.slipAngle ?? 0
    const groundY = telemetry?.y ?? 0
    const pitch = clamp(Math.atan(telemetry?.slope ?? 0), -0.32, 0.32)
    const horizonY = groundY

    this.clock += step

    this.carGroup.position.set(x, groundY + (offRoad ? 0.03 : 0), z)
    this.roll = damp(this.roll, clamp(-slip * 0.16 - steer * 0.015, -0.06, 0.06), step, 6)
    this.carGroup.rotation.set(pitch, -heading, this.roll)

    const spin = (signedSpeed * step) / 0.34
    for (const wheel of this.wheels) {
      wheel.spin.rotation.x -= spin
      if (wheel.front) wheel.pivot.rotation.y = steer * 0.34
    }

    this.brakeLightMaterial.emissiveIntensity = braking > 0.08 ? 2.9 : 0.35
    if (this.reverseLightMaterial) {
      this.reverseLightMaterial.emissiveIntensity = telemetry?.gear === -1 ? 2.4 : 0.04
    }
    this.updateTyreSmoke(step, telemetry, groundY)

    const speedFactor = clamp(speed / 42, 0, 1)
    const inMountain = z > GENTING.bounds.minZ && z < GENTING.bounds.maxZ &&
      x > GENTING.bounds.minX && x < GENTING.bounds.maxX
    const back = (inMountain ? 11.5 : 8.4) + speedFactor * 2.4
    const desiredX = x - Math.sin(heading) * back
    const desiredZ = z + Math.cos(heading) * back
    const shake = offRoad ? 0.045 : 0.005 + speedFactor * 0.008

    this.camera.position.x = damp(this.camera.position.x, desiredX, step, 5.4)
    const cameraFloor = surfaceHeightAt(this.camera.position.x, this.camera.position.z) + 1.5
    this.camera.position.y = damp(
      this.camera.position.y,
      Math.max(
        cameraFloor,
        horizonY + (inMountain ? 5.2 : 3.15) + speedFactor * 0.3 + Math.sin(this.clock * 21) * shake,
      ),
      step,
      5,
    )
    this.camera.position.z = damp(this.camera.position.z, desiredZ, step, 5.4)

    const lookAhead = (inMountain ? 6 : 7) + speedFactor * 7
    this.lookTarget.x = damp(
      this.lookTarget.x,
      x + Math.sin(heading) * lookAhead,
      step,
      6,
    )
    this.lookTarget.y = damp(this.lookTarget.y, groundY + 1.05, step, 6)
    this.lookTarget.z = damp(
      this.lookTarget.z,
      z - Math.cos(heading) * lookAhead,
      step,
      6,
    )
    this.camera.lookAt(this.lookTarget)

    const targetFov = 58 + speedFactor * 12
    if (Math.abs(this.camera.fov - targetFov) > 0.01) {
      this.camera.fov = damp(this.camera.fov, targetFov, step, 2.6)
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
          if (material.emissiveMap) material.emissiveMap.dispose()
          material.dispose()
        }
      }
    })
    if (this.scene.environment) this.scene.environment.dispose()
    if (this.scene.background?.isTexture) this.scene.background.dispose()
    this.renderer.dispose()
  }
}
