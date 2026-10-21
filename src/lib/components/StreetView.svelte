<script lang="ts">
	import { GOOGLE_MAPS_API_KEY } from '$app/env/public';
	import { gameState } from '#lib/gameState.svelte.ts';
	import { onMount } from 'svelte';

	let panoContainer: HTMLDivElement;
	let panorama: google.maps.StreetViewPanorama | null = null;
	let sdkReady = $state(false);
	let loadError = $state<string | null>(null);

	function loadGoogleMapsScript(): Promise<void> {
		if (typeof window !== 'undefined' && window.google?.maps) {
			return Promise.resolve();
		}

		return new Promise((resolve, reject) => {
			const existingScript = document.getElementById('google-maps-sdk');
			if (existingScript) {
				existingScript.addEventListener('load', () => resolve());
				return;
			}

			const script = document.createElement('script');
			script.id = 'google-maps-sdk';
			script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&v=weekly`;
			script.async = true;
			script.defer = true;
			script.onload = () => resolve();
			script.onerror = () => reject(new Error('Failed to load Google Maps JS SDK.'));
			document.head.appendChild(script);
		});
	}

	onMount(() => {
		loadGoogleMapsScript()
			.then(() => {
				sdkReady = true;
			})
			.catch((err) => {
				loadError = err.message;
			});
	});

	// Reactively initialize or update the single StreetViewPanorama instance
	// whenever sdkReady, currentLocation, or the movement modifier changes
	$effect(() => {
		if (!sdkReady || !panoContainer || !gameState.currentLocation) return;

		const loc = gameState.currentLocation;
		const mod = gameState.settings.modifier;
		const isMoving = mod === 'MOVING';
		const isNMPZ = mod === 'NMPZ';

		const options: google.maps.StreetViewPanoramaOptions = {
			pano: loc.panoId,
			pov: {
				heading: loc.heading ?? 0,
				pitch: loc.pitch ?? 0
			},
			zoom: 0,
			// Movement & UI locks
			linksControl: isMoving,
			clickToGo: isMoving,
			scrollwheel: !isNMPZ,
			zoomControl: !isNMPZ,
			panControl: !isNMPZ,
			// Always hide road labels, address boxes, and fullscreen toggles
			showRoadLabels: false,
			addressControl: false,
			fullscreenControl: false,
			motionTracking: false,
			motionTrackingControl: false,
			enableCloseButton: false
		};

		if (!panorama) {
			panorama = new google.maps.StreetViewPanorama(panoContainer, options);
		} else {
			panorama.setOptions(options);
			panorama.setPano(loc.panoId);
			panorama.setPov({ heading: loc.heading ?? 0, pitch: loc.pitch ?? 0 });
			panorama.setZoom(0);
		}
	});

	function returnToStart() {
		if (!panorama || !gameState.currentLocation) return;
		const loc = gameState.currentLocation;
		panorama.setPano(loc.panoId);
		panorama.setPov({ heading: loc.heading ?? 0, pitch: loc.pitch ?? 0 });
		panorama.setZoom(0);
	}

	// Block keyboard navigation (WASD / Arrow keys) in NO_MOVE and NMPZ modes
	function handleKeydown(e: KeyboardEvent) {
		if (gameState.settings.modifier === 'MOVING') return;
		const blockedKeys = [
			'ArrowUp',
			'ArrowDown',
			'ArrowLeft',
			'ArrowRight',
			'KeyW',
			'KeyA',
			'KeyS',
			'KeyD',
			'+',
			'-',
			'='
		];
		if (blockedKeys.includes(e.code) || blockedKeys.includes(e.key)) {
			e.stopPropagation();
			e.preventDefault();
		}
	}
</script>

<div
	role="application"
	aria-label="Street View Panorama"
	onkeydowncapture={handleKeydown}
	class="relative h-screen w-screen overflow-hidden bg-slate-950 select-none"
>
	{#if loadError}
		<div class="flex h-full w-full items-center justify-center text-sm text-rose-400">
			{loadError}
		</div>
	{/if}

	<!-- Google Street View Mount Node -->
	<div bind:this={panoContainer} class="h-full w-full"></div>

	<!-- NMPZ Physical Input Shield: blocks mouse drag, double-click, and wheel zoom -->
	{#if gameState.settings.modifier === 'NMPZ'}
		<div
			role="region"
			aria-label="No Move and Pan Zoom"
			class="absolute inset-0 z-10 cursor-default"
			onwheel={(e) => e.preventDefault()}
			oncontextmenu={(e) => e.preventDefault()}
		></div>
	{/if}

	<!-- Top HUD Bar (Round, Modifier, Timer, Player Guess Status) -->
	<div
		class="pointer-events-none absolute top-4 right-4 left-4 z-20 flex flex-wrap items-center justify-between gap-3"
	>
		<!-- Left Pill: Round & Modifier + Return to Start -->
		<div
			class="pointer-events-auto flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/90 px-3.5 py-2 shadow-lg backdrop-blur"
		>
			<div class="text-xs font-bold text-white">
				Round {gameState.currentRound}<span class="text-slate-400">/{gameState.totalRounds}</span>
			</div>
			<span class="text-slate-700">|</span>
			<span
				class="rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-400"
			>
				{gameState.settings.modifier}
			</span>

			{#if gameState.settings.modifier === 'MOVING'}
				<button
					type="button"
					onclick={returnToStart}
					title="Return to starting spawn location"
					class="ml-1 cursor-pointer rounded bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-200 transition hover:bg-slate-700"
				>
					↺ Reset Spawn
				</button>
			{/if}
		</div>

		<!-- Center Pill: Countdown Timer -->
		<div
			class="rounded-xl border px-4 py-2 font-mono text-base font-bold shadow-lg backdrop-blur {gameState.timeRemaining <=
			10
				? 'animate-pulse border-rose-500 bg-rose-950/90 text-rose-300'
				: 'border-slate-800 bg-slate-900/90 text-white'}"
		>
			{Math.floor(gameState.timeRemaining / 60)}:{String(gameState.timeRemaining % 60).padStart(
				2,
				'0'
			)}
		</div>

		<!-- Right Pill: Live Player Lock-In Status -->
		<div
			class="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/90 px-3 py-2 shadow-lg backdrop-blur"
		>
			{#each gameState.players as player (player)}
				{@const locked = gameState.guessedPlayers.includes(player)}
				<span
					class="rounded px-2 py-0.5 text-[11px] font-medium transition {locked
						? 'border border-emerald-500/30 bg-emerald-500/20 text-emerald-300'
						: 'bg-slate-800 text-slate-400'}"
				>
					{player}
					{locked ? '✓' : '…'}
				</span>
			{/each}
		</div>
	</div>
</div>
