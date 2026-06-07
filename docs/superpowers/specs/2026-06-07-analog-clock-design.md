# Analog Clock Style — Design

**Date:** 2026-06-07
**Status:** Approved

## Goal

Add an analog clock face as a new option for the idle clock display on the
64×64 RGB LED matrix.

## Integration

Add `analog` as a new value for the existing `clockStyle` setting, alongside
`classic`, `sevenSegment`, `rounded`, and `tallCondensed`. This reuses all
existing plumbing:

- The `idleMode: 'clock'` path that starts/stops the clock.
- The `clockColor` color picker.
- Settings persistence (`settings.json`) and migration logic in `index.js`.
- The web UI clock-style dropdown.

No new config keys and no new idle mode are introduced. `renderClock()` gets a
branch near the top: when the active style is `analog`, it calls a new
`renderAnalogFace()` and returns, instead of running the digit-font layout.

## Visual design (64×64)

Center at (32, 32).

- **12 hour dots** on a ring at radius ~30 (1px each), leaving a ~1px safe
  border inside the panel edge. The four quarter dots (12 / 3 / 6 / 9) are
  drawn at full `clockColor`; the other eight at a dimmed `clockColor` (~0.4)
  for visual hierarchy so orientation reads at a glance.
- **Center hub:** a small 2×2 dot in `clockColor`.
- **Minute hand:** 1px Bresenham line, length ~22px. Angle = `minutes * 6°`.
- **Hour hand:** 2px-thick line (two adjacent 1px lines), length ~14px.
  Angle = `(hours % 12 + minutes / 60) * 30°`, so it advances smoothly between
  hours.
- 0° points up (12 o'clock). Endpoints:
  `x = cx + len * sin θ`, `y = cy − len * cos θ`.

There is **no second hand** (per design decision). All hands use `clockColor`.

## Render loop

Keep the existing 1-second `setInterval(renderClock, 1000)`. With no second
hand the face only visibly changes once a minute, but redrawing each second is
cheap and keeps the CO2 overlay responsive. The analog branch ends with the
same `overlayCallback?.()` followed by `sync()`, so the tiered CO2 border still
draws on top of the clock face.

## Code layout

All new rendering code lives in `lib/clock.js`:

- `drawLine(x0, y0, x1, y1, color)` — Bresenham line helper, pixel-clamped to
  the matrix bounds (mirrors the bounds checks in `drawChar`).
- `renderAnalogFace()` — draws dots, hub, and hands; ends with
  `overlayCallback?.()` and `sync()`.
- A branch at the top of `renderClock()` selecting analog vs. digit rendering.

One line is added to the web UI (`web/index.html`):
`<option value="analog">Analog</option>` in the `#clockStyle` select.

`config.example.js` clock-style comment is updated to list `analog`.

## Testing / verification

The repo has no automated test suite, and `lib/clock.js` transitively imports
`rpi-led-matrix` (via `matrix.js`), which does not load off-device. Verification
is manual on the Raspberry Pi:

1. Set `clockStyle: 'analog'` (config or web UI) with `idleMode: 'clock'`.
2. With nothing playing, confirm the analog face renders: 12 dots, hub, and
   hour/minute hands at the correct positions for the current time.
3. Confirm switching styles in the web UI updates live.
4. Confirm the CO2 border still appears over the analog face when triggered.

## Out of scope

- Sweeping/ticking second hand.
- Configurable hand lengths/colors beyond the existing `clockColor`.
- Drawn circular rim (only the 12 dots form the dial).
