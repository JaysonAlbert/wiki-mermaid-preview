export type ExtractMode = "auto" | "innerText" | "joinChildrenText" | "fencedMermaid"

export type SiteAccessPattern = {
  id: string
  pattern: string
}

export type SelectorRule = {
  id: string
  name: string
  enabled: boolean
  urlPatterns: string[]
  containerSelector: string
  extractMode: ExtractMode
  lineSelector?: string
  trimLines: boolean
  removeEmptyLines: boolean
}
