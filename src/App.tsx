import { useAuth0 } from '@auth0/auth0-react'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'
import './Assistant.css'

type Settings = { city: string; units: string; style: string; subjectRef: string }
type Trace = { tool: string; detail: string; subjectRef: string }
type Message = { role: 'user' | 'assistant'; text: string; trace?: Trace[] }
const emptySettings = { city: 'London', units: 'celsius', style: 'concise', subjectRef: '' }

export default function App() {
  const { isAuthenticated, isLoading, error: authError, user, loginWithRedirect, logout, getAccessTokenSilently } = useAuth0()
  const [settings, setSettings] = useState<Settings>(emptySettings)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [input, setInput] = useState('Plan my day using my saved preferences.')
  const [messages, setMessages] = useState<Message[]>([])
  async function api(path: string, method = 'GET', body?: unknown) {
    const token = await getAccessTokenSilently()
    const response = await fetch(path, {
      method, headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Request failed')
    return data
  }
  useEffect(() => {
    let active = true
    if (isAuthenticated) {
      api('/api/settings').then((data) => { if (active) { setSettings(data); setReady(true) } })
        .catch((err: Error) => { if (active) setError(err.message) })
    } else { setReady(false); setMessages([]); setSettings(emptySettings) }
    return () => { active = false }
    // The identity change is the lifecycle boundary for protected settings.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, getAccessTokenSilently])
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    try { setSettings(await api('/api/settings', 'PUT', settings)); setNotice('Preferences saved to your protected API profile.') }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not save settings') }
    finally { setBusy(false) }
  }
  async function send(event: FormEvent) {
    event.preventDefault()
    const text = input.trim()
    if (!text || busy) return
    setBusy(true); setError(''); setInput('')
    setMessages((previous) => [...previous, { role: 'user', text }])
    try {
      const result = await api('/api/assistant', 'POST', { message: text })
      setMessages((previous) => [...previous, { role: 'assistant', text: result.reply, trace: result.trace }])
    } catch (err) { setError(err instanceof Error ? err.message : 'The assistant could not respond'); setInput(text) }
    finally { setBusy(false) }
  }
  return <div className="assistant-page">
    <header className="assistant-header"><a className="brand" href="/">◈ Context Assistant</a><span>{isAuthenticated ? user?.name : 'Identity stays with your conversation'}</span>{isAuthenticated && <button onClick={() => void logout({ logoutParams: { returnTo: window.location.origin } })}>Sign out</button>}</header>
    <main className="assistant-main">
      <div className="assistant-heading"><p className="eyebrow">AUTH0 · FIRST-PARTY API · OPEN-METEO</p><h1>A little context.<br /><span>A better day.</span></h1><p>Your saved preferences guide every weather request in this conversation.</p></div>
      {(error || authError) && <div className="error-banner" role="alert">{error || authError?.message}</div>}
      {isLoading ? <p role="status">Checking your session…</p> : !isAuthenticated ? <section className="auth-card"><h2>Your personal assistant starts here.</h2><p>Sign in with Auth0 to load your own settings and plan around the weather.</p><button className="button button-primary" onClick={() => void loginWithRedirect()}>Sign in with Auth0 →</button></section> : <div className="workspace">
        <aside className="preferences"><p className="eyebrow">YOUR CONTEXT</p><h2>Make it personal.</h2><form onSubmit={(event) => void save(event)}>
          <label>City<select aria-label="City" value={settings.city} onChange={(e) => setSettings({ ...settings, city: e.target.value })}>{['London', 'Tokyo', 'Shanghai', 'New York'].map((city) => <option key={city}>{city}</option>)}</select></label>
          <label>Temperature<select aria-label="Temperature" value={settings.units} onChange={(e) => setSettings({ ...settings, units: e.target.value })}><option value="celsius">Celsius °C</option><option value="fahrenheit">Fahrenheit °F</option></select></label>
          <label>Response style<select aria-label="Response style" value={settings.style} onChange={(e) => setSettings({ ...settings, style: e.target.value })}><option value="concise">Concise</option><option value="detailed">Detailed</option></select></label>
          <button className="button button-primary" disabled={busy || !ready}>Save preferences</button>
        </form>{notice && <p role="status" className="notice">{notice}</p>}<div className="identity-note">Signed-in context<br /><code>{settings.subjectRef || 'Loading…'}</code><p>A short identity reference from the verified token. Your account ID and token stay out of weather requests.</p></div></aside>
        <section className="conversation" aria-label="Assistant conversation"><div className="conversation-top"><h2>Your day, with context.</h2><span className="session-badge">Authenticated session</span></div>
          <div className="messages" aria-live="polite">{messages.length === 0 && <div className="empty-chat"><span>☀</span><h3>What does your day look like?</h3><p>Save a city and ask me to plan your day. I’ll read your protected preferences and check current weather.</p><small>This demo uses a deterministic tool planner; it does not use an LLM.</small></div>}{messages.map((message, index) => <article key={index} className={`message ${message.role}`}><strong>{message.role === 'user' ? 'You' : 'Context Assistant'}</strong><p>{message.text}</p>{message.trace && <details open><summary>Tools used · same user context</summary>{message.trace.map((step) => <div className="trace-step" key={step.tool}><b>{step.tool}</b><span>{step.detail}</span><code>User context: {step.subjectRef}</code></div>)}<a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Weather data by Open-Meteo</a></details>}</article>)}{busy && <p role="status">Working with your context…</p>}</div>
          <form className="composer" onSubmit={(event) => void send(event)}><input aria-label="Message" maxLength={1000} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Plan my day using my preferences…" /><button disabled={busy || !ready || !input.trim()}>Send →</button></form>
        </section>
      </div>}
    </main><footer className="assistant-footer">Your identity → your settings → current weather. <a href="https://open-meteo.com/">Weather data: Open-Meteo · CC BY 4.0</a></footer>
  </div>
}
