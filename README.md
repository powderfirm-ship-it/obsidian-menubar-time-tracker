# Menu-Bar Time Tracker

A focused Obsidian desktop plugin that puts a clock in your **macOS menu bar** for one-click project time tracking. Left-click to start, left-click again to stop, then confirm the project and jot a description — a markdown session note lands in your vault, and an Obsidian Base rolls up total time per project.

Built to keep the data **yours**: plain markdown in your vault, not a SaaS database.

## How it works

- **Left-click** the menu-bar clock → starts a timer (the icon shows live elapsed time, e.g. `0:42`).
- **Left-click again** → stops it and opens a modal: pick an existing project or type a new one, add a description, Save.
- **Right-click** → menu with Start/Stop, Cancel timer (while running), and Settings.
- Each session is written as one note with frontmatter (`project`, `start`, `end`, `duration` in minutes, `date`).
- A shipped **`Time per project.base`** groups sessions by project and sums duration.
- A running timer **survives an Obsidian restart** — it resumes from where it left off.
- A **"Toggle timer" command** mirrors the left-click, as a fallback if the menu-bar icon is hidden behind the notch.
- Stopping **surfaces the Obsidian window** so the tag-the-session modal is visible even when Obsidian was in the background.
- The menu-bar icon color is configurable (**White / Black / Auto**) since some Electron builds don't honor the macOS auto-tint template.

macOS-only for the live menu-bar readout (`Tray.setTitle` is macOS-only); the timer and note-writing still work elsewhere.

## Install (local / development)

```bash
npm install
npm run build      # produces main.js
```

Then copy `main.js`, `manifest.json`, and `styles.css` into your vault at:

```
<vault>/.obsidian/plugins/menubar-time-tracker/
```

Enable it under **Settings → Community plugins** (Restricted Mode off). Set your session folder under the plugin's settings (default `Time Log/Sessions`).

The **`Time per project` Base** is deployed automatically next to your session folder after the first session is saved. If you change the session folder later, update the Base's `file.inFolder(...)` filter (the plugin reminds you).

## Develop

```bash
npm run dev        # esbuild watch
npm test           # vitest (pure logic: format, session)
npm run typecheck  # tsc --noEmit
```

Pure, Obsidian-free logic lives in `src/format.ts` and `src/session.ts` and is unit-tested. The Obsidian/Electron-coupled code (tray, modal, vault) is thin and verified manually in Obsidian (see below).

## Manual verification checklist

Because there's no headless Obsidian harness, verify these in your running Obsidian after installing:

1. **Tray click wiring (the one unproven assumption):** left-click toggles start/stop; right-click opens the menu. (Confirms the macOS `on('click')` / `on('right-click')` + `popUpContextMenu` path works in your Obsidian/Electron build.)
2. **Live readout:** the menu-bar icon counts up each second without horizontal jitter; idle vs running icons differ.
3. **Stop modal:** elapsed shows; the project field suggests prior projects and accepts a new name; Save is inert until a project is set; Esc/Cancel/click-away writes nothing.
4. **Note written:** a session note appears in the session folder with correct frontmatter; a same-minute second session gets a ` 2` suffix.
5. **Restart resume:** start a timer, quit and reopen Obsidian — the timer resumes from the original start and is visible immediately.
6. **Base rollup:** open `Time per project.base` — sessions group by project with summed minutes/hours.
7. **Coexists with Headless Mode:** both menu-bar icons work; neither destroys the other.

## License

MIT
