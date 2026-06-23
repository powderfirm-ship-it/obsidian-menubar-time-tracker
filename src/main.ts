import { Platform, Plugin } from "obsidian";
import { ElectronRemote, getElectronRemote } from "./electron-tray";
import { StopModal, StopResult } from "./stop-modal";
import { Timer } from "./timer";
import { MenuBarTray, MenuTemplate } from "./tray";

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

	// Replaced in U5 with the real session writer. For now, discard after logging.
	private async handleSubmit(elapsedMs: number, result: StopResult): Promise<void> {
		console.log(
			`Menu-Bar Time Tracker: save ${result.project} (${elapsedMs}ms) — writer pending (U5)`,
		);
		this.timer?.clear();
	}

	// Replaced in U6 with cancel/settings items.
	private buildMenuTemplate(): MenuTemplate {
		return [{ label: "Time Tracker", enabled: false }];
	}
}
