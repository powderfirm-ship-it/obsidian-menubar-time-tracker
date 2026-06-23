import { Notice, Platform, Plugin, normalizePath } from "obsidian";
import { buildBaseFile } from "./base-asset";
import { BASE_FILENAME, DEFAULT_FOLDER } from "./constants";
import { ElectronRemote, IconColor, getElectronRemote } from "./electron-tray";
import { formatHuman } from "./format";
import { addKnownProject } from "./session";
import { TimeTrackerSettingTab } from "./settings";
import { StopModal, StopResult } from "./stop-modal";
import { Timer } from "./timer";
import { MenuBarTray, MenuTemplate } from "./tray";
import { writeSession } from "./writer";

// After this many consecutive write failures, stop re-opening the modal and park
// the (still-running) timer so the user can retry deliberately — no infinite loop.
const MAX_SAVE_RETRIES = 2;

export interface PluginSettings {
	running: boolean;
	startedAt: number | null;
	knownProjects: string[];
	sessionFolder: string;
	baseFilterFolder: string | null;
	iconColor: IconColor;
}

const DEFAULT_SETTINGS: PluginSettings = {
	running: false,
	startedAt: null,
	knownProjects: [],
	sessionFolder: DEFAULT_FOLDER,
	baseFilterFolder: null,
	// "white" suits the typical dark macOS menu bar; "auto" (template) is unreliable
	// in some Electron builds, so it is opt-in via settings rather than the default.
	iconColor: "white",
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
			new Notice("Time Tracker: Electron API unavailable — plugin disabled.");
			return;
		}

		await this.loadSettings();

		this.tray = new MenuBarTray(this.remote, {
			onToggle: () => this.timer?.toggle(),
			buildMenuTemplate: () => this.buildMenuTemplate(),
			color: this.settings.iconColor,
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
		this.timer?.dispose(); // stop the render tick before tearing down the tray
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

	// `modalOpen` stays true for the whole stop→save round-trip (including retries),
	// so a tray click during the awaited write can't fire a second stop.
	private openStopModal(elapsedMs: number, prefill?: StopResult, attempt = 0): void {
		this.modalOpen = true;
		// The modal renders inside the Obsidian window — surface it so the user isn't
		// left hunting for a hidden window after stopping from the menu bar.
		this.focusObsidianWindow();
		new StopModal(
			this.app,
			elapsedMs,
			this.settings.knownProjects,
			{
				onSubmit: (result) => {
					void this.handleSubmit(elapsedMs, result, attempt);
				},
				onCancel: () => {
					this.modalOpen = false;
					this.timer?.cancel();
				},
			},
			prefill,
		).open();
	}

	private async handleSubmit(elapsedMs: number, result: StopResult, attempt: number): Promise<void> {
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
			this.modalOpen = false;
		} catch (e) {
			console.error("Menu-Bar Time Tracker: failed to write session", e);
			if (attempt >= MAX_SAVE_RETRIES) {
				new Notice(
					"Time Tracker: couldn't save after retries — the timer is still running; stop it again to retry.",
				);
				this.modalOpen = false; // park; the timer is still running so the user can stop again
				return;
			}
			new Notice("Time Tracker: couldn't save the session — try again.");
			// Re-present the modal with the user's input intact; modalOpen stays true.
			this.openStopModal(elapsedMs, result, attempt + 1);
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

	// Opens this plugin's settings pane. `app.setting` is an undocumented internal
	// API; the optional chaining makes a no-op the worst case if it ever changes.
	private openSettings(): void {
		const setting = (this.app as unknown as {
			setting?: { open?: () => void; openTabById?: (id: string) => void };
		}).setting;
		setting?.open?.();
		setting?.openTabById?.(this.manifest.id);
	}

	private focusObsidianWindow(): void {
		try {
			const win = this.remote?.getCurrentWindow?.();
			if (!win) return;
			if (win.isMinimized?.()) win.restore?.();
			win.show();
			win.focus();
		} catch {
			// Best effort — the modal still opens, just possibly behind the window.
		}
	}

	setIconColor(color: IconColor): void {
		this.settings.iconColor = color;
		this.tray?.setColor(color);
		void this.saveSettings();
	}

	// Drops the "Time per project" Base next to the session folder the first time the
	// folder exists, templating its filter and never overwriting or re-deploying.
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
		// Already deployed once (e.g. the user later moved the folder) — don't drop a
		// second Base; the drift Notice tells them to update the existing filter.
		if (this.settings.baseFilterFolder) return;
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
