# SignalRGB plugin for Logitech G102 / G203 Lightsync

A small, standalone native SignalRGB device plugin for the **Logitech G102 /
G203 Lightsync** mouse, ported directly from **OpenRGB's own driver** for
this exact board — not from SignalRGB's stock, generic "Logitech Device"
plugin.

Confirmed working: the device is correctly detected as "Logitech G102/G203
Lightsync" / type Mouse, taking over from the stock plugin.

## Why a separate plugin instead of fixing the stock one

SignalRGB already ships its own Logitech support
(`Signal-x64\Plugins\Logitech\Logitech_Modern_Device.js`, published by
WhirlwindFX) — a large, generic driver covering dozens of Logitech
keyboards/mice through dynamic HID++ feature discovery. On this specific
3-zone mouse it caused intermittent RGB flicker/color corruption.

Since OpenRGB already controls this exact mouse cleanly, the fix here is
to stop relying on WhirlwindFX's generic multi-device code entirely and
port OpenRGB's own small, single-purpose driver for it instead — same idea
as the [Skyloong GK104 Pro plugin](https://github.com/Makoli-Den/signalrgb-skyloong-gk104pro):
reverse-engineer the exact protocol OpenRGB already gets right, reimplement
it standalone for SignalRGB's plugin API.

## Protocol credit

Ported from [OpenRGB](https://gitlab.com/CalcProgrammer1/OpenRGB)'s
`Controllers/LogitechController/LogitechG203LController/` (GPL-2.0-or-later).
OpenRGB registers the G102 under the name "Logitech G203 Lightsync" — it's
the same board with the same USB VID/PID (`046D:C092`, alt PID `C09D`),
just a different cosmetic name/color.

The protocol itself is deliberately simple compared to the generic HID++
feature-discovery approach: two feature indices are hardcoded (`0x0E` for
mode-setting, `0x12` for direct RGB) rather than looked up dynamically, and
every color update always sends a full, explicitly zero-filled 20-byte
report for all 3 zones — no "only send changed zones" optimization, which
is exactly the class of thing that caused the corruption in the generic
plugin. OpenRGB's own `DeviceUpdateLEDs()` also sends each color+apply pair
**twice** per update, commented in their source as a "dirty workaround for
color lag" — kept here for parity with the known-working reference.

## Installation

This device (VID `046D`, PID `C092`/`C09D`) is also claimed by
SignalRGB's own built-in "Logitech Device" plugin. Two ways were tried to
resolve the conflict before finding the real one:

- Editing the stock plugin's `ProductIDs` array to drop this device's
  PIDs — **doesn't stick**: SignalRGB keeps a second, separately-updated
  copy of every stock plugin under
  `%LOCALAPPDATA%\WhirlwindFX\SignalRgb\cache\plugin_cdn\beta\Plugins\...`,
  which is re-downloaded from WhirlwindFX's server (whole folder replaced,
  not just the file) on every app start, silently reverting any edit.
- Installing this repo as an add-on via SignalRGB's Add-on manager — the
  add-on gets cached under `cache\addons\<hash>\...`, which loads with
  *lower* priority than that CDN copy, so the stock plugin kept winning
  the VID/PID match regardless.

**The actual documented mechanism** (per
[SignalRGB's own plugin-loading docs](https://docs.signalrgb.com/developer/plugins/how-is-a-plugin-loaded-/)):
plugins placed under the user's own **Documents** folder are the
highest-priority scan location, persist across SignalRGB updates, and
override anything elsewhere (bundled app folder or CDN cache) with a
matching VID/PID. That's the actual fix — no need to touch the stock
plugin file or fight its auto-updating cache at all:

1. Copy [`Logitech_G102_Lightsync.js`](Logitech_G102_Lightsync.js) from
   this repo into:
   ```
   %USERPROFILE%\Documents\WhirlwindFX\Plugins\
   ```
   (create the `WhirlwindFX\Plugins` folders if they don't exist yet; if
   your Documents folder is redirected to OneDrive, use
   `%USERPROFILE%\OneDrive\Documents\WhirlwindFX\Plugins\` instead).
2. Restart SignalRGB.
3. The device should now show up as "Logitech G102/G203 Lightsync" /
   type Mouse in the device list, replacing the old "Logitech Device" /
   Dongle entry for this specific PID. Enable it if it comes up disabled
   (carries over from the previous device's enabled state).

No Add-on manager install needed at all with this method — it's a plain
file drop, and it survives both SignalRGB app updates and the CDN plugin
cache's own auto-refresh, since neither of those touch the Documents
folder.

## Known limitations

- Only Direct/Canvas lighting is implemented (plus Forced Color and
  Shutdown Color) — the mouse's built-in effects (Cycle/Wave/Breathing/
  Colormixing) that OpenRGB also exposes aren't wired up here, since
  SignalRGB's own effect library already covers that role for a
  Canvas-driven device.
- No macro/button-input handling — this plugin only drives lighting.
- Zone-to-physical-LED mapping (Left/Logo/Right) hasn't been visually
  confirmed against the real hardware yet — if a zone's color looks
  swapped, it's a one-line fix in `LEDS` / `setColors()`'s zone-index
  bytes (`0x01`/`0x02`/`0x03`).

## Files

- `Logitech_G102_Lightsync.js` — the plugin.
