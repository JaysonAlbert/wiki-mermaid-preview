import { defaultRules } from "../shared/default-rules"
import {
  refreshRegisteredContentScripts
} from "../shared/content-script-registration"
import { isValidMatchPattern } from "../shared/match-pattern"
import { createRuntimeId } from "../shared/runtime-id"
import { getSiteAccessPatterns, saveSiteAccessPatterns } from "../shared/site-access"
import { loadRules, saveRules } from "../shared/storage"
import type { ExtractMode, SelectorRule, SiteAccessPattern } from "../shared/types"

const extractModes: ExtractMode[] = ["auto", "innerText", "joinChildrenText"]
const autosaveDelayMs = 250
const defaultRuleIds = new Set(defaultRules.map((rule) => rule.id))

function cloneRule(rule: SelectorRule): SelectorRule {
  return {
    ...rule,
    urlPatterns: [...rule.urlPatterns]
  }
}

function cloneRules(rules: SelectorRule[]): SelectorRule[] {
  return rules.map(cloneRule)
}

function cloneSiteAccessPattern(pattern: SiteAccessPattern): SiteAccessPattern {
  return structuredClone(pattern)
}

function cloneSiteAccessPatterns(
  patterns: SiteAccessPattern[]
): SiteAccessPattern[] {
  return patterns.map(cloneSiteAccessPattern)
}

function createEmptyRule(): SelectorRule {
  return {
    id: createRuntimeId("rule"),
    name: "",
    enabled: false,
    urlPatterns: ["*://*/*"],
    containerSelector: "",
    extractMode: "auto",
    lineSelector: "",
    trimLines: true,
    removeEmptyLines: false
  }
}

function createSiteAccessPattern(pattern: string): SiteAccessPattern {
  return {
    id: createRuntimeId("site"),
    pattern
  }
}

function formatUrlPatterns(patterns: string[]): string {
  return patterns.join(", ")
}

function parseUrlPatterns(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function findRule(rules: SelectorRule[], id: string): SelectorRule | undefined {
  return rules.find((rule) => rule.id === id)
}

function getRuleCard(target: EventTarget | null): HTMLElement | null {
  return target instanceof HTMLElement ? target.closest<HTMLElement>("[data-rule-id]") : null
}

function getSiteAccessCard(target: EventTarget | null): HTMLElement | null {
  return target instanceof HTMLElement
    ? target.closest<HTMLElement>("[data-site-access-id]")
    : null
}

function createRuleAutosaver() {
  let debounceId: number | undefined
  let inFlight = false
  let queuedRules: SelectorRule[] | null = null

  async function flush(rules: SelectorRule[]) {
    inFlight = true

    try {
      await saveRules(rules)
    } catch (error) {
      console.error("[wiki-mermaid-preview]", error)
    } finally {
      inFlight = false
      if (queuedRules) {
        const nextRules = queuedRules
        queuedRules = null
        void flush(nextRules)
      }
    }
  }

  function cancelDebounce() {
    if (debounceId !== undefined) {
      window.clearTimeout(debounceId)
      debounceId = undefined
    }
  }

  function saveNow(rules: SelectorRule[]) {
    cancelDebounce()

    if (inFlight) {
      queuedRules = cloneRules(rules)
      return
    }

    void flush(cloneRules(rules))
  }

  function saveDebounced(rules: SelectorRule[]) {
    const snapshot = cloneRules(rules)
    cancelDebounce()
    debounceId = window.setTimeout(() => {
      debounceId = undefined

      if (inFlight) {
        queuedRules = snapshot
        return
      }

      void flush(snapshot)
    }, autosaveDelayMs)
  }

  return {
    saveDebounced,
    saveNow
  }
}

function buildLabel(text: string, control: HTMLElement): HTMLLabelElement {
  const label = document.createElement("label")
  label.className = "wmp-options__label"

  const span = document.createElement("span")
  span.className = "wmp-options__label-text"
  span.textContent = text

  label.append(span, control)
  return label
}

function buildTextInput(
  field: keyof Pick<
    SelectorRule,
    "name" | "containerSelector" | "lineSelector"
  >,
  value: string
): HTMLInputElement {
  const input = document.createElement("input")
  input.className = "wmp-options__input"
  input.type = "text"
  input.dataset.field = field
  input.value = value
  return input
}

function buildUrlPatternsInput(value: string): HTMLInputElement {
  const input = document.createElement("input")
  input.className = "wmp-options__input"
  input.type = "text"
  input.dataset.field = "urlPatterns"
  input.value = value
  return input
}

function buildSelect(value: ExtractMode): HTMLSelectElement {
  const select = document.createElement("select")
  select.className = "wmp-options__input"
  select.dataset.field = "extractMode"

  for (const mode of extractModes) {
    const option = document.createElement("option")
    option.value = mode
    option.textContent = mode
    if (mode === value) {
      option.selected = true
    }
    select.append(option)
  }

  return select
}

function buildCheckbox(field: keyof Pick<SelectorRule, "enabled" | "trimLines" | "removeEmptyLines">, checked: boolean) {
  const input = document.createElement("input")
  input.type = "checkbox"
  input.dataset.field = field
  input.checked = checked
  return input
}

function buildSiteAccessInput(value: string): HTMLInputElement {
  const input = document.createElement("input")
  input.className = "wmp-options__input"
  input.type = "text"
  input.dataset.field = "siteAccessPattern"
  input.value = value
  input.placeholder = "http://example.com/*"
  return input
}

function buildSiteAccessCard(
  pattern: SiteAccessPattern,
  isBusy: boolean
): HTMLElement {
  const card = document.createElement("section")
  card.className = "wmp-site-access-card"
  card.dataset.siteAccessId = pattern.id

  const details = document.createElement("div")
  details.className = "wmp-site-access-card__details"

  const title = document.createElement("h3")
  title.className = "wmp-site-access-card__title"
  title.textContent = pattern.pattern

  const meta = document.createElement("p")
  meta.className = "wmp-site-access-card__meta"
  meta.textContent = "Authorized site"

  details.append(title, meta)

  const removeButton = document.createElement("button")
  removeButton.type = "button"
  removeButton.dataset.action = "remove-site-access"
  removeButton.textContent = "Remove"
  removeButton.disabled = isBusy

  card.append(details, removeButton)
  return card
}

function buildRuleCard(rule: SelectorRule): HTMLElement {
  const card = document.createElement("section")
  card.className = "wmp-rule-card"
  card.dataset.ruleId = rule.id
  card.dataset.testid = `rule-card-${rule.id}`

  const header = document.createElement("div")
  header.className = "wmp-rule-card__header"

  const titleWrap = document.createElement("div")
  const title = document.createElement("h2")
  title.className = "wmp-rule-card__title"
  title.textContent = rule.name || "Untitled rule"

  const meta = document.createElement("p")
  meta.className = "wmp-rule-card__meta"
  meta.textContent = defaultRuleIds.has(rule.id) ? "Built-in rule" : "Custom rule"

  titleWrap.append(title, meta)

  const enabledWrap = document.createElement("label")
  enabledWrap.className = "wmp-rule-card__toggle"
  enabledWrap.append(buildCheckbox("enabled", rule.enabled), document.createTextNode("Enabled"))

  header.append(titleWrap, enabledWrap)

  const fields = document.createElement("div")
  fields.className = "wmp-rule-card__fields"
  fields.append(
    buildLabel("Rule name", buildTextInput("name", rule.name)),
    buildLabel("URL patterns", buildUrlPatternsInput(formatUrlPatterns(rule.urlPatterns))),
    buildLabel("Container selector", buildTextInput("containerSelector", rule.containerSelector)),
    buildLabel("Extract mode", buildSelect(rule.extractMode)),
    buildLabel("Line selector", buildTextInput("lineSelector", rule.lineSelector ?? "")),
    buildLabel("Trim lines", buildCheckbox("trimLines", rule.trimLines)),
    buildLabel("Remove empty lines", buildCheckbox("removeEmptyLines", rule.removeEmptyLines))
  )

  const actions = document.createElement("div")
  actions.className = "wmp-rule-card__actions"

  const deleteButton = document.createElement("button")
  deleteButton.type = "button"
  deleteButton.dataset.action = "delete"
  deleteButton.textContent = "Delete"

  actions.append(deleteButton)

  card.append(header, fields, actions)
  return card
}

function syncRuleCardTitle(card: HTMLElement, rule: SelectorRule) {
  const title = card.querySelector<HTMLElement>(".wmp-rule-card__title")
  if (title) {
    title.textContent = rule.name || "Untitled rule"
  }
}

function renderPage(
  root: HTMLElement,
  rules: SelectorRule[],
  siteAccessPatterns: SiteAccessPattern[],
  siteAccessInput: string,
  siteAccessStatus: string,
  siteAccessBusy: boolean
) {
  root.replaceChildren()

  const shell = document.createElement("div")
  shell.className = "wmp-options"

  const header = document.createElement("header")
  header.className = "wmp-options__header"

  const eyebrow = document.createElement("p")
  eyebrow.className = "wmp-options__eyebrow"
  eyebrow.textContent = "Wiki Mermaid Preview"

  const title = document.createElement("h1")
  title.className = "wmp-options__title"
  title.textContent = "Wiki Mermaid Preview"

  const description = document.createElement("p")
  description.className = "wmp-options__description"
  description.textContent = "Add, edit, disable, or reset the selector rules used to find Mermaid blocks."

  const toolbar = document.createElement("div")
  toolbar.className = "wmp-options__toolbar"

  const addButton = document.createElement("button")
  addButton.type = "button"
  addButton.dataset.action = "add"
  addButton.textContent = "Add Rule"

  const resetButton = document.createElement("button")
  resetButton.type = "button"
  resetButton.dataset.action = "reset"
  resetButton.textContent = "Reset Defaults"

  toolbar.append(addButton, resetButton)
  header.append(eyebrow, title, description, toolbar)

  const siteAccessSection = document.createElement("section")
  siteAccessSection.className = "wmp-site-access"
  siteAccessSection.dataset.busy = String(siteAccessBusy)

  const siteAccessHeader = document.createElement("div")
  siteAccessHeader.className = "wmp-site-access__header"

  const siteAccessTitle = document.createElement("h2")
  siteAccessTitle.className = "wmp-site-access__title"
  siteAccessTitle.textContent = "Site Access"

  const siteAccessDescription = document.createElement("p")
  siteAccessDescription.className = "wmp-site-access__description"
  siteAccessDescription.textContent =
    "Authorize a site match pattern to let the extension run there."

  siteAccessHeader.append(siteAccessTitle, siteAccessDescription)

  const siteAccessForm = document.createElement("div")
  siteAccessForm.className = "wmp-site-access__form"

  const siteAccessLabel = buildLabel("Site match pattern", buildSiteAccessInput(siteAccessInput))

  const siteAccessButton = document.createElement("button")
  siteAccessButton.type = "button"
  siteAccessButton.dataset.action = "add-site-access"
  siteAccessButton.textContent = "Allow Site"
  siteAccessButton.disabled = siteAccessBusy

  siteAccessForm.append(siteAccessLabel, siteAccessButton)

  const siteAccessStatusElement = document.createElement("p")
  siteAccessStatusElement.className = "wmp-site-access__status"
  siteAccessStatusElement.dataset.role = "site-access-status"
  siteAccessStatusElement.textContent = siteAccessStatus

  const siteAccessList = document.createElement("div")
  siteAccessList.className = "wmp-site-access__list"
  siteAccessList.dataset.role = "site-access-list"
  for (const pattern of siteAccessPatterns) {
    siteAccessList.append(buildSiteAccessCard(pattern, siteAccessBusy))
  }

  siteAccessSection.append(
    siteAccessHeader,
    siteAccessForm,
    siteAccessStatusElement,
    siteAccessList
  )

  const note = document.createElement("p")
  note.className = "wmp-options__note"
  note.textContent = "Changes save automatically. Refresh the wiki page after updating rules."

  const list = document.createElement("div")
  list.className = "wmp-options__rule-list"
  list.dataset.role = "rule-list"
  for (const rule of rules) {
    list.append(buildRuleCard(rule))
  }

  shell.append(header, siteAccessSection, note, list)
  root.append(shell)
}

export async function mountOptionsApp(root: HTMLElement) {
  let rules = cloneRules(await loadRules())
  let siteAccessPatterns = cloneSiteAccessPatterns(await getSiteAccessPatterns())
  let siteAccessInput = ""
  let siteAccessStatus = ""
  let siteAccessBusy = false
  const autosaver = createRuleAutosaver()

  function updateSiteAccessStatus(message: string) {
    siteAccessStatus = message
    const statusElement = root.querySelector<HTMLElement>("[data-role='site-access-status']")
    if (statusElement) {
      statusElement.textContent = message
    }
  }

  function renderCurrentPage() {
    renderPage(
      root,
      rules,
      siteAccessPatterns,
      siteAccessInput,
      siteAccessStatus,
      siteAccessBusy
    )
  }

  function reportSiteAccessError(message: string, error?: unknown) {
    if (error !== undefined) {
      console.error("[wiki-mermaid-preview]", error)
    }
    updateSiteAccessStatus(message)
  }

  async function addSiteAccessPattern() {
    if (siteAccessBusy) {
      return
    }

    const pattern = siteAccessInput.trim()

    if (!isValidMatchPattern(pattern)) {
      updateSiteAccessStatus("Enter a valid site match pattern.")
      return
    }

    if (siteAccessPatterns.some((entry) => entry.pattern === pattern)) {
      updateSiteAccessStatus("That site match pattern is already allowed.")
      return
    }

    siteAccessBusy = true
    updateSiteAccessStatus("Requesting site access...")
    renderCurrentPage()

    try {
      const granted = await chrome.permissions.request({ origins: [pattern] })

      if (!granted) {
        updateSiteAccessStatus("Site access was not granted.")
        return
      }

      const nextPatterns = [...siteAccessPatterns, createSiteAccessPattern(pattern)]

      try {
        await saveSiteAccessPatterns(nextPatterns)
      } catch (error) {
        try {
          await chrome.permissions.remove({ origins: [pattern] })
        } catch (rollbackError) {
          console.error("[wiki-mermaid-preview]", rollbackError)
        }
        reportSiteAccessError("Could not save site access.", error)
        return
      }

      siteAccessPatterns = nextPatterns
      siteAccessInput = ""

      try {
        await refreshRegisteredContentScripts(
          siteAccessPatterns.map((entry) => entry.pattern)
        )
        siteAccessStatus = "Site access added."
      } catch (error) {
        reportSiteAccessError(
          "Site access was saved, but registration refresh failed.",
          error
        )
      }
    } catch (error) {
      reportSiteAccessError("Could not update site access.", error)
    } finally {
      siteAccessBusy = false
      renderCurrentPage()
    }
  }

  async function removeSiteAccessPattern(patternId: string) {
    if (siteAccessBusy) {
      return
    }

    const entry = siteAccessPatterns.find((item) => item.id === patternId)
    if (!entry) {
      return
    }

    siteAccessBusy = true
    updateSiteAccessStatus("Removing site access...")
    renderCurrentPage()

    try {
      const removed = await chrome.permissions.remove({ origins: [entry.pattern] })

      if (!removed) {
        updateSiteAccessStatus("Site access was not removed.")
        return
      }

      const nextPatterns = siteAccessPatterns.filter((item) => item.id !== patternId)

      try {
        await saveSiteAccessPatterns(nextPatterns)
      } catch (error) {
        try {
          await chrome.permissions.request({ origins: [entry.pattern] })
        } catch (rollbackError) {
          console.error("[wiki-mermaid-preview]", rollbackError)
        }
        reportSiteAccessError("Could not save site access changes.", error)
        return
      }

      siteAccessPatterns = nextPatterns

      try {
        await refreshRegisteredContentScripts(
          siteAccessPatterns.map((item) => item.pattern)
        )
        siteAccessStatus = "Site access removed."
      } catch (error) {
        reportSiteAccessError(
          "Site access was updated, but registration refresh failed.",
          error
        )
      }
    } catch (error) {
      reportSiteAccessError("Could not update site access.", error)
    } finally {
      siteAccessBusy = false
      renderCurrentPage()
    }
  }

  renderCurrentPage()

  root.addEventListener("input", (event) => {
    if (
      event.target instanceof HTMLInputElement &&
      event.target.dataset.field === "siteAccessPattern"
    ) {
      siteAccessInput = event.target.value
      if (siteAccessStatus) {
        updateSiteAccessStatus("")
      }
      return
    }

    const card = getRuleCard(event.target)
    const field = event.target instanceof HTMLElement ? event.target.dataset.field : undefined

    if (!card || !field) {
      return
    }

    const rule = findRule(rules, card.dataset.ruleId ?? "")
    if (!rule) {
      return
    }

    if (event.target instanceof HTMLInputElement) {
      if (field === "name") {
        rule.name = event.target.value
        syncRuleCardTitle(card, rule)
      } else if (field === "containerSelector") {
        rule.containerSelector = event.target.value
      } else if (field === "lineSelector") {
        rule.lineSelector = event.target.value
      } else if (field === "urlPatterns") {
        rule.urlPatterns = parseUrlPatterns(event.target.value)
      } else {
        return
      }

      autosaver.saveDebounced(rules)
    }
  })

  root.addEventListener("change", (event) => {
    const card = getRuleCard(event.target)
    const field = event.target instanceof HTMLElement ? event.target.dataset.field : undefined

    if (!card || !field) {
      return
    }

    const rule = findRule(rules, card.dataset.ruleId ?? "")
    if (!rule) {
      return
    }

    if (event.target instanceof HTMLInputElement && event.target.type === "checkbox") {
      if (field === "enabled") {
        rule.enabled = event.target.checked
      } else if (field === "trimLines") {
        rule.trimLines = event.target.checked
      } else if (field === "removeEmptyLines") {
        rule.removeEmptyLines = event.target.checked
      } else {
        return
      }
      autosaver.saveNow(rules)
    } else if (event.target instanceof HTMLSelectElement && field === "extractMode") {
      rule.extractMode = event.target.value as ExtractMode
      autosaver.saveNow(rules)
    }
  })

  root.addEventListener("click", (event) => {
    const target = event.target
    if (!(target instanceof HTMLElement)) {
      return
    }

    const card = getRuleCard(target)

    if (target.dataset.action === "add") {
      rules = [...rules, createEmptyRule()]
      renderCurrentPage()
      autosaver.saveNow(rules)
      return
    }

    if (target.dataset.action === "reset") {
      rules = cloneRules(defaultRules)
      renderCurrentPage()
      autosaver.saveNow(rules)
      return
    }

    if (target.dataset.action === "add-site-access") {
      void addSiteAccessPattern()
      return
    }

    if (!card) {
      const siteAccessCard = getSiteAccessCard(target)
      if (siteAccessCard && target.dataset.action === "remove-site-access") {
        void removeSiteAccessPattern(siteAccessCard.dataset.siteAccessId ?? "")
      }
      return
    }

    const ruleId = card.dataset.ruleId
    if (!ruleId) {
      return
    }

    if (target.dataset.action === "delete") {
      rules = rules.filter((rule) => rule.id !== ruleId)
      renderCurrentPage()
      autosaver.saveNow(rules)
    }
  })
}
