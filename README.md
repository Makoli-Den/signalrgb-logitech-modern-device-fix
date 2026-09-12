# SignalRGB plugin for Logitech G102 / G203 Lightsync

A small, standalone native SignalRGB device plugin for the **Logitech G102 /
G203 Lightsync** mouse, ported directly from **OpenRGB's own driver** for
this exact board — not from SignalRGB's stock, generic "Logitech Device"
plugin.

## Why a separate plugin instead of fixing the stock one

SignalRGB already ships its own Logitech support
(`Signal-x64\Plugins\Logitech\Logitech_Modern_Device.js`, published by
WhirlwindFX) — a large, generic driver covering dozens of Logitech
keyboards/mice through dynamic HID++ feature discovery. On this specific
3-zone mouse it caused intermittent RGB flicker/color corruption. A first
attempt patched that stock file directly (explicit zero-padding on its HID
writes) — a plausible fix, but it means hand-patching a file that ships
with the app itself, which gets overwritten on every SignalRGB update.

Since OpenRGB already controls this exact mouse cleanly, the better fix is
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

This device is still also claimed by SignalRGB's own built-in "Logitech
Device" plugin (same VendorId, and `0xC092`/`0xC09D` are in its
`ProductIDs` list) — installing this add-on alongside it as-is would leave
two plugins both matching the same mouse. To avoid that, remove those two
PIDs from the stock plugin's own device list so only this plugin claims the
mouse, while every other Logitech device on the list is completely
unaffected:

1. Open `Signal-x64\Plugins\Logitech\Logitech_Modern_Device.js` in a text
   editor (path is under your SignalRGB install, typically
   `%LOCALAPPDATA%\VortxEngine\app-<version>\Signal-x64\Plugins\Logitech\`).
2. Find the `ProductIDs` array (inside `LogitechDeviceLibrary`'s
   constructor) and delete `0xc092,` and `0xc09d,` from it — leave every
   other entry untouched:
   ```js
   // before
   this.ProductIDs = [
       0xc081, 0xc082, 0xc083, 0xc084, 0xc085, 0xc087, 0xc088, 0xc08b,
       0xc08c, 0xc08d, 0xc08f, 0xc090, 0xc091, 0xc092, 0xc094, 0xc095,
       0xc09d, 0xc332, ...
   ];
   // after
   this.ProductIDs = [
       0xc081, 0xc082, 0xc083, 0xc084, 0xc085, 0xc087, 0xc088, 0xc08b,
       0xc08c, 0xc08d, 0xc08f, 0xc090, 0xc091, 0xc094, 0xc095,
       0xc332, ...
   ];
   ```
   This is a much smaller, easier-to-reapply edit than replacing the whole
   file — if a SignalRGB update ever restores the stock array, it's a
   30-second fix to remove the two numbers again, no full file diff to
   redo.
3. In SignalRGB, open the add-on manager and add this repository's URL:
   `https://github.com/Makoli-Den/signalrgb-logitech-modern-device-fix`.
   Enable the add-on and select the `main` branch (the repo must stay
   **public** for the branch list to populate).
4. Restart SignalRGB. It should detect "Logitech G102/G203 Lightsync" as
   its own device, separate from the stock Logitech entry.

## Known limitations

- Only Direct/Canvas lighting is implemented (plus Forced Color and
  Shutdown Color) — the mouse's built-in effects (Cycle/Wave/Breathing/
  Colormixing) that OpenRGB also exposes aren't wired up here, since
  SignalRGB's own effect library already covers that role for a
  Canvas-driven device.
- No macro/button-input handling — this plugin only drives lighting.
- Not tested against a real device yet; please report back whether the
  flicker/corruption is actually gone and whether the 3 zones map to the
  right physical LEDs (left/logo/right) — if a zone's color looks swapped,
  it's a one-line fix in `LEDS` / `setColors()`'s zone-index bytes
  (`0x01`/`0x02`/`0x03`).

## Files

- `Logitech_G102_Lightsync.js` — the plugin.
