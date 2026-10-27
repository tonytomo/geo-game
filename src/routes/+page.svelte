<!-- src/routes/+page.svelte -->
<script lang="ts">
	import AuthView from '#lib/components/AuthView.svelte';
	import LobbyView from '#lib/components/LobbyView.svelte';
	import MapOverlay from '#lib/components/MapOverlay.svelte';
	import RoomBrowser from '#lib/components/RoomBrowser.svelte';
	import StandingsModal from '#lib/components/StandingsModal.svelte';
	import StreetView from '#lib/components/StreetView.svelte';
	import { gameState, parseUrlParamsAndAutoConnect } from '#lib/gameState.svelte.ts';
	import { onMount } from 'svelte';

	function handleGlobalKeydown(e: KeyboardEvent) {
		if (
			e.code === 'Space' &&
			gameState.phase === 'IN_ROUND' &&
			gameState.selectedPin &&
			!gameState.hasLockedGuess
		) {
			e.preventDefault();
			gameState.lockGuess();
		}
	}

	onMount(() => {
		parseUrlParamsAndAutoConnect();
	});
</script>

<svelte:window onkeydown={handleGlobalKeydown} />

{#if gameState.phase === 'DISCONNECTED'}
	<AuthView />
{:else if gameState.phase === 'BROWSER'}
	<RoomBrowser />
{:else if gameState.phase === 'LOBBY'}
	<LobbyView />
{:else if gameState.phase === 'IN_ROUND' || gameState.phase === 'ROUND_REVEAL'}
	<StreetView />
	<MapOverlay />
{:else if gameState.phase === 'GAME_OVER'}
	<StandingsModal />
{/if}
