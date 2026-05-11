# Project Inception + DAGRCMD — PRD

## Overview
Dual mobile app (React Native Expo):
- **Project Inception** (civilian) — JARVIS AI, stocks, PDF/PPTX generation, world crisis intel, hotspot clocks, accessibility narration
- **DAGRCMD** (military) — closed-channel walkie-talkie / comms with end-to-end encryption

## Tech Stack
- **Frontend**: Expo SDK 54, expo-router, react-native-svg, expo-av, expo-speech, expo-secure-store, tweetnacl, expo-location
- **Backend**: FastAPI + Motor, reportlab (PDF), python-pptx (PPTX), emergentintegrations (Claude Sonnet 4.5), openai (TTS+Whisper via Emergent gateway), httpx (Finnhub + GDELT/news)
- **External**: Finnhub (real-time stocks, free 60 req/min), GDELT/Finnhub general news (world crisis), Alpha Vantage (fallback)

## Implemented Features

### Project Inception
1. **Home Dashboard** — Logo + DAGRCMD switch + LIVE indicator, real-time stock tickers (Finnhub), animated JARVIS orb + dynamic greeting (TTS narrated), 3 action cards, bottom nav: WORLD / LIBRARY / SETTINGS.
2. **JARVIS Chat** — multi-turn Claude Sonnet 4.5; hold-to-speak (Whisper); tap volume to narrate any reply.
3. **Stock Tracker + Detail** — watchlist (persisted), sparklines, hourly/quarterly tabs, world news with sentiment, JARVIS BUY/HOLD/SELL recommendation.
4. **Document Generator** — AI-built PDF (reportlab) and PPTX (python-pptx) with outline preview, smart-quote normalization, 3-retry JSON parse, native share.
5. **Library** — list / open / share / delete generated docs.
6. **World Intel** (`/world`) — live crisis feed from Finnhub general news, categorized (MILITARY/GUERRILLA/UNREST/CRISIS) with hotspot tagging (Gaza, Ukraine, Sudan, etc.); horizontal timezone clocks for 26 hotspot cities (Gaza City, Beirut, Damascus, Sana'a, Tehran, Kabul, Mogadishu, Tripoli, Bamako, Kyiv, Pyongyang, Caracas, etc.).
7. **Settings** — voice on/off, premium voice (OpenAI TTS), motion toggle, about.

### DAGRCMD
1. **Enlistment / Auth** (`/dagrcmd`) — callsign + auth code + rank + unit; on-device X25519 keypair via `tweetnacl`, private key in `expo-secure-store`. Wipe identity option.
2. **COMMS** (`/dagrcmd/comms`) — list closed channels, create with member callsigns, generate 6-hex invite code, join by code, presence indicator.
3. **Channel** (`/dagrcmd/channel/[id]`) — real-time E2E encrypted chat via WebSocket relay:
   - **Text** — encrypted per-recipient via NaCl box (X25519 + XSalsa20-Poly1305)
   - **Push-to-talk audio** — hold mic to record, encrypt audio bytes, send; recipient decrypts and plays
   - **Location pings** — encrypted GPS coordinates
   - Server NEVER sees plaintext, only relays ciphertext map per recipient.

## Key Endpoints (all /api)
- Health: `GET /`, `GET /fonts/ionicons.ttf` (serves Ionicons font to bypass Metro asset bundling bug)
- Chat: `POST /chat`, `GET /chat/history/{session_id}`
- Stocks: `GET /stocks/quotes`, `/intraday/{sym}`, `/quarterly/{sym}`, `/news/{sym}`, `POST /stocks/recommendation`
- Docs: `POST /documents/generate`, `GET /documents`, `GET /documents/{id}`, `DELETE /documents/{id}`
- Voice: `POST /tts`, `POST /stt`
- Watchlist: `GET /watchlist/{user_id}`, `PUT /watchlist`
- World: `GET /world/crisis?category=all|military|guerrilla|unrest|crisis`, `GET /world/hotspots`
- DAGRCMD: `POST /dagrcmd/officers/register`, `/login`, `GET /dagrcmd/officers`, `POST /dagrcmd/channels`, `GET /dagrcmd/channels/{callsign}`, `POST /dagrcmd/channels/join`, `POST /dagrcmd/messages`, `GET /dagrcmd/messages/{channel_id}`, `WS /api/ws/dagrcmd/{callsign}?auth_code=...`

## Design
- **Project Inception**: true-black canvas, neon #D4FF00 + green/blue/purple accents, Rajdhani + Space Grotesk.
- **DAGRCMD**: tactical red (#FF1A1A) on near-black (#0A0000), monospace classified terminal aesthetic.

## Recent Fixes
- Real-time stocks via **Finnhub** (Alpha Vantage hit daily limit and switched to premium-only intraday)
- Fixed `expoFont.loadAsync` repeated error by serving Ionicons font from backend `/api/fonts/ionicons.ttf` and bypassing Metro's asset bundling under tunnel mode
- Added 3-retry + smart-quote normalization to AI document generation to fix intermittent JSONDecodeError

## Deferred
- DAGRCMD MAP / MISSIONS / SYSTEMS tabs (only COMMS implemented)
- "Guide-to-cover" GPS feature (real GPS works via expo-location, cover-point lookup TBD)
- Per-channel key rotation
- Auto hourly stock snapshot & quarterly snapshot job

## Smart Business Enhancement
Every document and DAGRCMD channel persists with metadata enabling a future Pro tier (unlimited gens, premium voice, larger channels) and shareable PDF links for monetization.
