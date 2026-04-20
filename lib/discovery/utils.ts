/**
 * Normalizes keys from various formats (snake_case, kebab-case) to camelCase
 */
export function normalizeKey(key: string): string {
  return key
    .replace(/[:_-]([a-z])/g, (_, char) => char.toUpperCase())
    .replace(/^([A-Z])/, (_, char) => char.toLowerCase());
}

/**
 * Extracts URLs from a string value
 */
export function extractUrls(value: string): string[] {
  const urlRegex = /https?:\/\/[^\s"'<>]+(?:\.[^\s"'<>]+)+/g;
  return value.match(urlRegex) || [];
}

/**
 * Parses srcset attribute into an array of URLs
 */
export function parseSrcset(srcset: string): string[] {
  return srcset
    .split(',')
    .map(s => s.trim().split(/\s+/)[0])
    .filter(s => s.startsWith('http'));
}
