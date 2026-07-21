import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { bumpVersion } from "../../scripts/bump-version.mjs"

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })))
})

async function createFixture(versions = { package: "0.1.3", lock: "0.1.3", manifest: "0.1.3" }) {
  const root = await mkdtemp(join(tmpdir(), "wiki-mermaid-preview-version-"))
  roots.push(root)
  await writeFile(
    join(root, "package.json"),
    `${JSON.stringify({ name: "wiki-mermaid-preview", version: versions.package }, null, 2)}\n`
  )
  await writeFile(
    join(root, "package-lock.json"),
    `${JSON.stringify({
      name: "wiki-mermaid-preview",
      version: versions.lock,
      lockfileVersion: 3,
      packages: { "": { name: "wiki-mermaid-preview", version: versions.lock } }
    }, null, 2)}\n`
  )
  await writeFile(
    join(root, "manifest.config.ts"),
    `export const extensionManifest = {\n  version: "${versions.manifest}"\n}\n`
  )
  return root
}

describe("bumpVersion", () => {
  it("increments the patch version in every version source", async () => {
    const root = await createFixture()

    const result = await bumpVersion(root, "patch")

    expect(result).toEqual({ previousVersion: "0.1.3", version: "0.1.4" })
    expect(JSON.parse(await readFile(join(root, "package.json"), "utf8")).version).toBe("0.1.4")
    const lock = JSON.parse(await readFile(join(root, "package-lock.json"), "utf8"))
    expect(lock.version).toBe("0.1.4")
    expect(lock.packages[""].version).toBe("0.1.4")
    expect(await readFile(join(root, "manifest.config.ts"), "utf8")).toContain('version: "0.1.4"')
  })

  it("rejects existing version drift without modifying files", async () => {
    const root = await createFixture({ package: "0.1.3", lock: "0.1.2", manifest: "0.1.3" })
    const before = await readFile(join(root, "package.json"), "utf8")

    await expect(bumpVersion(root, "patch")).rejects.toThrow(
      "Version sources are out of sync: package.json=0.1.3, package-lock.json=0.1.2, manifest.config.ts=0.1.3"
    )
    expect(await readFile(join(root, "package.json"), "utf8")).toBe(before)
  })

  it("supports minor, major, and explicit Chrome versions", async () => {
    const minorRoot = await createFixture()
    const majorRoot = await createFixture()
    const explicitRoot = await createFixture()

    await expect(bumpVersion(minorRoot, "minor")).resolves.toMatchObject({ version: "0.2.0" })
    await expect(bumpVersion(majorRoot, "major")).resolves.toMatchObject({ version: "1.0.0" })
    await expect(bumpVersion(explicitRoot, "2.10.2.4")).resolves.toMatchObject({ version: "2.10.2.4" })
  })

  it("rejects an explicit version that is not newer", async () => {
    const equalRoot = await createFixture()
    const lowerRoot = await createFixture()

    await expect(bumpVersion(equalRoot, "0.1.3")).rejects.toThrow(
      "New version must be greater than current version: 0.1.3 <= 0.1.3"
    )
    await expect(bumpVersion(lowerRoot, "0.1.2.9")).rejects.toThrow(
      "New version must be greater than current version: 0.1.2.9 <= 0.1.3"
    )
  })
})
