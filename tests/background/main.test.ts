import { afterEach, describe, expect, it, vi } from "vitest"

const { refreshRegisteredContentScripts } = vi.hoisted(() => ({
  refreshRegisteredContentScripts: vi.fn()
}))

const { loadDisplayMode, saveDisplayMode } = vi.hoisted(() => ({
  loadDisplayMode: vi.fn(),
  saveDisplayMode: vi.fn()
}))

vi.mock("../../src/shared/content-script-registration", () => ({
  refreshRegisteredContentScripts
}))

vi.mock("../../src/shared/storage", () => ({
  loadDisplayMode,
  saveDisplayMode
}))

import { bootstrapRegistration, handleDisplayModeMenuClick, setupDisplayModeContextMenu } from "../../src/background/main"

afterEach(() => {
  refreshRegisteredContentScripts.mockReset()
  loadDisplayMode.mockReset()
  saveDisplayMode.mockReset()
  vi.unstubAllGlobals()
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

describe("display mode context menu", () => {
  it("creates radio menu items under a display mode submenu", async () => {
    const removeAll = vi.fn((callback: () => void) => callback())
    const create = vi.fn()
    loadDisplayMode.mockResolvedValue("previewOnly")
    vi.stubGlobal("chrome", {
      contextMenus: {
        removeAll,
        create
      }
    })

    await setupDisplayModeContextMenu()

    expect(removeAll).toHaveBeenCalled()
    expect(create).toHaveBeenCalledWith({
      id: "display-mode",
      title: "Display Mode",
      contexts: ["action"]
    })
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "display-mode-previewOnly",
        parentId: "display-mode",
        type: "radio",
        contexts: ["action"],
        checked: true
      })
    )
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "display-mode-codeAndPreview",
        title: "Code + preview"
      })
    )
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "display-mode-codeOnly",
        title: "Code only"
      })
    )
  })

  it("saves display mode clicks from the context menu", async () => {
    await handleDisplayModeMenuClick({ menuItemId: "display-mode-codeOnly" })

    expect(saveDisplayMode).toHaveBeenCalledWith("codeOnly")
  })
})
