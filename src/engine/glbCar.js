/**
 * Loads an optional GLB car body and wraps it in the same contract as the
 * parametric car model: a group, four wheel pivots and light materials.
 *
 * Different Sketchfab exports use different axes, scales and wheel layouts, so
 * each car supplies modelLength/modelForward and either named wheel nodes or a
 * single combined wheel group. The source scene is cached; prepared copies
 * share geometry but own their materials.
 */

import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const BMW_WHEEL_NAMES = ['Circle.070', 'Circle.068', 'Object442', 'Line005']
const sceneCache = new Map()

const normalize = (value) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

function loadScene(url) {
  if (!sceneCache.has(url)) {
    const promise = new Promise((resolve, reject) => {
      new GLTFLoader().load(
        url,
        (gltf) => resolve(gltf.scene),
        undefined,
        (error) => reject(error),
      )
    }).catch((error) => {
      sceneCache.delete(url)
      throw error
    })
    sceneCache.set(url, promise)
  }
  return sceneCache.get(url)
}

function createContactShadow(width, length) {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  const gradient = ctx.createRadialGradient(64, 64, 8, 64, 64, 62)
  gradient.addColorStop(0, 'rgba(0,0,0,0.6)')
  gradient.addColorStop(0.62, 'rgba(0,0,0,0.22)')
  gradient.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 128, 128)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(width + 0.9, length + 0.9),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      opacity: 0.72,
    }),
  )
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = 0.02
  shadow.userData.sharedGeometry = false
  return shadow
}

function cloneMaterials(model, car) {
  const materialCache = new Map()
  let brakeLightMaterial = null
  let headlightMaterial = null
  let tailLightMaterial = null

  model.traverse((object) => {
    if (!object.isMesh) return
    object.userData.sharedGeometry = true
    const original = object.material
    const materials = Array.isArray(original) ? original : [original]
    const cloned = materials.map((material) => {
      if (!materialCache.has(material)) {
        const copy = material.clone()
        const name = normalize(copy.name)
        const bmwPaint = name === 'carpaint'
        const bmwAccent = name.startsWith('carpaint') && !bmwPaint
        const bodyPaint = bmwPaint || name === 'primary' ||
          (name.includes('paint') && !name.includes('interior') && !name.includes('calliper'))
        if (bmwPaint || bodyPaint) {
          copy.color.set(car.color)
        } else if (bmwAccent) {
          copy.color.set(car.accent ?? car.color)
        }
        if (name === 'redlight' || name.includes('redglass') || name.includes('rearlight')) {
          copy.emissive = new THREE.Color(0xff1408)
          copy.emissiveIntensity = 1.1
          brakeLightMaterial = copy
          tailLightMaterial = copy
        } else if (name === 'light5') {
          copy.emissive = new THREE.Color(0xff2410)
          copy.emissiveIntensity = 0.8
          tailLightMaterial = copy
        }
        if (name === 'lightt' || name.includes('frontlight') || name.includes('lighta')) {
          copy.emissive = new THREE.Color(0xfff1cf)
          copy.emissiveIntensity = 2.1
          headlightMaterial = copy
        }
        const glass = name.includes('window') || name === 'glass001' ||
          name === 'glasss2222' || name === 'glass'
        if (glass) {
          copy.transparent = true
          copy.opacity = Math.min(copy.opacity ?? 1, 0.46)
          copy.depthWrite = false
          copy.roughness = Math.min(copy.roughness ?? 0.2, 0.2)
          copy.metalness = Math.max(copy.metalness ?? 0, 0.35)
        }
        copy.envMapIntensity = 1
        materialCache.set(material, copy)
      }
      return materialCache.get(material)
    })
    object.material = Array.isArray(original) ? cloned : cloned[0]
  })

  return { brakeLightMaterial, headlightMaterial, tailLightMaterial }
}

function addWheelPivot(wrapper, center) {
  const pivot = new THREE.Group()
  pivot.position.copy(center)
  wrapper.add(pivot)
  const spin = new THREE.Group()
  pivot.add(spin)
  wrapper.updateMatrixWorld(true)
  return { pivot, spin }
}

function rigNamedWheels(model, wrapper, names) {
  const wheels = []
  const found = []
  for (const name of names) {
    const node = model.getObjectByName(name) ||
      model.getObjectByName(name.replace(/\./g, ''))
    if (node) found.push(node)
  }
  for (const node of found) {
    node.updateWorldMatrix(true, true)
    const box = new THREE.Box3().setFromObject(node)
    if (box.isEmpty()) continue
    const center = wrapper.worldToLocal(box.getCenter(new THREE.Vector3()))
    const { pivot, spin } = addWheelPivot(wrapper, center)
    spin.attach(node)
    wheels.push({ pivot, spin, front: center.z < 0 })
  }
  return wheels
}

function rigCombinedWheels(model, wrapper) {
  let group = null
  let best = 4
  model.traverse((object) => {
    const named = /wheel|combined/i.test(object.name)
    if (named && object.children.length > best) {
      group = object
      best = object.children.length
    }
  })
  if (!group) return []

  const buckets = new Map()
  for (const child of [...group.children]) {
    child.updateWorldMatrix(true, true)
    const box = new THREE.Box3().setFromObject(child)
    if (box.isEmpty()) continue
    const center = wrapper.worldToLocal(box.getCenter(new THREE.Vector3()))
    const key = `${center.x >= 0 ? 'R' : 'L'}${center.z >= 0 ? 'B' : 'F'}`
    if (!buckets.has(key)) buckets.set(key, { centers: [], children: [] })
    const bucket = buckets.get(key)
    bucket.centers.push(center)
    bucket.children.push(child)
  }
  if (buckets.size !== 4) return []

  const wheels = []
  for (const bucket of buckets.values()) {
    const union = new THREE.Box3()
    for (const child of bucket.children) {
      child.updateWorldMatrix(true, true)
      union.expandByObject(child)
    }
    if (union.isEmpty()) continue
    const center = wrapper.worldToLocal(union.getCenter(new THREE.Vector3()))
    const { pivot, spin } = addWheelPivot(wrapper, center)
    for (const child of bucket.children) spin.attach(child)
    wheels.push({ pivot, spin, front: center.z < 0 })
  }
  return wheels
}

function rigWheels(model, wrapper, car) {
  const mode = car.modelWheelMode
  if (mode === 'combined') return rigCombinedWheels(model, wrapper)
  const names = car.modelWheelNames ?? BMW_WHEEL_NAMES
  const named = rigNamedWheels(model, wrapper, names)
  if (named.length === 4 || mode === 'named') return named
  const combined = rigCombinedWheels(model, wrapper)
  return combined.length === 4 ? combined : named
}

function geometrySignature(geometry) {
  const attributes = Object.keys(geometry.attributes).sort()
    .map((name) => {
      const attribute = geometry.attributes[name]
      return `${name}:${attribute.itemSize}:${attribute.normalized ? 1 : 0}`
    })
    .join(',')
  return `${attributes}|${geometry.index ? 'indexed' : 'plain'}`
}

/** Merge static meshes by material to cut draw calls, preserving transforms. */
function mergeMeshes(meshes, target) {
  target.updateWorldMatrix(true, true)
  const inverse = new THREE.Matrix4().copy(target.matrixWorld).invert()
  const groups = new Map()
  for (const mesh of meshes) {
    if (!mesh.isMesh || !mesh.geometry || Array.isArray(mesh.material)) continue
    mesh.updateWorldMatrix(true, false)
    const geometry = mesh.geometry.clone()
    geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld))
    const key = `${mesh.material.uuid}|${geometrySignature(geometry)}`
    if (!groups.has(key)) groups.set(key, { material: mesh.material, geometries: [] })
    groups.get(key).geometries.push(geometry)
  }

  const merged = new THREE.Group()
  for (const { material, geometries } of groups.values()) {
    let geometry = null
    if (geometries.length === 1) {
      geometry = geometries[0]
    } else {
      geometry = mergeGeometries(geometries, false)
      if (geometry) geometries.forEach((entry) => entry.dispose())
    }
    if (!geometry) {
      geometries.forEach((entry) => {
        if (entry !== geometry) {
          const mesh = new THREE.Mesh(entry, material)
          merged.add(mesh)
        }
      })
      continue
    }
    const mesh = new THREE.Mesh(geometry, material)
    mesh.userData.sharedGeometry = false
    merged.add(mesh)
  }
  return merged
}

function optimiseModel(model, wrapper, wheels) {
  const wheelMeshes = new Set()
  for (const wheel of wheels) {
    wheel.spin.traverse((object) => {
      if (object.isMesh) wheelMeshes.add(object)
    })
  }

  const bodyMeshes = []
  wrapper.traverse((object) => {
    if (object.isMesh && !wheelMeshes.has(object)) bodyMeshes.push(object)
  })
  const body = mergeMeshes(bodyMeshes, wrapper)
  wrapper.remove(model)
  wrapper.add(body)

  for (const wheel of wheels) {
    const meshes = []
    wheel.spin.traverse((object) => {
      if (object.isMesh) meshes.push(object)
    })
    // Merge while the meshes are still attached: their world matrices must
    // include the wheel pivot, otherwise the tyres collapse into the car centre.
    const merged = mergeMeshes(meshes, wheel.spin)
    wheel.spin.clear()
    wheel.spin.add(merged)
  }
}

export async function loadGlbCarModel(car) {
  if (!car?.modelUrl) return null
  const source = await loadScene(car.modelUrl)
  const model = source.clone(true)
  const wrapper = new THREE.Group()
  wrapper.add(model)

  // Scale from the model's own units using the real car length.
  let bounds = new THREE.Box3().setFromObject(model)
  const rawSize = bounds.getSize(new THREE.Vector3())
  const longest = Math.max(rawSize.x, rawSize.z)
  const targetLength = car.modelLength ?? 4.6
  const scale = car.modelScale ?? (longest > 0.0001 ? targetLength / longest : 1)
  model.scale.multiplyScalar(scale)

  const forward = car.modelForward ?? '+X'
  model.rotation.y = forward === '+Z' ? Math.PI
    : forward === '-Z' ? 0
      : forward === '-X' ? -Math.PI / 2
        : Math.PI / 2
  wrapper.updateMatrixWorld(true)

  bounds = new THREE.Box3().setFromObject(model)
  const center = bounds.getCenter(new THREE.Vector3())
  model.position.x -= center.x
  model.position.z -= center.z
  model.position.y -= bounds.min.y
  wrapper.updateMatrixWorld(true)
  bounds = new THREE.Box3().setFromObject(model)
  const size = bounds.getSize(new THREE.Vector3())

  const { brakeLightMaterial, headlightMaterial, tailLightMaterial } = cloneMaterials(model, car)
  const wheels = rigWheels(model, wrapper, car)
  if (car.modelMerge) optimiseModel(model, wrapper, wheels)
  wrapper.add(createContactShadow(size.x, size.z))

  wrapper.userData = {
    glbModel: true,
    brakeLightMaterial,
    headlightMaterial,
    tailLightMaterial,
  }

  return {
    group: wrapper,
    wheels,
    brakeLightMaterial,
    reverseLightMaterial: null,
    headlightMaterial,
    tailLightMaterial,
  }
}

/**
 * Dispose cloned materials but keep cached GLB geometry and textures alive.
 * Textures are shared with the cached source scene, so they must not be
 * disposed here or subsequent previews would lose their maps.
 */
export function disposeCarVisual(root) {
  if (!root) return
  const materials = new Set()
  root.traverse((object) => {
    if (object.geometry && !object.userData.sharedGeometry) {
      object.geometry.dispose()
    }
    if (!object.material) return
    const list = Array.isArray(object.material) ? object.material : [object.material]
    for (const material of list) materials.add(material)
  })
  materials.forEach((material) => material.dispose())
}
