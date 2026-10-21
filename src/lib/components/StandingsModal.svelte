<script lang="ts">
	import { gameState } from '#lib/gameState.svelte.ts';

	const maxPossibleScore = $derived(gameState.totalRounds * 5000);
</script>

<div class="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-100">
	<div
		class="w-full max-w-lg space-y-6 rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl"
	>
		<div class="text-center">
			<span
				class="mb-2 inline-block rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold tracking-wider text-amber-400 uppercase"
			>
				Match Complete · {gameState.settings.modifier}
			</span>
			<h1 class="text-2xl font-bold text-white">Final Standings</h1>
			<p class="mt-1 text-xs text-slate-400">
				Max possible score: {maxPossibleScore.toLocaleString()} pts ({gameState.totalRounds} rounds)
			</p>
		</div>

		<!-- Podium / Leaderboard List -->
		<div class="space-y-3">
			{#each gameState.standings as entry, idx (entry.player)}
				{@const isFirst = idx === 0}
				<div
					class="flex items-center justify-between rounded-xl border p-4 transition {isFirst
						? 'border-amber-500/40 bg-amber-500/10'
						: 'border-slate-800 bg-slate-950'}"
				>
					<div class="flex items-center gap-3">
						<div
							class="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold {idx ===
							0
								? 'bg-amber-400 text-slate-950'
								: idx === 1
									? 'bg-slate-300 text-slate-950'
									: idx === 2
										? 'bg-amber-700 text-white'
										: 'bg-slate-800 text-slate-400'}"
						>
							#{idx + 1}
						</div>
						<div>
							<div class="flex items-center gap-2 text-base font-bold text-white">
								{entry.player}
								{#if isFirst}
									<span>👑</span>
								{/if}
							</div>
							{#if entry.player === gameState.myLabel}
								<span class="text-[11px] text-emerald-400">You</span>
							{/if}
						</div>
					</div>

					<div class="text-right">
						<div class="text-lg font-extrabold {isFirst ? 'text-amber-300' : 'text-emerald-400'}">
							{entry.totalScore.toLocaleString()}
						</div>
						<div class="text-[11px] text-slate-500">points</div>
					</div>
				</div>
			{/each}
		</div>

		<!-- Actions Footer -->
		<div class="flex flex-col gap-3 border-t border-slate-800 pt-4 sm:flex-row">
			{#if gameState.isHost}
				<button
					type="button"
					onclick={() => gameState.returnToLobby()}
					class="flex-1 cursor-pointer rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-400"
				>
					Play Again (Return to Lobby)
				</button>
			{:else}
				<div
					class="flex flex-1 items-center justify-center rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-center text-xs text-slate-400"
				>
					Waiting for {gameState.hostLabel} to start a new game...
				</div>
			{/if}

			<button
				type="button"
				onclick={() => gameState.leaveCurrentRoom()}
				class="cursor-pointer rounded-xl bg-slate-800 px-4 py-3 text-xs font-semibold text-slate-300 transition hover:bg-slate-700"
			>
				Leave Room
			</button>
		</div>
	</div>
</div>
