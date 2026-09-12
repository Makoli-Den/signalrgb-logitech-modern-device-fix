export function Name() { return "Logitech G102/G203 Lightsync"; }
export function VendorId() { return 0x046D; }
export function ProductId() { return [0xC092, 0xC09D]; }
export function Publisher() { return "Community"; }
export function Documentation() { return "troubleshooting/logitech-g102-lightsync"; }
export function Size() { return [3, 3]; }
export function DefaultPosition() { return [225, 120]; }
export function DefaultScale() { return 15.0; }
export function DeviceType() { return "mouse"; }
// Same VID/PID/interface OpenRGB registers "Logitech G203 Lightsync" under
// (Controllers/LogitechController/LogitechG203LController/) — the G102 is a
// rebadge of the same board and shares this PID.
export function Validate(endpoint) {
	return endpoint.interface === 1 && endpoint.usage_page === 0xff00 && endpoint.usage === 2;
}
export function ImageUrl() {
	return "https://assets.signalrgb.com/devices/default/mice/mouse.png";
}
/* global
shutdownColor:readonly
LightingMode:readonly
forcedColor:readonly
*/
export function ControllableParameters() {
	return [
		{ property: "shutdownColor", group: "lighting", label: "Shutdown Color", description: "This color is applied to the device when the System, or SignalRGB is shutting down", min: "0", max: "360", type: "color", default: "#000000" },
		{ property: "LightingMode", group: "lighting", label: "Lighting Mode", description: "Determines where the device's RGB comes from. Canvas will pull from the active Effect, while Forced will override it to a specific color", type: "combobox", values: ["Canvas", "Forced"], default: "Canvas" },
		{ property: "forcedColor", group: "lighting", label: "Forced Color", description: "The color used when 'Forced' Lighting Mode is enabled", min: "0", max: "360", type: "color", default: "#009bde" },
	];
}

export function Initialize() {
	Logi.Initialize();
}

export function Render() {
	Logi.Render();
}

export function Shutdown(SystemSuspending) {
	Logi.Shutdown(SystemSuspending ? "#000000" : shutdownColor);
}

export function LedNames() {
	return LEDS.map(l => l.name);
}

export function LedPositions() {
	return LEDS.map(l => [l.x, l.y]);
}

/* global LEDS:readonly */

// Ported from OpenRGB's LogitechG203LController (GPL-2.0-or-later):
// https://gitlab.com/CalcProgrammer1/OpenRGB/-/tree/master/Controllers/LogitechController/LogitechG203LController
// This is deliberately a small, hand-rolled, single-device protocol rather
// than going through SignalRGB's own generic "Logitech Device" plugin
// (Logitech_Modern_Device.js) — that file's shared HID++ feature-discovery
// code path was the source of an intermittent RGB corruption bug on this
// exact 3-zone mouse. OpenRGB's driver sidesteps all of that: no dynamic
// feature discovery, no delta/changed-zone-only optimization, no read
// response validation — it hardcodes the two feature indices this specific
// board uses (0x0E for mode-setting, 0x12 for direct RGB) and always sends
// a full, explicitly zero-filled 20-byte report every time.
//
// Packet shape (all reports are fixed 20 bytes, byte 0 = 0x11 "long" HID++
// report id, byte 1 = 0xFF "wired" device index):
//   Enable software/direct control (sent once, in Initialize()):
//     [0x11, 0xFF, 0x0E, 0x50, 0x01, 0x03, 0x07, 0x00, ...]
//   Set the 3 zone colors (feature 0x12, function 0x10):
//     [0x11, 0xFF, 0x12, 0x10, 0x01,R,G,B, 0x02,R,G,B, 0x03,R,G,B, 0xFF, 0x00, ...]
//   Apply (feature 0x12, function 0x70):
//     [0x11, 0xFF, 0x12, 0x70, 0x00, ...]
const PACKET_SIZE = 20;

class LogitechG203Lightsync {
	constructor() {
		this.initialized = false;
	}

	/** @param {number[]} buf */
	sendPacket(buf) {
		device.write(buf, PACKET_SIZE);
		// Drain the device's ack so it doesn't linger and get picked up by
		// the next call — matches OpenRGB's own hid_read_timeout() drain
		// after every write.
		device.read([0x00], PACKET_SIZE, 10);
	}

	Initialize() {
		const buf = new Array(PACKET_SIZE).fill(0x00);

		buf[0] = 0x11;
		buf[1] = 0xff;
		buf[2] = 0x0e;
		buf[3] = 0x50;
		buf[4] = 0x01;
		buf[5] = 0x03;
		buf[6] = 0x07; // DIRECT mode

		this.sendPacket(buf);
		this.initialized = true;
	}

	sendApply() {
		const buf = new Array(PACKET_SIZE).fill(0x00);

		buf[0] = 0x11;
		buf[1] = 0xff;
		buf[2] = 0x12;
		buf[3] = 0x70;

		this.sendPacket(buf);
	}

	/** @param {number[]} c0 @param {number[]} c1 @param {number[]} c2 */
	setColors(c0, c1, c2) {
		const buf = new Array(PACKET_SIZE).fill(0x00);

		buf[0] = 0x11;
		buf[1] = 0xff;
		buf[2] = 0x12;
		buf[3] = 0x10;

		buf[4] = 0x01;
		buf[5] = c0[0];
		buf[6] = c0[1];
		buf[7] = c0[2];

		buf[8] = 0x02;
		buf[9] = c1[0];
		buf[10] = c1[1];
		buf[11] = c1[2];

		buf[12] = 0x03;
		buf[13] = c2[0];
		buf[14] = c2[1];
		buf[15] = c2[2];

		buf[16] = 0xff;

		this.sendPacket(buf);
		this.sendApply();
	}

	/** @param {string} [overrideColor] */
	Render(overrideColor) {
		if (!this.initialized) {return;}

		const colors = LEDS.map(led => {
			if (overrideColor) {return hexToRgb(overrideColor);}
			if (LightingMode === "Forced") {return hexToRgb(forcedColor);}

			return clampColor(device.color(led.x, led.y));
		});

		// OpenRGB's own RGBController_LogitechG203L::DeviceUpdateLEDs()
		// sends the color+apply pair TWICE per update, commented there as
		// a "dirty workaround for color lag" — kept here for parity with
		// the known-working reference rather than dropped as redundant.
		this.setColors(colors[0], colors[1], colors[2]);
		this.setColors(colors[0], colors[1], colors[2]);
	}

	/** @param {string} color */
	Shutdown(color) {
		this.Render(color);
	}
}

const Logi = new LogitechG203Lightsync();

/** @param {number[]} color */
function clampColor(color) {
	return [
		Math.min(255, Math.max(0, Math.round(color[0]))),
		Math.min(255, Math.max(0, Math.round(color[1]))),
		Math.min(255, Math.max(0, Math.round(color[2]))),
	];
}

/** @param {string} hex */
function hexToRgb(hex) {
	const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);

	return [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)];
}

// 3 zones, matching OpenRGB's own SetupZones() (Mouse Left/Center/Right,
// values 1/2/3 hardcoded directly into setColors() above) and the layout
// SignalRGB's own stock "ThreeZoneMouse" LED library uses for this class
// of device.
const LEDS = [
	{ name: "Left Zone", x: 0, y: 1 },
	{ name: "Logo Zone", x: 1, y: 2 },
	{ name: "Right Zone", x: 2, y: 1 },
];
