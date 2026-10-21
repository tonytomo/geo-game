export type GamePhase =
    | 'DISCONNECTED'
    | 'BROWSER'
    | 'LOBBY'
    | 'IN_ROUND'
    | 'ROUND_REVEAL'
    | 'GAME_OVER';

export type MovementModifier = 'MOVING' | 'NO_MOVE' | 'NMPZ';

export interface SeedLocation {
    panoId: string;
    lat: number;
    lng: number;
    heading: number;
    pitch: number;
    region?: string;
}

export interface RoomSettings {
    rounds: number;      // e.g., 5
    timeLimit: number;   // in seconds, e.g., 60
    modifier: MovementModifier;
}

export interface RoomMetadata extends RoomSettings {
    host: string;        // API key label of the creator
}

export interface PlayerGuess {
    lat: number;
    lng: number;
}

export interface RoundResult {
    player: string;
    lat: number | null;
    lng: number | null;
    distanceMeters: number | null;
    roundScore: number;
    totalScore: number;
}

export interface Standing {
    player: string;
    totalScore: number;
}

// ==========================================
// 2. Application Payloads (Inside `publish`)
// ==========================================

export type GameActionPayload =
    | {
        action: 'LOBBY_SYNC';
        host: string;
        players: string[];
        settings: RoomSettings;
    }
    | {
        action: 'ROUND_START';
        round: number;
        totalRounds: number;
        location: SeedLocation;
        durationSec: number;
        modifier: MovementModifier;
    }
    | {
        action: 'PLAYER_GUESSED';
        lat: number;
        lng: number;
    }
    | {
        action: 'ROUND_REVEAL';
        round: number;
        target: SeedLocation;
        results: RoundResult[];
    }
    | {
        action: 'GAME_OVER';
        standings: Standing[];
    };

// ==========================================
// 3. Universal WebSocket Server Protocol
// ==========================================

export interface PresencePayload {
    event: 'join' | 'leave' | 'room_deleted';
    who: string;
}

export interface RoomSummary {
    name: string;
    members: number;
    protected: boolean;
    kind: 'chat' | 'game' | 'custom';
    channels: string[];
    max_members: number;
    created_at: number;
    metadata?: RoomMetadata;
}

// Client -> Server Outbound Envelopes
export type ClientToServerMessage =
    | {
        type: 'create_room';
        room: string;
        kind?: 'chat' | 'game' | 'custom';
        passcode?: string;
        max_members?: number;
        ephemeral?: boolean;
        metadata?: RoomMetadata;
    }
    | {
        type: 'join_room';
        room: string;
        passcode?: string;
    }
    | {
        type: 'leave_room';
        room: string;
    }
    | {
        type: 'delete_room';
        room: string;
    }
    | {
        type: 'list_rooms';
    }
    | {
        type: 'publish';
        room: string;
        channel?: string;
        reliable?: boolean;
        include_sender?: boolean;
        payload: GameActionPayload;
    }
    | {
        type: 'ping';
    };

// Server -> Client Inbound Envelopes
export type ServerToClientMessage =
    | {
        type: 'welcome';
        client_id: string;
        label: string;
        server_version: string;
    }
    | {
        type: 'room_created';
        room: string;
        channels: string[];
    }
    | {
        type: 'room_joined';
        room: string;
        channels: string[];
        members: number;
    }
    | {
        type: 'room_left';
        room: string;
    }
    | {
        type: 'room_list';
        rooms: RoomSummary[];
    }
    | {
        type: 'message';
        room: string;
        channel: 'default' | 'presence' | string;
        from: string;
        seq: number;
        ts: number;
        payload: GameActionPayload | PresencePayload;
    }
    | {
        type: 'error';
        code: string;
        message: string;
        channel?: string;
        retry_after_ms?: number;
    }
    | {
        type: 'pong';
    };