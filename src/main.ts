import { Plugin } from "obsidian";

export default class MenubarTimeTrackerPlugin extends Plugin {
	async onload(): Promise<void> {
		// Wired up across U2–U6.
	}

	onunload(): void {
		// Teardown wired up in U2 (tray) and U3 (timer interval).
	}
}
