import { App, PluginSettingTab, Setting } from "obsidian";
import { DEFAULT_FOLDER } from "./constants";
import { IconColor } from "./electron-tray";
import type MenubarTimeTrackerPlugin from "./main";

export class TimeTrackerSettingTab extends PluginSettingTab {
	private plugin: MenubarTimeTrackerPlugin;

	constructor(app: App, plugin: MenubarTimeTrackerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Session folder")
			.setDesc("Vault folder where session notes are written.")
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_FOLDER)
					.setValue(this.plugin.settings.sessionFolder)
					.onChange(async (value) => {
						this.plugin.settings.sessionFolder = value.trim() || DEFAULT_FOLDER;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Menu-bar icon color")
			.setDesc(
				"White suits a dark menu bar, Black suits a light one. Auto uses a macOS template image that the system tints — but some builds render it black.",
			)
			.addDropdown((dropdown) =>
				dropdown
					.addOption("white", "White")
					.addOption("black", "Black")
					.addOption("auto", "Auto (macOS template)")
					.setValue(this.plugin.settings.iconColor)
					.onChange((value) => this.plugin.setIconColor(value as IconColor)),
			);
	}

	// Fires once when the settings pane closes — warn if the Base now filters a
	// folder the user moved away from, so the rollup doesn't silently go empty.
	hide(): void {
		this.plugin.checkBaseFolderDrift();
	}
}
