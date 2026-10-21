# GeoFriends (`geo-game`)

A lightweight, zero-cost, private multiplayer **GeoGuessr** clone built with **SvelteKit 5 (Runes)**, **Tailwind CSS**, the **Google Street View JS API**, **Leaflet (OpenStreetMap)**, and a lightweight **WebSocket relay**.

---

## Highlights & Features

- **Cost-Optimized Hybrid Mapping**:
  - **Single Panorama Instance**: Instantiates `google.maps.StreetViewPanorama` once and recycles it across rounds via `.setPano()` and `.setPov()`, dramatically reducing Google Maps JavaScript API session costs.
  - **Free 2D Leaflet Guess Map**: Uses Leaflet with OpenStreetMap tiles for pin-dropping, minimap overlays, and round summaries—incurring zero Google Dynamic Maps quota charges.
- **Host-Authoritative Multiplayer**:
  - Room-based multiplayer coordinated via a lightweight Universal WebSocket Server relay.
  - No database or heavy backend required; the room creator acts as the authoritative host for timers, round seeds, and score calculations.
  - Room presence tracking, live player rosters, and real-time guess status indicators.
- **Classic Competitive Modifiers**:
  - **Moving**: Walk, pan, zoom freely, with a quick "Reset Spawn" button to return to the round's origin point.
  - **No Move (NM)**: Panning and zooming allowed; walking arrows, click-to-move, and keyboard navigation keys (`WASD`, arrow keys) are strictly locked.
  - **NMPZ (No Move, Pan, Zoom)**: Complete viewport lock with an interactive transparent input shield blocking mouse drag, double-click, and wheel zoom.
- **Authentic GeoGuessr Scoring Formula**:
  - Calculates true great-circle distance using the **Haversine formula** ($R = 6,371\text{ km}$).
  - Exponential decay scoring matching official competitive curves:
    $$\text{Score} = \text{round}\left(5000 \times e^{-d / 2,000,000}\right)$$
  - 25-meter grace distance awards an automatic **5,000 points** (5k).
- **500+ Curated Global Panoramas**:
  - Pre-seeded with 500+ high-quality, verified Street View locations across SE Asia, the Americas, Europe, Africa, and Oceania (`src/lib/data/locations.json`).
- **SvelteKit 5 Runes & SPA Architecture**:
  - Fine-grained reactivity powered by Svelte 5 (`$state`, `$derived`, `$effect`).
  - Client-side Single Page Application (`@sveltejs/adapter-static` with `ssr = false`).
  - Dark-themed UI crafted with Tailwind CSS v4.

---

## Tech Stack

| Component              | Technology                                                                                | Description                                                  |
| ---------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| **Framework**          | [SvelteKit 5](https://svelte.dev/)                                                        | Svelte 5 with Runes (`$state`, `$derived`, `$effect`)        |
| **Build & Tooling**    | [Vite 6+](https://vitejs.dev/) & [TypeScript](https://www.typescriptlang.org/)            | Fast bundling and static type checking                       |
| **Styling**            | [Tailwind CSS v4](https://tailwindcss.com/)                                               | Modern CSS design with `@tailwindcss/vite`                   |
| **360° Panorama**      | [Google Maps JavaScript API](https://developers.google.com/maps/documentation/javascript) | `StreetViewPanorama` for immersive street-level exploration  |
| **2D Guessing Map**    | [Leaflet](https://leafletjs.com/) + OpenStreetMap                                         | Interactive minimap for pin placement and post-round reveals |
| **Multiplayer Relay**  | Universal WebSocket Server                                                                | Ephemeral room creation and message broadcasting             |
| **Deployment Adapter** | `@sveltejs/adapter-static`                                                                | Single-page application bundle (`ssr = false`)               |

---

## Game Loop & Client Phases

```
┌──────────────┐     API Key Entered     ┌──────────────┐     Create / Join Room     ┌──────────────┐
│ DISCONNECTED │ ──────────────────────> │   BROWSER    │ ─────────────────────────> │    LOBBY     │
└──────────────┘                         └──────────────┘                            └──────────────┘
                                                                                            │
                                                                                    Host Starts Game
                                                                                            │
                                                                                            ▼
┌──────────────┐     Final Round Done    ┌──────────────┐    All Guessed / Timeout   ┌──────────────┐
│  GAME_OVER   │ <────────────────────── │ ROUND_REVEAL │ <───────────────────────── │   IN_ROUND   │
└──────────────┘                         └──────────────┘                            └──────────────┘
       │                                         ▲                                          │
       │                                         │              Next Round                  │
       └──────────────── Play Again ─────────────┴──────────────────────────────────────────┘
```

1. **`DISCONNECTED`**: Connect to the WebSocket relay using your player API key and endpoint.
2. **`BROWSER`**: Browse available lobbies, create new custom rooms, or join with an optional passcode.
3. **`LOBBY`**: Configure match settings (rounds, countdown timer, movement modifier). Host synchronizes state across players.
4. **`IN_ROUND`**: Explore Street View panorama, open the Leaflet minimap overlay, drop a pin, and lock your guess (or press `Space`).
5. **`ROUND_REVEAL`**: Full-screen 2D map showing true coordinates, all player pins, connecting dashed polylines, distances, and round points.
6. **`GAME_OVER`**: Final podium leaderboard displaying total scores, rankings, and a host option to start a rematch.

---

## Scoring Breakdown

The match scoring uses an exponential decay curve against the great-circle distance $d$ (in meters):

- **$\le 25\text{ m}$**: Automatic **5,000 points**
- **$> 25\text{ m}$**: $\text{round}\left(5000 \cdot e^{-d / 2,000,000}\right)$

### Score Scale Reference

| Distance ($d$)         | Approximate Score |
| ---------------------- | ----------------- |
| $\le 25\text{ m}$      | **5,000** pts     |
| $\sim 20\text{ km}$    | **~4,950** pts    |
| $\sim 250\text{ km}$   | **~4,412** pts    |
| $\sim 1,000\text{ km}$ | **~3,032** pts    |
| $\sim 3,000\text{ km}$ | **~1,115** pts    |
| $\sim 5,000\text{ km}$ | **~410** pts      |
| $\ge 15,000\text{ km}$ | **~3** pts        |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- A **Google Maps JavaScript API Key** with the _Maps JavaScript API_ enabled in the Google Cloud Console.
- A running **Universal WebSocket Server** endpoint (e.g. `ws://localhost:8080/ws`).

### 1. Clone & Install Dependencies

```bash
git clone <repository-url>
cd geo-game
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory (based on `.env.example`):

```bash
cp .env.example .env
```

Set your configuration values:

```env
WS_URL=ws://localhost:8080/ws
GOOGLE_MAPS_API_KEY=AIzaSyYourActualGoogleMapsAPIKeyHere
```

### 3. Run Development Server

```bash
npm run dev
```

The game will be available at `http://localhost:5173`.

---

## Available Scripts

| Command           | Action                                                        |
| ----------------- | ------------------------------------------------------------- |
| `npm run dev`     | Starts the local Vite development server with HMR             |
| `npm run build`   | Compiles the production SPA static bundle into `build/`       |
| `npm run preview` | Locally previews the production build                         |
| `npm run check`   | Runs SvelteKit synchronization and `svelte-check` type audits |
| `npm run lint`    | Runs ESLint and checks formatting with Prettier               |
| `npm run format`  | Automatically formats codebase files with Prettier            |

---

## Project Structure

```text
geo-game/
├── specs/
│   └── PLAN.md                  # Specification & implementation plan
├── src/
│   ├── app.html                 # HTML shell template
│   ├── env.ts                   # SvelteKit environment variable definitions
│   ├── routes/
│   │   ├── +layout.svelte       # App shell, favicon, and global CSS import
│   │   ├── +layout.ts           # SPA configuration (`ssr = false`, `prerender = false`)
│   │   ├── +page.svelte         # Top-level view router driven by `gameState.phase`
│   │   └── layout.css           # Tailwind CSS imports
│   └── lib/
│       ├── types.ts             # TypeScript definitions (WS protocol, game state, actions)
│       ├── geoMath.ts           # Haversine distance, exponential scoring, and distance formatting
│       ├── wsClient.ts          # WebSocket client with heartbeat, reconnect, and pub/sub helpers
│       ├── gameState.svelte.ts  # Reactive Svelte 5 state machine and host-authoritative logic
│       ├── data/
│       │   └── locations.json   # 500+ curated valid Street View panorama coordinates
│       └── components/
│           ├── AuthView.svelte       # Player API key & server URL configuration screen
│           ├── RoomBrowser.svelte    # Public room browser and lobby creation modal
│           ├── LobbyView.svelte      # Pre-game lobby with settings (rounds, timer, modifiers)
│           ├── StreetView.svelte     # Street View panorama renderer with modifier lock enforcement
│           ├── MapOverlay.svelte     # Leaflet mini-map for guess placement and round summary
│           └── StandingsModal.svelte # Post-game podium and score summary
├── static/                      # Static assets served at root
├── .env.example                 # Example environment variables
└── package.json                 # Project dependencies and npm scripts
```

---

## In-Game Controls & Hotkeys

- **Click on Leaflet Minimap**: Place or adjust your guess marker.
- **Hover / Expand Button**: Expands the minimap for pinpoint placement.
- **`Spacebar`**: Instantly locks in your guess when a pin is selected on the map.
- **`WASD` / Arrow Keys**: Street View panorama navigation (enabled only in `Moving` mode).
- **Reset Spawn**: Button located on the HUD to immediately jump back to the starting panorama coordinates and heading.

---

## License

Private project. Built for private multiplayer parties and geographic exploration.
