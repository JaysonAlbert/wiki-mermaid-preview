import { describe, expect, it } from "vitest"
import { looksLikeMermaid } from "../../src/shared/mermaid-detect"

describe("looksLikeMermaid", () => {
  it("accepts erDiagram blocks", () => {
    expect(looksLikeMermaid("erDiagram\nA ||--o{ B : maps")).toBe(true)
  })

  it("accepts leading init directives and comments", () => {
    expect(
      looksLikeMermaid(`%%{init: {"theme":"base"}}%%
%% a comment
flowchart TD
  A-->B`)
    ).toBe(true)
  })

  it("rejects plain sql", () => {
    expect(looksLikeMermaid("select * from trade_deal")).toBe(false)
  })

  it("rejects strings that only start with mermaid keywords", () => {
    expect(looksLikeMermaid("graphviz")).toBe(false)
    expect(looksLikeMermaid("piechart")).toBe(false)
    expect(looksLikeMermaid("timelineX")).toBe(false)
  })
})
