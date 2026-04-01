const chromeMatchPattern =
  /^https?:\/\/(?:\*|\*\.[^/*:]+|[^/*:]+)(?::(?:\*|\d+))?\/.*$/

export function isValidMatchPattern(value: string): boolean {
  return chromeMatchPattern.test(value.trim())
}
