type PatternParts = {
  scheme: string
  host: string
  port?: string
  path: string
}

function parsePattern(pattern: string): PatternParts | null {
  const match = pattern.match(/^([^:]+):\/\/([^/]*)(\/.*)$/)
  if (!match) {
    return null
  }

  const hostAndPort = match[2].toLowerCase()
  const lastColon = hostAndPort.lastIndexOf(":")
  const hasPort = lastColon > -1 && !hostAndPort.startsWith("[")
  const host = hasPort ? hostAndPort.slice(0, lastColon) : hostAndPort
  const port = hasPort ? hostAndPort.slice(lastColon + 1) : undefined

  return {
    scheme: match[1].toLowerCase(),
    host,
    port,
    path: match[3]
  }
}

function escapeRegExp(text: string): string {
  return text.replace(/[.+?^${}()|[\]\\]/g, "\\$&")
}

function matchesScheme(patternScheme: string, urlScheme: string): boolean {
  if (patternScheme === "*") {
    return urlScheme === "http" || urlScheme === "https"
  }

  return patternScheme === urlScheme
}

function matchesHost(patternHost: string, urlHost: string): boolean {
  if (patternHost === "*") {
    return true
  }

  if (patternHost.startsWith("*.")) {
    const suffix = patternHost.slice(2)
    return urlHost === suffix || urlHost.endsWith(`.${suffix}`)
  }

  return patternHost === urlHost
}

function matchesPort(patternPort: string | undefined, urlPort: string, urlScheme: string): boolean {
  if (patternPort === undefined || patternPort === "*") {
    return true
  }

  const defaultPort = urlScheme === "https" ? "443" : urlScheme === "http" ? "80" : ""
  return patternPort === (urlPort || defaultPort)
}

function matchesPath(patternPath: string, urlPath: string): boolean {
  const pathPattern = escapeRegExp(patternPath).replace(/\*/g, ".*")
  return new RegExp(`^${pathPattern}$`).test(urlPath)
}

export function urlMatchesAnyPattern(url: string, patterns: string[]): boolean {
  let parsedUrl: URL

  try {
    parsedUrl = new URL(url)
  } catch {
    return false
  }

  const urlScheme = parsedUrl.protocol.slice(0, -1).toLowerCase()
  const urlHost = parsedUrl.hostname.toLowerCase()
  const urlPort = parsedUrl.port
  const urlPath = parsedUrl.pathname

  return patterns.some((pattern) => {
    const parts = parsePattern(pattern)
    if (!parts) {
      return false
    }

    return (
      matchesScheme(parts.scheme, urlScheme) &&
      matchesHost(parts.host, urlHost) &&
      matchesPort(parts.port, urlPort, urlScheme) &&
      matchesPath(parts.path, urlPath)
    )
  })
}
