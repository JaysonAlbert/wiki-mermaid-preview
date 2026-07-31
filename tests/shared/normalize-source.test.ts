import mermaid from "mermaid"
import { describe, expect, it } from "vitest"
import { normalizeMermaidSource } from "../../src/shared/normalize-source"
import { mermaidRenderFailureFixtures } from "../fixtures/mermaid-render-failures"

describe("normalizeMermaidSource", () => {
  it.each(mermaidRenderFailureFixtures)("$name", async ({ source }) => {
    const normalizedSource = normalizeMermaidSource(source)

    await expect(mermaid.parse(normalizedSource)).resolves.toBeTruthy()
    expect(normalizedSource).toContain("as 期权")
    expect(normalizedSource).toContain("relatedOption")
  })
})
