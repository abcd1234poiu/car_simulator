/** Three.js scene for the expanded two-city driving world. */
import * as THREE from 'three'
import { createCarModel, createSunTexture } from './carModel.js'
import {
  BRIDGE, BUILDINGS, ROAD_SEGMENTS, ROAD_SHOULDER_WIDTH, SPAWN, WATERWAY, WORLD_BOUNDS,
  roadDeckHeightAt, surfaceHeightAt, terrainHeightAt, terrainMeshHeightAt,
} from '../maps/roadWorld.js'

const clamp = (value, low, high) => Math.max(low, Math.min(high, value))
const damp = (value, target, dt, rate) => value + (target - value) * (1 - Math.exp(-rate * dt))

function meshFromTriangles(positions, color, yOffset = 0) {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.computeVertexNormals()
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.95,
    metalness: 0,
    side: THREE.DoubleSide,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.y = yOffset
  mesh.receiveShadow = true
  return mesh
}

function addQuad(target, ax, ay, az, bx, by, bz, halfWidth) {
  const length = Math.hypot(bx - ax, bz - az)
  if (length < 0.01) return
  const nx = -(bz - az) / length * halfWidth
  const nz = (bx - ax) / length * halfWidth
  const a = [ax + nx, ay, az + nz]
  const b = [ax - nx, ay, az - nz]
  const c = [bx + nx, by, bz + nz]
  const d = [bx - nx, by, bz - nz]
  target.push(...a, ...b, ...c, ...c, ...b, ...d)
}

function addDisc(target, x, z, radius, y) {
  const sides = 12
  const centerY = Math.max(y, terrainMeshHeightAt(x, z) + 0.4)
  for (let index = 0; index < sides; index += 1) {
    const a = index / sides * Math.PI * 2
    const b = (index + 1) / sides * Math.PI * 2
    const ax = x + Math.cos(a) * radius
    const az = z + Math.sin(a) * radius
    const bx = x + Math.cos(b) * radius
    const bz = z + Math.sin(b) * radius
    target.push(
      x, centerY, z,
      ax, Math.max(y, terrainMeshHeightAt(ax, az) + 0.4), az,
      bx, Math.max(y, terrainMeshHeightAt(bx, bz) + 0.4), bz,
    )
  }
}

function buildRoadMeshes(scene) {
  const shoulder = []
  const asphalt = []
  const freeways = []
  const markings = []
  const medianLines = []
  const junctions = new Map()

  for (const road of ROAD_SEGMENTS) {
    const { a, b, halfWidth } = road
    const isFreeway = road.kind === 'freeway'
    const length = Math.hypot(b.x - a.x, b.z - a.z)
    const heightAt = (t) => roadDeckHeightAt(road, t)
    const steps = Math.max(1, Math.ceil(length / 12))
    for (let index = 0; index < steps; index += 1) {
      const t0 = index / steps
      const t1 = (index + 1) / steps
      const x0 = a.x + (b.x - a.x) * t0
      const z0 = a.z + (b.z - a.z) * t0
      const x1 = a.x + (b.x - a.x) * t1
      const z1 = a.z + (b.z - a.z) * t1
      addQuad(shoulder, x0, heightAt(t0) + 0.1, z0,
        x1, heightAt(t1) + 0.1, z1, halfWidth + ROAD_SHOULDER_WIDTH)
      addQuad(isFreeway ? freeways : asphalt,
        x0, heightAt(t0) + 0.13, z0, x1, heightAt(t1) + 0.13, z1, halfWidth)
      if (isFreeway) {
        addQuad(medianLines, x0, heightAt(t0) + 0.19, z0,
          x1, heightAt(t1) + 0.19, z1, 0.28)
      }
    }
    for (const [point, t] of [[a, 0], [b, 1]]) {
      const key = `${point.x},${point.z}`
      const old = junctions.get(key)
      junctions.set(key, {
        x: point.x, z: point.z,
        y: Math.max(old?.y ?? -Infinity, heightAt(t)),
        radius: Math.max(old?.radius ?? 0, halfWidth),
        freeway: isFreeway || Boolean(old?.freeway),
      })
    }

    // Sparse lane markings keep the road network readable without buildings.
    if (length < 40 || road.kind === 'hill') continue
    const ux = (b.x - a.x) / length
    const uz = (b.z - a.z) / length
    for (let distance = 20; distance < length - 15; distance += 42) {
      for (const offset of isFreeway ? [-halfWidth * 0.46, halfWidth * 0.46] : [0]) {
        const startX = a.x + ux * distance - uz * offset
        const startZ = a.z + uz * distance + ux * offset
        addQuad(markings, startX, heightAt(distance / length) + 0.2, startZ,
          startX + ux * 12, heightAt((distance + 12) / length) + 0.2, startZ + uz * 12,
          isFreeway ? 0.32 : 0.21)
      }
    }
  }

  for (const point of junctions.values()) {
    addDisc(shoulder, point.x, point.z, point.radius + ROAD_SHOULDER_WIDTH, point.y + 0.1)
    addDisc(point.freeway ? freeways : asphalt, point.x, point.z, point.radius, point.y + 0.14)
  }

  scene.add(meshFromTriangles(shoulder, 0x6e695e))
  scene.add(meshFromTriangles(asphalt, 0x262a30))
  scene.add(meshFromTriangles(freeways, 0x1c252d, 0.002))
  scene.add(meshFromTriangles(markings, 0xc6c4ab, 0.004))
  scene.add(meshFromTriangles(medianLines, 0xd7b965, 0.006))
}

function buildTerrain(scene) {
  const step = 100
  const nx = Math.ceil((WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX) / step)
  const nz = Math.ceil((WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ) / step)
  const positions = []
  const colors = []
  const indices = []
  const rural = new THREE.Color(0x425545)
  const urban = new THREE.Color(0x747a72)
  const hillColor = new THREE.Color(0x667360)
  for (let iz = 0; iz <= nz; iz += 1) for (let ix = 0; ix <= nx; ix += 1) {
    const x = WORLD_BOUNDS.minX + ix * step
    const z = WORLD_BOUNDS.minZ + iz * step
    const y = terrainHeightAt(x, z) - 0.12
    positions.push(x, y, z)
    const city = (x > -2400 && x < 2250 && z > -250 && z < 2350) ||
      (x > 4250 && x < 7650 && z > -430 && z < 2250)
    const color = (city ? urban : rural).clone().lerp(hillColor, clamp(y / 130, 0, 0.8))
    colors.push(color.r, color.g, color.b)
  }
  for (let iz = 0; iz < nz; iz += 1) for (let ix = 0; ix < nx; ix += 1) {
    const a = iz * (nx + 1) + ix
    const b = a + 1
    const c = a + nx + 1
    const d = c + 1
    indices.push(a, c, b, b, c, d)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  scene.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 1, side: THREE.DoubleSide,
  })))
}

function buildBuildings(scene) {
  if (!BUILDINGS.length) return
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#b2b9ba'
  ctx.fillRect(0, 0, 128, 128)
  for (let row = 0; row < 10; row += 1) for (let col = 0; col < 7; col += 1) {
    const lit = (row * 17 + col * 11) % 7 < 3
    ctx.fillStyle = lit ? '#d8cba6' : '#344550'
    ctx.fillRect(5 + col * 18, 5 + row * 12, 11, 7)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const walls = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ map: texture, roughness: 0.82, metalness: 0.06 }),
    BUILDINGS.length,
  )
  const roofs = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x333941, roughness: 0.9 }),
    BUILDINGS.length,
  )
  const colors = [0xd7d5ca, 0xb5bec4, 0xc9b8a0, 0xa6b2ae, 0x9eabb8]
  const dummy = new THREE.Object3D()
  BUILDINGS.forEach((building, index) => {
    dummy.position.set(building.x, building.baseY + building.height / 2, building.z)
    dummy.scale.set(building.width, building.height, building.depth)
    dummy.updateMatrix()
    walls.setMatrixAt(index, dummy.matrix)
    walls.setColorAt(index, new THREE.Color(colors[building.colorIndex]))
    dummy.position.y = building.baseY + building.height + 0.8
    dummy.scale.set(building.width + 2, 1.6, building.depth + 2)
    dummy.updateMatrix()
    roofs.setMatrixAt(index, dummy.matrix)
  })
  walls.instanceMatrix.needsUpdate = true
  walls.instanceColor.needsUpdate = true
  roofs.instanceMatrix.needsUpdate = true
  scene.add(walls, roofs)
}

function buildBridge(scene) {
  const concrete = new THREE.MeshStandardMaterial({ color: 0x777e80, roughness: 0.95 })
  const rail = new THREE.MeshStandardMaterial({ color: 0xc1c6c5, metalness: 0.35, roughness: 0.55 })
  for (const x of [3380, 3600, 3820]) {
    const deck = surfaceHeightAt(x, BRIDGE.z)
    const support = new THREE.Mesh(new THREE.BoxGeometry(5, deck - WATERWAY.level, 4), concrete)
    support.position.set(x, (deck + WATERWAY.level) / 2, BRIDGE.z)
    scene.add(support)
  }
  for (const side of [-1, 1]) for (const [x0, x1] of [[3240, 3600], [3600, 3960]]) {
    const y0 = surfaceHeightAt(x0, BRIDGE.z) + 1.4
    const y1 = surfaceHeightAt(x1, BRIDGE.z) + 1.4
    const length = Math.hypot(x1 - x0, y1 - y0)
    const barrier = new THREE.Mesh(new THREE.BoxGeometry(length, 1, 0.8), rail)
    barrier.position.set((x0 + x1) / 2, (y0 + y1) / 2,
      BRIDGE.z + side * (BRIDGE.halfWidth + 1.1))
    barrier.rotation.z = Math.atan2(y1 - y0, x1 - x0)
    scene.add(barrier)
  }
}

function createStopMarker(color) {
  const group = new THREE.Group()
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(9, 0.8, 6, 32),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }),
  )
  ring.rotation.x = -Math.PI / 2
  ring.position.y = 0.16
  group.add(ring)
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6, 0.6, 11, 8),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45 }),
  )
  beacon.position.y = 5.5
  group.add(beacon)
  group.visible = false
  return group
}

function createSmokeTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const context = canvas.getContext('2d')
  const gradient = context.createRadialGradient(32, 32, 2, 32, 32, 31)
  gradient.addColorStop(0, 'rgba(225,230,235,0.62)')
  gradient.addColorStop(0.5, 'rgba(190,200,210,0.3)')
  gradient.addColorStop(1, 'rgba(170,180,190,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(canvas)
}

export class RoadScene {
  constructor(canvas, car) {
    this.canvas = canvas
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.3))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.25

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x91a5b8)
    this.scene.fog = new THREE.Fog(0x91a5b8, 900, 4400)
    this.camera = new THREE.PerspectiveCamera(58, 1, 0.25, 8500)
    this.camera.position.set(SPAWN.x, 6 + surfaceHeightAt(SPAWN.x, SPAWN.z), SPAWN.z + 12)
    this.lookTarget = new THREE.Vector3(SPAWN.x, 1, SPAWN.z - 10)

    this.scene.add(new THREE.HemisphereLight(0xdde8ff, 0x344035, 2.1))
    const sunLight = new THREE.DirectionalLight(0xffd5a9, 2.5)
    sunLight.position.set(-300, 700, -900)
    this.scene.add(sunLight)
    const sun = new THREE.Sprite(new THREE.SpriteMaterial({
      map: createSunTexture(), transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, fog: false,
    }))
    sun.position.set(-1400, 650, -3500)
    sun.scale.set(900, 900, 1)
    this.scene.add(sun)

    buildTerrain(this.scene)

    const seaMaterial = new THREE.MeshStandardMaterial({ color: 0x22526a, roughness: 0.6, metalness: 0.06 })
    const westernSea = new THREE.Mesh(new THREE.PlaneGeometry(950, 5800), seaMaterial)
    westernSea.rotation.x = -Math.PI / 2
    westernSea.position.set(-3350, -0.01, -200)
    this.scene.add(westernSea)
    const southernSea = new THREE.Mesh(new THREE.PlaneGeometry(11400, 700), seaMaterial)
    southernSea.rotation.x = -Math.PI / 2
    southernSea.position.set(2400, -0.008, 2800)
    this.scene.add(southernSea)
    const river = new THREE.Mesh(
      new THREE.PlaneGeometry(WATERWAY.xMax - WATERWAY.xMin,
        WATERWAY.zMax - WATERWAY.zMin), seaMaterial,
    )
    river.rotation.x = -Math.PI / 2
    river.position.set((WATERWAY.xMin + WATERWAY.xMax) / 2, WATERWAY.level,
      (WATERWAY.zMin + WATERWAY.zMax) / 2)
    this.scene.add(river)

    buildRoadMeshes(this.scene)
    buildBridge(this.scene)
    buildBuildings(this.scene)

    const model = createCarModel(car)
    this.carGroup = model.group
    this.carGroup.rotation.order = 'YXZ'
    this.wheels = model.wheels
    this.brakeLightMaterial = model.brakeLightMaterial
    this.reverseLightMaterial = model.reverseLightMaterial
    this.scene.add(this.carGroup)

    this.smokeTexture = createSmokeTexture()
    this.smoke = []
    this.smokeClock = 0
    this.skidClock = 0
    this.skidCount = 0
    this.skids = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.2, 0.012, 1.1),
      new THREE.MeshBasicMaterial({ color: 0x111517, transparent: true, opacity: 0.37,
        depthWrite: false }),
      240,
    )
    this.skids.count = 0
    this.skids.frustumCulled = false
    this.scene.add(this.skids)

    this.stopMarkers = {
      pickup: createStopMarker(0xf9c86a),
      dropoff: createStopMarker(0xfb7185),
    }
    this.scene.add(this.stopMarkers.pickup, this.stopMarkers.dropoff)
    this.roll = 0
    this.clock = 0
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(canvas.parentElement ?? canvas)
    this.resize()
    this.update(0, SPAWN)
  }

  setStops(pickup, dropoff, status) {
    this.stopMarkers.pickup.visible = Boolean(pickup) && status === 'pickup'
    if (pickup) this.stopMarkers.pickup.position.set(pickup.x, surfaceHeightAt(pickup.x, pickup.z), pickup.z)
    this.stopMarkers.dropoff.visible = Boolean(dropoff) && status === 'trip'
    if (dropoff) this.stopMarkers.dropoff.position.set(dropoff.x, surfaceHeightAt(dropoff.x, dropoff.z), dropoff.z)
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
    const steer = telemetry?.steer ?? 0
    const braking = telemetry?.brake ?? 0
    const slip = telemetry?.slipAngle ?? 0
    this.clock += step

    const groundY = telemetry?.y ?? surfaceHeightAt(x, z)
    this.carGroup.position.set(x, groundY + (telemetry?.suspensionTravel ?? 0) + 0.15, z)
    this.roll = damp(this.roll, clamp((telemetry?.bodyRoll ?? 0) - slip * 0.08, -0.14, 0.14), step, 6)
    this.carGroup.rotation.set(
      clamp(Math.atan(telemetry?.slope ?? 0) + (telemetry?.bodyPitch ?? 0), -0.3, 0.3),
      -heading,
      this.roll,
    )
    const spin = ((telemetry?.signedSpeed ?? speed) * step) / 0.34
    for (const wheel of this.wheels) {
      wheel.spin.rotation.x -= spin
      if (wheel.front) wheel.pivot.rotation.y = steer * 0.55
    }
    this.brakeLightMaterial.emissiveIntensity = braking > 0.08 ? 2.9 : 0.35
    if (this.reverseLightMaterial) {
      this.reverseLightMaterial.emissiveIntensity = telemetry?.gear === -1 ? 2.4 : 0.04
    }

    const drifting = speed > 6 && (Math.abs(slip) > 0.13 || telemetry?.handbrake)
    for (let index = this.smoke.length - 1; index >= 0; index -= 1) {
      const particle = this.smoke[index]
      particle.life -= step
      particle.sprite.position.y += step * 0.65
      particle.sprite.scale.setScalar(2.5 + (1.25 - particle.life) * 3)
      particle.sprite.material.opacity = clamp(particle.life / 1.25, 0, 1) * 0.55
      if (particle.life <= 0) {
        this.scene.remove(particle.sprite)
        particle.sprite.material.dispose()
        this.smoke.splice(index, 1)
      }
    }
    if (drifting && step > 0) {
      this.smokeClock += step
      this.skidClock += step
      if (this.smokeClock >= 0.07) {
        this.smokeClock = 0
        for (const side of [-1, 1]) {
          const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
            map: this.smokeTexture, transparent: true, depthWrite: false, opacity: 0.5,
          }))
          sprite.position.set(x - Math.sin(heading) * 1.55 + Math.cos(heading) * side * 0.72,
            groundY + 0.5,
            z + Math.cos(heading) * 1.55 + Math.sin(heading) * side * 0.72)
          sprite.scale.setScalar(2.5)
          this.scene.add(sprite)
          this.smoke.push({ sprite, life: 1.25 })
        }
      }
      if (this.skidClock >= 0.12) {
        this.skidClock = 0
        const dummy = new THREE.Object3D()
        for (const side of [-1, 1]) {
          const skidX = x - Math.sin(heading) * 1.5 + Math.cos(heading) * side * 0.73
          const skidZ = z + Math.cos(heading) * 1.5 + Math.sin(heading) * side * 0.73
          dummy.position.set(skidX, surfaceHeightAt(skidX, skidZ) + 0.17, skidZ)
          dummy.rotation.y = -heading
          dummy.updateMatrix()
          this.skids.setMatrixAt(this.skidCount % 240, dummy.matrix)
          this.skidCount += 1
        }
        this.skids.count = Math.min(this.skidCount, 240)
        this.skids.instanceMatrix.needsUpdate = true
      }
    } else {
      this.smokeClock = 0
      this.skidClock = 0
    }

    const speedFactor = clamp(speed / 42, 0, 1)
    const back = 8.2 + speedFactor * 1.8
    const desiredX = x - Math.sin(heading) * back
    const desiredZ = z + Math.cos(heading) * back
    this.camera.position.x = damp(this.camera.position.x, desiredX, step, 5.4)
    this.camera.position.y = damp(this.camera.position.y,
      Math.max(surfaceHeightAt(desiredX, desiredZ) + 2.8, groundY + 4.5 + speedFactor * 0.8), step, 5)
    this.camera.position.z = damp(this.camera.position.z, desiredZ, step, 5.4)
    const lookAhead = 8 + speedFactor * 8
    this.lookTarget.x = damp(this.lookTarget.x, x + Math.sin(heading) * lookAhead, step, 6)
    this.lookTarget.y = damp(this.lookTarget.y, groundY + 1.05, step, 6)
    this.lookTarget.z = damp(this.lookTarget.z, z - Math.cos(heading) * lookAhead, step, 6)
    this.camera.lookAt(this.lookTarget)
    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    this.resizeObserver?.disconnect()
    this.scene.traverse((object) => {
      object.geometry?.dispose()
      if (object.material) {
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          material.map?.dispose()
          material.dispose()
        }
      }
    })
    this.smokeTexture.dispose()
    this.renderer.dispose()
  }
}
