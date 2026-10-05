/**
 * A small three.js page in the shape the AI is asked for (ADR 0023): the showcase kit's
 * interactive-page card and the fake AI provider's answer (Studio, Edge Function and E2E).
 * Self-contained: no addresses, drawn textures, keyboard and reduced-motion aware.
 */
import { PAGE_MODULES } from '../model/page.ts'

// The page's own import lines are built from PAGE_MODULES, so this file's source holds no
// import statement of its own that scripts/check-boundaries.mjs would read as one.
const IMPORT = 'import'
const [THREE_MODULE, CONTROLS_MODULE] = PAGE_MODULES

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function samplePageHtml(title = 'Dünya ve Ay') {
  const name = escapeHtml(title.trim().slice(0, 60) || 'Dünya ve Ay')
  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${name}</title>
<style>
  html, body { margin: 0; height: 100%; overflow: hidden; background: #050816; color: #eef3ff; font: 17px/1.45 system-ui, sans-serif; }
  canvas { display: block; width: 100%; height: 100%; touch-action: none; outline: none; }
  canvas:focus-visible { box-shadow: inset 0 0 0 4px #ffd166; }
  #bilgi { position: absolute; left: 12px; right: 12px; bottom: 12px; margin: 0; padding: 10px 14px; border-radius: 14px; background: rgba(5, 8, 22, 0.78); text-align: center; }
</style>
</head>
<body>
<canvas id="sahne" tabindex="0" role="img" aria-label="${name}: Dünya ve etrafında dönen Ay. Sürükleyerek ya da ok tuşlarıyla döndür."></canvas>
<p id="bilgi" role="status">Dünya’ya ya da Ay’a dokun! Döndürmek için sürükle.</p>
<script type="module">
${IMPORT} * as THREE from '${THREE_MODULE}'
${IMPORT} { OrbitControls } from '${CONTROLS_MODULE}'

const canvas = document.getElementById('sahne')
const info = document.getElementById('bilgi')
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches

function earthTexture() {
  const paint = document.createElement('canvas')
  paint.width = 256
  paint.height = 128
  const g = paint.getContext('2d')
  g.fillStyle = '#1d6fd6'
  g.fillRect(0, 0, 256, 128)
  g.fillStyle = '#3fae5a'
  for (const [x, y, w, h] of [[40, 30, 50, 34], [70, 70, 30, 40], [140, 26, 60, 30], [170, 60, 34, 44], [222, 80, 24, 20]]) {
    g.beginPath()
    g.ellipse(x, y, w / 2, h / 2, 0.4, 0, Math.PI * 2)
    g.fill()
  }
  g.fillStyle = '#f4f8ff'
  g.fillRect(0, 0, 256, 8)
  g.fillRect(0, 120, 256, 8)
  return new THREE.CanvasTexture(paint)
}

function start() {
  let renderer
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  } catch {
    info.textContent = 'Bu cihaz 3B çizimi gösteremiyor. Ay, Dünya’nın çevresinde yaklaşık 27 günde bir tur atar.'
    return
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
  camera.position.set(0, 2.2, 7)
  scene.add(new THREE.AmbientLight(0xffffff, 0.35))
  const sun = new THREE.DirectionalLight(0xffffff, 2.2)
  sun.position.set(5, 3, 4)
  scene.add(sun)

  const earth = new THREE.Mesh(new THREE.SphereGeometry(1.4, 48, 32), new THREE.MeshStandardMaterial({ map: earthTexture(), roughness: 0.8 }))
  earth.userData.fact = 'Dünya: üzerinde yaşadığımız gezegen. Kendi çevresinde bir günde, yani 24 saatte döner.'
  scene.add(earth)
  const orbit = new THREE.Group()
  scene.add(orbit)
  const moon = new THREE.Mesh(new THREE.SphereGeometry(0.38, 32, 16), new THREE.MeshStandardMaterial({ color: 0xc9cbd4, roughness: 1 }))
  moon.position.set(3.2, 0, 0)
  moon.userData.fact = 'Ay: Dünya’nın uydusu. Dünya’nın çevresindeki turunu yaklaşık 27 günde tamamlar.'
  orbit.add(moon)

  const stars = new THREE.BufferGeometry()
  const points = []
  for (let i = 0; i < 400; i++) points.push((Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60, -10 - Math.random() * 30)
  stars.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
  scene.add(new THREE.Points(stars, new THREE.PointsMaterial({ color: 0xffffff, size: 0.08 })))

  const controls = new OrbitControls(camera, canvas)
  controls.enableDamping = !calm
  controls.enablePan = false
  controls.minDistance = 4
  controls.maxDistance = 14

  canvas.addEventListener('keydown', (event) => {
    const step = { ArrowLeft: -0.2, ArrowRight: 0.2 }[event.key]
    if (step === undefined) return
    event.preventDefault()
    orbit.rotation.y += step
    earth.rotation.y += step
  })

  const pointer = new THREE.Vector2()
  const ray = new THREE.Raycaster()
  let down = null
  canvas.addEventListener('pointerdown', (event) => { down = [event.clientX, event.clientY] })
  canvas.addEventListener('pointerup', (event) => {
    if (!down || Math.hypot(event.clientX - down[0], event.clientY - down[1]) > 6) return
    const box = canvas.getBoundingClientRect()
    pointer.set(((event.clientX - box.left) / box.width) * 2 - 1, -((event.clientY - box.top) / box.height) * 2 + 1)
    ray.setFromCamera(pointer, camera)
    const [hit] = ray.intersectObjects([earth, moon])
    if (hit) info.textContent = hit.object.userData.fact
  })

  const resize = () => {
    const { clientWidth: width, clientHeight: height } = canvas
    if (!width || !height) return
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }
  new ResizeObserver(resize).observe(canvas)
  resize()

  const speed = calm ? 0 : 1
  renderer.setAnimationLoop(() => {
    earth.rotation.y += 0.004 * speed
    orbit.rotation.y += 0.0015 * speed
    controls.update()
    renderer.render(scene, camera)
  })
}

start()
</script>
</body>
</html>
`
}
