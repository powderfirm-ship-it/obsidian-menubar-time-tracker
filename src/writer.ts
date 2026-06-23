import { App, normalizePath } from "obsidian";
import { buildFilename, buildNote, nextAvailablePath, saveMinutes, SessionData } from "./session";

function pad(n: number): string {
	return String(n).padStart(2, "0");
}

function localDate(d: Date): string {
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function localTime(d: Date): string {
	return `${pad(d.getHours())}${pad(d.getMinutes())}`;
}

export interface WriteInput {
	folder: string;
	startMs: number;
	endMs: number;
	project: string;
	description: string;
}

// Writes one session note. Returns the created path. Throws on vault errors so the
// caller can retain the timer and let the user retry.
export async function writeSession(app: App, input: WriteInput): Promise<string> {
	const folder = normalizePath(input.folder);
	await ensureFolder(app, folder);

	const start = new Date(input.startMs);
	const end = new Date(input.endMs);
	const startISO = start.toISOString();
	const endISO = end.toISOString();

	const data: SessionData = {
		project: input.project,
		startISO,
		endISO,
		minutes: saveMinutes(startISO, endISO),
		date: localDate(end),
	};

	const filename = buildFilename(localDate(end), localTime(end), input.project);
	const path = nextAvailablePath(
		folder,
		filename,
		(p) => app.vault.getAbstractFileByPath(p) != null,
	);

	await app.vault.create(path, buildNote(data, input.description));
	return path;
}

async function ensureFolder(app: App, folder: string): Promise<void> {
	if (!folder || folder === "/" || folder === ".") return;
	if (app.vault.getAbstractFileByPath(folder)) return;
	try {
		await app.vault.createFolder(folder);
	} catch (e) {
		// Tolerate the "already exists / created concurrently" race, but surface any
		// real failure (permissions, read-only vault) to the caller's catch.
		if (!app.vault.getAbstractFileByPath(folder)) throw e;
	}
}
