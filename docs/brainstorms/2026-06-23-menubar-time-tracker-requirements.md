---
date: 2026-06-23
topic: menubar-time-tracker
---

# Menu-Bar Project Time Tracker (Obsidian Plugin)

## Summary

A focused Obsidian desktop plugin that places a clock icon in the macOS menu bar. Left-click starts a timer (the icon shows live elapsed time); left-click again stops it and opens a modal to confirm the project and add a description. On save, the session is written into the vault as markdown, so per-project time is owned, plain-text, and queryable in Obsidian. Built as a standalone sibling to the author's existing Headless Mode plugin, reusing its proven Electron `Tray` pattern.

---

## Problem Frame

Malik works across many projects (Tack Tools Pro, Meirakami, Yonder, Ice Mount'n, Meir Luck, books, side quests) and has no record of how much time each one actually consumes. There's currently no time log at all — the data simply doesn't exist, so questions like "how much time did I sink into Yonder this month" can't be answered.

Off-the-shelf menu-bar trackers (Toggl, Timing, Tyme) exist and nail the start/stop loop, but their data lives inside a third-party SaaS database. Getting a clean, plain-text, per-project log out of them means fighting exports and APIs — which runs against Malik's core preference for owning his data inside his Obsidian vault, where time can sit next to project notes and roll up via Bases. The friction that has prevented tracking so far is the gap between "one-click capture at the top of the screen" and "the log ending up somewhere I own and can query."

---

## Actors

Single-actor tool. Omitting the Actors section — the only actor is Malik, the operator, on his primary Mac. No multi-user, agent, or system-perspective decisions are involved.

---

## Key Flows

- F1. Track a work session
  - **Trigger:** Malik left-clicks the menu-bar clock icon to begin working.
  - **Steps:** (1) Timer starts; start time is persisted to disk. (2) The menu-bar icon displays live elapsed time while running. (3) Malik works in any app. (4) He left-clicks the icon again to stop. (5) A modal opens showing the elapsed duration, a project picker (existing projects + type-to-add-new), and a description field. (6) He confirms the project, types a brief description, and saves.
  - **Outcome:** One session is written to the vault as markdown with project, start, end, duration, and description. The icon returns to its idle state.
  - **Covered by:** R1, R2, R3, R4, R5, R6, R9

- F2. Cancel a session without logging
  - **Trigger:** Malik started a timer by mistake, or doesn't want to record the session.
  - **Steps:** (1) Right-click the icon for the menu. (2) Choose "Cancel timer" (or dismiss the stop modal without saving).
  - **Outcome:** No session note is written; the running-timer state is cleared.
  - **Covered by:** R7, R8

---

## Requirements

**Menu-bar control**
- R1. The plugin places an icon in the macOS menu bar using the Electron `Tray` API, following the pattern proven in the author's Headless Mode plugin.
- R2. Left-clicking the icon toggles the timer: first click starts, next click stops and opens the stop modal. Only one timer runs at a time.
- R3. While a timer runs, the menu-bar icon shows live elapsed time (e.g. `◷ 0:42`) and visibly distinguishes running from idle.
- R7. Right-clicking the icon opens a menu with at least: cancel the current timer (when running) and open plugin settings.

**Stop modal**
- R4. Stopping opens a modal that displays the elapsed duration and requires the user to confirm a project before saving.
- R5. The project field is a picker of previously used projects that also accepts a newly typed name, which is then remembered for future sessions.
- R6. The modal includes a free-text description field for a brief note on what was worked on.
- R8. The modal can be dismissed without saving, which records no session and clears the running-timer state.

**Logging and rollup**
- R9. On save, the plugin writes one note per session into a dedicated vault folder, with frontmatter capturing project, start, end, duration, and a date, plus the description in the body.
- R10. The plugin provides (or the doc ships) an Obsidian Base that lists sessions, groups by project, and sums duration, so "time per project" is a live view rather than a manual tally.
- R11. The running timer's start time is persisted to disk so an Obsidian restart or crash mid-session does not lose the in-progress session.

---

## Acceptance Examples

- AE1. **Covers R2, R3.** Given no timer is running, when Malik left-clicks the icon, then the timer starts and the icon begins showing live elapsed time.
- AE2. **Covers R4, R5, R6, R9.** Given a timer has run for 42 minutes, when Malik left-clicks the icon, then a modal shows "42m", and on selecting "Yonder" + typing a description and saving, a session note is written with project=Yonder, the start/end timestamps, duration=42m, and the description in the body.
- AE3. **Covers R5.** Given "Boyfrnd." is not yet a known project, when Malik types "Boyfrnd." in the stop modal and saves, then "Boyfrnd." appears in the project picker for future sessions.
- AE4. **Covers R8.** Given a timer is running, when Malik dismisses the stop modal without saving, then no session note is written and the icon returns to idle.
- AE5. **Covers R11.** Given a timer is running and Obsidian is quit and reopened, when the plugin reloads, then the in-progress session is recovered (still running from the original start time) rather than lost.

---

## Success Criteria

- After a week of use, Malik can open one Base view and see total time per project without any manual tallying.
- Starting and stopping a session is a single left-click each, fast enough that it doesn't interrupt flow.
- The log is plain markdown inside the vault — readable, editable, and queryable with no export step.
- Handoff is clean enough that `/ce-plan` can produce an implementation plan without inventing product behavior, the data shape, or the interaction model.

---

## Scope Boundaries

- No idle/away detection or auto-pause in v1.
- No in-modal duration editing — if a timer runs too long (e.g. forgotten overnight), the session note is hand-edited afterward.
- No multiple concurrent or overlapping timers.
- No billing, invoicing, or reporting beyond the Base rollup.
- No mobile support — the Tray/menu-bar approach is desktop-only (`isDesktopOnly: true`), matching Headless Mode.
- Not a feature bolted onto Headless Mode — it ships as its own single-purpose plugin (see Key Decisions).

---

## Key Decisions

- Build as an Obsidian plugin rather than a standalone Swift/native app: the author's shipped Headless Mode plugin already proves an Obsidian plugin can own a real macOS menu-bar presence via Electron `Tray`, and a plugin writes markdown directly into the vault — satisfying both "lives at the top of the screen" and "data lives in my vault."
- Standalone sibling plugin rather than a feature inside Headless Mode: the two have unrelated jobs (hide-the-app vs. track-time), and a dedicated plugin gets its own icon that can act as the live timer readout via `Tray.setTitle()` — which Headless Mode's icon should not do.
- Project assigned at stop, not at start: matches the original intent (confirm-and-describe at the end) and means the running timer never needs to know the project up front.
- Left-click toggle + right-click menu: gives true one-click start/stop for the common path while keeping settings/cancel reachable.
- One-note-per-session + Base rather than a single table file: Bases query notes (not table rows), so per-session notes give the strongest per-project rollup and match the vault's atomic-notes philosophy. (Single-file table was considered and rejected as weaker for rollups.)

---

## Dependencies / Assumptions

- Reuses the Electron `Tray` / `@electron/remote` access pattern already working in `obsidian-headless-mode/main.js` (icon rendering, retina scaling, stale-tray cleanup). Desktop Obsidian only.
- Assumes a dedicated vault folder for session notes (exact location to be chosen in planning) and that the vault's Bases plugin is available for the rollup view.
- Assumes single-user, single-machine use on Malik's primary Mac; no sync-conflict handling for a timer running on two devices at once.

---

## Outstanding Questions

### Deferred to Planning

- [Affects R9][Technical] Exact vault folder for session notes and the note-naming scheme (e.g. timestamp-based filename).
- [Affects R9][Technical] Frontmatter field names and the duration format (e.g. minutes as a number vs. `Hh Mm` string) that Bases rolls up cleanly.
- [Affects R10][Technical] Whether the plugin generates the `.base` file automatically or it's a one-time hand-placed asset shipped with the plugin.
- [Affects R5][Technical] Where the known-projects list is stored (plugin data vs. derived from existing session notes).
- [Affects R3][Needs research] Confirm `Tray.setTitle()` live-updating behavior and refresh cadence for a smooth elapsed-time readout without excess redraws.
