import { Platform } from "obsidian";
import { ElectronRemote, ElectronTray, IconColor, createClockIcon } from "./electron-tray";

// Distinct from Headless Mode's `__headlessModeTray` so the two plugins' trays
// never destroy each other.
const TRAY_GLOBAL = "__menubarTimeTrackerTray";

export type MenuItemTemplate =
	| { label: string; enabled?: boolean; click?: () => void }
	| { type: "separator" };
export type MenuTemplate = MenuItemTemplate[];

export interface TrayOptions {
	onToggle: () => void;
	buildMenuTemplate: () => MenuTemplate;
	color: IconColor;
}

export class MenuBarTray {
	private remote: ElectronRemote;
	private tray: ElectronTray | null;
	private buildMenuTemplate: () => MenuTemplate;
	private color: IconColor;
	private running = false;

	constructor(remote: ElectronRemote, opts: TrayOptions) {
		this.remote = remote;
		this.buildMenuTemplate = opts.buildMenuTemplate;
		this.color = opts.color;

		const carrier = window as unknown as Record<string, ElectronTray | undefined>;
		const stale = carrier[TRAY_GLOBAL];
		if (stale && !stale.isDestroyed?.()) stale.destroy();

		this.tray = new remote.Tray(createClockIcon(remote, false, this.color));
		this.tray.setToolTip("Time Tracker — click to start");
		carrier[TRAY_GLOBAL] = this.tray;

		// Deliberate divergence from Headless Mode: do NOT call setContextMenu, so the
		// left-click event reaches our toggle. Right-click pops the menu on demand.
		this.tray.on("click", () => opts.onToggle());
		this.tray.on("right-click", () => this.popMenu());
	}

	private popMenu(): void {
		if (!this.tray || this.tray.isDestroyed?.()) return;
		const menu = this.remote.Menu.buildFromTemplate(this.buildMenuTemplate());
		this.tray.popUpContextMenu(menu);
	}

	setRunning(running: boolean): void {
		this.running = running;
		if (!this.tray || this.tray.isDestroyed?.()) return;
		this.tray.setImage(createClockIcon(this.remote, running, this.color));
		this.tray.setToolTip(running ? "Time Tracker — click to stop" : "Time Tracker — click to start");
		if (!running) this.setTitle("");
	}

	setColor(color: IconColor): void {
		this.color = color;
		if (!this.tray || this.tray.isDestroyed?.()) return;
		this.tray.setImage(createClockIcon(this.remote, this.running, this.color));
	}

	setTitle(text: string): void {
		if (!this.tray || this.tray.isDestroyed?.()) return;
		// Tray.setTitle is macOS-only; on other platforms the timer still runs and
		// writes notes, just without the live menu-bar readout.
		if (!Platform.isMacOS) return;
		this.tray.setTitle(text, { fontType: "monospacedDigit" });
	}

	destroy(): void {
		if (this.tray && !this.tray.isDestroyed?.()) this.tray.destroy();
		this.tray = null;
		(window as unknown as Record<string, ElectronTray | undefined>)[TRAY_GLOBAL] = undefined;
	}
}
