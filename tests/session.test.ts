import { describe, expect, it } from "vitest";
import {
	addKnownProject,
	buildFilename,
	buildFrontmatter,
	buildNote,
	nextAvailablePath,
	sanitizeForFilename,
	saveMinutes,
} from "../src/session";

const base = "2026-06-23T14:00:00.000Z";
const plus = (seconds: number) => new Date(Date.parse(base) + seconds * 1000).toISOString();

describe("saveMinutes", () => {
	it("floors a 25-second session to 1 minute", () => {
		expect(saveMinutes(base, plus(25))).toBe(1);
	});

	it("keeps a 42-minute session at 42", () => {
		expect(saveMinutes(base, plus(42 * 60))).toBe(42);
	});
});

describe("buildFrontmatter / buildNote", () => {
	const data = {
		project: "Yonder",
		startISO: base,
		endISO: plus(42 * 60),
		minutes: 42,
		date: "2026-06-23",
	};

	it("emits integer duration and ISO timestamps", () => {
		const fm = buildFrontmatter(data);
		expect(fm).toContain("duration: 42");
		expect(fm).toContain(`start: ${base}`);
		expect(fm).toContain(`end: ${plus(42 * 60)}`);
		expect(fm).toContain('project: "Yonder"');
	});

	it("puts the description in the body", () => {
		expect(buildNote(data, "Shipped the map view")).toContain("Shipped the map view");
	});

	it("produces an empty body for a blank description without crashing", () => {
		expect(buildNote(data, "   ")).toMatch(/---\n\n$/);
	});

	it("escapes backslashes and quotes in the project name", () => {
		const fm = buildFrontmatter({ ...data, project: 'a"b\\c' });
		expect(fm).toContain('project: "a\\"b\\\\c"');
	});
});

describe("sanitizeForFilename", () => {
	it.each(["\\", "/", ":", "*", "?", '"', "<", ">", "|", "#", "^", "[", "]"])(
		"replaces the illegal character %s with a space",
		(ch) => {
			expect(sanitizeForFilename(`a${ch}b`)).toBe("a b");
		},
	);

	it("collapses runs of whitespace", () => {
		expect(sanitizeForFilename("a   b")).toBe("a b");
	});
});

describe("buildFilename", () => {
	it("formats as 'YYYY-MM-DD HHmm <project>.md'", () => {
		expect(buildFilename("2026-06-23", "1432", "Yonder")).toBe("2026-06-23 1432 Yonder.md");
	});

	it("sanitizes filesystem-illegal characters", () => {
		expect(buildFilename("2026-06-23", "1432", "Client/Acme:1")).toBe(
			"2026-06-23 1432 Client Acme 1.md",
		);
	});

	it("falls back to 'Untitled' when the name sanitizes to empty", () => {
		expect(buildFilename("2026-06-23", "1432", "/")).toBe("2026-06-23 1432 Untitled.md");
	});
});

describe("nextAvailablePath", () => {
	it("returns the base path when nothing exists", () => {
		expect(nextAvailablePath("F", "a.md", () => false)).toBe("F/a.md");
	});

	it("appends ' 2' when the base exists", () => {
		const taken = new Set(["F/a.md"]);
		expect(nextAvailablePath("F", "a.md", (p) => taken.has(p))).toBe("F/a 2.md");
	});

	it("appends ' 3' when base and ' 2' exist", () => {
		const taken = new Set(["F/a.md", "F/a 2.md"]);
		expect(nextAvailablePath("F", "a.md", (p) => taken.has(p))).toBe("F/a 3.md");
	});
});

describe("addKnownProject", () => {
	it("adds a new project", () => {
		expect(addKnownProject(["Yonder"], "Boyfrnd.")).toEqual(["Yonder", "Boyfrnd."]);
	});

	it("does not duplicate by case or whitespace", () => {
		expect(addKnownProject(["Yonder"], "yonder")).toEqual(["Yonder"]);
		expect(addKnownProject(["Yonder"], "  Yonder  ")).toEqual(["Yonder"]);
	});

	it("ignores an empty name", () => {
		expect(addKnownProject(["Yonder"], "   ")).toEqual(["Yonder"]);
	});
});
