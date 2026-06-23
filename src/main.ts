import { Notice, Platform, Plugin } from "obsidian";
import { ElectronRemote, getElectronRemote } from "./electron-tray";
import { formatHuman } from "./format";
import { addKnownProject } from "./session";
import { StopModal, StopResult } from "./stop-modal";
import { Timer } from "./timer";
import { MenuBarTray, MenuTemplate } from "./tray";
import { writeSession } from "./writer";

export interface PluginSettings {
	running: boolean;
	startedAt: number | null;
	knownProjects: string[];
	sessionFolder: string;
}

const DEFAULT_SETTINGS: PluginSettings = {
	running: false,
	startedAt: null,
	knownProjects: [],
	sessionFolder: "Time Log/Sessions",
};

export default class MenubarTimeTrackerPlugin extends Plugin {
	settings: PluginSettings = { ...DEFAULT_SETTINGS };
	private remote: ElectronRemote | null = null;
	private tray: MenuBarTray | null = null;
	private timer: Timer | null = null;
	private modalOpen = false;

	async onload(): Promise<void> {
		if (!Platform.isDesktopApp) return;

		this.remote = getElectronRemote();
		if (!this.remote) {
			console.error(
				"Menu-Bar Time Tracker: Electron remote API unavailable; plugin disabled.",
			);
			return;
		}

		await this.loadSettings();

		this.tray = new MenuBarTray(this.remote, {
			onToggle: () => this.timer?.toggle(),
			buildMenuTemplate: () => this.buildMenuTemplate(),
		});

		this.timer = new Timer({
			tray: this.tray,
			settings: this.settings,
			save: () => this.saveSettings(),
			registerInterval: (id) => this.registerInterval(id),
			isModalOpen: () => this.modalOpen,
			openStopModal: (elapsedMs) => this.openStopModal(elapsedMs),
		});

		this.addCommand({
			id: "toggle-timer",
			name: "Toggle timer",
			callback: () => this.timer?.toggle(),
		});

		// Resume a timer that was running when Obsidian last closed (R11).
		this.app.workspace.onLayoutReady(() => this.timer?.resumeIfRunning());
	}

	onunload(): void {
		this.tray?.destroy();
		this.tray = null;
	}

	async loadSettings(): Promise<void> {
		const data = (await this.loadData()) as Partial<PluginSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data ?? {});
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	private openStopModal(elapsedMs: number): void {
		this.modalOpen = true;
		new StopModal(this.app, elapsedMs, this.settings.knownProjects, {
			onSubmit: (result) => {
				this.modalOpen = false;
				void this.handleSubmit(elapsedMs, result);
			},
			onCancel: () => {
				this.modalOpen = false;
				this.timer?.cancel();
			},
		}).open();
	}

	private async handleSubmit(elapsedMs: number, result: StopResult): Promise<void> {
		const startMs = this.settings.startedAt ?? Date.now() - elapsedMs;
		const endMs = startMs + elapsedMs;
		try {
			// Write first; only on success update state, clear the timer, and confirm.
			await writeSession(this.app, {
				folder: this.settings.sessionFolder,
				startMs,
				endMs,
				project: result.project,
				description: result.description,
			});
			this.settings.knownProjects = addKnownProject(this.settings.knownProjects, result.project);
			this.timer?.clear(); // clears running state and persists (incl. knownProjects)
			new Notice(`Session saved — ${result.project}, ${formatHuman(elapsedMs / 60000)}`);
		} catch (e) {
			console.error("Menu-Bar Time Tracker: failed to write session", e);
			new Notice("Time Tracker: couldn't save the session — timer kept, try again.");
			// Keep elapsed; re-present the modal so the session isn't lost.
			this.openStopModal(elapsedMs);
		}
	}

	// Replaced in U6 with cancel/settings items.
	private buildMenuTemplate(): MenuTemplate {
		return [{ label: "Time Tracker", enabled: false }];
	}
}
