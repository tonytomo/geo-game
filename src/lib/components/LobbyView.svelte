<script lang="ts">
	import { gameState } from '#lib/gameState.svelte.ts';
	import type { MovementModifier } from '#lib/types.ts';

	const modifiers: { value: MovementModifier; label: string; desc: string }[] = [
		{ value: 'MOVING', label: 'Moving', desc: 'Walk, pan, and zoom freely' },
		{ value: 'NO_MOVE', label: 'No Move (NM)', desc: 'Pan and zoom only; no walking' },
		{ value: 'NMPZ', label: 'NMPZ', desc: 'Frozen camera frame; no moving, panning, or zooming' }
	];

	const roundOptions = [3, 5, 10];
	const timerOptions = [30, 60, 90, 120, 180];
</script>

<div class="min-h-screen bg-slate-950 p-6 text-slate-100">
	<div class="mx-auto max-w-3xl space-y-6">
		<!-- Top Room Bar -->
		<header
			class="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 p-4"
		>
			<div>
				<div class="flex items-center gap-2">
					<span class="text-xs font-semibold tracking-wider text-emerald-400 uppercase"
						>Room Lobby</span
					>
					<span class="text-slate-600">·</span>
					<span class="text-xs text-slate-400"
						>Host: <strong class="text-white">{gameState.hostLabel}</strong></span
					>
				</div>
				<h1 class="mt-0.5 text-xl font-bold text-white">{gameState.currentRoom}</h1>
			</div>

			<button
				onclick={() => gameState.leaveCurrentRoom()}
				class="cursor-pointer rounded-lg border border-rose-500/20 bg-rose-500/10 px-3.5 py-1.5 text-xs font-medium text-rose-400 transition hover:bg-rose-500/20"
			>
				{gameState.isHost ? 'Close Room' : 'Leave Room'}
			</button>
		</header>

		<div class="grid grid-cols-1 gap-6 md:grid-cols-5">
			<!-- Left Column: Players Roster (2 cols) -->
			<div class="rounded-xl border border-slate-800 bg-slate-900 p-5 md:col-span-2">
				<h2 class="mb-3 text-sm font-semibold text-slate-200">
					Players ({gameState.players.length})
				</h2>

				<ul class="space-y-2">
					{#each gameState.players as player (player)}
						<li
							class="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
						>
							<div class="flex items-center gap-2">
								<span class="h-2 w-2 rounded-full bg-emerald-400"></span>
								<span class="font-medium text-white">{player}</span>
								{#if player === gameState.myLabel}
									<span class="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400"
										>You</span
									>
								{/if}
							</div>

							{#if player === gameState.hostLabel}
								<span
									class="rounded border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400"
								>
									HOST
								</span>
							{/if}
						</li>
					{/each}
				</ul>
			</div>

			<!-- Right Column: Room Master Rules (3 cols) -->
			<div
				class="flex flex-col justify-between space-y-6 rounded-xl border border-slate-800 bg-slate-900 p-5 md:col-span-3"
			>
				<div class="space-y-5">
					<div class="flex items-center justify-between">
						<h2 class="text-sm font-semibold text-slate-200">Match Settings</h2>
						{#if !gameState.isHost}
							<span class="text-xs text-slate-400">Controlled by {gameState.hostLabel}</span>
						{/if}
					</div>

					<!-- Movement Modifier -->
					<div>
						<span class="mb-2 block text-xs font-medium text-slate-400">Movement Modifier</span>
						<div class="grid grid-cols-1 gap-2">
							{#each modifiers as mod (mod.value)}
								<button
									type="button"
									disabled={!gameState.isHost}
									onclick={() => gameState.updateSettings({ modifier: mod.value })}
									class="rounded-xl border p-3 text-left transition {gameState.settings.modifier ===
									mod.value
										? 'border-emerald-500 bg-emerald-500/10 text-white'
										: 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'} disabled:cursor-default"
								>
									<div class="text-xs font-bold">{mod.label}</div>
									<div class="mt-0.5 text-[11px] text-slate-400">{mod.desc}</div>
								</button>
							{/each}
						</div>
					</div>

					<!-- Number of Rounds -->
					<div>
						<span class="mb-2 block text-xs font-medium text-slate-400">Number of Rounds</span>
						<div class="grid grid-cols-3 gap-2">
							{#each roundOptions as r (r)}
								<button
									type="button"
									disabled={!gameState.isHost}
									onclick={() => gameState.updateSettings({ rounds: r })}
									class="rounded-lg border px-3 py-2 text-xs font-semibold transition {gameState
										.settings.rounds === r
										? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
										: 'border-slate-800 bg-slate-950 text-slate-400'} disabled:cursor-default"
								>
									{r} Rounds
								</button>
							{/each}
						</div>
					</div>

					<!-- Round Time Limit -->
					<div>
						<span class="mb-2 block text-xs font-medium text-slate-400">Time Limit per Round</span>
						<div class="grid grid-cols-5 gap-2">
							{#each timerOptions as sec (sec)}
								<button
									type="button"
									disabled={!gameState.isHost}
									onclick={() => gameState.updateSettings({ timeLimit: sec })}
									class="rounded-lg border px-2 py-2 text-xs font-semibold transition {gameState
										.settings.timeLimit === sec
										? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
										: 'border-slate-800 bg-slate-950 text-slate-400'} disabled:cursor-default"
								>
									{sec}s
								</button>
							{/each}
						</div>
					</div>
				</div>

				<!-- Start Button -->
				<div class="border-t border-slate-800 pt-4">
					{#if gameState.isHost}
						<button
							onclick={() => gameState.startGame()}
							class="w-full cursor-pointer rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-500/10 transition hover:bg-emerald-400"
						>
							Start Match ({gameState.settings.rounds} Rounds · {gameState.settings.modifier})
						</button>
					{:else}
						<div
							class="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-center text-xs text-slate-400"
						>
							Waiting for <strong class="text-white">{gameState.hostLabel}</strong> to start the match...
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>
