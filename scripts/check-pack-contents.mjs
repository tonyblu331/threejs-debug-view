import { execSync } from "node:child_process"
import { readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { assertReadmeBundleBadge } from "./measure-bundle-size.mjs"

const root = process.cwd()
const allowedEntries = new Set([
  "package/dist/",
  "package/LICENSE",
  "package/README.md",
  "package/package.json",
])

const forbiddenPatterns = [
  /^package\/src\//,
  /^package\/demo\//,
  /^package\/packages\//,
  /^package\/tests\//,
  /^package\/components\//,
  /^package\/assets\//,
  /^package\/public\//,
  /^package\/index\.html$/,
  /^package\/vite(\.|$)/,
  /^package\/playwright/,
]

function getLatestTarball(directory) {
  return readdirSync(directory)
    .filter((name) => name.endsWith(".tgz"))
    .map((name) => ({ name, mtime: statSync(join(directory, name)).mtimeMs }))
    .sort((left, right) => right.mtime - left.mtime)[0]?.name
}

function listTarballEntries(tarballPath) {
  return execSync(`tar -tf "${tarballPath}"`, { encoding: "utf8" })
    .split(/\r?\n/)
    .filter(Boolean)
}

const packedName = execSync("pnpm pack --pack-destination .", {
  cwd: root,
  encoding: "utf8",
})
  .trim()
  .split(/\r?\n/)
  .at(-1)
  ?.trim()

const tarballPath = join(root, packedName ?? getLatestTarball(root) ?? "")
if (!tarballPath.endsWith(".tgz")) {
  throw new Error("Could not locate npm pack tarball.")
}

const entries = listTarballEntries(tarballPath)
const violations = []

for (const entry of entries) {
  const allowed = [...allowedEntries].some((prefix) => entry.startsWith(prefix) || entry === prefix.slice(0, -1))
  const forbidden = forbiddenPatterns.some((pattern) => pattern.test(entry))

  if (!allowed || forbidden) {
    violations.push(entry)
  }
}

if (violations.length > 0) {
  console.error("npm pack contains files outside the library publish surface:")
  for (const entry of violations) {
    console.error(`  - ${entry}`)
  }
  process.exit(1)
}

console.log(`Pack surface OK (${entries.length} entries in ${tarballPath.split(/[/\\]/).at(-1)})`)

const measurement = assertReadmeBundleBadge(join(root, "README.md"))
console.log(`Bundle badge OK (${measurement.badgeLabel} published ESM gzip)`)
