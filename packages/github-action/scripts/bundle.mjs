import { execFileSync } from 'node:child_process'
import { readdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const distDir = join(packageRoot, 'dist')
const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'

function removeSourceMaps(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name)
    if (entry.isDirectory()) {
      removeSourceMaps(entryPath)
    } else if (entry.name.endsWith('.map')) {
      rmSync(entryPath)
    }
  }
}

rmSync(distDir, { recursive: true, force: true })
execFileSync(pnpmCommand, ['exec', 'ncc', 'build', 'src/index.ts', '-o', 'dist', '--minify'], {
  cwd: packageRoot,
  stdio: 'inherit',
})
removeSourceMaps(distDir)
