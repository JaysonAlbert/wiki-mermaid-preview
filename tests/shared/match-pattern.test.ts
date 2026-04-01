import { describe, expect, it } from "vitest"
import { isValidMatchPattern } from "../../src/shared/match-pattern"

describe("isValidMatchPattern", () => {
  it("accepts http and https match patterns", () => {
    expect(isValidMatchPattern("http://example.com/*")).toBe(true)
    expect(isValidMatchPattern("https://*.example.com/*")).toBe(true)
  })

  it("rejects empty, malformed, and unsupported schemes", () => {
    expect(isValidMatchPattern("")).toBe(false)
    expect(isValidMatchPattern("   ")).toBe(false)
    expect(isValidMatchPattern("ftp://example.com/*")).toBe(false)
    expect(isValidMatchPattern("file:///tmp/*")).toBe(false)
    expect(isValidMatchPattern("*://example.com/*")).toBe(false)
    expect(isValidMatchPattern("http://example.com")).toBe(false)
  })
})
