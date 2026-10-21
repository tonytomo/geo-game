<!-- src/components/MapOverlay.svelte -->
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import L from 'leaflet';
	import { gameState } from '#lib/gameState.svelte.ts';
	import { formatDistance } from '#lib/geoMath.ts';

	let mapElement: HTMLDivElement;
	let map: L.Map | null = null;
	let layerGroup: L.LayerGroup | null = null;
	let isExpanded = $state(false);

	const isReveal = $derived(gameState.phase === 'ROUND_REVEAL');

	onMount(() => {
		map = L.map(mapElement, {
			center: [20, 0],
			zoom: 2,
			minZoom: 1,
			worldCopyJump: true,
			zoomControl: true
		});

		// Free OpenStreetMap standard tile layer
		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			attribution: '&copy; OpenStreetMap contributors',
			maxZoom: 19
		}).addTo(map);

		layerGroup = L.layerGroup().addTo(map);

		// Handle clicking on the map to drop/move the player's pin during IN_ROUND
		map.on('click', (e: L.LeafletMouseEvent) => {
			if (gameState.phase !== 'IN_ROUND' || gameState.hasLockedGuess) return;
			// Wrap longitude cleanly to [-180, 180]
			const wrapped = e.latlng.wrap();
			gameState.selectedPin = { lat: wrapped.lat, lng: wrapped.lng };
		});
	});

	onDestroy(() => {
		map?.remove();
		map = null;
	});

	// Re-render markers & polylines whenever phase, selectedPin, or roundResults change
	$effect(() => {
		if (!map || !layerGroup) return;
		const phase = gameState.phase;
		const pin = gameState.selectedPin;
		const results = gameState.roundResults;
		const target = gameState.currentLocation;

		layerGroup.clearLayers();

		if (phase === 'IN_ROUND') {
			if (pin) {
				L.circleMarker([pin.lat, pin.lng], {
					radius: 8,
					color: '#0f172a',
					weight: 2,
					fillColor: '#10b981',
					fillOpacity: 1
				})
					.bindTooltip('Your Guess', { permanent: false, direction: 'top' })
					.addTo(layerGroup);
			}
		} else if (phase === 'ROUND_REVEAL' && target) {
			const bounds = L.latLngBounds([[target.lat, target.lng]]);

			// 1. True Target Location Marker (Gold/Emerald Star Dot)
			L.circleMarker([target.lat, target.lng], {
				radius: 10,
				color: '#ffffff',
				weight: 3,
				fillColor: '#f59e0b',
				fillOpacity: 1
			})
				.bindTooltip('True Location', { permanent: true, direction: 'top' })
				.addTo(layerGroup);

			// 2. Player Guess Pins & Connecting Dashed Lines
			for (const res of results) {
				if (res.lat !== null && res.lng !== null) {
					bounds.extend([res.lat, res.lng]);

					// Dashed line between player guess and target
					L.polyline(
						[
							[res.lat, res.lng],
							[target.lat, target.lng]
						],
						{
							color: res.player === gameState.myLabel ? '#10b981' : '#94a3b8',
							weight: 2,
							dashArray: '6, 6'
						}
					).addTo(layerGroup);

					// Player pin
					L.circleMarker([res.lat, res.lng], {
						radius: 7,
						color: '#0f172a',
						weight: 2,
						fillColor: res.player === gameState.myLabel ? '#10b981' : '#38bdf8',
						fillOpacity: 1
					})
						.bindTooltip(`${res.player} (${formatDistance(res.distanceMeters)})`, {
							permanent: true,
							direction: 'bottom'
						})
						.addTo(layerGroup);
				}
			}

			// Recalculate container size and fit all markers into view
			setTimeout(() => {
				map?.invalidateSize();
				map?.fitBounds(bounds, { padding: [60, 60], maxZoom: 12 });
			}, 100);
		}
	});

	// Ensure Leaflet recalculates dimensions when the mini-map expands/collapses
	function triggerResize() {
		setTimeout(() => {
			map?.invalidateSize();
		}, 220);
	}
</script>

<!-- Container switches between bottom-right overlay (IN_ROUND) and full-screen modal (ROUND_REVEAL) -->
<div
	role="region"
	aria-label="Map Overlay"
	onmouseenter={() => {
		if (!isReveal) {
			isExpanded = true;
			triggerResize();
		}
	}}
	onmouseleave={() => {
		if (!isReveal) {
			isExpanded = false;
			triggerResize();
		}
	}}
	class={isReveal
		? 'fixed inset-0 z-30 flex flex-col bg-slate-950 md:flex-row'
		: `fixed right-4 bottom-4 z-20 flex flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/95 shadow-2xl transition-all duration-200 ${
				isExpanded
					? 'h-[55vh] w-[92vw] opacity-100 sm:h-90 sm:w-120'
					: 'h-44 w-64 opacity-85 hover:opacity-100'
			}`}
>
	<!-- Mobile / Tablet Toggle Button when in IN_ROUND -->
	{#if !isReveal}
		<button
			type="button"
			onclick={() => {
				isExpanded = !isExpanded;
				triggerResize();
			}}
			class="bg-slate-800 px-3 py-1 text-center text-[11px] font-semibold text-slate-200 sm:hidden"
		>
			{isExpanded ? 'Minimize Map' : 'Expand Map'}
		</button>
	{/if}

	<!-- Leaflet Map Canvas -->
	<div bind:this={mapElement} class="h-full w-full flex-1"></div>

	<!-- IN_ROUND Action Footer: Lock Guess Button -->
	{#if !isReveal}
		<div class="border-t border-slate-800 bg-slate-900 p-2.5">
			<button
				type="button"
				disabled={!gameState.selectedPin || gameState.hasLockedGuess}
				onclick={() => gameState.lockGuess()}
				class="w-full cursor-pointer rounded-xl px-4 py-2 text-xs font-bold tracking-wider uppercase transition {gameState.hasLockedGuess
					? 'cursor-default bg-slate-800 text-emerald-400'
					: gameState.selectedPin
						? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
						: 'cursor-not-allowed bg-slate-800 text-slate-500'}"
			>
				{#if gameState.hasLockedGuess}
					Guess Locked ✓ (Waiting for others...)
				{:else if gameState.selectedPin}
					Lock Guess (Space)
				{:else}
					Click map to place pin
				{/if}
			</button>
		</div>
	{/if}

	<!-- ROUND_REVEAL Side Panel: Scores & Next Round Button -->
	{#if isReveal}
		<div
			class="flex max-h-[45vh] w-full flex-col justify-between overflow-y-auto border-t border-slate-800 bg-slate-900 p-5 md:max-h-full md:w-96 md:border-t-0 md:border-l"
		>
			<div>
				<div class="mb-4 flex items-center justify-between">
					<div>
						<span class="text-xs font-semibold tracking-wider text-emerald-400 uppercase">
							Round {gameState.currentRound} of {gameState.totalRounds}
						</span>
						<h2 class="text-lg font-bold text-white">Round Results</h2>
					</div>

					{#if gameState.currentLocation}
						<a
							href={`https://www.google.com/maps/@?api=1&map_action=pano&pano=${gameState.currentLocation.panoId}`}
							target="_blank"
							rel="noreferrer"
							class="text-xs text-sky-400 hover:underline"
						>
							Open in Maps ↗
						</a>
					{/if}
				</div>

				<div class="space-y-2.5">
					{#each gameState.roundResults as res, idx (res.player)}
						<div
							class="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-3"
						>
							<div>
								<div class="flex items-center gap-2">
									<span class="font-mono text-xs text-slate-500">#{idx + 1}</span>
									<span class="text-sm font-semibold text-white">{res.player}</span>
								</div>
								<div class="mt-0.5 text-xs text-slate-400">
									Distance: <span class="text-slate-200">{formatDistance(res.distanceMeters)}</span>
								</div>
							</div>

							<div class="text-right">
								<div class="text-sm font-bold text-emerald-400">
									+{res.roundScore.toLocaleString()} pts
								</div>
								<div class="text-[11px] text-slate-400">
									Total: {res.totalScore.toLocaleString()}
								</div>
							</div>
						</div>
					{/each}
				</div>
			</div>

			<div class="mt-4 border-t border-slate-800 pt-4">
				{#if gameState.isHost}
					<button
						type="button"
						onclick={() => gameState.nextRoundOrFinish()}
						class="w-full cursor-pointer rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-400"
					>
						{gameState.currentRound < gameState.totalRounds
							? `Start Round ${gameState.currentRound + 1} →`
							: 'View Final Podium 🏆'}
					</button>
				{:else}
					<div class="py-2 text-center text-xs text-slate-400">
						Waiting for <strong class="text-white">{gameState.hostLabel}</strong> to continue...
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>
