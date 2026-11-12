import { Auth0Provider } from '@auth0/auth0-react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

function SetupRequired() {
  return (
    <main className="setup-shell">
      <section className="setup-card" aria-labelledby="setup-title">
        <div className="brand setup-brand">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M12 3.25 19 6v5.2c0 4.6-2.9 8.15-7 9.55-4.1-1.4-7-4.95-7-9.55V6l7-2.75Z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
              <path
                d="M9.4 11.6 11.2 13.4l3.55-3.8"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span>AuthFlow</span>
        </div>

        <p className="eyebrow">ONE-TIME SETUP</p>
        <h1 id="setup-title">Connect your Auth0 app.</h1>
        <p className="setup-copy">
          Add your Single Page Application’s Domain and Client ID to a local
          <code>.env</code> file to enable the login flow.
        </p>

        <div className="env-example" aria-label="Required environment variables">
          <code>VITE_AUTH0_DOMAIN=your-tenant.us.auth0.com</code>
          <code>VITE_AUTH0_CLIENT_ID=your-client-id</code>
        </div>

        <ol className="setup-steps">
          <li>Create a Single Page Application in your Auth0 Dashboard.</li>
          <li>
            Allow <code>http://localhost:5173</code> for callback, logout, and
            web origin URLs.
          </li>
          <li>
            Copy <code>.env.example</code> to <code>.env</code>, add the values,
            and restart the dev server.
          </li>
        </ol>

        <p className="setup-footnote">
          Local environment files are ignored by Git and won’t be included in
          the repository.
        </p>
      </section>
    </main>
  )
}

const domain = import.meta.env.VITE_AUTH0_DOMAIN?.trim()
const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID?.trim()
const root = document.getElementById('root')

if (!root) {
  throw new Error('The application root element was not found.')
}

createRoot(root).render(
  <StrictMode>
    {domain && clientId ? (
      <Auth0Provider
        domain={domain}
        clientId={clientId}
        authorizationParams={{ redirect_uri: window.location.origin, audience: import.meta.env.VITE_AUTH0_AUDIENCE }}
      >
        <App />
      </Auth0Provider>
    ) : (
      <SetupRequired />
    )}
  </StrictMode>,
)
