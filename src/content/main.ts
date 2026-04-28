import { loadDisplayMode, loadRules } from "../shared/storage"
import { scanRoot } from "../shared/scan"
import { createScanScheduler } from "./scan-scheduler"

let scanTimer: number | undefined

async function runScan() {
  try {
    const [rules, displayMode] = await Promise.all([loadRules(), loadDisplayMode()])
    await scanRoot(document, rules, window.location.href, displayMode)
  } catch (error) {
    console.error("[wiki-mermaid-preview]", error)
  }
}

const { schedule } = createScanScheduler(runScan)

function scheduleScan() {
  window.clearTimeout(scanTimer)
  scanTimer = window.setTimeout(() => {
    schedule()
  }, 120)
}

function startObserver() {
  const target = document.body ?? document.documentElement

  schedule()

  const observer = new MutationObserver(() => {
    scheduleScan()
  })

  observer.observe(target, { childList: true, subtree: true })
}

if (document.body) {
  startObserver()
} else {
  document.addEventListener("DOMContentLoaded", startObserver, { once: true })
}
