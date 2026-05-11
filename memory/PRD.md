# Project Inception — PRD

## Overview
Civilian AI assistant mobile app (React Native Expo) with sci-fi/Iron-Man-inspired interface. Helps users with stocks, market intelligence, and AI-powered document generation (PDF/PPTX). Includes voice narration mode for blind/low-vision users.

## Tech Stack
- **Frontend**: Expo SDK 54 (file-based router), react-native-svg, expo-av, expo-speech, expo-file-system, expo-sharing, Google Fonts (Rajdhani + Space Grotesk)
- **Backend**: FastAPI + Motor (MongoDB), reportlab (PDF), python-pptx (PPTX), emergentintegrations (Claude Sonnet 4.5), openai SDK (TTS + Whisper via Emergent gateway)
- **External**: Alpha Vantage (real-time stocks + news sentiment) — graceful mock fallback on rate limit

## Implemented (v1)
1. **Home Dashboard** — Logo header + LIVE indicator, 3 stock tickers with sparklines, animated JARVIS orb + dynamic greeting (TTS narrated on tap), 3 action cards, bottom nav.
2. **JARVIS Chat** (`/chat`) — Multi-turn Claude Sonnet 4.5; hold-to-speak with Whisper; long-press or tap volume icon to narrate any reply.
3. **Stock Tracker** (`/stocks`) — Watchlist (persisted to Mongo), add/remove tickers, sparklines, SIM badge when AV fallback used.
4. **Stock Detail** (`/stock/[symbol]`) — Hourly/Quarterly tabs, large chart, JARVIS BUY/HOLD/SELL AI recommendation (confidence + reasoning), world-news feed with sentiment.
5. **Document Generator** (`/document`) — Prompt input with preset suggestions, PDF/PPTX format toggle, AI outline preview, export/share via expo-sharing.
6. **Library** (`/library`) — All generated docs, open/share, delete.
7. **Settings** (`/settings`) — Voice narration toggle, Premium voice (OpenAI TTS) test, animations toggle, About.

## Key Backend Endpoints (all /api)
- `GET /` health, `POST /chat`, `GET /chat/history/{session_id}`
- `GET /stocks/quotes?symbols=...`, `GET /stocks/intraday/{symbol}`, `GET /stocks/quarterly/{symbol}`, `GET /stocks/news/{symbol}`, `POST /stocks/recommendation`
- `POST /documents/generate`, `GET /documents`, `GET /documents/{id}`, `DELETE /documents/{id}`
- `POST /tts`, `POST /stt`
- `GET /watchlist/{user_id}`, `PUT /watchlist`

## Design
- True black bg (#000), neon yellow primary (#D4FF00), green/blue/purple accents per card
- Rajdhani (heading, sci-fi) + Space Grotesk (body)
- Animated JARVIS orb: SVG concentric rings, reanimated rotation + pulse

## Deferred
- DAGRCMD (military) twin app — to build after Inception is finalized.
- Hourly auto-refresh / quarterly scheduled snapshots (current refresh is manual pull-to-refresh + LIVE labels)
- True blind mode (screen-reader walkthrough of all screens)

## Smart Business Enhancement
The Library auto-persists every generated doc with metadata + base64 — enables a future "Pro" tier (unlimited generations, premium voice, more tickers) and shareable doc links for monetization.
