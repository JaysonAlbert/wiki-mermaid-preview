export function createScanScheduler(runScan: () => Promise<void>) {
  let running = false
  let rerunRequested = false

  const schedule = () => {
    if (running) {
      rerunRequested = true
      return
    }

    running = true

    void runScan().finally(() => {
      running = false

      if (rerunRequested) {
        rerunRequested = false
        schedule()
      }
    })
  }

  return { schedule }
}
