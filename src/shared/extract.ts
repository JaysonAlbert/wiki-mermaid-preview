import type { SelectorRule } from "./types"

function readNodeText(node: HTMLElement): string {
  return node.innerText ?? node.textContent ?? ""
}

function normalizeLines(
  lines: string[],
  rule: Pick<SelectorRule, "trimLines" | "removeEmptyLines">
): string[] {
  const normalized = lines.map((line) => (rule.trimLines ? line.trim() : line))
  return rule.removeEmptyLines ? normalized.filter((line) => line.length > 0) : normalized
}

function extractFencedMermaid(text: string): string {
  const match = text.replace(/\r\n/g, "\n").match(/(?:^|\n)```mermaid[^\n]*\n([\s\S]*?)\n```(?=\n|$)/i)
  return match?.[1] ?? ""
}

export function extractMermaidSource(
  container: Element,
  rule: Pick<SelectorRule, "extractMode" | "lineSelector" | "trimLines" | "removeEmptyLines">
): string {
  if (rule.extractMode === "fencedMermaid") {
    return normalizeLines(
      extractFencedMermaid(readNodeText(container as HTMLElement)).split("\n"),
      rule
    ).join("\n")
  }

  const childLines =
    rule.lineSelector && (rule.extractMode === "auto" || rule.extractMode === "joinChildrenText")
      ? Array.from(container.querySelectorAll<HTMLElement>(rule.lineSelector)).map((node) => readNodeText(node))
      : []

  if (childLines.length > 0) {
    return normalizeLines(childLines, rule).join("\n")
  }

  return normalizeLines(readNodeText(container as HTMLElement).split("\n"), rule).join("\n")
}
