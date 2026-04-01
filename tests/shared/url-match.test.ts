import { describe, expect, it } from "vitest"
import { urlMatchesAnyPattern } from "../../src/shared/url-match"

describe("urlMatchesAnyPattern", () => {
  it("matches a specific host root pattern", () => {
    expect(urlMatchesAnyPattern("http://example.com/pages/viewpage.action?id=1", ["http://example.com/*"])).toBe(
      true
    )
  })

  it("treats wildcard scheme as http and https only", () => {
    expect(urlMatchesAnyPattern("ftp://example.com/docs/diagram", ["*://example.com/*"])).toBe(
      false
    )
  })

  it("matches the bare host for a wildcard host", () => {
    expect(urlMatchesAnyPattern("https://example.com/docs/diagram", ["https://*.example.com/docs/*"])).toBe(
      true
    )
  })

  it("matches subdomains for a wildcard host", () => {
    expect(
      urlMatchesAnyPattern("https://wiki.example.com/docs/diagram", ["https://*.example.com/docs/*"])
    ).toBe(true)
  })

  it("supports a wildcard host", () => {
    expect(urlMatchesAnyPattern("https://example.com/docs/diagram", ["*://*/*"])).toBe(true)
  })

  it("supports host patterns with a wildcard port", () => {
    expect(urlMatchesAnyPattern("http://example.com:8080/docs/diagram", ["http://*:*/*"])).toBe(
      true
    )
  })

  it("ignores query and hash when matching the path", () => {
    expect(
      urlMatchesAnyPattern("http://example.com/pages/viewpage.action?id=1#section", [
        "http://example.com/pages/viewpage.action"
      ])
    ).toBe(true)
  })
})
