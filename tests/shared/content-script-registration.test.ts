import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("../../src/shared/content-script-assets", () => ({
  contentScriptAssetPath: "/assets/main.ts-loader-0T5a3nYD.js",
  contentStyleAssetPath: "chrome-extension://abc123/assets/style-Daf_cKDz.css"
}))

import {
  contentScriptRegistrationId,
  contentScriptScriptFile,
  contentScriptStyleFile,
  refreshRegisteredContentScripts
} from "../../src/shared/content-script-registration"

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("refreshRegisteredContentScripts", () => {
  it("registers the resolved asset paths instead of source paths", async () => {
    const registerContentScripts = vi.fn().mockResolvedValue(undefined)
    const unregisterContentScripts = vi.fn().mockResolvedValue(undefined)

    vi.stubGlobal("chrome", {
      scripting: {
        registerContentScripts,
        unregisterContentScripts
      }
    })

    await refreshRegisteredContentScripts(["https://example.com/*"])

    expect(contentScriptRegistrationId).toBe("wiki-mermaid-preview-content")
    expect(contentScriptScriptFile).toBe("/assets/main.ts-loader-0T5a3nYD.js")
    expect(contentScriptStyleFile).toBe(
      "chrome-extension://abc123/assets/style-Daf_cKDz.css"
    )
    expect(registerContentScripts).toHaveBeenCalledWith([
      {
        id: contentScriptRegistrationId,
        matches: ["https://example.com/*"],
        js: ["assets/main.ts-loader-0T5a3nYD.js"],
        css: ["assets/style-Daf_cKDz.css"],
        runAt: "document_idle"
      }
    ])
  })

  it("unregisters the prior registration and skips re-registration when there are no patterns", async () => {
    const registerContentScripts = vi.fn().mockResolvedValue(undefined)
    const unregisterContentScripts = vi.fn().mockResolvedValue(undefined)

    vi.stubGlobal("chrome", {
      scripting: {
        registerContentScripts,
        unregisterContentScripts
      }
    })

    await refreshRegisteredContentScripts([])

    expect(unregisterContentScripts).toHaveBeenCalledWith({
      ids: [contentScriptRegistrationId]
    })
    expect(registerContentScripts).not.toHaveBeenCalled()
  })
})
