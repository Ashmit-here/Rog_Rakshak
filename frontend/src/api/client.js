const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api'

export const API_BASE_URL = configuredApiBaseUrl.replace(/\/+$/, '')
export const SESSION_TOKEN_KEY = 'rog-rakshak-session-token'
export const UNAUTHORIZED_EVENT = 'rog-rakshak:unauthorized'

export class ApiError extends Error {
  constructor(message, status = 0, endpoint = '') {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.endpoint = endpoint
  }
}

export function getSessionToken() {
  return window.sessionStorage.getItem(SESSION_TOKEN_KEY)
}

export function setSessionToken(token) {
  window.sessionStorage.setItem(SESSION_TOKEN_KEY, token)
}

export function clearSessionToken() {
  window.sessionStorage.removeItem(SESSION_TOKEN_KEY)
}

export async function apiRequest(path, {
  method = 'GET',
  body,
  signal,
  authenticated = true,
  token,
} = {}) {
  const headers = { Accept: 'application/json' }
  const requestToken = token ?? (authenticated ? getSessionToken() : null)
  if (requestToken) headers.Authorization = `Bearer ${requestToken}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      signal,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new ApiError('Unable to reach the Rog Rakshak API. Check that the backend is running.', 0, path)
  }

  let payload = null
  if (response.status !== 204) {
    try {
      payload = await response.json()
    } catch {
      if (response.ok) {
        throw new ApiError('The API returned an unreadable response.', response.status, path)
      }
    }
  }

  if (response.status === 401 && requestToken) {
    clearSessionToken()
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
  }

  if (!response.ok) {
    throw new ApiError(
      response.status === 403
        ? 'You do not have permission to access this resource.'
        : typeof payload?.error === 'string'
          ? payload.error
          : 'The request could not be completed.',
      response.status,
      path,
    )
  }

  if (payload === null) {
    throw new ApiError('The API returned an empty response.', response.status, path)
  }

  return payload
}
