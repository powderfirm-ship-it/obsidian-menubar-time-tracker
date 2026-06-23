// Electron access + menu-bar icon rendering.
//
// getElectronRemote() is ported verbatim from the author's `obsidian-headless-mode`
// plugin, which already constructs an Electron Tray from a renderer-process plugin in
// the current Obsidian build — so this access path is proven, not speculative.

export interface ElectronRemote {
	Tray: new (image: unknown) => ElectronTray;
	Menu: { buildFromTemplate(template: unknown[]): unknown };
	nativeImage: {
		createEmpty(): ElectronNativeImage;
	};
}

export interface ElectronNativeImage {
	addRepresentation(rep: { scaleFactor: number; dataURL: string }): void;
	setTemplateImage(value: boolean): void;
}

export interface ElectronTray {
	setToolTip(text: string): void;
	setImage(image: unknown): void;
	setTitle(text: string, options?: { fontType?: string }): void;
	popUpContextMenu(menu: unknown): void;
	on(event: string, listener: () => void): void;
	destroy(): void;
	isDestroyed?(): boolean;
}

export function getElectronRemote(): ElectronRemote | null {
	const req = (window as unknown as { require?: (id: string) => unknown }).require;
	if (!req) return null;
	try {
		const electron = req("electron") as { remote?: ElectronRemote } | undefined;
		if (electron?.remote) return electron.remote;
	} catch (e) {
		/* fall through to @electron/remote */
	}
	try {
		return req("@electron/remote") as ElectronRemote;
	} catch (e) {
		return null;
	}
}

// Draws a 16pt clock as a macOS template image (system-tinted) at 1x and 2x.
// Idle = hollow ring with hands; running = filled disc with carved-out hands —
// distinct at a glance without relying on color.
export function createClockIcon(remote: ElectronRemote, running: boolean): ElectronNativeImage {
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

		ctx.strokeStyle = "#000000";
		ctx.fillStyle = "#000000";
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
	image.setTemplateImage(true);
	return image;
}
