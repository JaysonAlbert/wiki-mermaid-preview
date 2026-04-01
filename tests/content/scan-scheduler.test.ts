import { describe, expect, it, vi } from "vitest"
import { createScanScheduler } from "../../src/content/scan-scheduler"

function createDeferred() {
  let resolve!: () => void
  const promise = new Promise<void>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

describe("createScanScheduler", () => {
  it("coalesces overlapping scan requests into one rerun", async () => {
    const first = createDeferred()
    const second = createDeferred()
    const runScan = vi
      .fn<[], Promise<void>>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)

    const scheduler = createScanScheduler(runScan)

    scheduler.schedule()
    scheduler.schedule()
    scheduler.schedule()

    expect(runScan).toHaveBeenCalledTimes(1)

    first.resolve()
    await Promise.resolve()

    expect(runScan).toHaveBeenCalledTimes(2)

    second.resolve()
    await Promise.resolve()

    expect(runScan).toHaveBeenCalledTimes(2)
  })
})
