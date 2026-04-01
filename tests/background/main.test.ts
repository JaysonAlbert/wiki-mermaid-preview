import { afterEach, describe, expect, it, vi } from "vitest"

const { refreshRegisteredContentScripts } = vi.hoisted(() => ({
  refreshRegisteredContentScripts: vi.fn()
}))

vi.mock("../../src/shared/content-script-registration", () => ({
  refreshRegisteredContentScripts
}))

import { bootstrapRegistration } from "../../src/background/main"

afterEach(() => {
  refreshRegisteredContentScripts.mockReset()
})

describe("bootstrapRegistration", () => {
  it("registers the content script for all authorized patterns on startup", async () => {
    const getSiteAccessPatterns = vi.fn().mockResolvedValue([
      { id: "site-1", pattern: "http://example.com/*" },
      { id: "site-2", pattern: "https://wiki.example.com/*" }
    ])

    await bootstrapRegistration({ getSiteAccessPatterns })

    expect(refreshRegisteredContentScripts).toHaveBeenCalledWith([
      "http://example.com/*",
      "https://wiki.example.com/*"
    ])
  })

  it("delegates an empty site list to the shared registration helper", async () => {
    const getSiteAccessPatterns = vi.fn().mockResolvedValue([])

    await bootstrapRegistration({ getSiteAccessPatterns })

    expect(refreshRegisteredContentScripts).toHaveBeenCalledWith([])
  })
})
