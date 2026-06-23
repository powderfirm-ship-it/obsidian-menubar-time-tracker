import { Platform, Plugin } from "obsidian";
import { ElectronRemote, getElectronRemote } from "./electron-tray";
import { MenuBarTray, MenuTemplate } from "./tray";

export default class MenubarTimeTrackerPlugin extends Plugin {
	private remote: ElectronRemote | null = null;
	private tray: MenuBarTray | null = null;

	async onload(): Promise<void> {
		if (!Platform.isDesktopApp) return;

		this.remote = getElectronRemote();
		if (!this.remote) {
			console.error(
				"Menu-Bar Time Tracker: Electron remote API unavailable; plugin disabled.",
			);
			return;
		}

		this.tray = new MenuBarTray(this.remote, {
			onToggle: () => this.handleToggle(),
			buildMenuTemplate: () => this.buildMenuTemplate(),
		});
	}

	onunload(): void {
		this.tray?.destroy();
		this.tray = null;
	}

	// Replaced in U3 with the real timer toggle.
	private handleToggle(): void {
		console.log("Menu-Bar Time Tracker: tray clicked (toggle)");
	}

	// Replaced in U6 with cancel/settings items.
	private buildMenuTemplate(): MenuTemplate {
		return [{ label: "Time Tracker", enabled: false }];
	}
}
