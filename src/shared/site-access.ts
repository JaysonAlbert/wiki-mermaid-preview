import type { SiteAccessPattern } from "./types"

const storageKey = "siteAccessPatterns"

function cloneSiteAccessPattern(pattern: SiteAccessPattern): SiteAccessPattern {
  return structuredClone(pattern)
}

function cloneSiteAccessPatterns(
  patterns: SiteAccessPattern[]
): SiteAccessPattern[] {
  return patterns.map(cloneSiteAccessPattern)
}

export async function getSiteAccessPatterns(): Promise<SiteAccessPattern[]> {
  const result = await chrome.storage.sync.get(storageKey)
  const savedPatterns = result[storageKey] as SiteAccessPattern[] | undefined

  if (!Array.isArray(savedPatterns)) {
    return []
  }

  return cloneSiteAccessPatterns(savedPatterns)
}

export async function saveSiteAccessPatterns(
  patterns: SiteAccessPattern[]
): Promise<void> {
  await chrome.storage.sync.set({
    [storageKey]: cloneSiteAccessPatterns(patterns)
  })
}
