import {
  refreshRegisteredContentScripts
} from "../shared/content-script-registration"
import { loadDisplayMode, saveDisplayMode } from "../shared/storage"
import type { DisplayMode } from "../shared/types"

type SiteAccessPattern = {
  id: string
  pattern: string
}

export type BootstrapRegistrationDeps = {
  getSiteAccessPatterns?: () => Promise<SiteAccessPattern[]>
}

const siteAccessStorageKey = "siteAccessPatterns"
const displayModeMenuPrefix = "display-mode-"
const displayModeMenuItems: Array<{ id: DisplayMode; title: string }> = [
  { id: "codeAndPreview", title: "Code + preview" },
  { id: "codeOnly", title: "Code only" },
  { id: "previewOnly", title: "Preview only" }
]

async function getSiteAccessPatternsFromStorage(): Promise<SiteAccessPattern[]> {
  const result = await chrome.storage.sync.get(siteAccessStorageKey)
  const savedPatterns = result[siteAccessStorageKey] as SiteAccessPattern[] | undefined

  return Array.isArray(savedPatterns) ? savedPatterns : []
}

export async function bootstrapRegistration(
  deps: BootstrapRegistrationDeps = {}
): Promise<void> {
  const getSiteAccessPatterns =
    deps.getSiteAccessPatterns ?? getSiteAccessPatternsFromStorage
  const siteAccessPatterns = await getSiteAccessPatterns()
  const patterns = siteAccessPatterns.map((entry) => entry.pattern)

  await refreshRegisteredContentScripts(patterns)
}

function removeAllContextMenus(): Promise<void> {
  return new Promise((resolve) => {
    chrome.contextMenus.removeAll(resolve)
  })
}

function getDisplayModeFromMenuId(menuItemId: string | number): DisplayMode | null {
  if (typeof menuItemId !== "string" || !menuItemId.startsWith(displayModeMenuPrefix)) {
    return null
  }

  const mode = menuItemId.slice(displayModeMenuPrefix.length) as DisplayMode
  return displayModeMenuItems.some((item) => item.id === mode) ? mode : null
}

export async function setupDisplayModeContextMenu(): Promise<void> {
  const displayMode = await loadDisplayMode()
  await removeAllContextMenus()

  for (const item of displayModeMenuItems) {
    chrome.contextMenus.create({
      id: `${displayModeMenuPrefix}${item.id}`,
      title: item.title,
      type: "radio",
      contexts: ["action"],
      checked: item.id === displayMode
    })
  }
}

export async function handleDisplayModeMenuClick(
  info: Pick<chrome.contextMenus.OnClickData, "menuItemId">
): Promise<void> {
  const displayMode = getDisplayModeFromMenuId(info.menuItemId)
  if (displayMode) {
    await saveDisplayMode(displayMode)
  }
}

void bootstrapRegistration().catch(() => undefined)
if (typeof chrome !== "undefined") {
  void setupDisplayModeContextMenu().catch(() => undefined)
  chrome.runtime?.onInstalled?.addListener(() => {
    void setupDisplayModeContextMenu().catch(() => undefined)
  })
  chrome.contextMenus?.onClicked?.addListener((info) => {
    void handleDisplayModeMenuClick(info).catch(() => undefined)
  })
}
