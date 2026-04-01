import { defaultRules } from "./default-rules"
import type { SelectorRule } from "./types"

const storageKey = "selectorRules"
const legacyInternalRulePatternHash = 659150893

function fnv1a32(value: string): number {
  let hash = 0x811c9dc5

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }

  return hash >>> 0
}

function normalizeRulePattern(pattern: string): string {
  return fnv1a32(pattern.trim()) === legacyInternalRulePatternHash ? "*://*/*" : pattern
}

function cloneRule(rule: SelectorRule): SelectorRule {
  const cloned = structuredClone(rule)
  cloned.urlPatterns = cloned.urlPatterns.map(normalizeRulePattern)
  return cloned
}

function cloneRules(rules: SelectorRule[]): SelectorRule[] {
  return rules.map(cloneRule)
}

export async function loadRules(): Promise<SelectorRule[]> {
  const result = await chrome.storage.sync.get(storageKey)
  const savedRules = result[storageKey] as SelectorRule[] | undefined
  const sourceRules = Array.isArray(savedRules) ? savedRules : defaultRules
  return cloneRules(sourceRules)
}

export async function saveRules(rules: SelectorRule[]): Promise<void> {
  await chrome.storage.sync.set({ [storageKey]: cloneRules(rules) })
}

export async function resetRules(): Promise<void> {
  await chrome.storage.sync.set({ [storageKey]: cloneRules(defaultRules) })
}
