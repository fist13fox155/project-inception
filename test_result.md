#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

user_problem_statement: |
  Dual-mode app: (A) Project Inception (civilian) - real-time stocks, world crisis news,
  JARVIS AI chat with TTS, PDF/PPTX generation; (B) DAGRCMD (military) - encrypted
  walkie-talkie comms, troop tracker map. Bug fix wave: icons missing, audio glitchy,
  insane stock values, no Project Inception login, missing personalized name, no news
  banner, plain background. Plus add: phone calls, video calls, image+video sharing
  in DAGRCMD.

frontend:
  - task: "Migrate Ionicons -> lucide-react-native via Icon wrapper"
    implemented: true
    working: true
    file: "components/Icon.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Created drop-in Icon wrapper mapping all Ionicons names to Lucide SVG components. Removed hacky font-download code from _layout.tsx. Bulk sed-replaced Ionicons in all 13 screens. Screenshot confirms icons render."

  - task: "Project Inception Login (name + 4-digit PIN)"
    implemented: true
    working: true
    file: "app/login.tsx, lib/prefs.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "New /login route with REGISTER/LOGIN modes. SecureStore on native, localStorage on web. JARVIS addresses user by chosen name throughout app."

  - task: "Cyan ethereal pulsing orb background"
    implemented: true
    working: true
    file: "components/EtherealOrbBackground.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Pure react-native-svg radial-gradient orb with reanimated pulse + drift. Visible on home and login. Screenshot looks gorgeous."

  - task: "News ticker banner on home screen"
    implemented: true
    working: true
    file: "components/NewsTicker.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Horizontally auto-scrolling Animated.View interleaving stock prices and crisis headlines from /api/world/crisis. Tap → /world."

  - task: "Stock invalid value filtering + auto-cleanup"
    implemented: true
    working: true
    file: "app/index.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Filter quotes: price>0 AND price<1M AND |change_pct|<100 AND sparkline.length>1. Invalid tickers are PUT back to watchlist endpoint to clean storage."

  - task: "DAGRCMD audio playback fix (file-based not data URI)"
    implemented: true
    working: "NA"
    file: "app/dagrcmd/channel/[id].tsx, app/chat.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Switched from data:audio/m4a;base64,... URI to writing b64 to FileSystem cache and loading via Audio.Sound.createAsync(uri). Static import of expo-file-system/legacy."

  - task: "DAGRCMD live phone call (broadcast audio mode)"
    implemented: true
    working: "NA"
    file: "app/dagrcmd/channel/[id].tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Continuous 2.5-sec record loop sends encrypted audio chunks via WS. All channel members auto-play incoming chunks. Toggle via radio icon in header."

  - task: "DAGRCMD video sharing"
    implemented: true
    working: "NA"
    file: "app/dagrcmd/channel/[id].tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "ImagePicker.MediaTypeOptions.Videos with 15s/8MB cap. Saved to cache and opened via expo-sharing."

  - task: "DAGRCMD auto-locate user on map load"
    implemented: true
    working: "NA"
    file: "app/dagrcmd/map.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Auto-request location permission on mount, then loadAll() pins user as 'me' (green marker)."

  - task: "Settings: edit Architect name + sign out + reset PIN"
    implemented: true
    working: "NA"
    file: "app/settings.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "New Identity card lets user rename JARVIS user, sign out, or wipe and re-enroll."

backend:
  - task: "Chat endpoint accepts user_name and personalizes system prompt"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "ChatRequest got optional user_name; JARVIS_SYSTEM appended with the name so Claude addresses the user properly."

metadata:
  created_by: "main_agent"
  version: "2.0"
  test_sequence: 0
  run_ui: false

test_plan:
  current_focus:
    - "Project Inception Login (name + 4-digit PIN)"
    - "Cyan ethereal pulsing orb background"
    - "Stock invalid value filtering + auto-cleanup"
    - "DAGRCMD audio playback fix"
    - "DAGRCMD live phone call (broadcast audio mode)"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: |
      Big feature/bug-fix wave landed. Major changes:
      • Icons: full swap to lucide-react-native via components/Icon.tsx — chronic font-load issue is dead.
      • New /login screen (name + 4-digit PIN) gates the home; SecureStore native + localStorage web.
      • Home: cyan ethereal orb background, scrolling news+stocks ticker, 3x3 grid with invalid-value auto-cleanup, personalized JARVIS greeting.
      • Chat: passes user_name so Claude greets by name.
      • DAGRCMD channel: video sharing button, live-call audio broadcast mode, audio playback now uses file URI not data URI.
      • DAGRCMD map: auto-requests location to pin user.
      • Settings: edit Architect name, sign out, wipe PIN.
      • Backend: /api/chat now accepts user_name.
      Verified bundle compiles and login → home flow works in web preview.
