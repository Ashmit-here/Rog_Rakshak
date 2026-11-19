import { useEffect, useState } from 'react'
import './App.css'

const healthUrl = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api'}/health`

function App() {
  const [connection, setConnection] = useState('checking')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    async function checkBackend() {
      setConnection('checking')

      try {
        const response = await fetch(healthUrl, { signal: controller.signal })

        if (!response.ok) {
          throw new Error(`Health check failed with status ${response.status}`)
        }

        const health = await response.json()
        if (health.status !== 'ok') {
          throw new Error('The API returned an unhealthy status')
        }

        setConnection('connected')
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('Unable to connect to the backend:', error)
          setConnection('disconnected')
        }
      }
    }

    checkBackend()

    return () => controller.abort()
  }, [retry])

  const connectionMessage = {
    checking: 'Checking backend connection',
    connected: 'Backend connected',
    disconnected: 'Backend not connected',
  }[connection]

  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="brand" href="#home" aria-label="Rog Rakshak home">
          <span className="brand-mark" aria-hidden="true">
            <span />
          </span>
          <span>Rog<span className="brand-accent">Rakshak</span></span>
        </a>
        <nav className="main-nav" aria-label="Main navigation">
          <a href="#approach">Our approach</a>
          <a href="#about">About the project</a>
        </nav>
        <div className={`connection connection-${connection}`} aria-live="polite">
          <span className="connection-dot" />
          <span>{connectionMessage}</span>
          {connection === 'disconnected' && (
            <button
              className="retry-button"
              onClick={() => setRetry((current) => current + 1)}
              type="button"
            >
              Retry
            </button>
          )}
        </div>
      </header>

      <main>
        <section className="hero" id="home">
          <div className="hero-copy">
            <p className="eyebrow"><span /> COMMUNITY HEALTH, IN FOCUS</p>
            <h1>Better awareness.<br /><span>Healthier communities.</span></h1>
            <p className="hero-description">
              Rog_Rakshak is an area-based disease surveillance project designed
              to help communities and public-health teams stay informed.
            </p>
            <a className="primary-link" href="#approach">
              Discover our approach <span aria-hidden="true">→</span>
            </a>
            <p className="hero-note">
              A project for timely awareness and informed public-health action.
            </p>
          </div>

          <div className="hero-art" aria-hidden="true">
            <div className="art-orbit orbit-outer" />
            <div className="art-orbit orbit-inner" />
            <div className="art-center">
              <span className="art-cross">+</span>
              <span className="art-center-label">Community<br />wellbeing</span>
            </div>
            <span className="art-point point-one" />
            <span className="art-point point-two" />
            <span className="art-point point-three" />
            <div className="art-caption">
              <span className="caption-icon">⌖</span>
              <span><strong>Area-based</strong><br />health awareness</span>
            </div>
            <span className="art-decoration decoration-one" />
            <span className="art-decoration decoration-two" />
          </div>
        </section>

        <section className="approach-section" id="approach">
          <div className="section-heading">
            <p className="eyebrow">HOW WE THINK</p>
            <h2>Public health starts with understanding place.</h2>
            <p>
              Disease surveillance helps make health information useful at a
              community level. Our first step is building a clear, responsible
              foundation for that work.
            </p>
          </div>
          <div className="approach-grid">
            <article className="approach-card">
              <span className="card-number">01</span>
              <h3>See the bigger picture</h3>
              <p>Organize health awareness around the areas communities call home.</p>
            </article>
            <article className="approach-card">
              <span className="card-number">02</span>
              <h3>Support early awareness</h3>
              <p>Make it easier to understand health signals and where attention may be needed.</p>
            </article>
            <article className="approach-card">
              <span className="card-number">03</span>
              <h3>Keep people at the center</h3>
              <p>Build with a focus on clarity, responsibility, and community wellbeing.</p>
            </article>
          </div>
        </section>

        <section className="about-section" id="about">
          <div className="about-symbol" aria-hidden="true">+</div>
          <div>
            <p className="eyebrow">ABOUT ROG_RAKSHAK</p>
            <h2>A foundation for area-based disease surveillance.</h2>
            <p>
              This project is in its first development stage. No disease
              statistics are shown until reliable data is available.
            </p>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <a className="brand footer-brand" href="#home">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span>Rog<span className="brand-accent">Rakshak</span></span>
        </a>
        <p>Building awareness for healthier communities.</p>
        <span className="footer-stage">Development stage 01</span>
      </footer>
    </div>
  )
}

export default App
