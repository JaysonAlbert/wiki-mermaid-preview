const sequenceDiagramReservedActorAliases = new Set([
  "activate",
  "actor",
  "alt",
  "and",
  "autonumber",
  "box",
  "break",
  "create",
  "critical",
  "deactivate",
  "destroy",
  "details",
  "else",
  "end",
  "link",
  "links",
  "loop",
  "note",
  "opt",
  "option",
  "par",
  "participant",
  "properties",
  "rect"
])

const actorDeclarationPattern =
  /^(\s*(?:(?:create|destroy)\s+)?(?:participant|actor)\s+)([A-Za-z_][A-Za-z0-9_-]*)(?=\s|$)/i

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function replaceActorAlias(value: string, alias: string, replacement: string): string {
  return value.replace(
    new RegExp(`(^|[^A-Za-z0-9_])${escapeRegExp(alias)}(?=$|[^A-Za-z0-9_])`, "g"),
    `$1${replacement}`
  )
}

export function normalizeMermaidSource(source: string): string {
  if (!/^\s*sequenceDiagram\b/im.test(source)) {
    return source
  }

  const lines = source.split("\n")
  const declaredAliases = lines.flatMap((line) => {
    const match = line.match(actorDeclarationPattern)
    return match ? [match[2]] : []
  })
  const usedAliases = new Set(declaredAliases.map((alias) => alias.toLowerCase()))
  const replacements = new Map<string, string>()

  for (const alias of declaredAliases) {
    if (!sequenceDiagramReservedActorAliases.has(alias.toLowerCase())) {
      continue
    }

    let replacement = `wmp_${alias}`
    while (usedAliases.has(replacement.toLowerCase())) {
      replacement += "_"
    }

    usedAliases.add(replacement.toLowerCase())
    replacements.set(alias, replacement)
  }

  if (replacements.size === 0) {
    return source
  }

  return lines
    .map((line) => {
      const declaration = line.match(actorDeclarationPattern)
      if (declaration) {
        const replacement = replacements.get(declaration[2])
        return replacement
          ? line.replace(actorDeclarationPattern, `$1${replacement}`)
          : line
      }

      const colonIndex = line.indexOf(":")
      const isActorDirective = /^\s*(?:activate|deactivate|destroy)\b/i.test(line)
      if (colonIndex < 0 && !isActorDirective) {
        return line
      }

      const structuralPart = colonIndex < 0 ? line : line.slice(0, colonIndex)
      const labelPart = colonIndex < 0 ? "" : line.slice(colonIndex)
      let normalizedStructuralPart = structuralPart

      for (const [alias, replacement] of replacements) {
        normalizedStructuralPart = replaceActorAlias(
          normalizedStructuralPart,
          alias,
          replacement
        )
      }

      return normalizedStructuralPart + labelPart
    })
    .join("\n")
}
