import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const packageNames = ['core', 'reporters', 'cli', 'trashtests']
const workDir = mkdtempSync(join(tmpdir(), 'trashtests-package-smoke-'))
const tarballDir = join(workDir, 'tarballs')
const consumerDir = join(workDir, 'consumer')
const npmCli =
  process.platform === 'win32'
    ? resolve(process.execPath, '..', 'node_modules', 'npm', 'bin', 'npm-cli.js')
    : resolve(process.execPath, '..', '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js')
const pnpmCli = process.env.npm_execpath
if (!pnpmCli) {
  throw new Error('The smoke test must be run through pnpm so its CLI path is available.')
}

function run(command, args, cwd) {
  execFileSync(command, args, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, npm_config_ignore_scripts: 'true' },
  })
}

try {
  mkdirSync(tarballDir)
  for (const name of packageNames) {
    run(
      process.execPath,
      [pnpmCli, 'pack', '--pack-destination', tarballDir],
      join(root, 'packages', name),
    )
  }

  const tarballs = packageNames.map((name) => {
    const prefix = name === 'trashtests' ? 'trashtests-' : `trash-tests-${name}-`
    const matches = readdirSync(tarballDir)
      .filter((file) => file.startsWith(prefix) && file.endsWith('.tgz'))
      .map((file) => join(tarballDir, file))
    if (matches.length !== 1) {
      throw new Error(`Expected one tarball for ${name}; found ${matches.length}.`)
    }
    return matches[0]
  })

  mkdirSync(consumerDir)
  writeFileSync(
    join(consumerDir, 'package.json'),
    JSON.stringify({ name: 'trashtests-package-smoke', private: true, type: 'module' }, null, 2),
  )
  if (!existsSync(npmCli)) {
    throw new Error(`Could not locate npm-cli.js at ${npmCli}.`)
  }
  run(process.execPath, [npmCli, 'install', '--ignore-scripts', ...tarballs], consumerDir)

  const bin = join(
    consumerDir,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'trashtests.cmd' : 'trashtests',
  )
  const entrypoint = join(consumerDir, 'node_modules', 'trashtests', 'bin.js')
  if (!existsSync(bin) || !existsSync(entrypoint)) {
    throw new Error('The trashtests binary was not installed in the clean consumer project.')
  }
  run(process.execPath, [entrypoint, '--version'], consumerDir)
  run(process.execPath, [entrypoint, 'list-rules'], consumerDir)

  console.log(`\nPackage smoke test passed in ${consumerDir}`)
} finally {
  rmSync(workDir, { recursive: true, force: true })
}
