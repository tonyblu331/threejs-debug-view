import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { gzipSync } from "node:zlib"

const root = process.cwd()
const distDir = join(root, "dist")

function collectJavaScriptFiles(directory) {
  const files = []

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)

    if (entry.isDirectory()) {
      files.push(...collectJavaScriptFiles(path))
      continue
    }

    if (entry.name.endsWith(".js")) {
      files.push(path)
    }
  }

  return files
}

export function measurePublishedBundleGzip(directory = distDir) {
  const files = collectJavaScriptFiles(directory)
  let rawBytes = 0
  let gzipBytes = 0

  for (const file of files) {
    const contents = readFileSync(file)
    rawBytes += contents.length
    gzipBytes += gzipSync(contents).length
  }

  const gzipKilobytes = Math.round(gzipBytes / 1024)

  return {
    fileCount: files.length,
    rawBytes,
    gzipBytes,
    gzipKilobytes,
    badgeLabel: `${gzipKilobytes} kB`,
    badgeUrl: `https://img.shields.io/badge/library_gzip-${gzipKilobytes}_kB-007ec6`,
    files: files.map((file) => relative(root, file)),
  }
}

function readMeasuredBadgeUrl(readmePath) {
  const readme = readFileSync(readmePath, "utf8")
  const match = readme.match(
    /!\[[^\]]*\]\((https:\/\/img\.shields\.io\/badge\/library_gzip-\d+_kB-007ec6)\)/,
  )

  return match?.[1]
}

export function assertReadmeBundleBadge(readmePath = join(root, "README.md")) {
  const measurement = measurePublishedBundleGzip()
  const badgeUrl = readMeasuredBadgeUrl(readmePath)

  if (!badgeUrl) {
    throw new Error("README.md is missing the library gzip shields badge.")
  }

  if (badgeUrl !== measurement.badgeUrl) {
    throw new Error(
      `README bundle badge is stale. Expected ${measurement.badgeUrl}, found ${badgeUrl}.`,
    )
  }

  return measurement
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  const measurement = measurePublishedBundleGzip()
  console.log(
    `Published ESM surface: ${measurement.fileCount} files, ${measurement.rawBytes} bytes raw, ${measurement.gzipBytes} bytes gzip (${measurement.badgeLabel})`,
  )
  console.log(measurement.badgeUrl)
}
