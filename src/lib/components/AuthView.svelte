<script lang="ts">
	import { gameState } from '#lib/gameState.svelte.ts';

	let keyInput = $state(gameState.apiKey);
	let showServerConfig = $state(false);

	function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		gameState.connect(keyInput);
	}
</script>

<div class="flex min-h-screen items-center justify-center bg-slate-950 p-4 text-slate-100">
	<div class="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
		<div class="mb-6">
			<span
				class="mb-2 inline-block rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold tracking-wide text-emerald-400 uppercase"
			>
				Private Party Edition
			</span>
			<h1 class="text-2xl font-bold tracking-tight text-white">GeoFriends</h1>
			<p class="mt-1 text-sm text-slate-400">
				Enter your personal API key to connect to the game server.
			</p>
		</div>

		{#if gameState.errorBanner}
			<div
				class="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300"
			>
				{gameState.errorBanner}
			</div>
		{/if}

		<form onsubmit={handleSubmit} class="space-y-4">
			<div>
				<label for="api-key" class="mb-1.5 block text-xs font-medium text-slate-300">
					Your API Key
				</label>
				<input
					id="api-key"
					type="password"
					bind:value={keyInput}
					placeholder="your_api_key"
					required
					class="w-full rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-600 transition focus:border-emerald-500 focus:outline-none"
				/>
			</div>

			<div>
				<button
					type="button"
					onclick={() => (showServerConfig = !showServerConfig)}
					class="text-xs text-slate-500 transition hover:text-slate-300"
				>
					{showServerConfig ? 'Hide server URL' : 'Change WebSocket server URL'}
				</button>

				{#if showServerConfig}
					<div class="mt-2">
						<input
							type="text"
							bind:value={gameState.wsUrl}
							placeholder="ws://localhost:8080/ws"
							class="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-300 focus:border-emerald-500 focus:outline-none"
						/>
					</div>
				{/if}
			</div>

			<button
				type="submit"
				class="w-full cursor-pointer rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
			>
				Connect to Lobby
			</button>
		</form>
	</div>
</div>
