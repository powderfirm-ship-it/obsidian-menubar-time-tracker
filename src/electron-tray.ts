// Electron access + menu-bar icon rendering.
//
// getElectronRemote() is ported verbatim from the author's `obsidian-headless-mode`
// plugin, which already constructs an Electron Tray from a renderer-process plugin in
// the current Obsidian build — so this access path is proven, not speculative.

// Opaque handle to an Electron Menu instance.
export type ElectronMenu = { readonly __electronMenu?: never };

// Menu-bar icon color. "auto" emits a macOS template image (system-tinted); some
// Electron builds ignore the template flag, so "white"/"black" force an explicit color.
export type IconColor = "auto" | "white" | "black";

export interface ElectronBrowserWindow {
	show(): void;
	focus(): void;
	isMinimized?(): boolean;
	restore?(): void;
}

export interface ElectronRemote {
	Tray: new (image: ElectronNativeImage) => ElectronTray;
	Menu: { buildFromTemplate(template: unknown[]): ElectronMenu };
	nativeImage: {
		createEmpty(): ElectronNativeImage;
	};
	getCurrentWindow?(): ElectronBrowserWindow;
}

export interface ElectronNativeImage {
	addRepresentation(rep: { scaleFactor: number; dataURL: string }): void;
	setTemplateImage(value: boolean): void;
}

export interface ElectronTray {
	setToolTip(text: string): void;
	setImage(image: ElectronNativeImage): void;
	setTitle(text: string, options?: { fontType?: string }): void;
	popUpContextMenu(menu: ElectronMenu): void;
	on(event: "click" | "right-click", listener: () => void): void;
	destroy(): void;
	isDestroyed?(): boolean;
}

// Confirms the object actually carries the Electron pieces we use, so a shape we
// don't expect becomes a graceful null (plugin disables) instead of a later TypeError.
function isElectronRemote(value: unknown): value is ElectronRemote {
	return (
		!!value &&
		typeof value === "object" &&
		"Tray" in value &&
		"Menu" in value &&
		"nativeImage" in value
	);
}

export function getElectronRemote(): ElectronRemote | null {
	const req = (window as unknown as { require?: (id: string) => unknown }).require;
	if (!req) return null;
	try {
		const electron = req("electron") as { remote?: unknown } | undefined;
		if (electron?.remote && isElectronRemote(electron.remote)) return electron.remote;
	} catch (e) {
		/* fall through to @electron/remote */
	}
	try {
		const remote = req("@electron/remote");
		if (isElectronRemote(remote)) return remote;
	} catch (e) {
		/* not available */
	}
	return null;
}

// Draws a 16pt clock at 1x and 2x. Idle = hollow ring with hands; running = filled
// disc with carved-out hands — distinct at a glance without relying on color.
// "auto" renders a black template image (macOS tints it); "white"/"black" force the color.
export function createClockIcon(
	remote: ElectronRemote,
	running: boolean,
	color: IconColor,
): ElectronNativeImage {
	const fill = color === "white" ? "#ffffff" : "#000000";
	const image = remote.nativeImage.createEmpty();
	for (const scale of [1, 2]) {
		const size = 16 * scale;
		const canvas = document.createElement("canvas");
		canvas.width = size;
		canvas.height = size;
		const ctx = canvas.getContext("2d");
		if (!ctx) continue;
		const s = scale;
		const cx = 8 * s;
		const cy = 8 * s;
		const r = 6 * s;

		ctx.strokeStyle = fill;
		ctx.fillStyle = fill;
		ctx.lineWidth = 1.5 * s;
		ctx.lineCap = "round";

		if (running) {
			ctx.beginPath();
			ctx.arc(cx, cy, r, 0, Math.PI * 2);
			ctx.fill();
			// carve the hands out of the filled disc
			ctx.globalCompositeOperation = "destination-out";
			ctx.beginPath();
			ctx.moveTo(cx, cy);
			ctx.lineTo(cx, cy - r * 0.55);
			ctx.moveTo(cx, cy);
			ctx.lineTo(cx + r * 0.45, cy);
			ctx.stroke();
			ctx.globalCompositeOperation = "source-over";
		} else {
			ctx.beginPath();
			ctx.arc(cx, cy, r, 0, Math.PI * 2);
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(cx, cy);
			ctx.lineTo(cx, cy - r * 0.55);
			ctx.moveTo(cx, cy);
			ctx.lineTo(cx + r * 0.45, cy);
			ctx.stroke();
		}

		image.addRepresentation({ scaleFactor: scale, dataURL: canvas.toDataURL("image/png") });
	}
	if (color === "auto") image.setTemplateImage(true);
	return image;
}
