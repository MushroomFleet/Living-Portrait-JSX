import { useState, useEffect, useRef, useCallback } from "react";

const DB_NAME = "LivingPortraitDB";
const DB_VERSION = 2;
const IMG_STORE = "images";
const PROFILE_STORE = "profiles";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IMG_STORE)) db.createObjectStore(IMG_STORE);
      if (!db.objectStoreNames.contains(PROFILE_STORE)) db.createObjectStore(PROFILE_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbPut(store, key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbGet(store, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Glow overlay rendered on a canvas
function GlowCanvas({ eyeSockets, glowIntensity, width, height, containerRef }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !width || !height) return;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, width, height);

    if (glowIntensity <= 0) return;

    eyeSockets.forEach(({ x, y }) => {
      const px = x * width;
      const py = y * height;
      const radius = Math.max(20, width * 0.045);
      const intensity = glowIntensity;

      // Outer halo
      const outerGrad = ctx.createRadialGradient(px, py, 0, px, py, radius * 3.5);
      outerGrad.addColorStop(0, `rgba(255, 20, 0, ${0.25 * intensity})`);
      outerGrad.addColorStop(0.3, `rgba(200, 0, 0, ${0.12 * intensity})`);
      outerGrad.addColorStop(1, `rgba(100, 0, 0, 0)`);
      ctx.fillStyle = outerGrad;
      ctx.fillRect(px - radius * 4, py - radius * 4, radius * 8, radius * 8);

      // Inner glow
      const innerGrad = ctx.createRadialGradient(px, py, 0, px, py, radius * 1.5);
      innerGrad.addColorStop(0, `rgba(255, 80, 30, ${0.9 * intensity})`);
      innerGrad.addColorStop(0.4, `rgba(255, 20, 0, ${0.5 * intensity})`);
      innerGrad.addColorStop(1, `rgba(180, 0, 0, 0)`);
      ctx.fillStyle = innerGrad;
      ctx.beginPath();
      ctx.arc(px, py, radius * 1.5, 0, Math.PI * 2);
      ctx.fill();

      // White-hot core
      const coreGrad = ctx.createRadialGradient(px, py, 0, px, py, radius * 0.5);
      coreGrad.addColorStop(0, `rgba(255, 220, 180, ${0.95 * intensity})`);
      coreGrad.addColorStop(0.5, `rgba(255, 120, 40, ${0.6 * intensity})`);
      coreGrad.addColorStop(1, `rgba(255, 40, 0, 0)`);
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(px, py, radius * 0.5, 0, Math.PI * 2);
      ctx.fill();
    });
  }, [eyeSockets, glowIntensity, width, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        mixBlendMode: "screen",
        zIndex: 3,
      }}
    />
  );
}

export default function LivingPortrait() {
  const [imageData, setImageData] = useState(null);
  const [eyeSockets, setEyeSockets] = useState([]);
  const [locked, setLocked] = useState(false);
  const [glowIntensity, setGlowIntensity] = useState(0);
  const [imgDimensions, setImgDimensions] = useState({ width: 0, height: 0 });
  const [profiles, setProfiles] = useState({});
  const [activeSlot, setActiveSlot] = useState(null);
  const [statusMsg, setStatusMsg] = useState("");
  const [draggingIdx, setDraggingIdx] = useState(null);
  const [hoverSocket, setHoverSocket] = useState(null);

  const containerRef = useRef(null);
  const imgRef = useRef(null);
  const fileInputRef = useRef(null);
  const spaceHeld = useRef(false);

  // Show status message briefly
  const flash = useCallback((msg) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(""), 2200);
  }, []);

  // Load all profiles from IndexedDB on mount
  useEffect(() => {
    (async () => {
      try {
        const saved = await dbGet(PROFILE_STORE, "allProfiles");
        if (saved) setProfiles(saved);
      } catch (e) {
        console.warn("Could not load profiles", e);
      }
    })();
  }, []);

  // Keyboard handlers
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        spaceHeld.current = true;
        setGlowIntensity(1);
      }
      // Slot keys 1-6
      if (e.key >= "1" && e.key <= "6" && !e.repeat) {
        const slot = parseInt(e.key);
        if (e.shiftKey) {
          // Shift+number = save to slot
          saveSlot(slot);
        } else {
          // number = load slot
          loadSlot(slot);
        }
      }
      // Delete selected eye socket
      if ((e.code === "Backspace" || e.code === "Delete") && hoverSocket !== null && !locked) {
        setEyeSockets((prev) => prev.filter((_, i) => i !== hoverSocket));
        setHoverSocket(null);
      }
    };
    const handleKeyUp = (e) => {
      if (e.code === "Space") {
        spaceHeld.current = false;
        setGlowIntensity(0);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [hoverSocket, locked, imageData, eyeSockets, profiles]);

  // Save slot
  const saveSlot = async (slot) => {
    if (!imageData) {
      flash("No image loaded");
      return;
    }
    const profile = {
      slot,
      imageKey: `img_slot_${slot}`,
      eyeSockets: [...eyeSockets],
      locked,
      savedAt: new Date().toISOString(),
    };
    try {
      await dbPut(IMG_STORE, `img_slot_${slot}`, imageData);
      const updated = { ...profiles, [slot]: profile };
      await dbPut(PROFILE_STORE, "allProfiles", updated);
      setProfiles(updated);
      setActiveSlot(slot);
      flash(`Scene saved to slot ${slot}`);
    } catch (e) {
      flash("Save failed");
      console.error(e);
    }
  };

  // Load slot
  const loadSlot = async (slot) => {
    const profile = profiles[slot];
    if (!profile) {
      flash(`Slot ${slot} is empty`);
      return;
    }
    try {
      const img = await dbGet(IMG_STORE, profile.imageKey);
      if (img) {
        setImageData(img);
        setEyeSockets(profile.eyeSockets || []);
        setLocked(profile.locked || false);
        setActiveSlot(slot);
        flash(`Loaded slot ${slot}`);
      } else {
        flash(`Image missing for slot ${slot}`);
      }
    } catch (e) {
      flash("Load failed");
      console.error(e);
    }
  };

  // Handle image upload
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImageData(ev.target.result);
      setEyeSockets([]);
      setLocked(false);
      setActiveSlot(null);
    };
    reader.readAsDataURL(file);
  };

  // Image click to place eye socket
  const handleImageClick = (e) => {
    if (locked || !imageData) return;
    if (draggingIdx !== null) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setEyeSockets((prev) => [...prev, { x, y }]);
  };

  // Drag eye socket
  const handleSocketMouseDown = (e, idx) => {
    if (locked) return;
    e.stopPropagation();
    setDraggingIdx(idx);
    const handleMove = (me) => {
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (me.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (me.clientY - rect.top) / rect.height));
      setEyeSockets((prev) => prev.map((s, i) => (i === idx ? { x, y } : s)));
    };
    const handleUp = () => {
      setDraggingIdx(null);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  const onImgLoad = () => {
    if (imgRef.current) {
      setImgDimensions({
        width: imgRef.current.clientWidth,
        height: imgRef.current.clientHeight,
      });
    }
  };

  useEffect(() => {
    const handleResize = () => {
      if (imgRef.current) {
        setImgDimensions({
          width: imgRef.current.clientWidth,
          height: imgRef.current.clientHeight,
        });
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Export profiles as JSON
  const exportProfiles = () => {
    const data = JSON.stringify(profiles, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "living-portrait-profiles.json";
    a.click();
    URL.revokeObjectURL(url);
    flash("Profiles exported");
  };

  // Import profiles from JSON
  const importProfiles = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        await dbPut(PROFILE_STORE, "allProfiles", data);
        setProfiles(data);
        flash("Profiles imported");
      } catch (err) {
        flash("Invalid profile file");
      }
    };
    reader.readAsText(file);
  };

  const slotKeys = [1, 2, 3, 4, 5, 6];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0a",
        color: "#c4b5a0",
        fontFamily: "'EB Garamond', 'Palatino Linotype', 'Book Antiqua', Palatino, serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "24px 16px",
        userSelect: "none",
      }}
    >
      {/* Title */}
      <h1
        style={{
          fontSize: "2.4rem",
          fontWeight: 400,
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          color: "#8b7355",
          marginBottom: 4,
          textShadow: "0 0 30px rgba(139,115,85,0.3)",
        }}
      >
        Living Portrait
      </h1>
      <p style={{ color: "#665544", fontSize: "0.85rem", letterSpacing: "0.3em", marginBottom: 24, textTransform: "uppercase" }}>
        Haunted Gallery System
      </p>

      {/* Status flash */}
      {statusMsg && (
        <div
          style={{
            position: "fixed",
            top: 20,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(30,20,10,0.95)",
            border: "1px solid #8b7355",
            color: "#d4c5a0",
            padding: "10px 28px",
            borderRadius: 4,
            fontSize: "0.9rem",
            zIndex: 100,
            letterSpacing: "0.1em",
            boxShadow: "0 4px 20px rgba(0,0,0,0.6)",
            animation: "fadeIn 0.2s ease",
          }}
        >
          {statusMsg}
        </div>
      )}

      {/* Slot bar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap", justifyContent: "center" }}>
        {slotKeys.map((s) => (
          <button
            key={s}
            onClick={() => loadSlot(s)}
            style={{
              background: activeSlot === s ? "#8b7355" : profiles[s] ? "rgba(139,115,85,0.2)" : "rgba(255,255,255,0.04)",
              color: activeSlot === s ? "#0a0a0a" : profiles[s] ? "#c4b5a0" : "#555",
              border: `1px solid ${activeSlot === s ? "#8b7355" : profiles[s] ? "#665544" : "#333"}`,
              padding: "6px 16px",
              borderRadius: 3,
              cursor: "pointer",
              fontSize: "0.8rem",
              letterSpacing: "0.15em",
              fontFamily: "inherit",
              transition: "all 0.2s",
            }}
            title={profiles[s] ? `Load slot ${s} (key: ${s}) | Shift+${s} to save` : `Empty slot (Shift+${s} to save)`}
          >
            {s} {profiles[s] ? "●" : "○"}
          </button>
        ))}
      </div>

      {/* Controls row */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", justifyContent: "center", alignItems: "center" }}>
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{
            background: "rgba(139,115,85,0.15)",
            color: "#c4b5a0",
            border: "1px solid #665544",
            padding: "8px 20px",
            borderRadius: 3,
            cursor: "pointer",
            fontSize: "0.8rem",
            letterSpacing: "0.12em",
            fontFamily: "inherit",
          }}
        >
          Upload Portrait
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: "none" }} />

        {imageData && (
          <>
            <button
              onClick={() => setLocked((l) => !l)}
              style={{
                background: locked ? "rgba(180,40,40,0.2)" : "rgba(139,115,85,0.15)",
                color: locked ? "#cc6644" : "#c4b5a0",
                border: `1px solid ${locked ? "#884433" : "#665544"}`,
                padding: "8px 20px",
                borderRadius: 3,
                cursor: "pointer",
                fontSize: "0.8rem",
                letterSpacing: "0.12em",
                fontFamily: "inherit",
              }}
            >
              {locked ? "🔒 Locked" : "🔓 Unlocked"}
            </button>
            <span style={{ color: "#555", fontSize: "0.75rem" }}>
              {eyeSockets.length} eye{eyeSockets.length !== 1 ? "s" : ""} placed
            </span>
          </>
        )}

        <button
          onClick={exportProfiles}
          style={{
            background: "rgba(139,115,85,0.1)",
            color: "#887766",
            border: "1px solid #444",
            padding: "8px 14px",
            borderRadius: 3,
            cursor: "pointer",
            fontSize: "0.75rem",
            letterSpacing: "0.1em",
            fontFamily: "inherit",
          }}
        >
          Export JSON
        </button>
        <label
          style={{
            background: "rgba(139,115,85,0.1)",
            color: "#887766",
            border: "1px solid #444",
            padding: "8px 14px",
            borderRadius: 3,
            cursor: "pointer",
            fontSize: "0.75rem",
            letterSpacing: "0.1em",
          }}
        >
          Import JSON
          <input type="file" accept=".json" onChange={importProfiles} style={{ display: "none" }} />
        </label>
      </div>

      {/* Portrait area */}
      <div
        style={{
          position: "relative",
          maxWidth: 700,
          width: "100%",
          background: "#111",
          borderRadius: 4,
          overflow: "hidden",
          boxShadow: `0 0 60px rgba(0,0,0,0.8), inset 0 0 80px rgba(0,0,0,0.5)${
            glowIntensity > 0 ? `, 0 0 ${40 * glowIntensity}px rgba(200,40,0,${0.15 * glowIntensity})` : ""
          }`,
          border: "3px solid #2a2218",
          transition: "box-shadow 0.15s ease",
        }}
      >
        {/* Ornate frame edges */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            border: "8px solid transparent",
            borderImage: "linear-gradient(135deg, #3d3020, #1a1510, #3d3020, #1a1510) 1",
            zIndex: 5,
            pointerEvents: "none",
          }}
        />

        {!imageData ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              height: 450,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#555",
              gap: 12,
            }}
          >
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            <span style={{ fontSize: "0.9rem", letterSpacing: "0.15em" }}>Click to upload a portrait</span>
            <span style={{ fontSize: "0.7rem", color: "#444" }}>Front-facing works best</span>
          </div>
        ) : (
          <div
            ref={containerRef}
            onClick={handleImageClick}
            style={{ position: "relative", cursor: locked ? "default" : "crosshair", lineHeight: 0 }}
          >
            <img
              ref={imgRef}
              src={imageData}
              onLoad={onImgLoad}
              style={{ width: "100%", display: "block", filter: glowIntensity > 0 ? `brightness(${0.7 + 0.3 * glowIntensity})` : "brightness(0.85)" }}
              alt="Portrait"
              draggable={false}
            />

            {/* Darkness overlay for atmosphere */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,${0.5 - 0.2 * glowIntensity}) 100%)`,
                pointerEvents: "none",
                zIndex: 2,
              }}
            />

            {/* Glow canvas */}
            <GlowCanvas
              eyeSockets={eyeSockets}
              glowIntensity={glowIntensity}
              width={imgDimensions.width}
              height={imgDimensions.height}
              containerRef={containerRef}
            />

            {/* Eye socket markers (edit mode) */}
            {!locked &&
              eyeSockets.map((socket, idx) => (
                <div
                  key={idx}
                  onMouseDown={(e) => handleSocketMouseDown(e, idx)}
                  onMouseEnter={() => setHoverSocket(idx)}
                  onMouseLeave={() => setHoverSocket(null)}
                  style={{
                    position: "absolute",
                    left: `${socket.x * 100}%`,
                    top: `${socket.y * 100}%`,
                    width: 20,
                    height: 20,
                    marginLeft: -10,
                    marginTop: -10,
                    borderRadius: "50%",
                    border: `2px solid ${hoverSocket === idx ? "#ff6644" : "#cc8855"}`,
                    background: `rgba(200, 60, 20, ${hoverSocket === idx ? 0.4 : 0.2})`,
                    cursor: "grab",
                    zIndex: 10,
                    transition: "border-color 0.15s, background 0.15s",
                    boxShadow: hoverSocket === idx ? "0 0 12px rgba(200,60,20,0.5)" : "none",
                  }}
                  title="Drag to move • Delete/Backspace to remove"
                />
              ))}
          </div>
        )}
      </div>

      {/* Help text */}
      <div style={{ marginTop: 20, textAlign: "center", maxWidth: 600, lineHeight: 1.8 }}>
        <p style={{ color: "#555", fontSize: "0.75rem", letterSpacing: "0.08em" }}>
          {!imageData
            ? "Upload a portrait image to begin"
            : locked
            ? "Scene locked · Hold SPACE to illuminate · Shift+[1-6] to save · [1-6] to load"
            : "Click to place eye sockets · Drag to reposition · Delete to remove · Lock when ready"}
        </p>
        <p style={{ color: "#444", fontSize: "0.65rem", marginTop: 4, letterSpacing: "0.06em" }}>
          Slots 1–6 save full scenes (image + eye positions) · Export/Import for backup
        </p>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&display=swap');
        @keyframes fadeIn { from { opacity: 0; transform: translateX(-50%) translateY(-8px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        button:hover { filter: brightness(1.15); }
        button:active { filter: brightness(0.9); }
      `}</style>
    </div>
  );
}
