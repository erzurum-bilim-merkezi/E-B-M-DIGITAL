// The three.js runtime the page runner gives interactive pages (ADR 0023). vite.config.ts bundles
// this entry into one self-contained module (page-runtime/three-<version>.js); the runner maps both
// import-map entries to it, so `import * as THREE from 'three'` and OrbitControls share one copy.
export * from 'three'
export { OrbitControls } from 'three/addons/controls/OrbitControls.js'
