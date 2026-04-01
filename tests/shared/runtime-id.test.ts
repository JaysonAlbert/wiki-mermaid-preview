import { describe, expect, it, vi } from "vitest"
import { createRuntimeId } from "../../src/shared/runtime-id"

describe("createRuntimeId", () => {
  it("uses crypto.randomUUID when available", () => {
    const originalCrypto = globalThis.crypto
    const randomUUID = vi.fn(() => "uuid-value")

    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: { ...originalCrypto, randomUUID }
    })

    expect(createRuntimeId("wmp")).toBe("wmp-uuid-value")
    expect(randomUUID).toHaveBeenCalledTimes(1)

    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: originalCrypto
    })
  })

  it("falls back when crypto.randomUUID is unavailable", () => {
    const originalCrypto = globalThis.crypto

    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: {}
    })

    const first = createRuntimeId("rule")
    const second = createRuntimeId("rule")

    expect(first).toMatch(/^rule-[a-z0-9]+-[a-z0-9]+$/)
    expect(second).toMatch(/^rule-[a-z0-9]+-[a-z0-9]+$/)
    expect(second).not.toBe(first)

    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: originalCrypto
    })
  })
})
