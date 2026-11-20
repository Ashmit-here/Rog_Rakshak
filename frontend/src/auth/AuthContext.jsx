import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  apiRequest,
  clearSessionToken,
  getSessionToken,
  setSessionToken,
  UNAUTHORIZED_EVENT,
} from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [sessionError, setSessionError] = useState('')

  useEffect(() => {
    const savedToken = getSessionToken()
    if (!savedToken) {
      setIsLoading(false)
      return undefined
    }

    const controller = new AbortController()
    let active = true
    apiRequest('/auth/me', { signal: controller.signal, token: savedToken })
      .then(({ user: currentUser }) => {
        if (active) setUser(currentUser)
      })
      .catch((error) => {
        if (active && error.name !== 'AbortError' && error.status !== 401) {
          setSessionError(error.message)
        }
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [])

  useEffect(() => {
    function handleUnauthorized() {
      setUser(null)
      setSessionError('Your session expired. Please sign in again.')
      setIsLoading(false)
    }

    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized)
  }, [])

  const login = useCallback(async (email, password) => {
    setIsLoading(true)
    setSessionError('')
    let issuedToken = null

    try {
      const result = await apiRequest('/auth/login', {
        method: 'POST',
        body: { email, password },
        authenticated: false,
      })
      if (typeof result.token !== 'string' || !result.token) {
        throw new Error('The API did not return an authentication token.')
      }

      issuedToken = result.token
      setSessionToken(issuedToken)
      const { user: currentUser } = await apiRequest('/auth/me', { token: issuedToken })
      setUser(currentUser)
      return currentUser
    } catch (error) {
      if (issuedToken) clearSessionToken()
      setUser(null)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    clearSessionToken()
    setUser(null)
    setSessionError('')
  }, [])

  const value = useMemo(() => ({
    user,
    isLoading,
    sessionError,
    login,
    logout,
  }), [user, isLoading, sessionError, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
