import { WS_URL } from '$app/env/public';
import locationsData from './data/locations.json';
import { calculateDistanceMeters, calculateScore } from './geoMath';
import { WSClient } from './wsClient';
import type {
	GameActionPayload,
	GamePhase,
	PlayerGuess,
	PresencePayload,
	RoomMetadata,
	RoomSettings,
	RoomSummary,
	RoundResult,
	SeedLocation,
	ServerToClientMessage,
	Standing
} from './types';
import { SvelteURLSearchParams } from 'svelte/reactivity';

const STORAGE_KEY_API = 'geofriends_api_key';
const DEFAULT_WS_URL = WS_URL || 'ws://localhost:8080/ws';
const ALL_LOCATIONS = locationsData as SeedLocation[];

class GameState {
	// ==========================================
	// 1. Reactive UI State (Svelte 5 Runes)
	// ==========================================
	phase = $state<GamePhase>('DISCONNECTED');
	apiKey = $state<string>(
		typeof localStorage !== 'undefined' ? (localStorage.getItem(STORAGE_KEY_API) ?? '') : ''
	);
	wsUrl = $state<string>(DEFAULT_WS_URL);

	myClientId = $state<string>('');
	myLabel = $state<string>('');
	errorBanner = $state<string | null>(null);

	// Room Browser State
	rooms = $state<RoomSummary[]>([]);

	// Active Room & Lobby State
	currentRoom = $state<string | null>(null);
	hostLabel = $state<string>('');
	players = $state<string[]>([]);
	settings = $state<RoomSettings>({
		rounds: 5,
		timeLimit: 60,
		modifier: 'MOVING'
	});

	// Active Round State
	currentRound = $state<number>(1);
	totalRounds = $state<number>(5);
	currentLocation = $state<SeedLocation | null>(null);
	timeRemaining = $state<number>(0);

	// Pin & Guess State
	selectedPin = $state<PlayerGuess | null>(null);
	hasLockedGuess = $state<boolean>(false);
	guessedPlayers = $state<string[]>([]); // Players who have locked in this round

	// Results & Standings
	roundResults = $state<RoundResult[]>([]);
	standings = $state<Standing[]>([]);

	// Derived Helpers
	isHost = $derived(this.myLabel !== '' && this.myLabel === this.hostLabel);

	// ==========================================
	// 2. Internal Host-Only State & Timers
	// ==========================================
	private ws: WSClient;
	private usedPanoIds = new Set<string>();
	private hostRoundGuesses = new Map<string, PlayerGuess>();
	private hostTotalScores = new Map<string, number>();
	private countdownInterval: ReturnType<typeof setInterval> | null = null;
	private hostRevealTimeout: ReturnType<typeof setTimeout> | null = null;

	constructor() {
		this.ws = new WSClient(
			(msg) => this.handleServerMessage(msg),
			(connected, reason) => this.handleConnectionStatus(connected, reason)
		);
	}

	// ==========================================
	// 3. Connection & Room Commands
	// ==========================================

	connect(customKey?: string): void {
		if (customKey !== undefined) {
			this.apiKey = customKey.trim();
		}
		if (!this.apiKey) {
			this.errorBanner = 'Please enter your API key.';
			return;
		}
		this.errorBanner = null;
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(STORAGE_KEY_API, this.apiKey);
		}
		this.ws.connect(this.wsUrl, this.apiKey);
	}

	disconnect(): void {
		this.clearTimers();
		this.ws.disconnect();
		this.phase = 'DISCONNECTED';
	}

	refreshRooms(): void {
		this.ws.listRooms();
	}

	createRoom(roomName: string, passcode = ''): void {
		const cleanName = roomName.trim().replace(/[^a-zA-Z0-9_-]/g, '-');
		if (!cleanName) {
			this.errorBanner = 'Room name must use letters, numbers, dashes, or underscores.';
			return;
		}

		// Set optimistic Host state prior to room_created -> join_room
		this.hostLabel = this.myLabel;
		this.players = [this.myLabel];

		const metadata: RoomMetadata = {
			host: this.myLabel,
			...this.settings
		};

		this.ws.createRoom(cleanName, metadata, passcode, 10);
	}

	joinRoom(roomName: string, passcode = ''): void {
		// Check if we know the host from the cached room list
		const found = this.rooms.find((r) => r.name === roomName);
		if (found?.metadata?.host) {
			this.hostLabel = found.metadata.host;
			this.settings = {
				rounds: found.metadata.rounds ?? 5,
				timeLimit: found.metadata.timeLimit ?? 60,
				modifier: found.metadata.modifier ?? 'MOVING'
			};
		}
		this.ws.joinRoom(roomName, passcode);
	}

	leaveCurrentRoom(): void {
		if (!this.currentRoom) return;
		if (this.isHost) {
			// Host deletes the room so all guests get a clean room_deleted eviction
			this.ws.deleteRoom(this.currentRoom);
		} else {
			this.ws.leaveRoom(this.currentRoom);
		}
		this.resetRoomState();
		this.phase = 'BROWSER';
		this.refreshRooms();
	}

	// ==========================================
	// 4. Host & Gameplay Actions
	// ==========================================

	updateSettings(partial: Partial<RoomSettings>): void {
		if (!this.isHost || !this.currentRoom) return;
		this.settings = { ...this.settings, ...partial };
		this.broadcastLobbySync();
	}

	startGame(): void {
		if (!this.isHost || !this.currentRoom) return;
		this.hostTotalScores.clear();
		for (const p of this.players) {
			this.hostTotalScores.set(p, 0);
		}
		this.startRound(1);
	}

	nextRoundOrFinish(): void {
		if (!this.isHost || !this.currentRoom) return;
		if (this.currentRound < this.settings.rounds) {
			this.startRound(this.currentRound + 1);
		} else {
			const standings: Standing[] = this.players
				.map((player) => ({
					player,
					totalScore: this.hostTotalScores.get(player) ?? 0
				}))
				.sort((a, b) => b.totalScore - a.totalScore);

			this.ws.publishAction(this.currentRoom, {
				action: 'GAME_OVER',
				standings
			});
		}
	}

	returnToLobby(): void {
		if (!this.isHost || !this.currentRoom) return;
		this.broadcastLobbySync();
	}

	lockGuess(): void {
		if (
			!this.currentRoom ||
			this.phase !== 'IN_ROUND' ||
			this.hasLockedGuess ||
			!this.selectedPin
		) {
			return;
		}

		this.hasLockedGuess = true;
		this.ws.publishAction(this.currentRoom, {
			action: 'PLAYER_GUESSED',
			lat: this.selectedPin.lat,
			lng: this.selectedPin.lng
		});
	}

	// ==========================================
	// 5. Internal Host Mechanics
	// ==========================================

	private broadcastLobbySync(): void {
		if (!this.isHost || !this.currentRoom) return;
		this.ws.publishAction(this.currentRoom, {
			action: 'LOBBY_SYNC',
			host: this.myLabel,
			players: [...this.players],
			settings: { ...this.settings }
		});
	}

	private startRound(roundNumber: number): void {
		if (!this.isHost || !this.currentRoom) return;

		const location = this.pickRandomSeedLocation();
		this.hostRoundGuesses.clear();

		this.ws.publishAction(this.currentRoom, {
			action: 'ROUND_START',
			round: roundNumber,
			totalRounds: this.settings.rounds,
			location,
			durationSec: this.settings.timeLimit,
			modifier: this.settings.modifier
		});

		// Host sets authoritative timeout to reveal results when time expires
		if (this.hostRevealTimeout) clearTimeout(this.hostRevealTimeout);
		this.hostRevealTimeout = setTimeout(
			() => {
				this.triggerRoundReveal();
			},
			this.settings.timeLimit * 1000 + 500
		);
	}

	private triggerRoundReveal(): void {
		if (!this.isHost || !this.currentRoom || !this.currentLocation) return;
		if (this.hostRevealTimeout) {
			clearTimeout(this.hostRevealTimeout);
			this.hostRevealTimeout = null;
		}

		const target = this.currentLocation;

		const results: RoundResult[] = this.players.map((player) => {
			const guess = this.hostRoundGuesses.get(player) ?? null;
			const distanceMeters = guess
				? calculateDistanceMeters(target.lat, target.lng, guess.lat, guess.lng)
				: null;
			const roundScore = calculateScore(distanceMeters);
			const prevTotal = this.hostTotalScores.get(player) ?? 0;
			const newTotal = prevTotal + roundScore;
			this.hostTotalScores.set(player, newTotal);

			return {
				player,
				lat: guess ? guess.lat : null,
				lng: guess ? guess.lng : null,
				distanceMeters,
				roundScore,
				totalScore: newTotal
			};
		});

		// Sort round results highest score first
		results.sort((a, b) => b.roundScore - a.roundScore);

		this.ws.publishAction(this.currentRoom, {
			action: 'ROUND_REVEAL',
			round: this.currentRound,
			target,
			results
		});
	}

	private pickRandomSeedLocation(): SeedLocation {
		if (this.usedPanoIds.size >= ALL_LOCATIONS.length) {
			this.usedPanoIds.clear();
		}
		const available = ALL_LOCATIONS.filter((loc) => !this.usedPanoIds.has(loc.panoId));
		const chosen = available[Math.floor(Math.random() * available.length)] ?? ALL_LOCATIONS[0];
		this.usedPanoIds.add(chosen.panoId);
		return chosen;
	}

	// ==========================================
	// 6. WebSocket Protocol Message Router
	// ==========================================

	private handleConnectionStatus(connected: boolean, reason?: string): void {
		if (!connected) {
			this.clearTimers();
			this.resetRoomState();
			this.phase = 'DISCONNECTED';
			if (reason) this.errorBanner = reason;
		}
	}

	private handleServerMessage(msg: ServerToClientMessage): void {
		switch (msg.type) {
			case 'welcome':
				this.myClientId = msg.client_id;
				this.myLabel = msg.label;
				this.errorBanner = null;
				this.phase = 'BROWSER';
				this.refreshRooms();
				break;

			case 'room_list':
				this.rooms = msg.rooms;
				break;

			case 'room_joined':
				this.currentRoom = msg.room;
				this.errorBanner = null;
				this.phase = 'LOBBY';
				if (this.isHost) {
					if (!this.players.includes(this.myLabel)) {
						this.players = [this.myLabel];
					}
					this.broadcastLobbySync();
				}
				break;

			case 'room_left':
				this.resetRoomState();
				this.phase = 'BROWSER';
				this.refreshRooms();
				break;

			case 'error':
				this.errorBanner = `${msg.code}: ${msg.message}`;
				break;

			case 'message':
				if (msg.channel === 'presence') {
					this.handlePresenceEvent(msg.payload as PresencePayload);
				} else {
					this.handleGameAction(msg.from, msg.payload as GameActionPayload);
				}
				break;
		}
	}

	private handlePresenceEvent(presence: PresencePayload): void {
		if (presence.event === 'room_deleted') {
			this.clearTimers();
			this.resetRoomState();
			this.phase = 'BROWSER';
			this.errorBanner = `Room was closed by ${presence.who}.`;
			this.refreshRooms();
			return;
		}

		if (presence.event === 'join') {
			if (!this.players.includes(presence.who)) {
				this.players = [...this.players, presence.who];
			}
			if (this.isHost) {
				this.broadcastLobbySync();
			}
		}

		if (presence.event === 'leave') {
			this.players = this.players.filter((p) => p !== presence.who);
			if (this.isHost) {
				this.broadcastLobbySync();
				// If someone leaves mid-round and all remaining players have guessed, reveal early
				if (
					this.phase === 'IN_ROUND' &&
					this.players.length > 0 &&
					this.players.every((p) => this.hostRoundGuesses.has(p))
				) {
					this.triggerRoundReveal();
				}
			}
		}
	}

	private handleGameAction(senderLabel: string, payload: GameActionPayload): void {
		switch (payload.action) {
			case 'LOBBY_SYNC':
				this.hostLabel = payload.host;
				this.players = payload.players;
				this.settings = payload.settings;
				if (this.phase === 'GAME_OVER') {
					this.phase = 'LOBBY';
				}
				break;

			case 'ROUND_START':
				this.clearCountdown();
				this.currentRound = payload.round;
				this.totalRounds = payload.totalRounds;
				this.currentLocation = payload.location;
				this.settings.modifier = payload.modifier;
				this.timeRemaining = payload.durationSec;

				this.selectedPin = null;
				this.hasLockedGuess = false;
				this.guessedPlayers = [];
				this.roundResults = [];
				this.phase = 'IN_ROUND';

				this.startVisualCountdown(payload.durationSec);
				break;

			case 'PLAYER_GUESSED':
				if (!this.guessedPlayers.includes(senderLabel)) {
					this.guessedPlayers = [...this.guessedPlayers, senderLabel];
				}

				if (this.isHost && this.phase === 'IN_ROUND') {
					this.hostRoundGuesses.set(senderLabel, {
						lat: payload.lat,
						lng: payload.lng
					});

					// Check if all active players in the room have submitted their guess
					const allGuessed = this.players.every((p) => this.hostRoundGuesses.has(p));
					if (allGuessed) {
						this.triggerRoundReveal();
					}
				}
				break;

			case 'ROUND_REVEAL':
				this.clearTimers();
				this.currentLocation = payload.target;
				this.roundResults = payload.results;
				this.phase = 'ROUND_REVEAL';
				break;

			case 'GAME_OVER':
				this.clearTimers();
				this.standings = payload.standings;
				this.phase = 'GAME_OVER';
				break;
		}
	}

	// ==========================================
	// 7. Timers & Cleanup Helpers
	// ==========================================

	private startVisualCountdown(seconds: number): void {
		this.clearCountdown();
		this.timeRemaining = seconds;
		this.countdownInterval = setInterval(() => {
			if (this.timeRemaining > 0) {
				this.timeRemaining -= 1;
			} else {
				this.clearCountdown();
			}
		}, 1000);
	}

	private clearCountdown(): void {
		if (this.countdownInterval) {
			clearInterval(this.countdownInterval);
			this.countdownInterval = null;
		}
	}

	private clearTimers(): void {
		this.clearCountdown();
		if (this.hostRevealTimeout) {
			clearTimeout(this.hostRevealTimeout);
			this.hostRevealTimeout = null;
		}
	}

	private resetRoomState(): void {
		this.currentRoom = null;
		this.hostLabel = '';
		this.players = [];
		this.selectedPin = null;
		this.hasLockedGuess = false;
		this.guessedPlayers = [];
		this.roundResults = [];
		this.standings = [];
	}
}

export const gameState = new GameState();

/**
 * Parses URL parameters and auto-connects to the WebSocket server.
 *
 * @remarks
 * This function should be called on mount to allow deep linking into the application.
 * It will automatically connect to the WebSocket server if an API key is provided in the URL.
 * It will also automatically join a room if a room name is provided in the URL.
 */
export function parseUrlParamsAndAutoConnect(): void {
	if (typeof window === 'undefined') return;

	const params = new SvelteURLSearchParams(window.location.search);
	const keyParam = params.get('key');
	const roomParam = params.get('room');
	const wsParam = params.get('ws');

	if (wsParam) {
		gameState.wsUrl = decodeURIComponent(wsParam);
	}

	if (keyParam) {
		gameState.apiKey = keyParam.trim();
		localStorage.setItem('geofriends_api_key', gameState.apiKey);
	}

	// If a valid key exists, auto-connect immediately
	if (gameState.apiKey) {
		gameState.connect();

		// If a target room is specified in the URL, join it once connected
		if (roomParam) {
			const targetRoom = roomParam.trim();
			const checkConnected = setInterval(() => {
				if (gameState.phase === 'BROWSER') {
					clearInterval(checkConnected);
					gameState.joinRoom(targetRoom);
				}
			}, 100);

			// Timeout after 5s if connection fails
			setTimeout(() => clearInterval(checkConnected), 5000);
		}
	}

	// Clean the URL bar without reloading so the key isn't sitting in browser history
	if (keyParam || roomParam) {
		const cleanUrl = window.location.pathname;
		window.history.replaceState({}, '', cleanUrl);
	}
}