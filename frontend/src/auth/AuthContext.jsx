// Import React Context and hooks for authentication state management
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

// Import API and session token utilities
import {
  apiRequest,
  clearSessionToken,
  getSessionToken,
  setSessionToken,
  UNAUTHORIZED_EVENT,
} from '../api/client'

// Create authentication context
const AuthContext = createContext(null)

// Provides authentication state and functions to child components
export function AuthProvider({ children }) {
  // Store the logged-in user and authentication status
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [sessionError, setSessionError] = useState('')

  // Restore the user session when the application loads
  useEffect(() => {
    const savedToken = getSessionToken()
    if (!savedToken) {
      setIsLoading(false)
      return undefined
    }

    // Create an AbortController to cancel the API request if needed
    const controller = new AbortController()
    let active = true

    // Verify the saved token and retrieve the current user
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

    // Cancel the request when the component unmounts
    return () => {
      active = false
      controller.abort()
    }
  }, [])

  // Listen for unauthorized events, such as an expired session
  useEffect(() => {
    function handleUnauthorized() {
      setUser(null)
      setSessionError('Your session expired. Please sign in again.')
      setIsLoading(false)
    }

    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized)
  }, [])

  // Handle user login and retrieve authenticated user details
  const login = useCallback(async (email, password) => {
    setIsLoading(true)
    setSessionError('')
    let issuedToken = null

    try {
      // Send login credentials to the backend
      const result = await apiRequest('/auth/login', {
        method: 'POST',
        body: { email, password },
        authenticated: false,
      })

      // Ensure the backend returns a valid authentication token
      if (typeof result.token !== 'string' || !result.token) {
        throw new Error('The API did not return an authentication token.')
      }

      // Save the token and fetch the current user's details
      issuedToken = result.token
      setSessionToken(issuedToken)
      const { user: currentUser } = await apiRequest('/auth/me', { token: issuedToken })
      setUser(currentUser)
      return currentUser
    } catch (error) {
      // Clear the token if login or user retrieval fails
      if (issuedToken) clearSessionToken()
      setUser(null)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Handle logout by clearing the session and user information
  const logout = useCallback(() => {
    clearSessionToken()
    setUser(null)
    setSessionError('')
  }, [])

  // Memoize the context value to avoid unnecessary updates
  const value = useMemo(() => ({
    user,
    isLoading,
    sessionError,
    login,
    logout,
  }), [user, isLoading, sessionError, login, logout])

  // Make authentication data and functions available to child components
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Custom hook to access authentication context
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}


