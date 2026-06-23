import { describe, expect, it } from "vitest";
import { formatHuman, formatTrayElapsed, minutesBetween } from "../src/format";

describe("formatTrayElapsed", () => {
	it("shows M:SS under an hour", () => {
		expect(formatTrayElapsed(42 * 60 * 1000)).toBe("42:00");
	});

	it("shows H:MM:SS at or over an hour", () => {
		expect(formatTrayElapsed(3 * 3600 * 1000 + 125 * 1000)).toBe("3:02:05");
	});

	it("renders zero as 0:00", () => {
		expect(formatTrayElapsed(0)).toBe("0:00");
	});

	it("flips to H:MM:SS exactly at one hour", () => {
		expect(formatTrayElapsed(3600 * 1000)).toBe("1:00:00");
	});

	it("never goes negative", () => {
		expect(formatTrayElapsed(-5000)).toBe("0:00");
	});
});

describe("formatHuman", () => {
	it.each([
		[0, "0m"],
		[42, "42m"],
		[63, "1h 03m"],
		[840, "14h 00m"],
		[-5, "0m"],
	])("formats %i minutes as %s", (minutes, expected) => {
		expect(formatHuman(minutes)).toBe(expected);
	});
});

describe("minutesBetween", () => {
	const base = "2026-06-23T14:00:00.000Z";
	const plus = (seconds: number) => new Date(Date.parse(base) + seconds * 1000).toISOString();

	it("rounds 89s down to 1 minute", () => {
		expect(minutesBetween(base, plus(89))).toBe(1);
	});

	it("rounds 91s up to 2 minutes", () => {
		expect(minutesBetween(base, plus(91))).toBe(2);
	});

	it("is 0 for an instant session", () => {
		expect(minutesBetween(base, base)).toBe(0);
	});

	it("returns 0 for unparseable input instead of NaN", () => {
		expect(minutesBetween("not-a-date", base)).toBe(0);
		expect(minutesBetween(base, "nonsense")).toBe(0);
	});
});
