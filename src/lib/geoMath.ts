const EARTH_RADIUS_METERS = 6_371_000;
const PERFECT_SCORE_RADIUS_METERS = 25; // Within 25m = automatic 5,000 pts
const MAX_SCORE = 5_000;
// Scale factor for World maps (~14,916 km max diagonal / decay constant)
const WORLD_DECAY_CONSTANT = 2_000_000;

function toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
}

/**
 * Calculates great-circle distance between two coordinates in meters
 * using the Haversine formula.
 */
export function calculateDistanceMeters(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
): number {
    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);

    const rLat1 = toRadians(lat1);
    const rLat2 = toRadians(lat2);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(EARTH_RADIUS_METERS * c);
}

/**
 * Calculates GeoGuessr-style score (0 to 5000) based on distance in meters.
 * - <= 25m: 5000 pts
 * - > 25m:  5000 * e^(-distance / 2,000,000)
 */
export function calculateScore(distanceMeters: number | null): number {
    if (distanceMeters === null || distanceMeters < 0) return 0;
    if (distanceMeters <= PERFECT_SCORE_RADIUS_METERS) return MAX_SCORE;

    const rawScore = MAX_SCORE * Math.exp(-distanceMeters / WORLD_DECAY_CONSTANT);
    return Math.max(0, Math.min(MAX_SCORE, Math.round(rawScore)));
}

/**
 * Formats distance in meters into a human-readable string ("142 m" or "1,420.5 km").
 */
export function formatDistance(distanceMeters: number | null): string {
    if (distanceMeters === null) return 'No Guess';
    if (distanceMeters < 1000) {
        return `${distanceMeters} m`;
    }
    const km = distanceMeters / 1000;
    return km >= 100
        ? `${Math.round(km).toLocaleString()} km`
        : `${km.toFixed(1)} km`;
}