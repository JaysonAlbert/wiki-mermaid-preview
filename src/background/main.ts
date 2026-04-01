import {
  refreshRegisteredContentScripts
} from "../shared/content-script-registration"

type SiteAccessPattern = {
  id: string
  pattern: string
}

export type BootstrapRegistrationDeps = {
  getSiteAccessPatterns?: () => Promise<SiteAccessPattern[]>
}

const siteAccessStorageKey = "siteAccessPatterns"

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

void bootstrapRegistration().catch(() => undefined)
