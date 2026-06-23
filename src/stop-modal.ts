import { AbstractInputSuggest, App, ButtonComponent, Modal, Setting } from "obsidian";
import { formatHuman } from "./format";

export interface StopResult {
	project: string;
	description: string;
}

export interface StopHandlers {
	onSubmit: (result: StopResult) => void;
	onCancel: () => void;
}

// Embedded "pick existing or type new" suggester on the project input.
class ProjectSuggest extends AbstractInputSuggest<string> {
	private projects: string[];
	private onPick: (value: string) => void;

	constructor(
		app: App,
		inputEl: HTMLInputElement,
		projects: string[],
		onPick: (value: string) => void,
	) {
		super(app, inputEl);
		this.projects = projects;
		this.onPick = onPick;
	}

	getSuggestions(query: string): string[] {
		const q = query.toLowerCase().trim();
		if (!q) return this.projects.slice();
		return this.projects.filter((p) => p.toLowerCase().includes(q));
	}

	renderSuggestion(value: string, el: HTMLElement): void {
		el.setText(value);
	}

	selectSuggestion(value: string): void {
		this.setValue(value);
		this.onPick(value);
		this.close();
	}
}

export class StopModal extends Modal {
	private elapsedMs: number;
	private knownProjects: string[];
	private handlers: StopHandlers;
	private submitted = false;
	private project = "";
	private description = "";
	private saveButton: ButtonComponent | null = null;

	constructor(app: App, elapsedMs: number, knownProjects: string[], handlers: StopHandlers) {
		super(app);
		this.elapsedMs = elapsedMs;
		this.knownProjects = knownProjects;
		this.handlers = handlers;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass("mbtt-stop-modal");
		contentEl.createEl("h3", { text: "Stop timer" });
		contentEl.createDiv({
			cls: "mbtt-elapsed",
			text: formatHuman(this.elapsedMs / 60000),
		});

		new Setting(contentEl).setName("Project").addText((text) => {
			text.setPlaceholder("Project name");
			text.onChange((value) => {
				this.project = value;
				this.refreshSaveState();
			});
			new ProjectSuggest(this.app, text.inputEl, this.knownProjects, (value) => {
				this.project = value;
				this.refreshSaveState();
			});
		});

		new Setting(contentEl).setName("Description").addTextArea((area) => {
			area.setPlaceholder("What did you work on?");
			area.onChange((value) => {
				this.description = value;
			});
		});

		const buttons = contentEl.createDiv({ cls: "mbtt-buttons" });
		new ButtonComponent(buttons).setButtonText("Cancel").onClick(() => this.close());
		this.saveButton = new ButtonComponent(buttons)
			.setButtonText("Save")
			.setCta()
			.onClick(() => this.submit());
		this.refreshSaveState();
	}

	private refreshSaveState(): void {
		this.saveButton?.setDisabled(this.project.trim().length === 0);
	}

	private submit(): void {
		const project = this.project.trim();
		if (!project) return;
		this.submitted = true;
		this.close();
		this.handlers.onSubmit({ project, description: this.description.trim() });
	}

	onClose(): void {
		this.contentEl.empty();
		// Esc, the Cancel button, and click-away all land here without submit set.
		if (!this.submitted) this.handlers.onCancel();
	}
}
