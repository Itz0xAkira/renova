/** Runs every headless simulation test in this folder, one process each, and stops at the first failure. */
import { execFileSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const files = readdirSync(here)
  .filter((f) => f.endsWith('.test.ts'))
  .sort()
let failed = 0
for (const f of files) {
  try {
    const out = execFileSync('npx', ['tsx', join(here, f)], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    const last = out.trim().split('\n').pop() ?? ''
    console.log(`✓ ${f}  ${last}`)
  } catch (e) {
    failed++
    const err = e as { stdout?: string; stderr?: string }
    console.log(`✗ ${f}\n${err.stdout ?? ''}${err.stderr ?? ''}`)
  }
}
console.log(failed ? `\n${failed} of ${files.length} failed` : `\nAll ${files.length} passed`)
process.exit(failed ? 1 : 0)
