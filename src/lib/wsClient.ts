import type {
	ClientToServerMessage,
	GameActionPayload,
	RoomMetadata,
	ServerToClientMessage
} from './types';

type MessageHandler = (msg: ServerToClientMessage) => void;
type StatusHandler = (connected: boolean, errorReason?: string) => void;

export class WSClient {
	private socket: WebSocket | null = null;
	private pingTimer: ReturnType<typeof setInterval> | null = null;
	private pendingPasscode: string = '';

	private onMessageCallback: MessageHandler;
	private onStatusCallback: StatusHandler;

	constructor(onMessage: MessageHandler, onStatus: StatusHandler) {
		this.onMessageCallback = onMessage;
		this.onStatusCallback = onStatus;
	}

	/**
	 * Connects to the Universal WebSocket Server using query parameter auth (?key=...)
	 */
	connect(wsUrl: string, apiKey: string): void {
		this.disconnect();

		const trimmedKey = apiKey.trim();
		if (!trimmedKey) {
			this.onStatusCallback(false, 'API key is required.');
			return;
		}

		const url = new URL(wsUrl);
		url.searchParams.set('key', trimmedKey);

		try {
			this.socket = new WebSocket(url.toString());
		} catch (err) {
			console.error('[WSClient] Invalid WebSocket URL.', err);
			this.onStatusCallback(false, 'Invalid WebSocket URL.');
			return;
		}

		this.socket.onopen = () => {
			this.startHeartbeat();
			this.onStatusCallback(true);
		};

		this.socket.onmessage = (event: MessageEvent) => {
			if (typeof event.data !== 'string') return; // Ignore binary frames

			try {
				const msg = JSON.parse(event.data) as ServerToClientMessage;

				// Protocol §3.1: create_room does not auto-join the creator.
				// Immediately follow up room_created with join_room.
				if (msg.type === 'room_created') {
					this.joinRoom(msg.room, this.pendingPasscode);
					this.pendingPasscode = '';
				}

				this.onMessageCallback(msg);
			} catch (err) {
				console.error('[WSClient] Failed to parse server frame:', err);
			}
		};

		this.socket.onerror = () => {
			// If upgrade fails with HTTP 401, onerror fires right before onclose
			console.warn('[WSClient] WebSocket error occurred.');
		};

		this.socket.onclose = (event: CloseEvent) => {
			this.stopHeartbeat();
			this.socket = null;

			const reason =
				event.reason ||
				(event.code === 1006
					? 'Connection failed (check your API key or server status).'
					: `Closed (code ${event.code})`);

			this.onStatusCallback(false, reason);
		};
	}

	/**
	 * Cleanly closes the active WebSocket connection
	 */
	disconnect(): void {
		this.stopHeartbeat();
		if (this.socket) {
			this.socket.onclose = null;
			this.socket.close(1000, 'Client disconnected');
			this.socket = null;
		}
		this.onStatusCallback(false);
	}

	/**
	 * Low-level typed JSON frame sender
	 */
	sendFrame(frame: ClientToServerMessage): void {
		if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
			console.warn('[WSClient] Cannot send frame; socket is not open:', frame);
			return;
		}
		this.socket.send(JSON.stringify(frame));
	}

	// ==========================================
	// High-Level Protocol Commands (§3.1 - §3.6)
	// ==========================================

	listRooms(): void {
		this.sendFrame({ type: 'list_rooms' });
	}

	createRoom(room: string, metadata: RoomMetadata, passcode = '', maxMembers = 10): void {
		this.pendingPasscode = passcode;
		this.sendFrame({
			type: 'create_room',
			room,
			kind: 'custom', // Provisions only "default" (reliable) and "presence"
			passcode,
			max_members: maxMembers,
			ephemeral: true,
			metadata
		});
	}

	joinRoom(room: string, passcode = ''): void {
		this.sendFrame({
			type: 'join_room',
			room,
			...(passcode ? { passcode } : {})
		});
	}

	leaveRoom(room: string): void {
		this.sendFrame({
			type: 'leave_room',
			room
		});
	}

	deleteRoom(room: string): void {
		this.sendFrame({
			type: 'delete_room',
			room
		});
	}

	/**
	 * Publishes a game action on the room's "default" reliable channel.
	 * Uses include_sender: true so the Host and guests process events identically.
	 */
	publishAction(room: string, payload: GameActionPayload): void {
		this.sendFrame({
			type: 'publish',
			room,
			channel: 'default',
			reliable: true,
			include_sender: true,
			payload
		});
	}

	// ==========================================
	// Internal Heartbeat (§3.8)
	// ==========================================

	private startHeartbeat(): void {
		this.stopHeartbeat();
		// Ping every 25s (Server PING_INTERVAL=30s, READ_TIMEOUT=60s)
		this.pingTimer = setInterval(() => {
			this.sendFrame({ type: 'ping' });
		}, 25_000);
	}

	private stopHeartbeat(): void {
		if (this.pingTimer) {
			clearInterval(this.pingTimer);
			this.pingTimer = null;
		}
	}
}
