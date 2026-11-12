# Context Assistant

A full-stack identity-preserving personal assistant for the MLH Auth0 challenge. It uses Auth0 Universal Login, an Express first-party settings API protected by verified access tokens, and the public Open-Meteo weather API.

The assistant uses a deterministic tool planner for weather and day-planning requests. It does not require or claim to use an LLM. Every turn retrieves the current authenticated user's saved city, temperature unit and response style from the protected API, then uses those preferences to call Open-Meteo.

## Run

Requires Node 22.12+ and npm. Copy `.env.example` to `.env`, fill the Domain and Client ID of an Auth0 Single Page Application, and create an Auth0 API with the identifier `https://context-assistant.local/api` and RS256 signing. Set that identifier in both audience variables; set the issuer to your tenant's HTTPS URL.

The SPA must allow `http://localhost:5173` in Allowed Callback URLs, Allowed Logout URLs and Allowed Web Origins.

```sh
npm install
npm run dev
```

Open http://localhost:5173. The frontend proxies `/api` to the backend on loopback port 3001. Sign in, save your own preferences, and send "Plan my day using my saved preferences." The answer references those preferences and current weather; the tool trace shows the same identity reference for both calls. Change the preference and send another turn to see that the same session uses the updated setting.

## Identity boundaries

- The backend verifies JWT signature, issuer, audience and expiry with `express-oauth2-jwt-bearer`.
- Settings are keyed only by the verified JWT `sub`. A client cannot select another user's subject.
- The assistant forwards the same bearer token to the protected first-party settings API, then checks that its subject reference matches the authenticated request.
- Open-Meteo receives only the selected public city coordinates and units. No user ID or Auth0 token is sent to the third-party weather service. This public endpoint does not need delegated OAuth access or Token Vault.
- Settings persist locally in ignored `data/settings.json`; `.env` is ignored too. Tokens remain in the Auth0 SDK's in-memory cache.
- Weather answers report an observation timestamp and do not claim to be a full-day forecast. Failed tool requests produce an error rather than invented weather.

## Sources

- [Auth0 React Quickstart](https://auth0.com/docs/quickstart/spa/react)
- [Auth0 Express API Quickstart](https://auth0.com/docs/quickstart/backend/nodejs)
- [Open-Meteo API documentation](https://open-meteo.com/en/docs) — weather data attributed under CC BY 4.0.
