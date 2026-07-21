import { readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

const releaseKinds = new Set(["patch", "minor", "major"])

function parseChromeVersion(value) {
  const text = String(value)
  const rawParts = text.split(".")
  if (rawParts.length < 1 || rawParts.length > 4) {
    throw new Error(`Invalid Chrome extension version: ${text}`)
  }
  const parts = rawParts.map((part) => {
    if (!/^\d+$/.test(part) || (part.length > 1 && part.startsWith("0"))) {
      throw new Error(`Invalid Chrome extension version: ${text}`)
    }
    const number = Number(part)
    if (number > 65535) {
      throw new Error(`Invalid Chrome extension version: ${text}`)
    }
    return number
  })
  if (parts.every((part) => part === 0)) {
    throw new Error(`Invalid Chrome extension version: ${text}`)
  }
  return parts
}

function nextVersion(currentVersion, release) {
  if (!releaseKinds.has(release)) {
    parseChromeVersion(release)
    return release
  }

  const parts = parseChromeVersion(currentVersion)
  while (parts.length < 3) {
    parts.push(0)
  }
  const index = release === "major" ? 0 : release === "minor" ? 1 : 2
  if (parts[index] === 65535) {
    throw new Error(`Cannot bump ${release} version beyond 65535: ${currentVersion}`)
  }
  parts[index] += 1
  for (let right = index + 1; right < parts.length; right += 1) {
    parts[right] = 0
  }
  return parts.join(".")
}

function compareChromeVersions(left, right) {
  const leftParts = parseChromeVersion(left)
  const rightParts = parseChromeVersion(right)
  while (leftParts.length < 4) leftParts.push(0)
  while (rightParts.length < 4) rightParts.push(0)
  for (let index = 0; index < 4; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] - rightParts[index]
    }
  }
  return 0
}

export async function bumpVersion(root, release = "patch") {
  const packagePath = resolve(root, "package.json")
  const packageLockPath = resolve(root, "package-lock.json")
  const manifestPath = resolve(root, "manifest.config.ts")
  const [packageText, packageLockText, manifestText] = await Promise.all([
    readFile(packagePath, "utf8"),
    readFile(packageLockPath, "utf8"),
    readFile(manifestPath, "utf8")
  ])
  const packageJson = JSON.parse(packageText)
  const packageLock = JSON.parse(packageLockText)
  const manifestMatches = [...manifestText.matchAll(/\bversion:\s*"([^"]+)"/g)]
  if (manifestMatches.length !== 1) {
    throw new Error(`Expected exactly one version field in manifest.config.ts, found ${manifestMatches.length}`)
  }

  const packageVersion = String(packageJson.version ?? "")
  const lockVersion = String(packageLock.version ?? "")
  const rootLockVersion = String(packageLock.packages?.[""]?.version ?? "")
  const manifestVersion = manifestMatches[0][1]
  if (
    packageVersion !== lockVersion
    || packageVersion !== rootLockVersion
    || packageVersion !== manifestVersion
  ) {
    throw new Error(
      `Version sources are out of sync: package.json=${packageVersion}, package-lock.json=${lockVersion}, manifest.config.ts=${manifestVersion}`
    )
  }

  parseChromeVersion(packageVersion)
  const version = nextVersion(packageVersion, release)
  if (compareChromeVersions(version, packageVersion) <= 0) {
    throw new Error(
      `New version must be greater than current version: ${version} <= ${packageVersion}`
    )
  }
  packageJson.version = version
  packageLock.version = version
  packageLock.packages[""].version = version
  const nextManifestText = manifestText.replace(
    /\bversion:\s*"[^"]+"/,
    `version: "${version}"`
  )

  await Promise.all([
    writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`),
    writeFile(packageLockPath, `${JSON.stringify(packageLock, null, 2)}\n`),
    writeFile(manifestPath, nextManifestText)
  ])
  return { previousVersion: packageVersion, version }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : ""
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    const result = await bumpVersion(process.cwd(), process.argv[2] ?? "patch")
    console.log(`Version bumped: ${result.previousVersion} -> ${result.version}`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
