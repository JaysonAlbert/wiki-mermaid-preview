const mermaidPrefixes = [
  "graph",
  "flowchart",
  "sequenceDiagram",
  "classDiagram",
  "stateDiagram",
  "stateDiagram-v2",
  "erDiagram",
  "journey",
  "gantt",
  "pie",
  "mindmap",
  "timeline",
  "gitGraph",
  "kanban",
  "architecture-beta"
]

export function looksLikeMermaid(source: string): boolean {
  const lines = source.trimStart().split(/\r?\n/)

  for (const line of lines) {
    const trimmed = line.trimStart()

    if (trimmed.length === 0) {
      continue
    }

    if (trimmed.startsWith("%%")) {
      continue
    }

    return mermaidPrefixes.some((prefix) => {
      if (!trimmed.startsWith(prefix)) {
        return false
      }

      const nextChar = trimmed.charAt(prefix.length)
      return nextChar === "" || /\s/.test(nextChar)
    })
  }

  return false
}
