import { describe, expect, it } from "vitest"
import { extensionManifest } from "../manifest.config"

describe("extensionManifest", () => {
  it("declares only valid required permissions for the extension APIs in use", () => {
    expect(extensionManifest.permissions).toEqual(["storage", "scripting", "contextMenus"])
    expect(extensionManifest.permissions).not.toContain("permissions")
  })

  it("declares standard chrome extension icon sizes", () => {
    expect(extensionManifest.icons).toEqual({
      16: "icons/icon16.png",
      32: "icons/icon32.png",
      48: "icons/icon48.png",
      128: "icons/icon128.png"
    })
  })
})
