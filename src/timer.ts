import { Notice } from "obsidian";
import { formatTrayElapsed } from "./format";
import { MenuBarTray } from "./tray";

// A timer that resumes past this on load is probably a crash leftover — warn rather
// than silently trust it.
const STALE_RESUME_MS = 8 * 60 * 60 * 1000;

// The timer reads and writes the running fields on the host's single in-memory
// settings object, so every save() serializes the same object (no field-drop races).
export interface TimerHost {
	tray: MenuBarTray;
	settings: { running: boolean; startedAt: number | null };
	save(): Promise<void>;
	registerInterval(id: number): number;
	isModalOpen(): boolean;
	openStopModal(elapsedMs: number): void;
}

export class Timer {
	private host: TimerHost;
	private intervalId: number | null = null;

	constructor(host: TimerHost) {
		this.host = host;
	}

	get running(): boolean {
		return this.host.settings.running;
	}

	private elapsedMs(): number {
		const { startedAt } = this.host.settings;
		if (startedAt == null) return 0;
		return Math.max(0, Date.now() - startedAt);
	}

	private render(): void {
		this.host.tray.setTitle(formatTrayElapsed(this.elapsedMs()));
	}

	private startInterval(): void {
		this.stopInterval();
		this.render(); // immediate, before the first tick
		this.intervalId = this.host.registerInterval(
			window.setInterval(() => this.render(), 1000),
		);
	}

	private stopInterval(): void {
		if (this.intervalId != null) {
			window.clearInterval(this.intervalId);
			this.intervalId = null;
		}
	}

	toggle(): void {
		if (this.host.isModalOpen()) return; // the modal owns the interaction
		if (this.running) this.stop();
		else this.start();
	}

	start(): void {
		this.host.settings.running = true;
		this.host.settings.startedAt = Date.now();
		void this.host.save();
		this.host.tray.setRunning(true);
		this.startInterval();
	}

	// Stops the visible timer and hands elapsed to the modal. Running state is
	// persisted until the session is saved (then clear()) or cancelled (cancel()),
	// so a crash mid-modal still resumes.
	stop(): void {
		const elapsed = this.elapsedMs();
		this.stopInterval();
		this.host.tray.setRunning(false);
		this.host.openStopModal(elapsed);
	}

	cancel(): void {
		this.clear();
	}

	// Clears persisted running state. Called after a successful save or a cancel.
	clear(): void {
		this.stopInterval();
		this.host.settings.running = false;
		this.host.settings.startedAt = null;
		void this.host.save();
		this.host.tray.setRunning(false);
	}

	// On plugin load, pick a persisted running timer back up (R11).
	resumeIfRunning(): void {
		if (!this.host.settings.running || this.host.settings.startedAt == null) return;
		const elapsed = this.elapsedMs();
		this.host.tray.setRunning(true);
		this.render(); // visible immediately, before the first interval tick
		this.startInterval();
		if (elapsed > STALE_RESUME_MS) {
			const hours = Math.round(elapsed / 3600000);
			new Notice(`Time Tracker resumed a timer running for ~${hours}h — stop it if that's stale.`);
		}
	}
}
