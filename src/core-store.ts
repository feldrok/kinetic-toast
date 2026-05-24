export type KineticStoreListener = () => void;

export interface KineticStore<TSnapshot> {
	getSnapshot: () => readonly TSnapshot[];
	subscribe: (listener: KineticStoreListener) => () => void;
	update: (updater: (snapshot: readonly TSnapshot[]) => readonly TSnapshot[]) => void;
}

export function createKineticStore<TSnapshot>(
	initialSnapshot: readonly TSnapshot[] = [],
): KineticStore<TSnapshot> {
	let snapshot = [...initialSnapshot];
	const listeners = new Set<KineticStoreListener>();

	const emit = () => {
		for (const listener of listeners) listener();
	};

	return {
		getSnapshot: () => snapshot,
		subscribe: (listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		update: (updater) => {
			const next = updater(snapshot);
			if (Object.is(snapshot, next)) return;
			snapshot = [...next];
			emit();
		},
	};
}
