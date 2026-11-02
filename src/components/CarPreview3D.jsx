import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { createCarModel } from '../engine/carModel.js'
import { CarSilhouette } from './CarSilhouette.jsx'

/** The selection screen and driving scene use the exact same car geometry. */
export function CarPreview3D({ car }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    let renderer
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false })
    } catch {
      // The SVG underneath remains visible if this device has no WebGL.
      return undefined
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.35

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x101822)
    scene.add(new THREE.HemisphereLight(0xe8f1ff, 0x344552, 2.5))
    const key = new THREE.DirectionalLight(0xffead0, 3)
    key.position.set(-3, 7, -5)
    scene.add(key)
    const rim = new THREE.DirectionalLight(0x74c9ff, 2)
    rim.position.set(4, 5, 6)
    scene.add(rim)

    const model = createCarModel(car)
    scene.add(model.group)
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100)
    camera.position.set(5.2, 3.3, -8.8)
    camera.lookAt(0, 0.7, 0)

    const resize = () => {
      const width = Math.max(1, canvas.clientWidth)
      const height = Math.max(1, canvas.clientHeight)
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)

    let frame
    const render = (time) => {
      model.group.rotation.y = -0.42 + Math.sin(time * 0.00032) * 0.2
      renderer.render(scene, camera)
      canvas.style.opacity = '1'
      frame = requestAnimationFrame(render)
    }
    frame = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      const geometries = new Set()
      const materials = new Set()
      const textures = new Set()
      model.group.traverse((item) => {
        if (item.geometry) geometries.add(item.geometry)
        if (item.material) {
          for (const material of Array.isArray(item.material) ? item.material : [item.material]) {
            materials.add(material)
            if (material.map) textures.add(material.map)
          }
        }
      })
      geometries.forEach((geometry) => geometry.dispose())
      materials.forEach((material) => material.dispose())
      textures.forEach((texture) => texture.dispose())
      renderer.dispose()
      canvas.style.opacity = '0'
    }
  }, [car])

  return (
    <div className="car-preview-3d" role="img" aria-label={`${car.name} 3D preview`}>
      <CarSilhouette car={car} />
      <canvas ref={canvasRef} aria-hidden="true" />
    </div>
  )
}
