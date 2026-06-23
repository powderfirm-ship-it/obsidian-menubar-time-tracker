// Pure, Obsidian-free formatting helpers. Unit-tested in tests/format.test.ts.

// Live menu-bar readout: M:SS under an hour, H:MM:SS at/over an hour.
export function formatTrayElapsed(ms: number): string {
	const totalSeconds = Math.max(0, Math.floor(ms / 1000));
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	const ss = String(seconds).padStart(2, "0");
	if (hours > 0) {
		return `${hours}:${String(minutes).padStart(2, "0")}:${ss}`;
	}
	return `${minutes}:${ss}`;
}

// Human-readable duration for the modal and notices: "42m" / "1h 03m".
export function formatHuman(minutes: number): string {
	const m = Math.max(0, Math.round(minutes));
	const h = Math.floor(m / 60);
	const rem = m % 60;
	if (h > 0) return `${h}h ${String(rem).padStart(2, "0")}m`;
	return `${m}m`;
}

// Whole minutes between two ISO timestamps, rounded to nearest. Returns 0 for
// unparseable input rather than propagating NaN into a session's duration.
export function minutesBetween(startISO: string, endISO: string): number {
	const startMs = new Date(startISO).getTime();
	const endMs = new Date(endISO).getTime();
	if (Number.isNaN(startMs) || Number.isNaN(endMs)) return 0;
	return Math.round((endMs - startMs) / 60000);
}
