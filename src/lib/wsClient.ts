import type {
	ClientToServerMessage,
	GameActionPayload,
	RoomMetadata,
	ServerToClientMessage
} from './types';

type MessageHandler = (msg: ServerToClientMessage) => void;
type StatusHandler = (connected: boolean, errorReason?: string, isReconnecting?: boolean) => void;

export class WSClient {
	private socket: WebSocket | null = null;
	private pingTimer: ReturnType<typeof setInterval> | null = null;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

	private lastWsUrl = '';
	private lastApiKey = '';
	private shouldReconnect = false;
	private reconnectAttempts = 0;
	private maxReconnectAttempts = 5;
	private pendingPasscode = '';

	private onMessageCallback: MessageHandler;
	private onStatusCallback: StatusHandler;

	constructor(onMessage: MessageHandler, onStatus: StatusHandler) {
		this.onMessageCallback = onMessage;
		this.onStatusCallback = onStatus;

		// Immediately ping when user switches back to the tab (prevents background tab timeout)
		if (typeof document !== 'undefined') {
			document.addEventListener('visibilitychange', () => {
				if (document.visibilityState === 'visible' && this.socket?.readyState === WebSocket.OPEN) {
					this.sendFrame({ type: 'ping' });
				}
			});
		}
	}

	connect(wsUrl: string, apiKey: string): void {
		const trimmedKey = apiKey.trim();
		if (!trimmedKey) {
			this.onStatusCallback(false, 'API key is required.');
			return;
		}

		this.lastWsUrl = wsUrl;
		this.lastApiKey = trimmedKey;
		this.shouldReconnect = true;
		this.openSocket();
	}

	private openSocket(): void {
		this.cleanupSocket();

		const url = new URL(this.lastWsUrl);
		url.searchParams.set('key', this.lastApiKey);

		try {
			this.socket = new WebSocket(url.toString());
		} catch {
			this.onStatusCallback(false, 'Invalid WebSocket URL.');
			return;
		}

		this.socket.onopen = () => {
			this.reconnectAttempts = 0;
			this.startHeartbeat();
			this.onStatusCallback(true);
		};

		this.socket.onmessage = (event: MessageEvent) => {
			if (typeof event.data !== 'string') return;
			try {
				const msg = JSON.parse(event.data) as ServerToClientMessage;
				if (msg.type === 'room_created') {
					this.joinRoom(msg.room, this.pendingPasscode);
					this.pendingPasscode = '';
				}
				this.onMessageCallback(msg);
			} catch (err) {
				console.error('[WSClient] Failed to parse server frame:', err);
			}
		};

		this.socket.onclose = (event: CloseEvent) => {
			this.stopHeartbeat();
			this.socket = null;

			// Attempt automatic reconnect unless manually disconnected
			if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
				this.reconnectAttempts += 1;
				const delay = Math.min(1000 * this.reconnectAttempts, 4000);
				this.onStatusCallback(false, `Reconnecting (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`, true);
				this.reconnectTimer = setTimeout(() => this.openSocket(), delay);
				return;
			}

			const reason =
				event.reason ||
				(event.code === 1006
					? 'Connection lost (check your API key or network).'
					: `Closed (code ${event.code})`);

			this.onStatusCallback(false, reason, false);
		};
	}

	disconnect(): void {
		this.shouldReconnect = false;
		if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
		this.cleanupSocket();
		this.onStatusCallback(false);
	}

	private cleanupSocket(): void {
		this.stopHeartbeat();
		if (this.socket) {
			this.socket.onclose = null;
			this.socket.close(1000, 'Client disconnected');
			this.socket = null;
		}
	}

	sendFrame(frame: ClientToServerMessage): void {
		if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
		this.socket.send(JSON.stringify(frame));
	}

	listRooms(): void {
		this.sendFrame({ type: 'list_rooms' });
	}

	createRoom(room: string, metadata: RoomMetadata, passcode = '', maxMembers = 10): void {
		this.pendingPasscode = passcode;
		this.sendFrame({
			type: 'create_room',
			room,
			kind: 'custom',
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
		this.sendFrame({ type: 'leave_room', room });
	}

	deleteRoom(room: string): void {
		this.sendFrame({ type: 'delete_room', room });
	}

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

	private startHeartbeat(): void {
		this.stopHeartbeat();
		// Ping every 15s so reverse proxies (Nginx/Cloudflare) never idle-drop the socket
		this.pingTimer = setInterval(() => {
			this.sendFrame({ type: 'ping' });
		}, 15_000);
	}

	private stopHeartbeat(): void {
		if (this.pingTimer) {
			clearInterval(this.pingTimer);
			this.pingTimer = null;
		}
	}
}