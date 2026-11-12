import express from 'express'
import { auth } from 'express-oauth2-jwt-bearer'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises'

const audience = process.env.AUTH0_AUDIENCE
const issuerBaseURL = process.env.AUTH0_ISSUER_BASE_URL
if (!audience || !issuerBaseURL) throw new Error('Set AUTH0_AUDIENCE and AUTH0_ISSUER_BASE_URL in .env')
const app = express()
const port = 3001
const cities = {
  London: { latitude: 51.5072, longitude: -0.1276 },
  Tokyo: { latitude: 35.6762, longitude: 139.6503 },
  Shanghai: { latitude: 31.2304, longitude: 121.4737 },
  'New York': { latitude: 40.7128, longitude: -74.006 },
}
const storeFile = new URL('../data/settings.json', import.meta.url)
await mkdir(new URL('../data/', import.meta.url), { recursive: true })
let settings
try { settings = new Map(JSON.parse(await readFile(storeFile, 'utf8'))) }
catch (error) { if (error.code !== 'ENOENT') throw error; settings = new Map() }
let pendingWrite = Promise.resolve()
const subjectRef = (subject) => createHash('sha256').update(subject).digest('hex').slice(0, 12)
const defaults = { city: 'London', units: 'celsius', style: 'concise' }

app.disable('x-powered-by')
app.use(express.json({ limit: '8kb' }))
app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next() })
app.use('/api', auth({ audience, issuerBaseURL, tokenSigningAlg: 'RS256' }))
app.use('/api', (req, res, next) => {
  if (typeof req.auth?.payload.sub !== 'string') return res.status(401).json({ error: 'A user subject is required.' })
  next()
})
app.get('/api/settings', (req, res) => {
  res.json({ ...defaults, ...settings.get(req.auth.payload.sub), subjectRef: subjectRef(req.auth.payload.sub) })
})
app.put('/api/settings', async (req, res, next) => {
  try {
    const { city, units, style } = req.body ?? {}
    if (!Object.hasOwn(cities, city) || !['celsius', 'fahrenheit'].includes(units) || !['concise', 'detailed'].includes(style)) {
      return res.status(400).json({ error: 'Choose a supported city, temperature unit and response style.' })
    }
    const value = { city, units, style }
    const subject = req.auth.payload.sub
    const operation = pendingWrite.catch(() => {}).then(async () => {
      const updated = new Map(settings)
      updated.set(subject, value)
      await writeFile(new URL('../data/settings.tmp', import.meta.url), JSON.stringify([...updated]), { mode: 0o600 })
      await rename(new URL('../data/settings.tmp', import.meta.url), storeFile)
      settings = updated
    })
    pendingWrite = operation
    await operation
    res.json({ ...value, subjectRef: subjectRef(subject) })
  } catch (error) { next(error) }
})

app.post('/api/assistant', async (req, res, next) => {
  try {
    const message = req.body?.message
    if (typeof message !== 'string' || !message.trim() || message.length > 1000) {
      return res.status(400).json({ error: 'Send a message between 1 and 1000 characters.' })
    }
    // The agent calls the protected first-party API with the original bearer token.
    // Identity is always resolved from the verified JWT, never from a body parameter.
    const profileResponse = await fetch(`http://127.0.0.1:${port}/api/settings`, {
      headers: { Authorization: req.get('Authorization') }, signal: AbortSignal.timeout(8000),
    })
    if (!profileResponse.ok) throw new Error('Settings tool failed')
    const profile = await profileResponse.json()
    if (profile.subjectRef !== subjectRef(req.auth.payload.sub)) throw new Error('Identity context mismatch')
    const trace = [{ tool: 'First-party settings API', detail: `${profile.city} · ${profile.units} · ${profile.style}`, subjectRef: profile.subjectRef }]
    if (!/weather|plan|day|outside|umbrella|天气|安排|出门|雨伞|气温/i.test(message)) {
      return res.json({ reply: `I remember your preferences: ${profile.city}, ${profile.units}, ${profile.style}. Ask me to plan your day or check the weather.`, trace })
    }
    const url = new URL('https://api.open-meteo.com/v1/forecast')
    const location = cities[profile.city]
    for (const [key, value] of Object.entries({ ...location, current: 'temperature_2m,precipitation,weather_code', temperature_unit: profile.units, timezone: 'auto' })) url.searchParams.set(key, String(value))
    // Only city coordinates and units go to Open-Meteo. No bearer token or user ID is sent.
    const weatherResponse = await fetch(url, { signal: AbortSignal.timeout(12000) })
    if (!weatherResponse.ok) return res.status(502).json({ error: 'The weather service is unavailable. Please try again.' })
    const weather = await weatherResponse.json()
    const current = weather.current
    if (!current || !Number.isFinite(current.temperature_2m) || !Number.isFinite(current.precipitation)) throw new Error('Weather response is incomplete')
    trace.push({ tool: 'Open-Meteo Weather API', detail: `${profile.city} · observed ${current.time}`, subjectRef: profile.subjectRef })
    const unit = profile.units === 'celsius' ? '°C' : '°F'
    const advice = current.precipitation > 0 ? 'It is precipitating now; take an umbrella and plan an indoor backup.' : 'No precipitation is reported now; a short outdoor break is an option. Check the forecast again before leaving.'
    let reply = `Using your saved ${profile.city} preference and ${profile.units} units: it is ${current.temperature_2m}${unit}, with ${current.precipitation} mm of current precipitation. ${advice}`
    if (profile.style === 'detailed') reply += ` I retrieved your settings through the protected first-party API, then queried Open-Meteo for that city. The same authenticated session was preserved for both tools. Observation time: ${current.time} (${weather.timezone}). This is current weather, not a whole-day forecast.`
    res.json({ reply, trace, source: 'https://open-meteo.com/', weatherTime: current.time })
  } catch (error) { next(error) }
})
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error)
  const status = error.status === 401 ? 401 : error.status === 400 ? 400 : 502
  res.status(status).json({ error: status === 401 ? 'A valid Auth0 access token for this API is required.' : status === 400 ? 'Invalid request.' : 'A tool could not complete its request. Please try again.' })
})
app.listen(port, '127.0.0.1', () => console.log(`Context API listening on http://127.0.0.1:${port}`))
