import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { createCarModel } from '../engine/carModel.js'
import { disposeCarVisual, loadGlbCarModel } from '../engine/glbCar.js'
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

    const fallback = createCarModel(car)
    let activeGroup = fallback.group
    let cancelled = false
    scene.add(activeGroup)

    if (car.modelUrl) {
      loadGlbCarModel(car).then((loaded) => {
        if (cancelled || !loaded) {
          disposeCarVisual(loaded?.group)
          return
        }
        scene.remove(activeGroup)
        disposeCarVisual(activeGroup)
        activeGroup = loaded.group
        scene.add(activeGroup)
      }).catch((error) => {
        console.warn('GLB preview could not load; keeping the parametric model.', error)
      })
    }
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
      activeGroup.rotation.y = -0.42 + Math.sin(time * 0.00032) * 0.2
      renderer.render(scene, camera)
      canvas.style.opacity = '1'
      frame = requestAnimationFrame(render)
    }
    frame = requestAnimationFrame(render)

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      observer.disconnect()
      disposeCarVisual(activeGroup)
      if (activeGroup !== fallback.group) disposeCarVisual(fallback.group)
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
