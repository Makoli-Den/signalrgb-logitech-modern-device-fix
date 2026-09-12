# SignalRGB Logitech plugin — per-key-lighting corruption fix

A patched copy of SignalRGB's own stock **"Logitech Device"** plugin
(`Publisher: WhirlwindFX`, ships bundled with the SignalRGB app itself at
`Signal-x64\Plugins\Logitech\Logitech_Modern_Device.js`), with a targeted
fix for intermittent RGB flicker/color corruption on small per-key-lighting
devices (e.g. the **Logitech G102**, a 3-zone mouse using the PerKeyLighting
V2 protocol).

This is **not** a new/separate device add-on — it's the same file WhirlwindFX
ships, with two small changes layered on top. See "Why this isn't an
Add-on-manager install" below for why it has to be applied by hand.

## Symptom

RGB updates on the mouse "jump"/flicker rather than transitioning smoothly,
and the flicker is color-dependent: purple briefly flickers red, bright cyan
flickers green, blue sometimes goes dark entirely. Intermittent — not every
frame/cycle.

## Root cause (best current theory)

`LogitechProtocol.setLongFeature()` builds the outgoing HID++ "Long" report
like this (stock code):

```js
const packet = [this.MessageTypes.LongMessage, this.Config.ConnectionMode, ...data];
device.write(packet, 20);
```

A HID++ 2.0 Long report is **always exactly 20 bytes on the wire** — but
`packet` here is only as long as `data` makes it. For most stock devices
this rarely matters: a keyboard's per-key lighting sends LED data in full
16-byte chunks almost every frame, so `packet` reaches 20 bytes anyway.

The G102 (and other small 3-zone PerKeyLightingV2 mice) is different: it
only ever has 3 LED zones, and `grabColors()` only includes a zone in the
outgoing data **if its color actually changed since the last frame**. That
means the real payload is often just 4-12 bytes — `packet` never comes close
to 20 bytes, on *every single frame*, not just an occasional tail chunk.

`device.write(packet, 20)` is told the buffer is 20 bytes despite `packet`
itself being shorter, and relies on the SDK's native implementation to
zero-fill the difference. If that native write buffer is reused between
calls without being explicitly cleared, a short write can leave stale bytes
from a *previous* write sitting at the tail of the buffer. The device's own
protocol has no explicit length field for this command — it reads the fixed
20-byte payload window as a fixed number of (zoneId, R, G, B) quad slots
regardless of how much "real" data was sent. Leftover garbage at the tail
gets read as a bogus extra zone update, and — if the stale zoneId byte
happens to alias a real zone (0/1/2 are small, easy to hit by chance) —
overwrites that zone's real color with garbage. This lines up with the
symptom being intermittent and worse right when the changed-zone count
drops between frames (e.g. 3 zones changing → 1 zone changing).

Two previous fix attempts (padding the LED-data sub-chunk to 16 bytes inside
`SendPerKeyLightingPacket`, and clamping/rounding color values) targeted
different layers and didn't help — this targets the actual wire-packet
length mismatch instead.

## The fix

`setShortFeature()` and `setLongFeature()` now build a full, explicitly
zero-filled array of the declared wire length (7 / 20 bytes) themselves,
and copy `data` into it, instead of concatenating a short array and handing
it to `device.write()` to pad:

```js
const packet = new Array(20).fill(0x00);
packet[0] = this.MessageTypes.LongMessage;
packet[1] = this.Config.ConnectionMode;
for (let i = 0; i < data.length; i++) { packet[2 + i] = data[i]; }
device.write(packet, 20);
```

This can't make anything worse even if the native binding already zero-pads
correctly — it's a no-op in that case. If it doesn't, this removes the
possibility entirely.

Also kept: a `clampColor()` guard on `device.color()` output (rounds/clamps
to 0-255 integers before packing into a packet) — harmless and technically
correct regardless of whether it was the real cause.

## Installation

**This is not installed through SignalRGB's Add-on manager.** The Add-on
manager adds a *new* plugin — but this device is already claimed by
SignalRGB's own built-in "Logitech Device" plugin (same VendorId `0x046d`
that basically every Logitech peripheral uses), so a second plugin
registered for the same vendor would conflict rather than cleanly override
it. Instead, replace the stock file directly:

1. Close SignalRGB.
2. Find your SignalRGB install's plugin folder — typically:
   `%LOCALAPPDATA%\VortxEngine\app-<version>\Signal-x64\Plugins\Logitech\Logitech_Modern_Device.js`
3. Back up that file somewhere first, just in case.
4. Replace it with [`Logitech_Modern_Device.js`](Logitech_Modern_Device.js) from this repo.
5. Start SignalRGB.

**Caveat:** this file ships as part of the SignalRGB application itself, so
a future SignalRGB update will overwrite it back to stock and you'll need
to reapply this patch after updating. That's an inherent tradeoff of
patching a bundled stock file rather than installing a separate add-on —
there's no clean substitution mechanism for "replace the built-in Logitech
plugin" the way there is for adding an entirely new device.

## Credit

Base file is WhirlwindFX's own official SignalRGB plugin (ships unobfuscated
with the app). This repo only adds the two changes described above.
