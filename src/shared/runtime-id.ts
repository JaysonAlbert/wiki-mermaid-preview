let fallbackCounter = 0

export function createRuntimeId(prefix = "id"): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `${prefix}-${globalThis.crypto.randomUUID()}`
  }

  fallbackCounter += 1

  return `${prefix}-${Date.now().toString(36)}-${fallbackCounter.toString(36)}`
}
