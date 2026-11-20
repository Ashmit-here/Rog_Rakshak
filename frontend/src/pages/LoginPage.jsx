import { useState } from 'react'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/AuthContext'

function LoginPage({ navigate }) {
  const { login, isLoading, sessionError } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const user = await login(email, password)
      navigate(user.role === 'HOSPITAL'
        ? '/hospital'
        : user.role === 'MEDICAL_OFFICER'
          ? '/medical-officer'
          : user.role === 'ADMIN'
            ? '/admin'
            : '/public', { replace: true })
    } catch (loginError) {
      if (
        loginError instanceof ApiError &&
        loginError.status === 401 &&
        loginError.endpoint === '/auth/login'
      ) {
        setError('Email or password is incorrect.')
      } else if (loginError instanceof ApiError && loginError.status === 401) {
        setError('Your session could not be verified. Please sign in again.')
      } else {
        setError(loginError.message || 'Unable to sign in. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="login-layout">
      <div className="login-intro">
        <p className="eyebrow">SECURE WORKSPACE</p>
        <h1>Sign in to your<br /><span>health workspace.</span></h1>
        <p>
          Access the tools and information available to your account. Your role
          is verified by the Rog Rakshak service.
        </p>
        <div className="privacy-note">
          <span aria-hidden="true">✓</span>
          <span>Account permissions are checked by the server.</span>
        </div>
      </div>

      <form className="login-card" onSubmit={handleSubmit}>
        <div>
          <p className="eyebrow">WELCOME BACK</p>
          <h2>Sign in</h2>
          <p className="muted-copy">Use the email and password associated with your account.</p>
        </div>

        {(sessionError || error) && (
          <p className="form-message form-message-error" role="alert">
            {error || sessionError}
          </p>
        )}

        <label className="form-field">
          <span>Email address</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.org"
            required
            maxLength={254}
            disabled={submitting || isLoading}
          />
        </label>

        <label className="form-field">
          <span>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            required
            disabled={submitting || isLoading}
          />
        </label>

        <button className="button button-primary login-submit" type="submit" disabled={submitting || isLoading}>
          {submitting || isLoading ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="login-footnote">
          Public health statistics are available without signing in.
          <button className="text-button" type="button" onClick={() => navigate('/public')}>
            View public dashboard
          </button>
        </p>
      </form>
    </section>
  )
}

export default LoginPage
