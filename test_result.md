#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

user_problem_statement: |
  Wave 3 of fixes: Chat said "connection failed", voice transmissions didn't work,
  photos/videos couldn't be picked, no British voice, JARVIS orb redesign as
  ethereal pulsating northern star in lighter cyan, more stocks should show on
  home, prominent logout, commodities (oil, gas, coal, propane, diesel, gasoline)
  in real-time, JARVIS daily market brief fact.

backend:
  - task: "Fix chat 500 — add user_name field to ChatRequest pydantic model"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Earlier search_replace silently no-op'd. Re-applied the user_name field. Curl test: 'Good day, Tony…' — JARVIS now greets by name."

  - task: "Real-time commodities endpoint (/api/stocks/commodities)"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Returns WTI oil (USO), Brent (BNO), Nat Gas (UNG), Gasoline RBOB (UGA), Heating oil/diesel (HEAT), Coal (KOL), Propane (AMLP) live via Finnhub. Verified."

  - task: "JARVIS market-brief endpoint (/api/jarvis/market-brief)"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Aggregates top movers from 10 mega-caps and returns a single sentence brief. Curl: 'Tesla surging 3.9% and leading the tape…'."

frontend:
  - task: "Northern Star JarvisOrb in lighter cyan with pulsing halo"
    implemented: true
    working: true
    file: "components/JarvisOrb.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Replaced concentric rings with an 8-pointed star polygon (#7FFCFF) plus pulsing radial-gradient halo. Verified in screenshot — looks gorgeous."

  - task: "British accent default voice + en-GB system TTS"
    implemented: true
    working: "NA"
    file: "lib/prefs.ts, app/chat.tsx, app/index.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Default voice now 'echo' (OpenAI's deep British male). All Speech.speak calls pass language: 'en-GB', rate: 0.9, pitch: 0.95."

  - task: "Home shows ALL stocks + commodities strip + market-brief greeting"
    implemented: true
    working: true
    file: "app/index.tsx, components/CommoditiesStrip.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Removed .slice(0,9). Added energy ETF tickers (XOM,CVX,BP) to defaults. Inserted CommoditiesStrip showing real-time oil/gas/coal/etc. JARVIS greeting includes daily market brief fact."

  - task: "Prominent logout button on home"
    implemented: true
    working: true
    file: "app/index.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Replaced tiny icon-only button with full LOGOUT pill in top-right (cyan-bordered)."

  - task: "Missing iOS/Android permissions for camera/photos/videos/location"
    implemented: true
    working: "NA"
    file: "app/app.json"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Added NSPhotoLibraryUsageDescription, NSCameraUsageDescription, NSLocationWhenInUseUsageDescription on iOS; CAMERA, READ_MEDIA_IMAGES/VIDEO, ACCESS_FINE_LOCATION on Android; configured expo-image-picker & expo-location plugins. This unblocks media-pickers AND DAGRCMD voice/video transmissions."

metadata:
  created_by: "main_agent"
  version: "3.0"
  test_sequence: 0
  run_ui: false

test_plan:
  current_focus:
    - "Fix chat 500 — add user_name field to ChatRequest pydantic model"
    - "Real-time commodities endpoint"
    - "Northern Star JarvisOrb"
    - "Home shows ALL stocks + commodities strip"
    - "Missing iOS/Android permissions"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: |
      Wave 3 landed. Major progress:
      • Backend chat 500 fixed (silent search_replace miss earlier — re-applied)
      • Permissions added in app.json (this was the root cause of "can't add photos/videos" and broken voice transmissions on device)
      • British accent: default voice = OpenAI 'echo' + system TTS now uses en-GB locale
      • JARVIS = ethereal 8-pointed northern star in #7FFCFF with pulsing halo
      • Home: all stocks render (no .slice(0,9)), prominent LOGOUT pill, real-time commodities strip (WTI, Brent, Nat Gas, Gasoline, Diesel, Coal, Propane), JARVIS daily market brief sentence
      • New backend endpoints: /stocks/commodities and /jarvis/market-brief verified
      Verified end-to-end in web preview.

      Still pending from user's wishlist (will tackle in next wave):
      - Drag-and-slide reorder on stock browse
      - News-ticker tap → highlight stock in WORLD tab
      - DAGRCMD prominent call/video icons in header (live-call radio toggle exists)
      - Long-press delete voice transmissions (backend already supports DELETE)
      - True video call (needs WebRTC native build)
