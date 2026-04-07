# Screensaver: Simplex Noise Plasma

## Overview

An organic, flowing screensaver for the 64x64 LED matrix that activates when idle. Uses layered 2D simplex noise to create aurora-like color fields that shift and drift smoothly. The user chooses between Clock, Screensaver, or Off as their idle mode via the web UI.

## Architecture

### New file: `lib/screensaver.js`

Mirrors `lib/clock.js` pattern:

- `startScreensaver(palette, fps)` - begins the animation loop
- `stopScreensaver()` - clears interval and matrix
- `isScreensaverVisible()` - returns boolean
- `setScreensaverPalette(name)` - switches palette without restart
- `setScreensaverFps(fps)` - adjusts framerate
- `setOnStateChange(callback)` - notifies index.js of visibility changes
- `setOverlayCallback(callback)` - for CO2 indicator overlay

Includes a self-contained simplex noise implementation (~80 lines) rather than an external dependency.

### Changes to `index.js`

The idle screen logic currently starts/stops the clock. This expands to a three-way switch based on `settings.idleMode`:

- `'clock'` - existing behavior, starts clock
- `'screensaver'` - starts screensaver with configured palette and FPS
- `'off'` - matrix stays blank when idle

When music starts playing, whichever idle mode is active gets stopped (same as clock today). When music stops, the configured idle mode starts.

### Changes to `server.js`

No structural changes. The existing `updateState` / WebSocket broadcast handles the new state fields automatically.

### Changes to `web/index.html`

The "Clock (Idle Screen)" card is replaced with an "Idle Screen" card:

- **Mode select**: Clock / Screensaver / Off
- **Clock color picker**: visible only when mode is Clock
- **Palette dropdown**: visible only when mode is Screensaver (options: Aurora, Ember, Ocean, Sunset, Forest)
- **FPS slider**: visible only when mode is Screensaver (range 5-30, default 10)

Conditional visibility is handled with simple `style.display` toggling based on the mode select value.

## Animation Engine

### Noise layers

Three simplex noise layers sampled at each pixel position per frame:

| Layer | Scale | Speed | Role |
|-------|-------|-------|------|
| Broad | 0.05 | slow | Primary hue selection |
| Medium | 0.1 | moderate | Brightness modulation |
| Fine | 0.15 | fast | Shimmer/texture |

Each layer samples `noise2D(x * scale + timeOffset, y * scale + timeOffset)` where `timeOffset` increments each frame at the layer's speed. The broad layer's time offset moves roughly 3x slower than the fine layer.

### Color mapping

The broad layer's noise output (remapped from -1..1 to 0..1) indexes into the active palette gradient. The palette is an array of RGB color stops that are linearly interpolated to produce smooth gradients.

The medium layer modulates brightness (multiply RGB by 0.5-1.0 range). The fine layer adds subtle variation on top (multiply RGB by 0.85-1.0 range).

### Rendering

Each frame:
1. Advance time offsets for all three layers
2. For each of the 4096 pixels: sample three noise values, map to palette color, apply brightness modulation
3. Write to shared `rgbBuffer` from `matrix.js`
4. Call `drawBuffer()` + `sync()`
5. Call overlay callback (CO2 indicator)

At 10 FPS, each frame has a 100ms budget. Simplex noise is ~10 multiplies + additions per sample, so 3 layers x 4096 pixels = ~12K noise evaluations per frame - well within Pi budget.

## Palettes

Each palette is an array of 4-5 RGB stops. The noise value (0-1) maps across these stops with linear interpolation, wrapping at the ends for seamless flow.

| Name | Stops |
|------|-------|
| Aurora | deep blue (20,0,80) -> teal (0,180,180) -> green (0,200,80) -> purple (120,0,200) |
| Ember | black (0,0,0) -> dark red (150,20,0) -> orange (255,120,0) -> gold (255,200,50) |
| Ocean | dark navy (0,10,40) -> blue (0,60,180) -> cyan (0,200,220) -> white (200,220,255) |
| Sunset | indigo (60,0,120) -> magenta (200,0,100) -> orange (255,120,0) -> warm yellow (255,200,80) |
| Forest | black (0,10,0) -> dark green (0,80,20) -> emerald (0,180,80) -> lime (120,220,60) |

## Settings

New fields added to the settings object:

```js
{
  idleMode: 'clock',            // 'clock' | 'screensaver' | 'off'
  screensaverPalette: 'aurora', // palette name
  screensaverFps: 10,           // 5-30
}
```

These are persisted to the settings file alongside existing settings. Defaults are applied via `getDefaultSettings()` merge pattern already in use.

### Migration

The existing `showClock` boolean is replaced by `idleMode`. In `getDefaultSettings()`, if `showClock` exists in saved settings but `idleMode` does not, map `showClock: true` to `idleMode: 'clock'` and `showClock: false` to `idleMode: 'off'`. The `showClock` key is then dropped from the saved settings on next save.

## State sync

The following fields are added to the state object broadcast via WebSocket:

- `idleMode` - current mode setting
- `screensaverPalette` - current palette name
- `screensaverFps` - current FPS
- `screensaverVisible` - whether screensaver is currently active

## Callbacks

New callback added to the server callbacks:

- `onIdleModeChange(mode, options)` - called when user changes idle mode, palette, or FPS. `options` contains `{ clockColor, screensaverPalette, screensaverFps }`.

This replaces the current `onClockChange` callback which only handled clock show/color.
