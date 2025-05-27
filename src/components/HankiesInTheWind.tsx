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
  const [wandMode, setWandMode] = useState(false)
  const sparkleCanvasRef = useRef<HTMLCanvasElement>(null)
  const [sparklePos, setSparklePos] = useState<{x: number, y: number} | null>(null)

  // UI controls state
  const DEFAULT_FREQUENCY = 2.5;
  const DEFAULT_AMPLITUDE = 0.4;
  const DEFAULT_NUM_SOURCES = 5;
  const DEFAULT_ANIMATION_SPEED = 0.0006;
  const [frequency, setFrequency] = useState(DEFAULT_FREQUENCY)
  const [amplitude, setAmplitude] = useState(DEFAULT_AMPLITUDE)
  const [numSources, setNumSources] = useState(DEFAULT_NUM_SOURCES)
  const [animationSpeed, setAnimationSpeed] = useState(DEFAULT_ANIMATION_SPEED)

  const [controlsCollapsed, setControlsCollapsed] = useState(false)

  const handleReset = () => {
    setFrequency(DEFAULT_FREQUENCY)
    setAmplitude(DEFAULT_AMPLITUDE)
    setNumSources(DEFAULT_NUM_SOURCES)
    setAnimationSpeed(DEFAULT_ANIMATION_SPEED)
  }

  // Sparkle effect (must be at top level, not inside another hook)
  useEffect(() => {
    if (!wandMode || !sparkleCanvasRef.current) return
    const canvas = sparkleCanvasRef.current
    const ctx = canvas.getContext('2d')
    let animationId: number
    function drawSparkles() {
      if (!ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (sparklePos) {
        for (let i = 0; i < 12; i++) {
          const angle = (Math.PI * 2 * i) / 12 + Math.random() * 0.2
          const r = 12 + Math.random() * 8
          const x = sparklePos.x + Math.cos(angle) * r
          const y = sparklePos.y + Math.sin(angle) * r
          ctx.beginPath()
          ctx.arc(x, y, 2 + Math.random() * 2, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(255, 200, 255, ${0.7 + Math.random() * 0.3})`
          ctx.shadowColor = '#ff00cc'
          ctx.shadowBlur = 8
          ctx.fill()
        }
      }
      animationId = requestAnimationFrame(drawSparkles)
    }
    drawSparkles()
    return () => {
      cancelAnimationFrame(animationId)
      ctx && ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  }, [wandMode, sparklePos])

  // Responsive effect: collapse controls by default on mobile
  useEffect(() => {
    const checkMobile = () => {
      if (window.innerWidth < 700) {
        setControlsCollapsed(true)
      } else {
        setControlsCollapsed(false)
      }
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

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
      time += animationSpeed

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
        frequency: frequency + 1,
        amplitude: amplitude + 0.1,
        phase: 0
      })
      if (wandMode) {
        setSparklePos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
      }
    }
    const handlePointerLeave = () => {
      setMouseSource(null)
      setSparklePos(null)
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
        frequency: frequency + 1,
        amplitude: amplitude + 0.1,
        phase: 0
      })
      if (wandMode) {
        setSparklePos({ x: touch.clientX - rect.left, y: touch.clientY - rect.top })
      }
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
        frequency: frequency + 1,
        amplitude: amplitude + 0.1,
        phase: 0
      })
      if (wandMode) {
        setSparklePos({ x: touch.clientX - rect.left, y: touch.clientY - rect.top })
      }
    }
    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault()
      setMouseSource(null)
      setSparklePos(null)
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
  }, [currentZoom, mouseSource, frequency, amplitude, numSources, animationSpeed, wandMode])

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
        position: 'relative',
      }}>
        <button
          onClick={() => setControlsCollapsed(c => !c)}
          style={{
            display: 'inline-block',
            position: 'absolute', left: 8, top: 8, zIndex: 3,
            background: '#f7f7f7', border: '1px solid #ccc', borderRadius: 4, padding: '4px 10px', fontWeight: 600, cursor: 'pointer',
            fontSize: 18,
          }}
        >
          {controlsCollapsed ? '☰ Show Controls' : '× Hide Controls'}
        </button>
        <div style={{ display: controlsCollapsed ? 'none' : 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap', width: '100%', justifyContent: 'center' }}>
          <button onClick={() => setWandMode(w => !w)} style={{ padding: '6px 16px', fontWeight: 600, borderRadius: 4, border: '1px solid #ccc', background: wandMode ? '#ffe6fa' : '#f7f7f7', cursor: 'pointer', color: wandMode ? '#c800a1' : undefined }}>
            {wandMode ? '🪄 Magic Wand On' : '🪄 Magic Wand Off'}
          </button>
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
          <label>
            Animation Speed: <input type="range" min={0.0001} max={0.1} step={0.0001} value={animationSpeed} onChange={e => setAnimationSpeed(Number(e.target.value))} /> {animationSpeed.toFixed(4)}
          </label>
        </div>
      </div>
      <div ref={containerRef} style={{ width: '100%', flex: 1, height: '100%', position: 'relative', cursor: wandMode ? 'url("data:image/svg+xml,%3Csvg width=\'32\' height=\'32\' viewBox=\'0 0 32 32\' fill=\'none\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Crect x=\'13\' y=\'2\' width=\'6\' height=\'20\' rx=\'3\' fill=\'%23c800a1\'/%3E%3Ccircle cx=\'16\' cy=\'4\' r=\'4\' fill=\'%23ffb3f6\'/%3E%3C/svg%3E%22) 0 32, auto' : undefined }}>
        {/* Sparkle overlay canvas */}
        {wandMode && <canvas ref={sparkleCanvasRef} width={containerRef.current?.clientWidth || 1} height={containerRef.current?.clientHeight || 1} style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }} />}
      </div>
    </div>
  )
}

export default HankiesInTheWind 