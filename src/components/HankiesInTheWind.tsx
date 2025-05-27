import React, { useRef, useEffect, useState } from 'react'
import * as THREE from 'three'

interface WaveSourceProps {
  position: [number, number, number]
  frequency: number
  amplitude: number
  phase: number
}

interface HankiesInTheWindProps {
  initialZoom?: number;
}

const HankiesInTheWind: React.FC<HankiesInTheWindProps> = ({ initialZoom = 6 }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [currentZoom] = useState(initialZoom)
  const [mouseSource, setMouseSource] = useState<WaveSourceProps | null>(null)

  // UI controls state
  const DEFAULT_FREQUENCY = 2.5;
  const DEFAULT_AMPLITUDE = 0.4;
  const DEFAULT_NUM_SOURCES = 5;
  const [frequency, setFrequency] = useState(DEFAULT_FREQUENCY)
  const [amplitude, setAmplitude] = useState(DEFAULT_AMPLITUDE)
  const [numSources, setNumSources] = useState(DEFAULT_NUM_SOURCES)

  const handleReset = () => {
    setFrequency(DEFAULT_FREQUENCY)
    setAmplitude(DEFAULT_AMPLITUDE)
    setNumSources(DEFAULT_NUM_SOURCES)
  }

  useEffect(() => {
    if (!containerRef.current) return

    let animationFrameId: number | null = null
    let scene: any = null
    let camera: any = null
    let renderer: any = null
    let lineGroups: any[] = []
    let cameraZoom = currentZoom

    const createWaveSources = (time: number, scale: number): WaveSourceProps[] => {
      const result: WaveSourceProps[] = []
      const count = numSources
      
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2
        const radius = scale * (1 + Math.sin(angle * 3) * 0.2)
        
        result.push({
          position: [
            Math.cos(angle) * radius,
            0,
            Math.sin(angle) * radius
          ],
          frequency: frequency + Math.sin(angle * 2),
          amplitude: amplitude + Math.cos(angle) * 0.1,
          phase: time * 3 + angle
        })
      }
      
      result.push({
        position: [0, 0, 0],
        frequency: frequency + 1,
        amplitude: amplitude + 0.1,
        phase: time * 4
      })
      
      if (mouseSource) {
        result.push(mouseSource)
      }
      
      return result
    }

    const createInterferenceField = (sources: WaveSourceProps[], size: number, resolution: number, time: number) => {
      const step = size / resolution
      const heightMap: number[][] = []
      
      for (let i = 0; i <= resolution; i++) {
        heightMap[i] = []
        const x = (i * step) - (size / 2)
        
        for (let j = 0; j <= resolution; j++) {
          const z = (j * step) - (size / 2)
          let height = 0
          
          sources.forEach(({ position: [sx, , sz], frequency, amplitude, phase }) => {
            const dx = x - sx
            const dz = z - sz
            const distance = Math.sqrt(dx * dx + dz * dz)
            height += Math.sin(distance * frequency - time * 5 + phase) * amplitude * Math.exp(-distance * 0.3)
          })
          
          heightMap[i][j] = height
        }
      }

      // Default material for regular sources
      const linesMaterial = new THREE.LineBasicMaterial({
        color: 0x333333,
        transparent: true,
        opacity: 0.4
      })
      // Special material for mouse source
      const mouseMaterial = new THREE.LineBasicMaterial({
        color: 0xff00cc, // Vibrant magenta
        transparent: true,
        opacity: 0.85,
        linewidth: 3 // Note: linewidth only works in some environments
      })

      const linesGroup = new THREE.Group()
      lineGroups.push(linesGroup)

      // Helper to determine if a point is closest to the mouse source
      const isMouseSource = (x: number, z: number) => {
        if (!mouseSource) return false
        const [mx, , mz] = mouseSource.position
        const dist = Math.sqrt((x - mx) ** 2 + (z - mz) ** 2)
        return dist < step * 1.5 // Highlight lines near the mouse
      }

      for (let i = 0; i <= resolution; i++) {
        const geometry = new THREE.BufferGeometry()
        const points = []
        const x = (i * step) - (size / 2)
        for (let j = 0; j <= resolution; j++) {
          const z = (j * step) - (size / 2)
          points.push(x, heightMap[i][j], z)
        }
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
        // Use mouse material if this line is near the mouse
        const material = isMouseSource(x, 0) ? mouseMaterial : linesMaterial
        const line = new THREE.Line(geometry, material)
        linesGroup.add(line)
      }

      for (let j = 0; j <= resolution; j++) {
        const geometry = new THREE.BufferGeometry()
        const points = []
        const z = (j * step) - (size / 2)
        for (let i = 0; i <= resolution; i++) {
          const x = (i * step) - (size / 2)
          points.push(x, heightMap[i][j], z)
        }
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
        const material = isMouseSource(0, z) ? mouseMaterial : linesMaterial
        const line = new THREE.Line(geometry, material)
        linesGroup.add(line)
      }

      for (let i = 1; i < resolution; i++) {
        for (let j = 1; j < resolution; j++) {
          const x = (i * step) - (size / 2)
          const z = (j * step) - (size / 2)
          const height = heightMap[i][j]
          const heightDiff = Math.abs(
            height - (heightMap[i-1][j] + heightMap[i+1][j] + heightMap[i][j-1] + heightMap[i][j+1]) / 4
          )
          if (heightDiff > 0.2) {
            const geometry1 = new THREE.BufferGeometry()
            const points1 = [
              x - step/2, height, z - step/2,
              x + step/2, height, z + step/2
            ]
            geometry1.setAttribute('position', new THREE.Float32BufferAttribute(points1, 3))
            const material1 = isMouseSource(x, z) ? mouseMaterial : linesMaterial
            const line1 = new THREE.Line(geometry1, material1)
            linesGroup.add(line1)

            const geometry2 = new THREE.BufferGeometry()
            const points2 = [
              x - step/2, height, z + step/2,
              x + step/2, height, z - step/2
            ]
            geometry2.setAttribute('position', new THREE.Float32BufferAttribute(points2, 3))
            const material2 = isMouseSource(x, z) ? mouseMaterial : linesMaterial
            const line2 = new THREE.Line(geometry2, material2)
            linesGroup.add(line2)
          }
        }
      }

      return linesGroup
    }

    const container = containerRef.current
    const width = container.clientWidth
    const height = container.clientHeight
    const dpr = window.devicePixelRatio || 1

    scene = new THREE.Scene()
    camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000)
    renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(dpr, 2))
    renderer.setSize(width, height)
    renderer.setClearColor(0xF0EEE6)
    container.appendChild(renderer.domElement)

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6)
    directionalLight.position.set(5, 5, 5)
    const pointLight = new THREE.PointLight(0xffffff, 0.4)
    pointLight.position.set(-5, 3, -5)

    scene.add(ambientLight)
    scene.add(directionalLight)
    scene.add(pointLight)

    camera.position.set(0, 0, cameraZoom)
    camera.lookAt(0, 0, 0)

    const mainGroup = new THREE.Group()
    scene.add(mainGroup)

    let time = 0

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate)
      time += 0.0006

      mainGroup.children.forEach((child: any) => {
        if (child instanceof THREE.Group) {
          child.children.forEach((line: any) => {
            if (line.geometry) line.geometry.dispose()
            if (line.material) line.material.dispose()
          })
          mainGroup.remove(child)
        }
      })

      lineGroups = []

      const sources1 = createWaveSources(time, 1.5)
      const field1 = createInterferenceField(sources1, 1.5 * 4, 32, time)
      mainGroup.add(field1)

      const sources2 = createWaveSources(time + 0.33, 0.8)
      const field2 = createInterferenceField(sources2, 0.8 * 4, 32, time + 0.33)
      field2.position.set(0, 1.5, 0)
      field2.rotation.set(Math.PI/6, 0, Math.PI/4)
      mainGroup.add(field2)

      const sources3 = createWaveSources(time + 0.66, 0.8)
      const field3 = createInterferenceField(sources3, 0.8 * 4, 32, time + 0.66)
      field3.position.set(0, -1.5, 0)
      field3.rotation.set(-Math.PI/6, 0, -Math.PI/4)
      mainGroup.add(field3)

      mainGroup.rotation.y = Math.sin(time * 0.3) * 0.2
      mainGroup.rotation.x = Math.cos(time * 0.2) * 0.1

      renderer.render(scene, camera)
    }

    animate()

    const handleResize = () => {
      if (!containerRef.current) return
      const width = containerRef.current.clientWidth
      const height = containerRef.current.clientHeight
      const dpr = window.devicePixelRatio || 1

      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setPixelRatio(Math.min(dpr, 2))
      renderer.setSize(width, height)
    }

    window.addEventListener('resize', handleResize)

    // Mouse interaction handlers
    const handlePointerMove = (e: MouseEvent) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1)
      // Project mouse to visualization plane (z=0)
      const size = 1.5 * 4
      const posX = x * (size / 2)
      const posZ = y * (size / 2)
      setMouseSource({
        position: [posX, 0, posZ],
        frequency: 3.5,
        amplitude: 0.5,
        phase: 0
      })
    }
    const handlePointerLeave = () => {
      setMouseSource(null)
    }
    // Touch interaction handlers
    const handleTouchStart = (e: TouchEvent) => {
      if (!containerRef.current) return
      if (e.touches.length === 0) return
      e.preventDefault()
      const touch = e.touches[0]
      const rect = containerRef.current.getBoundingClientRect()
      const x = ((touch.clientX - rect.left) / rect.width) * 2 - 1
      const y = -(((touch.clientY - rect.top) / rect.height) * 2 - 1)
      const size = 1.5 * 4
      const posX = x * (size / 2)
      const posZ = y * (size / 2)
      setMouseSource({
        position: [posX, 0, posZ],
        frequency: 3.5,
        amplitude: 0.5,
        phase: 0
      })
    }
    const handleTouchMove = (e: TouchEvent) => {
      if (!containerRef.current) return
      if (e.touches.length === 0) return
      e.preventDefault()
      const touch = e.touches[0]
      const rect = containerRef.current.getBoundingClientRect()
      const x = ((touch.clientX - rect.left) / rect.width) * 2 - 1
      const y = -(((touch.clientY - rect.top) / rect.height) * 2 - 1)
      const size = 1.5 * 4
      const posX = x * (size / 2)
      const posZ = y * (size / 2)
      setMouseSource({
        position: [posX, 0, posZ],
        frequency: 3.5,
        amplitude: 0.5,
        phase: 0
      })
    }
    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault()
      setMouseSource(null)
    }
    container.addEventListener('pointermove', handlePointerMove)
    container.addEventListener('pointerleave', handlePointerLeave)
    container.addEventListener('touchstart', handleTouchStart, { passive: false })
    container.addEventListener('touchmove', handleTouchMove, { passive: false })
    container.addEventListener('touchend', handleTouchEnd, { passive: false })

    return () => {
      window.removeEventListener('resize', handleResize)
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
      }
      if (renderer) {
        renderer.dispose()
      }
      if (container && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
      container.removeEventListener('pointermove', handlePointerMove)
      container.removeEventListener('pointerleave', handlePointerLeave)
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
    }
  }, [currentZoom, mouseSource, frequency, amplitude, numSources])

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        background: '#fff',
        padding: '12px 16px',
        borderBottom: '1px solid #eee',
        zIndex: 2,
        display: 'flex',
        gap: '24px',
        alignItems: 'center',
        flexWrap: 'wrap',
      }}>
        <button onClick={handleReset} style={{ padding: '6px 16px', fontWeight: 600, borderRadius: 4, border: '1px solid #ccc', background: '#f7f7f7', cursor: 'pointer' }}>
          Reset to Defaults
        </button>
        <label>
          Frequency: <input type="range" min={1} max={6} step={0.01} value={frequency} onChange={e => setFrequency(Number(e.target.value))} /> {frequency.toFixed(2)}
        </label>
        <label>
          Amplitude: <input type="range" min={0.1} max={1} step={0.01} value={amplitude} onChange={e => setAmplitude(Number(e.target.value))} /> {amplitude.toFixed(2)}
        </label>
        <label>
          Sources: <input type="range" min={2} max={12} step={1} value={numSources} onChange={e => setNumSources(Number(e.target.value))} /> {numSources}
        </label>
      </div>
      <div ref={containerRef} style={{ width: '100%', flex: 1, height: '100%' }} />
    </div>
  )
}

export default HankiesInTheWind 