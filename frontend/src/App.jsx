import { useCallback, useEffect, useState } from 'react'
import { apiRequest, UNAUTHORIZED_EVENT } from './api/client'
import { AuthProvider, useAuth } from './auth/AuthContext'
import LoginPage from './pages/LoginPage'
import PublicDashboard from './pages/PublicDashboard'
import RoleDashboard from './pages/RoleDashboard'
import HospitalReportPage from './pages/HospitalReportPage'
import HospitalMinePage from './pages/HospitalMinePage'
import MedicalOfficerPendingPage from './pages/MedicalOfficerPendingPage'
import MedicalOfficerReviewPage from './pages/MedicalOfficerReviewPage'
import MedicalOfficerHistoryPage from './pages/MedicalOfficerHistoryPage'
import './App.css'

const protectedRoutes = {
  '/hospital': 'HOSPITAL',
  '/hospital/reports': 'HOSPITAL',
  '/hospital/mine': 'HOSPITAL',
  '/medical-officer': 'MEDICAL_OFFICER',
  '/medical-officer/pending': 'MEDICAL_OFFICER',
  '/medical-officer/review': 'MEDICAL_OFFICER',
  '/medical-officer/history': 'MEDICAL_OFFICER',
  '/admin': 'ADMIN',
}

const roleHome = {
  PUBLIC: '/public',
  HOSPITAL: '/hospital',
  MEDICAL_OFFICER: '/medical-officer',
  ADMIN: '/admin',
}

const roleLabels = {
  PUBLIC: 'Public',
  HOSPITAL: 'Hospital',
  MEDICAL_OFFICER: 'Medical Officer',
  ADMIN: 'Administrator',
}

function getMedicalOfficerReviewReportId(path) {
  const match = path.match(/^\/medical-officer\/review\/([^/]+)$/)
  if (!match) return null

  try {
    return decodeURIComponent(match[1])
  } catch {
    return ''
  }
}

const roleNavigation = {
  PUBLIC: [{ label: 'Public overview', path: '/public' }],
  HOSPITAL: [
    { label: 'Workspace', path: '/hospital' },
    { label: 'Report submission', path: '/hospital/reports' },
    { label: 'My reports', path: '/hospital/mine' },
  ],
  MEDICAL_OFFICER: [
    { label: 'Workspace', path: '/medical-officer' },
    { label: 'Pending reports', path: '/medical-officer/pending' },
    { label: 'Review reports', path: '/medical-officer/review' },
    { label: 'Review history', path: '/medical-officer/history' },
  ],
  ADMIN: [{ label: 'Management', path: '/admin' }],
}

function AppLink({ to, navigate, className = '', children, ...props }) {
  return (
    <a
      href={to}
      className={className}
      onClick={(event) => {
        if (
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return
        }
        event.preventDefault()
        navigate(to)
      }}
      {...props}
    >
      {children}
    </a>
  )
}

function SiteHeader({ path, navigate }) {
  const { user, logout } = useAuth()
  const [health, setHealth] = useState('checking')
  const [retry, setRetry] = useState(0)
  const navItems = user ? roleNavigation[user.role] || [] : []

  useEffect(() => {
    const controller = new AbortController()
    setHealth('checking')
    apiRequest('/health', { authenticated: false, signal: controller.signal })
      .then(({ status }) => setHealth(status === 'ok' ? 'connected' : 'disconnected'))
      .catch((error) => {
        if (error.name !== 'AbortError') setHealth('disconnected')
      })
    return () => controller.abort()
  }, [retry])

  function handleLogout() {
    logout()
    navigate('/public', { replace: true })
  }

  const healthLabels = {
    checking: 'Checking API',
    connected: 'API connected',
    disconnected: 'API unavailable',
  }

  return (
    <header className="site-header">
      <div className="header-inner">
        <AppLink className="brand" to="/public" navigate={navigate} aria-label="Rog Rakshak public dashboard">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span>Rog<span className="brand-accent">Rakshak</span></span>
        </AppLink>

        <nav className="main-nav" aria-label="Main navigation">
          <AppLink className={path === '/' || path === '/public' ? 'nav-link active' : 'nav-link'} to="/public" navigate={navigate}>
            Public data
          </AppLink>
          {navItems.map((item) => {
            const isActive = path === item.path || (
              item.path === '/medical-officer/review' &&
              path.startsWith('/medical-officer/review/')
            )
            return (
              <AppLink
                className={isActive ? 'nav-link active' : 'nav-link'}
                key={item.path}
                to={item.path}
                navigate={navigate}
                aria-current={isActive ? 'page' : undefined}
              >
                {item.label}
              </AppLink>
            )
          })}
          {!user && (
            <AppLink
              className="nav-link"
              to="/public#about"
              navigate={(to) => {
                navigate(to)
                window.setTimeout(() => document.getElementById('about')?.scrollIntoView(), 0)
              }}
            >
              About
            </AppLink>
          )}
        </nav>

        <div className="header-actions">
          <div className={`connection connection-${health}`} aria-live="polite">
            <span className="connection-dot" />
            <span>{healthLabels[health]}</span>
            {health === 'disconnected' && (
              <button className="retry-button" type="button" onClick={() => setRetry((value) => value + 1)}>
                Retry
              </button>
            )}
          </div>
          {user ? (
            <div className="account-actions">
              <span className="account-label">
                <strong>{user.firstName}</strong>
                <small>{roleLabels[user.role] || 'Account'}</small>
              </span>
              <button className="button button-outline button-small" type="button" onClick={handleLogout}>
                Sign out
              </button>
            </div>
          ) : (
            <AppLink className="button button-primary button-small" to="/login" navigate={navigate}>
              Sign in
            </AppLink>
          )}
        </div>
      </div>
    </header>
  )
}

function LoadingPage({ message = 'Loading your workspace…' }) {
  return (
    <div className="state-card page-state" role="status">
      <span className="loading-spinner" aria-hidden="true" />
      {message}
    </div>
  )
}

function AccessDenied({ actualRole, requiredRole, navigate }) {
  return (
    <section className="access-denied page-state">
      <span className="denied-icon" aria-hidden="true">!</span>
      <p className="eyebrow">ACCESS RESTRICTED</p>
      <h1>This workspace is not available to your account.</h1>
      <p>
        You are signed in as {roleLabels[actualRole] || 'a different role'}.
        This page requires the {roleLabels[requiredRole]} role.
      </p>
      <button className="button button-primary" type="button" onClick={() => navigate(roleHome[actualRole] || '/public')}>
        Go to my workspace
      </button>
    </section>
  )
}

function NotFound({ navigate }) {
  return (
    <section className="access-denied page-state">
      <p className="eyebrow">PAGE NOT FOUND</p>
      <h1>We could not find that page.</h1>
      <button className="button button-primary" type="button" onClick={() => navigate('/public')}>
        View public dashboard
      </button>
    </section>
  )
}

function RouterApp() {
  const { user, isLoading } = useAuth()
  const [path, setPath] = useState(() => window.location.pathname)
  const navigate = useCallback((target, { replace = false, state = {} } = {}) => {
    const method = replace ? 'replaceState' : 'pushState'
    window.history[method](state, '', target)
    setPath(window.location.pathname)
    window.scrollTo(0, 0)
  }, [])
  const reviewReportId = getMedicalOfficerReviewReportId(path)
  const requiredRole = protectedRoutes[path] || (
    reviewReportId !== null ? 'MEDICAL_OFFICER' : null
  )

  useEffect(() => {
    function handlePopState() {
      setPath(window.location.pathname)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    function handleUnauthorized() {
      navigate('/login', { replace: true })
    }
    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized)
  }, [navigate])

  useEffect(() => {
    if (isLoading) return
    if (path === '/login' && user) {
      navigate(roleHome[user.role] || '/public', { replace: true })
      return
    }
    if (requiredRole && !user) {
      navigate('/login', { replace: true })
    }
  }, [isLoading, navigate, path, requiredRole, user])

  let content
  if (path === '/' || path === '/public') {
    content = <PublicDashboard />
  } else if (path === '/login') {
    content = user
      ? <LoadingPage message="Opening your workspace…" />
      : <LoginPage navigate={navigate} />
  } else if (requiredRole) {
    if (isLoading || !user) {
      content = <LoadingPage />
    } else if (user.role !== requiredRole) {
      content = <AccessDenied actualRole={user.role} requiredRole={requiredRole} navigate={navigate} />
    } else if (path === '/hospital/reports') {
      content = <HospitalReportPage navigate={navigate} />
    } else if (path === '/hospital/mine') {
      content = <HospitalMinePage />
    } else if (path === '/medical-officer/pending') {
      content = <MedicalOfficerPendingPage navigate={navigate} />
    } else if (path === '/medical-officer/history') {
      content = <MedicalOfficerHistoryPage />
    } else if (path === '/medical-officer/review' || reviewReportId !== null) {
      content = (
        <MedicalOfficerReviewPage
          key={reviewReportId ?? 'review'}
          reportId={reviewReportId}
          navigate={navigate}
        />
      )
    } else {
      content = <RoleDashboard role={user.role} path={path} navigate={navigate} />
    }
  } else {
    content = <NotFound navigate={navigate} />
  }

  return (
    <div className="app-shell">
      <SiteHeader path={path} navigate={navigate} />
      {user && (
        <div className="authenticated-banner">
          Signed in as <strong>{user.firstName} {user.lastName}</strong>
          <span>{roleLabels[user.role] || 'Account'}</span>
        </div>
      )}
      <main className={path === '/' || path === '/public' ? 'main-content public-content' : 'main-content'}>
        {content}
      </main>
      <footer className="site-footer">
        <AppLink className="brand footer-brand" to="/public" navigate={navigate}>
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span>Rog<span className="brand-accent">Rakshak</span></span>
        </AppLink>
        <p>Building awareness for healthier communities.</p>
        <span className="footer-stage">Verified, area-level information</span>
      </footer>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <RouterApp />
    </AuthProvider>
  )
}

export default App
