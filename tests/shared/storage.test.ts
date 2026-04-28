import { afterEach, describe, expect, it, vi } from "vitest"
import { defaultRules } from "../../src/shared/default-rules"
import {
  loadDisplayMode,
  loadRules,
  resetRules,
  saveDisplayMode,
  saveRules
} from "../../src/shared/storage"
import {
  getSiteAccessPatterns,
  saveSiteAccessPatterns
} from "../../src/shared/site-access"

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("loadRules", () => {
  it("preserves an intentionally empty saved rule array", async () => {
    vi.stubGlobal("chrome", {
      storage: {
        sync: {
          get: vi.fn().mockResolvedValue({ selectorRules: [] })
        }
      }
    })

    await expect(loadRules()).resolves.toEqual([])
  })

  it("returns a cloned copy of the defaults", async () => {
    vi.stubGlobal("chrome", {
      storage: {
        sync: {
          get: vi.fn().mockResolvedValue({})
        }
      }
    })

    const rules = await loadRules()
    rules[0].name = "mutated"
    rules[0].urlPatterns.push("https://example.com/*")

    expect(defaultRules[0].name).toBe("Confluence line-by-line Mermaid")
    expect(defaultRules[0].urlPatterns).toEqual(["*://*/*"])
  })

  it("normalizes legacy internal rule patterns to public-safe defaults", async () => {
    const legacyPattern = [
      104, 116, 116, 112, 58, 47, 47, 119, 105, 107, 105, 46, 103, 102, 46, 99, 111, 109, 46,
      99, 110, 47, 42
    ]
      .map((code) => String.fromCharCode(code))
      .join("")

    vi.stubGlobal("chrome", {
      storage: {
        sync: {
          get: vi.fn().mockResolvedValue({
            selectorRules: [
              {
                ...defaultRules[0],
                urlPatterns: [legacyPattern]
              }
            ]
          })
        }
      }
    })

    await expect(loadRules()).resolves.toEqual([
      {
        ...defaultRules[0],
        urlPatterns: ["*://*/*"]
      }
    ])
  })
})

describe("resetRules", () => {
  it("stores cloned default rules", async () => {
    const set = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal("chrome", {
      storage: {
        sync: {
          set
        }
      }
    })

    await resetRules()

    expect(set).toHaveBeenCalledWith({ selectorRules: defaultRules })
  })
})

describe("saveRules", () => {
  it("stores an edited rule set and loadRules reads it back", async () => {
    const editedRules = [
      {
        ...defaultRules[0],
        name: "Edited line-by-line rule",
        enabled: false
      },
      defaultRules[1]
    ]
    const set = vi.fn().mockResolvedValue(undefined)
    const get = vi.fn().mockResolvedValue({ selectorRules: editedRules })

    vi.stubGlobal("chrome", {
      storage: {
        sync: {
          get,
          set
        }
      }
    })

    await saveRules(editedRules)
    const loadedRules = await loadRules()

    expect(set).toHaveBeenCalledWith({ selectorRules: editedRules })
    expect(loadedRules).toEqual(editedRules)
  })
})

describe("display mode storage", () => {
  it("defaults to code and preview mode", async () => {
    vi.stubGlobal("chrome", {
      storage: {
        sync: {
          get: vi.fn().mockResolvedValue({})
        }
      }
    })

    await expect(loadDisplayMode()).resolves.toBe("codeAndPreview")
  })

  it("stores the selected display mode", async () => {
    const set = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal("chrome", {
      storage: {
        sync: {
          set
        }
      }
    })

    await saveDisplayMode("previewOnly")

    expect(set).toHaveBeenCalledWith({ displayMode: "previewOnly" })
  })
})

describe("site access storage", () => {
  it("returns a cloned copy of site access patterns", async () => {
    const savedPatterns = [
      { id: "site-1", pattern: "http://example.com/*" }
    ]

    vi.stubGlobal("chrome", {
      storage: {
        sync: {
          get: vi.fn().mockResolvedValue({
            siteAccessPatterns: savedPatterns
          })
        }
      }
    })

    const patterns = await getSiteAccessPatterns()
    patterns[0].pattern = "https://mutated.example.com/*"

    expect(savedPatterns[0].pattern).toBe("http://example.com/*")
  })

  it("stores and returns authorized site access patterns", async () => {
    const set = vi.fn().mockResolvedValue(undefined)
    const get = vi.fn().mockResolvedValue({
      siteAccessPatterns: [{ id: "site-1", pattern: "http://example.com/*" }]
    })

    vi.stubGlobal("chrome", {
      storage: {
        sync: {
          get,
          set
        }
      }
    })

    await saveSiteAccessPatterns([
      { id: "site-1", pattern: "http://example.com/*" }
    ])

    await expect(getSiteAccessPatterns()).resolves.toEqual([
      { id: "site-1", pattern: "http://example.com/*" }
    ])
    expect(set).toHaveBeenCalledWith({
      siteAccessPatterns: [{ id: "site-1", pattern: "http://example.com/*" }]
    })
  })
})
