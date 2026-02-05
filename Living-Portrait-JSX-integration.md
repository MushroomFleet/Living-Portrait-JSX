# Living Portrait JSX — Integration Guide

This guide walks you through integrating the `living-portrait.jsx` component into an existing React project, configuring it for your use case, and preparing it for future audio-reactive glow.

---

## Prerequisites

- **React 18+** with hooks support (`useState`, `useEffect`, `useRef`, `useCallback`)
- A browser environment with **IndexedDB** support (all modern browsers)
- No external dependencies — the component is fully self-contained

---

## 1. Installation

Copy `living-portrait.jsx` into your project's component directory:

```
src/
  components/
    living-portrait.jsx
```

Import it where needed:

```jsx
import LivingPortrait from "./components/living-portrait";
```

Render it as a top-level or nested component:

```jsx
function App() {
  return (
    <div>
      <LivingPortrait />
    </div>
  );
}
```

The component manages its own state and IndexedDB connections internally. No props are required for basic usage.

---

## 2. Project Structure

The component uses two IndexedDB object stores:

| Store | Key Pattern | Contents |
|---|---|---|
| `images` | `img_slot_1` … `img_slot_6` | Base64 data URLs of uploaded portraits |
| `profiles` | `allProfiles` | JSON object mapping slot numbers to scene profiles |

A scene profile has this shape:

```json
{
  "slot": 1,
  "imageKey": "img_slot_1",
  "eyeSockets": [
    { "x": 0.35, "y": 0.42 },
    { "x": 0.65, "y": 0.42 }
  ],
  "locked": true,
  "savedAt": "2025-02-05T12:00:00.000Z"
}
```

Coordinates `x` and `y` are normalised to the range `0–1` relative to the image dimensions, making them resolution-independent.

---

## 3. Keyboard Controls

| Key | Action |
|---|---|
| **Space** (hold) | Illuminate all eye sockets at full intensity |
| **1–6** | Load scene from slot |
| **Shift + 1–6** | Save current scene to slot |
| **Delete / Backspace** | Remove the eye socket currently under the cursor |

These bindings attach to `window` on mount and clean up on unmount.

---

## 4. Customising the Glow Effect

The glow is rendered on a `<canvas>` overlay using the `GlowCanvas` internal component. It uses three layered radial gradients per eye socket:

1. **Outer halo** — wide, dim red spread (`radius × 3.5`)
2. **Inner glow** — medium orange-red (`radius × 1.5`)
3. **White-hot core** — tight, bright centre (`radius × 0.5`)

The canvas uses `mix-blend-mode: screen` to composite over the portrait image.

### Changing glow colour

Find the `GlowCanvas` function (or the `drawGlow` function in the HTML version) and modify the RGBA values in the gradient colour stops. For example, to create a blue glow:

```js
// Replace red channel values with blue
outerGrad.addColorStop(0, `rgba(0, 60, 255, ${0.25 * intensity})`);
innerGrad.addColorStop(0, `rgba(30, 80, 255, ${0.9 * intensity})`);
coreGrad.addColorStop(0, `rgba(180, 220, 255, ${0.95 * intensity})`);
```

### Changing glow size

Adjust the `radius` calculation:

```js
// Default
const radius = Math.max(20, width * 0.045);

// Larger glow
const radius = Math.max(30, width * 0.07);

// Smaller, tighter glow
const radius = Math.max(12, width * 0.025);
```

---

## 5. Preparing for Audio-Reactive Glow

The component is designed so that `glowIntensity` is a single `0–1` float. Currently it toggles between `0` and `1` via the spacebar. To connect it to audio input:

### Step 1: Set up Web Audio API

```js
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const analyser = audioCtx.createAnalyser();
analyser.fftSize = 256;

navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
  const source = audioCtx.createMediaStreamSource(stream);
  source.connect(analyser);
});
```

### Step 2: Read volume in an animation loop

```js
const dataArray = new Uint8Array(analyser.frequencyBinCount);

function updateGlow() {
  analyser.getByteFrequencyData(dataArray);
  const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;

  // Normalise to 0–1 and apply clamp
  const minThreshold = 10;   // noise floor
  const maxThreshold = 180;  // loud speech
  const normalised = Math.max(0, Math.min(1,
    (avg - minThreshold) / (maxThreshold - minThreshold)
  ));

  setGlowIntensity(normalised);  // React state setter
  requestAnimationFrame(updateGlow);
}

updateGlow();
```

### Step 3: Expose `glowIntensity` as a prop (optional)

If you want external control, modify the component to accept an optional prop:

```jsx
export default function LivingPortrait({ externalGlow = null }) {
  const [internalGlow, setInternalGlow] = useState(0);
  const glowIntensity = externalGlow !== null ? externalGlow : internalGlow;
  // ...
}
```

This allows parent components to drive the glow from any source — TTS audio, music playback, or manual sliders.

---

## 6. Styling and Theming

The component uses inline styles with a dark, antique-gold colour palette. Key colour values:

| Variable | Value | Usage |
|---|---|---|
| Background | `#0a0a0a` | Page background |
| Gold | `#8b7355` | Headings, active elements |
| Gold dim | `#665544` | Borders, secondary text |
| Text | `#c4b5a0` | Primary text |
| Danger | `#cc6644` | Lock state accent |
| Frame | `#2a2218` | Portrait border |

The component imports **EB Garamond** from Google Fonts. To use a different font, modify the `fontFamily` in the root `<div>` style and update the `@import` in the `<style>` tag.

---

## 7. Profile JSON Import/Export

Profiles can be exported and imported as `.json` files. The exported file contains eye socket coordinates and metadata only — **images are stored separately in IndexedDB** and are not included in the export.

This means:
- Profiles are lightweight and portable
- Importing profiles on a new machine requires re-uploading the images and saving to the same slots
- Future versions could extend the export to include base64 image data for full portability

---

## 8. Using the demo.html Standalone

The `demo.html` file is a complete, dependency-free implementation that mirrors the JSX component using vanilla JavaScript. It can be:

- Opened directly in any browser (no build step)
- Hosted on any static file server
- Used as a reference implementation for porting to other frameworks

The vanilla version shares the same IndexedDB schema, so profiles created in either version are compatible.

---

## 9. Extending the Slot System

The current implementation supports 6 slots (keys 1–6). To expand:

1. Modify the `slotKeys` array (JSX) or the slot loop range (HTML)
2. Assign additional keyboard bindings or use a dropdown selector
3. The IndexedDB schema imposes no slot limit — keys are string-based (`img_slot_N`)

Slots 7–9 and 0 are intentionally reserved for future features such as audio source selection, glow presets, or animation sequences.

---

## 10. Browser Compatibility

| Feature | Required | Notes |
|---|---|---|
| IndexedDB | Yes | All modern browsers |
| Canvas 2D | Yes | All modern browsers |
| `mix-blend-mode: screen` | Yes | IE not supported |
| `getUserMedia` | For audio glow | Requires HTTPS in production |
| ES6+ | Yes | Arrow functions, destructuring, async/await |

The component does not use localStorage, WebGL, or any external CDN resources beyond the Google Fonts import.
