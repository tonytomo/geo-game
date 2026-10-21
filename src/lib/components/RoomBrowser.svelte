<script lang="ts">
	import { gameState } from '#lib/gameState.svelte.ts';

	let newRoomName = $state('');
	let newRoomPasscode = $state('');
	let joinPasscodeMap = $state<Record<string, string>>({});

	function handleCreateRoom(e: SubmitEvent) {
		e.preventDefault();
		if (!newRoomName.trim()) return;
		gameState.createRoom(newRoomName, newRoomPasscode);
	}

	function handleJoinRoom(roomName: string, isProtected: boolean) {
		const code = isProtected ? (joinPasscodeMap[roomName] ?? '') : '';
		gameState.joinRoom(roomName, code);
	}
</script>

<div class="min-h-screen bg-slate-950 p-6 text-slate-100">
	<div class="mx-auto max-w-4xl space-y-6">
		<!-- Top Header -->
		<header
			class="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900 p-4"
		>
			<div>
				<h1 class="text-xl font-bold text-white">GeoFriends</h1>
				<p class="text-xs text-slate-400">
					Connected as <span class="font-mono font-semibold text-emerald-400"
						>{gameState.myLabel}</span
					>
				</p>
			</div>

			<div class="flex items-center gap-2">
				<button
					onclick={() => gameState.refreshRooms()}
					class="cursor-pointer rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-700"
				>
					Refresh Rooms
				</button>
				<button
					onclick={() => gameState.disconnect()}
					class="cursor-pointer rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-400 transition hover:bg-rose-500/20"
				>
					Disconnect
				</button>
			</div>
		</header>

		{#if gameState.errorBanner}
			<div
				class="flex items-center justify-between rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300"
			>
				<span>{gameState.errorBanner}</span>
				<button
					onclick={() => (gameState.errorBanner = null)}
					class="text-rose-400 hover:text-white">✕</button
				>
			</div>
		{/if}

		<div class="grid grid-cols-1 gap-6 md:grid-cols-3">
			<!-- Create Room Card -->
			<div class="h-fit rounded-xl border border-slate-800 bg-slate-900 p-5">
				<h2 class="mb-1 text-base font-semibold text-white">Create a Room</h2>
				<p class="mb-4 text-xs text-slate-400">
					You will be the Room Master and control the rules.
				</p>

				<form onsubmit={handleCreateRoom} class="space-y-3">
					<div>
						<label for="room-name" class="mb-1 block text-xs text-slate-300">Room Name</label>
						<input
							id="room-name"
							type="text"
							bind:value={newRoomName}
							placeholder="e.g. malam-minggu"
							maxlength="32"
							required
							class="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
						/>
					</div>

					<div>
						<label for="room-pass" class="mb-1 block text-xs text-slate-300"
							>Passcode (Optional)</label
						>
						<input
							id="room-pass"
							type="password"
							bind:value={newRoomPasscode}
							placeholder="Leave blank for open room"
							class="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
						/>
					</div>

					<button
						type="submit"
						class="w-full cursor-pointer rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
					>
						Create & Join
					</button>
				</form>
			</div>

			<!-- Active Rooms List -->
			<div class="rounded-xl border border-slate-800 bg-slate-900 p-5 md:col-span-2">
				<div class="mb-4 flex items-center justify-between">
					<h2 class="text-base font-semibold text-white">
						Active Rooms ({gameState.rooms.length})
					</h2>
				</div>

				{#if gameState.rooms.length === 0}
					<div class="rounded-xl border border-dashed border-slate-800 py-12 text-center">
						<p class="text-sm text-slate-400">No active rooms right now.</p>
						<p class="mt-1 text-xs text-slate-500">
							Create one on the left to start playing with your friends.
						</p>
					</div>
				{:else}
					<div class="space-y-3">
						{#each gameState.rooms as room (room.name)}
							<div
								class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3.5"
							>
								<div>
									<div class="flex items-center gap-2">
										<span class="text-sm font-semibold text-white">{room.name}</span>
										{#if room.protected}
											<span
												class="rounded border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400"
											>
												Locked
											</span>
										{/if}
										{#if room.metadata?.modifier}
											<span
												class="rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-300"
											>
												{room.metadata.modifier}
											</span>
										{/if}
									</div>
									<p class="mt-0.5 text-xs text-slate-400">
										Host: <span class="text-slate-200">{room.metadata?.host ?? 'Unknown'}</span>
										· Members: <span class="text-slate-200">{room.members}/{room.max_members}</span>
									</p>
								</div>

								<div class="flex items-center gap-2">
									{#if room.protected}
										<input
											type="password"
											placeholder="Passcode"
											bind:value={joinPasscodeMap[room.name]}
											class="w-28 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
										/>
									{/if}
									<button
										onclick={() => handleJoinRoom(room.name, room.protected)}
										class="cursor-pointer rounded-lg bg-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-emerald-400"
									>
										Join
									</button>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
