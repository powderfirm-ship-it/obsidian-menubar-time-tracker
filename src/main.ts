import { Notice, Platform, Plugin, normalizePath } from "obsidian";
import { buildBaseFile } from "./base-asset";
import { ElectronRemote, getElectronRemote } from "./electron-tray";
import { formatHuman } from "./format";
import { addKnownProject } from "./session";
import { TimeTrackerSettingTab } from "./settings";
import { StopModal, StopResult } from "./stop-modal";
import { Timer } from "./timer";
import { MenuBarTray, MenuTemplate } from "./tray";
import { writeSession } from "./writer";

const DEFAULT_FOLDER = "Time Log/Sessions";
const BASE_FILENAME = "Time per project.base";

export interface PluginSettings {
	running: boolean;
	startedAt: number | null;
	knownProjects: string[];
	sessionFolder: string;
	baseFilterFolder: string | null;
}

const DEFAULT_SETTINGS: PluginSettings = {
	running: false,
	startedAt: null,
	knownProjects: [],
	sessionFolder: DEFAULT_FOLDER,
	baseFilterFolder: null,
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

		this.addSettingTab(new TimeTrackerSettingTab(this.app, this));

		this.app.workspace.onLayoutReady(() => {
			this.timer?.resumeIfRunning(); // R11
			void this.deployBaseIfAbsent();
		});
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
			void this.deployBaseIfAbsent();
		} catch (e) {
			console.error("Menu-Bar Time Tracker: failed to write session", e);
			new Notice("Time Tracker: couldn't save the session — timer kept, try again.");
			// Keep elapsed; re-present the modal so the session isn't lost.
			this.openStopModal(elapsedMs);
		}
	}

	private buildMenuTemplate(): MenuTemplate {
		const running = this.timer?.running ?? false;
		return [
			{
				label: running ? "Stop timer" : "Start timer",
				enabled: !this.modalOpen,
				click: () => this.timer?.toggle(),
			},
			{
				label: "Cancel timer",
				enabled: running && !this.modalOpen,
				click: () => this.timer?.cancel(),
			},
			{ type: "separator" },
			{
				label: "Settings",
				click: () => this.openSettings(),
			},
		];
	}

	private openSettings(): void {
		const setting = (this.app as unknown as {
			setting?: { open?: () => void; openTabById?: (id: string) => void };
		}).setting;
		setting?.open?.();
		setting?.openTabById?.(this.manifest.id);
	}

	// Drops the "Time per project" Base next to the session folder the first time
	// the folder exists, templating its filter and never overwriting an existing file.
	private async deployBaseIfAbsent(): Promise<void> {
		const folder = normalizePath(this.settings.sessionFolder);
		const parent = folder.includes("/") ? folder.slice(0, folder.lastIndexOf("/")) : "";
		const basePath = parent ? `${parent}/${BASE_FILENAME}` : BASE_FILENAME;

		if (this.app.vault.getAbstractFileByPath(basePath)) {
			if (!this.settings.baseFilterFolder) {
				this.settings.baseFilterFolder = folder;
				await this.saveSettings();
			}
			return;
		}
		// The parent must exist; it will once a session has been written. Until then,
		// skip — the next write retries.
		if (parent && !this.app.vault.getAbstractFileByPath(parent)) return;
		try {
			await this.app.vault.create(basePath, buildBaseFile(folder));
			this.settings.baseFilterFolder = folder;
			await this.saveSettings();
		} catch (e) {
			console.error("Menu-Bar Time Tracker: couldn't deploy the Base", e);
		}
	}

	checkBaseFolderDrift(): void {
		const deployed = this.settings.baseFilterFolder;
		const current = normalizePath(this.settings.sessionFolder);
		if (deployed && deployed !== current) {
			new Notice(
				`Time Tracker: your "${BASE_FILENAME}" still filters "${deployed}". ` +
					`Update its file.inFolder filter to "${current}".`,
			);
		}
	}
}
