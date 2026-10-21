# GeoFriends — Implementation Plan (`PLAN.md`)

A private, zero-cost multiplayer GeoGuessr clone built with **SvelteKit 5 (Runes)**, **Tailwind CSS**, **Adapter-Static**, **Google Street View JS API**, **Leaflet (OpenStreetMap)**, and the **Universal WebSocket Server**.

---

## 1. Tech Stack & Dependencies

- **Framework:** SvelteKit (Svelte 5 Runes `$state`, `$derived`, `$effect`) with `@sveltejs/adapter-static` (`ssr = false` SPA mode)
- **Styling:** Tailwind CSS
- **360° Panorama:** Google Maps JavaScript API (`StreetViewPanorama`)
- **2D Guessing Map:** `leaflet` + `@types/leaflet` (100% free OpenStreetMap tiles, saving Google Dynamic Map quota)
- **Multiplayer Relay:** Universal WebSocket Server (`GET /ws?key=<api_key>`)

### Required Packages

```bash
npm install leaflet
npm install -D @types/leaflet @types/google.maps

```

### Environment Variables (`.env`)

```env
PUBLIC_WS_URL=ws://localhost:8080/ws
PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSyYourKeyHere

```

---

## 2. Project File Structure

```text
src/
├── lib/
│   ├── data/
│   │   └── locations.json        # 500 pre-baked valid Street View locations
│   ├── types.ts                  # Shared TypeScript interfaces (WS envelopes, Game state)
│   ├── geoMath.ts                # Haversine distance & 0–5000 exponential score formula
│   ├── wsClient.ts               # WebSocket wrapper (auth, ping/pong, room & publish helpers)
│   └── gameState.svelte.ts       # Reactive Svelte 5 state machine & host-authoritative logic
├── components/
│   ├── AuthView.svelte           # API key input (persisted in localStorage)
│   ├── RoomBrowser.svelte        # List rooms, create room, join room
│   ├── LobbyView.svelte          # Player roster, Room Master settings (Rounds, Time, Moving/NM/NMPZ)
│   ├── StreetView.svelte         # Single-instance Street View panorama + NM/NMPZ locks
│   ├── MapOverlay.svelte         # Expandable Leaflet mini-map for pin drops & full-screen round summary
│   └── StandingsModal.svelte     # End-of-round & final game leaderboard
└── routes/
    ├── +layout.ts                # Exports `ssr = false` for pure client-side SPA
    ├── +layout.svelte            # Loads Tailwind & Leaflet CSS
    └── +page.svelte              # Top-level view router driven by `gameState.phase`

```

---

## 3. Architecture & Protocol Design

### 3.1 Host-Authoritative Model

Because the Universal WebSocket Server is a pure message relay without server-side game logic:

- The **Room Creator** (`room.metadata.host === myLabel`) acts as the authoritative host.
- **Room Preset:** Rooms are created with `kind: "custom"`, which provisions only `"default"` (reliable, unlimited) and `"presence"` (server-managed join/leave/delete events).

- **Self-Reflection:** All `publish` calls use `"include_sender": true` so the Host processes state transitions through the exact same message handler as guest players.

### 3.2 Client Phase State Machine (`gameState.phase`)

1. `'DISCONNECTED'` — Prompt user for their personal API key; connect to `/ws?key=...`.

2. `'BROWSER'` — Connected (`welcome` received with `label`); displays active rooms via `list_rooms`.

3. `'LOBBY'` — Inside a room (`room_joined`); waiting for players. Host can tweak settings (`rounds`, `timeLimit`, `modifier`).

4. `'IN_ROUND'` — Street View active, timer counting down, players dropping pins on the mini-map.
5. `'ROUND_REVEAL'` — Full-screen 2D map showing true location, all player pins, polylines, distances, and round points.
6. `'GAME_OVER'` — Final podium and total score breakdown after the last round, with a "Play Again" button for the Host.

### 3.3 Wire Payloads (Published on `"default"` Channel)

| `payload.action` | Sender | Trigger                                              | Payload Schema |
| ---------------- | ------ | ---------------------------------------------------- | -------------- |
| `LOBBY_SYNC`     | Host   | On any `presence` (`join`/`leave`) or setting change |

| `{ action: 'LOBBY_SYNC', host: string, players: string[], settings: RoomSettings }` |
| `ROUND_START` | Host | Host clicks Start / Next Round | `{ action: 'ROUND_START', round: number, totalRounds: number, location: SeedLocation, durationSec: number, modifier: MovementModifier }` |
| `PLAYER_GUESSED` | Any Player | Player clicks "Lock Guess" | `{ action: 'PLAYER_GUESSED', lat: number, lng: number }` _(Player identity read from envelope `from`)_<br> |
| `ROUND_REVEAL` | Host | All players guessed OR Host timer hits 0 | `{ action: 'ROUND_REVEAL', round: number, target: SeedLocation, results: RoundResult[] }` |
| `GAME_OVER` | Host | Host clicks "Finish" after final round | `{ action: 'GAME_OVER', standings: Standing[] }` |

---

## 4. Core Mathematical Formulas (`geoMath.ts`)

1. **Haversine Distance ($d$ in meters):**
   Calculates great-circle distance between `target(lat1, lng1)` and `guess(lat2, lng2)` using Earth radius $R = 6,371,000\text{ m}$.
2. **Exponential Score ($0\text{ to }5,000$):**

- Grace threshold: If $d \le 25\text{ m}$, award **5,000 points**.
- Otherwise:

$$\text{Score} = \text{round}\left(5000 \times e^{-d / 2000000}\right)$$

- Gives ~4,950 pts at 20 km, ~3,032 pts at 1,000 km, and ~410 pts at 5,000 km.

---

## 5. Street View Cost & Modifier Rules (`StreetView.svelte`)

1. **Single Panorama Instance:** Instantiate `new google.maps.StreetViewPanorama()` **once** when the component mounts and reuse it across rounds via `.setPano(location.panoId)` and `.setPov({ heading, pitch })`.
2. **Modifier Enforcement:**

- `MOVING`: `linksControl: true, clickToGo: true, scrollwheel: true, showRoadLabels: false`
- `NO_MOVE`: `linksControl: false, clickToGo: false, scrollwheel: true, showRoadLabels: false` + block keyboard navigation keys (`ArrowUp`, `ArrowDown`, `W`, `S`).
- `NMPZ`: Same as `NO_MOVE` + `zoomControl: false, panControl: false, scrollwheel: false` + render a transparent `pointer-events: auto` shield `<div>` over the Street View viewport so mouse dragging and scroll zooming are physically blocked.

---

## 6. Step-by-Step Build Milestones

- [ ] **Step 1: Project Setup & Math Utilities**
- Configure `ssr = false` in `src/routes/+layout.ts`.
- Create `src/lib/types.ts` and `src/lib/geoMath.ts`.

- [ ] **Step 2: WebSocket Client (`wsClient.ts`)**
- Implement connection with `?key=...`, 25s heartbeat `ping` timer (to stay well within the server's 60s `READ_TIMEOUT`), and auto-join after `create_room`.

- [ ] **Step 3: Reactive Game Store (`gameState.svelte.ts`)**
- Wire up `welcome`, `room_list`, `room_created`, `room_joined`, `presence` (`join`, `leave`, `room_deleted`), and the 5 `message` actions.

- [ ] **Step 4: Auth, Room Browser & Lobby UI**
- Build `AuthView.svelte`, `RoomBrowser.svelte`, and `LobbyView.svelte`. Test creating a room, joining with a second browser tab using a second API key, and syncing settings.

- [ ] **Step 5: Street View & Leaflet Map Components**
- Build `StreetView.svelte` with dynamic modifier locks and a single "Return to Start" button.
- Build `MapOverlay.svelte` for dropping a pin during `IN_ROUND` and drawing dashed polylines between player pins and the target flag during `ROUND_REVEAL`.

- [ ] **Step 6: End-to-End Polish**
- Add countdown timer bar, round transition overlays, and final podium view.
