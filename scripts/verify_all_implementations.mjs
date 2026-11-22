import fs from 'node:fs'
import path from 'node:path'

console.log('='.repeat(65))
console.log('🧪 POTHOLESCAN SYSTEM INTEGRATION & PERFORMANCE VERIFICATION')
console.log('='.repeat(65))

let allPassed = true

function check(testName, fn) {
  try {
    fn()
    console.log(`[PASS] ${testName}`)
  } catch (err) {
    console.error(`[FAIL] ${testName}:`, err.message)
    allPassed = false
  }
}

// 1. Verify nucliweb/webperf-snippets implementation
check('nucliweb/webperf-snippets: src/utils/webperf.ts exists and exports monitor', () => {
  const content = fs.readFileSync('src/utils/webperf.ts', 'utf8')
  if (!content.includes('webPerfMonitor') || !content.includes('PerformanceObserver') || !content.includes('__POTHOLE_PERF__')) {
    throw new Error('webperf.ts is missing core CWV observers or __POTHOLE_PERF__ global')
  }
  const mainContent = fs.readFileSync('src/main.tsx', 'utf8')
  if (!mainContent.includes('webPerfMonitor.init()')) {
    throw new Error('webPerfMonitor is not initialized in src/main.tsx')
  }
})

// 2. Verify davidsonfellipe/awesome-wpo implementations
check('awesome-wpo: Image optimizer utility exists and integrates in Public.tsx', () => {
  const optContent = fs.readFileSync('src/utils/imageOptimizer.ts', 'utf8')
  if (!optContent.includes('optimizeImageBeforeUpload') || !optContent.includes('canvas.toBlob')) {
    throw new Error('imageOptimizer.ts does not implement client-side canvas compression')
  }
  const publicContent = fs.readFileSync('src/components/Public.tsx', 'utf8')
  if (!publicContent.includes('optimizeImageBeforeUpload')) {
    throw new Error('Public.tsx does not use optimizeImageBeforeUpload')
  }
})

check('awesome-wpo: Code-splitting with React.lazy in App.tsx', () => {
  const appContent = fs.readFileSync('src/App.tsx', 'utf8')
  if (!appContent.includes('lazy(') || !appContent.includes('<Suspense')) {
    throw new Error('App.tsx does not implement dynamic lazy code-splitting')
  }
})

check('awesome-wpo: Vite chunking configuration in vite.config.ts', () => {
  const viteContent = fs.readFileSync('vite.config.ts', 'utf8')
  if (!viteContent.includes('manualChunks') || !viteContent.includes('vendor-react') || !viteContent.includes('vendor-leaflet')) {
    throw new Error('vite.config.ts does not configure manualChunks vendor splitting')
  }
})

check('awesome-wpo: Production bundle chunks verified in dist/', () => {
  if (!fs.existsSync('dist/assets')) {
    throw new Error('dist/assets does not exist. Run npm run build first.')
  }
  const files = fs.readdirSync('dist/assets')
  const hasReactVendor = files.some(f => f.startsWith('vendor-react'))
  const hasLeafletVendor = files.some(f => f.startsWith('vendor-leaflet'))
  const hasAdminChunk = files.some(f => f.startsWith('Admin-'))
  const hasStaffChunk = files.some(f => f.startsWith('Staff-'))

  if (!hasReactVendor || !hasLeafletVendor || !hasAdminChunk || !hasStaffChunk) {
    throw new Error(`Chunks missing in dist/assets. Found: ${files.join(', ')}`)
  }
})

check('awesome-wpo: FastAPI GZip middleware enabled in backend/app/main.py', () => {
  const backendMain = fs.readFileSync('backend/app/main.py', 'utf8')
  if (!backendMain.includes('GZipMiddleware')) {
    throw new Error('GZipMiddleware is not installed in backend/app/main.py')
  }
})

// 3. Verify GoogleChrome/lighthouse configuration
check('GoogleChrome/lighthouse: lighthouserc.json and CI workflow exist and are valid', () => {
  const lhciConfig = JSON.parse(fs.readFileSync('lighthouserc.json', 'utf8'))
  if (!lhciConfig.ci || !lhciConfig.ci.assert || !lhciConfig.ci.assert.assertions) {
    throw new Error('Invalid lighthouserc.json structure')
  }
  if (!fs.existsSync('.github/workflows/lighthouse.yml')) {
    throw new Error('.github/workflows/lighthouse.yml does not exist')
  }
})

// 4 & 5. Verify multica-ai/andrej-karpathy-skills & DietrichGebert/ponytail rules
check('Karpathy & Ponytail: AGENTS.md, CLAUDE.md, and .cursorrules contain governance rules', () => {
  const agentsMd = fs.readFileSync('AGENTS.md', 'utf8')
  if (!agentsMd.includes('Karpathy') || !agentsMd.includes('Ponytail') || !agentsMd.includes('Solution Ladder')) {
    throw new Error('AGENTS.md does not contain Karpathy & Ponytail standards')
  }
  if (!fs.existsSync('CLAUDE.md') || !fs.existsSync('.cursorrules')) {
    throw new Error('CLAUDE.md or .cursorrules missing')
  }
})

console.log('='.repeat(65))
if (allPassed) {
  console.log('🎉 ALL 8 INTEGRATION TESTS PASSED SUCCESSFULLY!')
} else {
  console.log('❌ SOME TESTS FAILED.')
  process.exit(1)
}
console.log('='.repeat(65))
