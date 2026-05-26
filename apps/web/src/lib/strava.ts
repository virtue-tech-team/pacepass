export interface StravaEmbedConfig {
  embedType: string
  embedId: string
  style: string
  mapHash: string
  token: string
  routeUrl: string
}

export function parseStravaRouteUrl(rawUrl: string) {
  try {
    const parsedUrl = new URL(rawUrl)

    if (!/strava\.com$/i.test(parsedUrl.hostname)) {
      return null
    }

    const routeMatch = parsedUrl.pathname.match(/^\/routes\/(\d+)\/?$/i)

    if (!routeMatch) {
      return null
    }

    return {
      routeId: routeMatch[1],
      routeUrl: `https://www.strava.com/routes/${routeMatch[1]}`,
    }
  } catch {
    return null
  }
}

export function parseStravaEmbedSnippet(rawValue: string) {
  const value = rawValue.trim()

  if (!value || typeof DOMParser === 'undefined') {
    return null
  }

  const documentFragment = new DOMParser().parseFromString(value, 'text/html')
  const placeholder = documentFragment.querySelector('.strava-embed-placeholder')
  const script = documentFragment.querySelector('script[src="https://strava-embeds.com/embed.js"]')

  if (!placeholder || !script) {
    return null
  }

  const embedType = placeholder.getAttribute('data-embed-type')?.trim() || ''
  const embedId = placeholder.getAttribute('data-embed-id')?.trim() || ''
  const style = placeholder.getAttribute('data-style')?.trim() || 'standard'
  const mapHash = placeholder.getAttribute('data-map-hash')?.trim() || ''
  const token = placeholder.getAttribute('data-token')?.trim() || ''

  if (!embedType || !embedId || !token) {
    return null
  }

  const routeUrl = embedType === 'route'
    ? `https://www.strava.com/routes/${embedId}`
    : 'https://www.strava.com/'

  return {
    embedType,
    embedId,
    style,
    mapHash,
    token,
    routeUrl,
  } satisfies StravaEmbedConfig
}

export function isValidStravaEmbedValue(rawValue: string) {
  const value = rawValue.trim()

  if (!value) {
    return true
  }

  return Boolean(parseStravaRouteUrl(value) || parseStravaEmbedSnippet(value))
}