import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const reference = process.argv[2] ?? process.env.GITHUB_REF_NAME ?? ''
const version = reference.replace(/^v/, '')

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error('Provide a release version or tag in the form 1.0.0 or v1.0.0.')
}

const manifests = [
  'package.json',
  'packages/core/package.json',
  'packages/reporters/package.json',
  'packages/cli/package.json',
  'packages/trashtests/package.json',
  'packages/github-action/package.json',
]

const mismatches = manifests.flatMap((path) => {
  const manifest = JSON.parse(readFileSync(resolve(root, path), 'utf8'))
  return manifest.version === version
    ? []
    : [`${path}: expected ${version}, found ${manifest.version}`]
})

if (mismatches.length > 0) {
  throw new Error(`Release version mismatch:\n${mismatches.join('\n')}`)
}

console.log(`Release version ${version} matches all public package manifests.`)
