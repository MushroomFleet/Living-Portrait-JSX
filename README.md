# Living Portrait JSX

A haunted portrait component that lets you upload face images, mark eye sockets, and trigger glowing red light effects from within them. Built as a self-contained React component with a matching vanilla HTML demo. Scenes are stored in IndexedDB with a 6-slot profile system for quick switching.

![Living Portrait](https://img.shields.io/badge/status-active-brightgreen) ![License](https://img.shields.io/badge/license-MIT-blue) ![React](https://img.shields.io/badge/React-18%2B-61DAFB)

---

## What It Does

Upload any portrait photograph, click to place glowing eye markers on the eye sockets, lock the scene, and hold **Space** to illuminate the eyes with a layered red glow effect. The glow is rendered on a canvas overlay with radial gradients composited using `screen` blend mode, giving a convincing "haunted painting" look.

The `glowIntensity` value is a simple `0–1` float, designed to be driven by audio volume in future iterations — making the eyes pulse with speech or sound.

### Key Features

- **Image upload** with IndexedDB persistence — images survive page reloads
- **Click-to-place** eye socket markers with drag repositioning and delete
- **Lock/unlock** toggle to prevent accidental edits once positioned
- **Spacebar glow** — hold to illuminate all eye sockets simultaneously
- **6 scene slots** — save and load complete scenes (image + eye positions) with hotkeys
- **Profile export/import** as `.json` for backup and sharing
- **Zero dependencies** — React hooks only, no external libraries

---

## Quick Preview

Open **`demo.html`** directly in any browser. No build step, no server, no dependencies.

The demo is a complete vanilla JavaScript implementation that mirrors the React component exactly and shares the same IndexedDB schema.

---

## Project Files

```
├── README.md                              # This file
├── demo.html                              # Standalone HTML demo (open in browser)
├── living-portrait.jsx                    # React component
└── Living-Portrait-JSX-integration.md     # Developer integration guide
```

---

## Getting Started

### Option A: Standalone Demo

1. Clone the repository
2. Open `demo.html` in your browser
3. Upload a portrait, place eye markers, lock the scene, hold Space

### Option B: React Integration

1. Copy `living-portrait.jsx` into your React project
2. Import and render:

```jsx
import LivingPortrait from "./components/living-portrait";

function App() {
  return <LivingPortrait />;
}
```

3. See **[Living-Portrait-JSX-integration.md](Living-Portrait-JSX-integration.md)** for full setup, customisation, and audio-reactive glow preparation

---

## Controls

| Input | Action |
|---|---|
| **Click** on image | Place an eye socket marker |
| **Drag** a marker | Reposition it |
| **Delete / Backspace** | Remove hovered marker |
| **Lock button** | Toggle edit protection |
| **Hold Space** | Illuminate all eye sockets |
| **1–6** | Load scene from slot |
| **Shift + 1–6** | Save scene to slot |

---

## Scene Profile Format

Profiles are stored and exported as JSON:

```json
{
  "1": {
    "slot": 1,
    "imageKey": "img_slot_1",
    "eyeSockets": [
      { "x": 0.35, "y": 0.42 },
      { "x": 0.65, "y": 0.42 }
    ],
    "locked": true,
    "savedAt": "2025-02-05T12:00:00.000Z"
  }
}
```

Eye coordinates are normalised `0–1` relative to image dimensions, making them resolution-independent.

---

## Future Plans

- **Audio-reactive glow** — drive `glowIntensity` from microphone input or TTS audio via Web Audio API
- **Volume clamping controls** — min/max threshold sliders for tuning glow sensitivity
- **Extended slot system** — slots 7+ for glow presets, animation sequences, and audio source binding
- **Full profile export** — option to bundle base64 image data with profile JSON for complete portability

---

## 📚 Citation

### Academic Citation

If you use this codebase in your research or project, please cite:

```bibtex
@software{living_portrait_jsx,
  title = {Living Portrait JSX: Haunted portrait component with glowing eye socket effects and scene profiles},
  author = {[Drift Johnson]},
  year = {2025},
  url = {https://github.com/MushroomFleet/Living-Portrait-JSX},
  version = {1.0.0}
}
```

### Donate:

[![Ko-Fi](https://cdn.ko-fi.com/cdn/kofi3.png?v=3)](https://ko-fi.com/driftjohnson)
