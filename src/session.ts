// Pure, Obsidian-free session helpers. Unit-tested in tests/session.test.ts.

import { minutesBetween } from "./format";

// Saved duration is floored to 1 minute so a real sub-minute session counts toward
// the Base Sum instead of vanishing as 0. Full-fidelity ISO start/end are kept too.
export function saveMinutes(startISO: string, endISO: string): number {
	return Math.max(1, minutesBetween(startISO, endISO));
}

export function sanitizeForFilename(name: string): string {
	return name
		.replace(/[\\/:*?"<>|#^[\]]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function yamlQuote(value: string): string {
	return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export interface SessionData {
	project: string;
	startISO: string;
	endISO: string;
	minutes: number;
	date: string; // YYYY-MM-DD (local)
}

export function buildFrontmatter(data: SessionData): string {
	return [
		"---",
		`project: ${yamlQuote(data.project)}`,
		`start: ${data.startISO}`,
		`end: ${data.endISO}`,
		`duration: ${data.minutes}`,
		`date: ${data.date}`,
		"---",
	].join("\n");
}

export function buildBody(description: string): string {
	const text = description.trim();
	return text ? `\n${text}\n` : "\n";
}

export function buildNote(data: SessionData, description: string): string {
	return `${buildFrontmatter(data)}\n${buildBody(description)}`;
}

export function buildFilename(date: string, time: string, project: string): string {
	const safe = sanitizeForFilename(project) || "Untitled";
	return `${date} ${time} ${safe}.md`;
}

// Resolves a collision-free vault path, appending " 2", " 3", … when needed.
// `exists` is injected so this stays pure and testable.
export function nextAvailablePath(
	folder: string,
	filename: string,
	exists: (path: string) => boolean,
): string {
	const base = filename.replace(/\.md$/, "");
	const prefix = folder ? `${folder}/` : "";
	let candidate = `${prefix}${base}.md`;
	let n = 2;
	while (exists(candidate)) {
		candidate = `${prefix}${base} ${n}.md`;
		n++;
	}
	return candidate;
}

// Dedupes case- and whitespace-insensitively, preserving the first spelling.
export function addKnownProject(list: string[], name: string): string[] {
	const trimmed = name.trim();
	if (!trimmed) return list.slice();
	const exists = list.some((p) => p.toLowerCase() === trimmed.toLowerCase());
	return exists ? list.slice() : [...list, trimmed];
}
