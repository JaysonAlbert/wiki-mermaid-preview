import {
  contentScriptAssetPath,
  contentStyleAssetPath
} from "./content-script-assets"

const registrationId = "wiki-mermaid-preview-content"

type ContentScriptRegistration = chrome.scripting.RegisteredContentScript

function normalizeExtensionPackagePath(value: string): string {
  try {
    const url = new URL(value)
    const path = url.pathname.replace(/^\/+/, "")
    return `${path}${url.search}${url.hash}`
  } catch {
    return value.replace(/^\/+/, "")
  }
}

export async function refreshRegisteredContentScripts(
  patterns: string[]
): Promise<void> {
  await chrome.scripting
    .unregisterContentScripts({ ids: [registrationId] })
    .catch(() => undefined)

  if (patterns.length === 0) {
    return
  }

  const registration: ContentScriptRegistration = {
    id: registrationId,
    matches: patterns,
    js: [normalizeExtensionPackagePath(contentScriptAssetPath)],
    css: [normalizeExtensionPackagePath(contentStyleAssetPath)],
    runAt: "document_idle"
  }

  await chrome.scripting.registerContentScripts([registration])
}

export const contentScriptRegistrationId = registrationId
export const contentScriptScriptFile = contentScriptAssetPath
export const contentScriptStyleFile = contentStyleAssetPath
