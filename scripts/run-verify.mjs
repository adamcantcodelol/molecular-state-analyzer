/**
 * Cross-platform verify runner: bundles a scripts/verify-*.mts with esbuild
 * into a repo-local .tmp/ outfile (gitignored), then executes it.
 * Avoids hardcoded /tmp paths that break on Windows (Node resolves /tmp → C:\tmp).
 */
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const name = process.argv[2]
if (!name || !/^verify-[a-z0-9-]+$/.test(name)) {
  console.error('Usage: node scripts/run-verify.mjs verify-<name>')
  process.exit(2)
}

const tmpDir = join(root, '.tmp')
mkdirSync(tmpDir, { recursive: true })

const src = join(root, 'scripts', `${name}.mts`)
const out = join(tmpDir, `msa-${name}.mjs`)

const esbuild = spawnSync(
  'npx',
  [
    '--yes',
    'esbuild',
    src,
    '--bundle',
    '--platform=node',
    '--format=esm',
    `--outfile=${out}`,
  ],
  { stdio: 'inherit', cwd: root, shell: true, env: process.env },
)
if ((esbuild.status ?? 1) !== 0) process.exit(esbuild.status ?? 1)

const run = spawnSync(process.execPath, [out], {
  stdio: 'inherit',
  cwd: root,
  env: process.env,
})
process.exit(run.status ?? 1)
