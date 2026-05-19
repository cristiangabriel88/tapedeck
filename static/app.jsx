const { useState, useEffect, useRef, useMemo, useCallback, Fragment } = React;

// ---------- helpers ----------
const cls = (...a) => a.filter(Boolean).join(" ");
const uid = () => Math.random().toString(36).slice(2, 9);
const stripExt = (n) => n.replace(/\.(mp3|m4a|opus|wav|flac|ogg)$/i, "");

const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iP(hone|od|ad)/i.test(navigator.platform || "");
const isWindows =
  typeof navigator !== "undefined" && /Win/i.test(navigator.platform || "");
const PATH_SEP = isWindows ? "\\" : "/";
const PASTE_HINT = isMac ? "⌘V" : "Ctrl+V";

const URL_RE = /^https?:\/\/\S+/i;
const YT_RE = /^https?:\/\/\S*(youtu\.?be|youtube\.com)\S*/i;

function splitUrls(raw) {
  if (Array.isArray(raw)) return raw.flatMap(splitUrls);
  return String(raw || "")
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter((s) => URL_RE.test(s));
}

const ACCENTS = {
  amber: {
    name: "Amber",
    c: "oklch(0.70 0.16 55)",
    ink: "oklch(0.20 0.04 60)",
  },
  forest: { name: "Forest", c: "oklch(0.55 0.12 155)", ink: "#fff" },
  ink: { name: "Ink", c: "oklch(0.22 0.02 270)", ink: "#fff" },
  coral: { name: "Coral", c: "oklch(0.68 0.18 25)", ink: "#fff" },
};

// ---------- icons ----------
const I = {
  wave: (p) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      {...p}
    >
      <path d="M3 12h2M7 8v8M11 5v14M15 9v6M19 11v2M21 12h.01" />
    </svg>
  ),
  paste: (p) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    </svg>
  ),
  x: (p) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      {...p}
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  ),
  check: (p) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <path d="M4 12l5 5L20 6" />
    </svg>
  ),
  folder: (p) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
    </svg>
  ),
  dot: (p) => (
    <svg viewBox="0 0 8 8" {...p}>
      <circle cx="4" cy="4" r="3" fill="currentColor" />
    </svg>
  ),
  spin: (p) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      {...p}
    >
      <path d="M21 12a9 9 0 1 1-6.2-8.55" />
    </svg>
  ),
  reveal: (p) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  ),
  sun: (p) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  ),
  moon: (p) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  ),
  gear: (p) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  coffee: (p) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <path d="M4 9h13v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V9z" />
      <path d="M17 11h2a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-2" />
      <path d="M7 3v3M10 3v3M13 3v3" />
    </svg>
  ),
  mail: (p) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  ),
};

const QUALITIES = ["128", "192", "256", "320"];
const FORMATS = ["mp3", "m4a", "opus", "wav", "flac"];

// ---------- filename template (palette + parser) ----------
const TPL_TOKEN_PALETTE = [
  { key: "title", sample: "Bohemian Rhapsody" },
  { key: "channel", sample: "Queen Official" },
  { key: "uploader", sample: "queenofficial" },
  { key: "id", sample: "fJ9rUzIMcZQ" },
];

const TPL_SEP_PALETTE = [
  { label: "–", value: " - " },
  { label: "·", value: " · " },
  { label: "_", value: "_" },
  { label: "␣", value: " " },
];

function parseTemplate(tpl) {
  const out = [];
  const src = String(tpl || "");
  const re = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
  let last = 0;
  let m;
  while ((m = re.exec(src)) !== null) {
    if (m.index > last)
      out.push({ kind: "text", value: src.slice(last, m.index) });
    out.push({ kind: "token", value: m[1] });
    last = m.index + m[0].length;
  }
  if (last < src.length) out.push({ kind: "text", value: src.slice(last) });
  return out;
}

function segmentsToTemplate(segs) {
  return segs
    .map((s) => (s.kind === "token" ? `{${s.value}}` : s.value))
    .join("");
}

function previewTemplate(tpl) {
  const result = String(tpl || "").replace(
    /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g,
    (full, k) => {
      const def = TPL_TOKEN_PALETTE.find((d) => d.key === k);
      return def ? def.sample : full;
    },
  );
  return result.replace(/\s+/g, " ").trim() || "audio";
}

// ---------- prefs (localStorage) ----------
function usePrefs() {
  const defaults = {
    format: "mp3",
    quality: "320",
    max_concurrent: 3,
    expand_playlists: false,
  };
  const [prefs, setPrefs] = useState(() => {
    try {
      const raw = localStorage.getItem("tapedeck.prefs");
      return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
    } catch {
      return defaults;
    }
  });
  const setPref = useCallback((k, v) => {
    setPrefs((p) => {
      const next = { ...p, [k]: v };
      try {
        localStorage.setItem("tapedeck.prefs", JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);
  return [prefs, setPref];
}

// ---------- equalizer (decorative) ----------
function Equalizer({ count = 5, playing }) {
  return (
    <div className="eq" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className={cls("eq-bar", playing && "on")}
          style={{ animationDelay: `${i * 0.12}s` }}
        />
      ))}
    </div>
  );
}

// ---------- inline progress bar (download phase only) ----------
function ProgressBar({ progress, accent }) {
  const pct = Math.max(0, Math.min(100, progress || 0));
  return (
    <div className="row-progress-inline" aria-hidden>
      <div
        className="row-progress-fill"
        style={{ width: `${pct}%`, background: accent.c }}
      />
    </div>
  );
}

// ---------- one row ----------
function TrackRow({
  track,
  accent,
  outDir,
  onRemove,
  onRetry,
  onReveal,
  onPromote,
}) {
  const {
    id,
    status,
    phase,
    progress,
    title,
    channel,
    dur,
    url,
    error,
    thumbnail,
    removing,
    jitterSeq,
  } = track;
  const hasImg = !!thumbnail && status !== "fetching";

  // Imperative shake via Web Animations API. CSS class-toggle restart isn't
  // reliable under React 18 batching — both commits land in the same frame,
  // so the browser never observes the no-class intermediate state and the
  // animation doesn't replay. element.animate() always starts fresh.
  const rowRef = useRef(null);
  const jitterAnimRef = useRef(null);
  useEffect(() => {
    if (!jitterSeq) return;
    const el = rowRef.current;
    if (!el || typeof el.animate !== "function") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;
    if (jitterAnimRef.current) jitterAnimRef.current.cancel();
    const tint = "color-mix(in oklab, var(--accent) 8%, transparent)";
    jitterAnimRef.current = el.animate(
      [
        { transform: "translateX(0)",   backgroundColor: tint, offset: 0 },
        { transform: "translateX(-7px)", offset: 0.1 },
        { transform: "translateX(7px)",  offset: 0.25 },
        { transform: "translateX(-5px)", offset: 0.4 },
        { transform: "translateX(5px)",  offset: 0.55 },
        { transform: "translateX(-3px)", offset: 0.7 },
        { transform: "translateX(3px)",  offset: 0.85 },
        { transform: "translateX(0)",   backgroundColor: tint, offset: 1 },
      ],
      { duration: 550, easing: "cubic-bezier(.36,.07,.19,.97)" },
    );
  }, [jitterSeq]);

  const statusNode = () => {
    if (status === "fetching")
      return (
        <span className="row-status fetching">
          <I.spin width="12" height="12" className="spin" /> resolving…
        </span>
      );
    if (status === "queued")
      return (
        <button
          className="row-status queued row-status-action"
          onClick={() => onPromote && onPromote(id)}
          title="start this clip now"
          aria-label="start this clip now"
        >
          <I.dot width="6" height="6" />
          <span className="row-status-label">queued</span>
          <span className="row-status-hover">start →</span>
        </button>
      );
    if (status === "working") {
      if (phase === "converting")
        return <span className="row-status working">converting…</span>;
      return (
        <span className="row-status working">
          downloading {Math.round(progress || 0)}%
        </span>
      );
    }
    if (status === "done")
      return (
        <span className="row-status done">
          <I.check width="12" height="12" /> saved
        </span>
      );
    if (status === "cancelled")
      return <span className="row-status queued">cancelled</span>;
    if (status === "error")
      return (
        <span className="row-status error" title={error}>
          failed
        </span>
      );
    return null;
  };

  return (
    <div
      ref={rowRef}
      className={cls("row", `row-${status}`, removing && "removing")}
    >
      <div className={cls("row-thumb", hasImg && "has-img")} aria-hidden>
        {status === "fetching" ? (
          <I.spin width="18" height="18" className="spin" />
        ) : hasImg ? (
          <img
            className="row-thumb-img"
            src={thumbnail}
            loading="lazy"
            alt=""
          />
        ) : status === "working" ? (
          <Equalizer playing />
        ) : status === "done" ? (
          <I.check width="18" height="18" />
        ) : (
          <I.wave width="18" height="18" />
        )}
      </div>

      <div className="row-main">
        <div className="row-title">
          {status === "fetching" ? (
            <span className="skeleton skeleton-title" />
          ) : (
            title
          )}
        </div>
        <div className="row-meta">
          {status === "fetching" ? (
            <span className="skeleton skeleton-meta" />
          ) : (
            <>
              <span>{channel}</span>
              <span className="dot-sep">·</span>
              <span className="mono">{dur}</span>
              {status === "done" && outDir && (
                <>
                  <span className="dot-sep">·</span>
                  <span className="mono dim">{outDir}</span>
                </>
              )}
            </>
          )}
        </div>
        {status === "working" && phase !== "converting" && (
          <ProgressBar progress={progress} accent={accent} />
        )}
      </div>

      <div className="row-status-cell">{statusNode()}</div>

      <div className="row-actions">
        {status === "error" && (
          <button
            className="iconbtn"
            aria-label="retry"
            title="retry"
            onClick={() => onRetry(id)}
          >
            <I.spin width="14" height="14" />
          </button>
        )}
        {status === "done" && (
          <button
            className="iconbtn"
            aria-label="reveal in folder"
            title="reveal in folder"
            onClick={() => onReveal(id)}
          >
            <I.reveal width="14" height="14" />
          </button>
        )}
        <button
          className="iconbtn"
          aria-label="remove"
          title={status === "working" ? "cancel" : "remove"}
          onClick={() => onRemove(id)}
        >
          <I.x width="14" height="14" />
        </button>
      </div>
    </div>
  );
}

// ---------- drag-and-drop filename template builder ----------
function TemplateBuilder({ tpl, setTpl }) {
  const segments = parseTemplate(tpl);
  const [dragOverSlot, setDragOverSlot] = useState(null);
  const [draggingIdx, setDraggingIdx] = useState(null);

  const applySegments = (segs) => setTpl(segmentsToTemplate(segs));

  const insertAt = (slotIdx, seg) => {
    applySegments([
      ...segments.slice(0, slotIdx),
      seg,
      ...segments.slice(slotIdx),
    ]);
  };
  const moveTo = (fromIdx, slotIdx) => {
    // Slot at index i sits *before* chip i. Dropping a chip back into its own
    // bordering slots (i or i+1) is a no-op.
    if (slotIdx === fromIdx || slotIdx === fromIdx + 1) return;
    const next = segments.slice();
    const [moved] = next.splice(fromIdx, 1);
    next.splice(fromIdx < slotIdx ? slotIdx - 1 : slotIdx, 0, moved);
    applySegments(next);
  };
  const removeAt = (idx) => applySegments(segments.filter((_, i) => i !== idx));

  const onPaletteDragStart = (e, payload) => {
    e.dataTransfer.setData("text/x-tpl", JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "copy";
  };
  const onChipDragStart = (e, idx) => {
    e.dataTransfer.setData(
      "text/x-tpl",
      JSON.stringify({ kind: "chip", index: idx }),
    );
    e.dataTransfer.effectAllowed = "move";
    setDraggingIdx(idx);
  };
  const onChipDragEnd = () => {
    setDraggingIdx(null);
    setDragOverSlot(null);
  };

  const dropPayloadAt = (slotIdx, data) => {
    if (data.kind === "palette-token")
      insertAt(slotIdx, { kind: "token", value: data.value });
    else if (data.kind === "palette-sep")
      insertAt(slotIdx, { kind: "text", value: data.value });
    else if (data.kind === "chip") moveTo(data.index, slotIdx);
  };

  const onSlotDragOver = (e, slotIdx) => {
    e.preventDefault();
    e.stopPropagation(); // outrun canvas-level dragover when a precise slot is hit
    setDragOverSlot(slotIdx);
  };
  const onSlotDrop = (e, slotIdx) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverSlot(null);
    setDraggingIdx(null);
    const raw = e.dataTransfer.getData("text/x-tpl");
    if (!raw) return;
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }
    dropPayloadAt(slotIdx, data);
  };

  // Canvas-level fallback: drops landing anywhere in the box (not on a precise
  // gap-slot) append at the end. Slot handlers stopPropagation so they win
  // when targeted; otherwise this fires.
  const onCanvasDragOver = (e) => {
    e.preventDefault();
    setDragOverSlot(segments.length);
  };
  const onCanvasDragLeave = (e) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setDragOverSlot(null);
  };
  const onCanvasDrop = (e) => {
    e.preventDefault();
    setDragOverSlot(null);
    setDraggingIdx(null);
    const raw = e.dataTransfer.getData("text/x-tpl");
    if (!raw) return;
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }
    dropPayloadAt(segments.length, data);
  };

  const renderSlot = (idx) => (
    <span
      className={cls("tpl-slot", dragOverSlot === idx && "tpl-slot-active")}
      onDragOver={(e) => onSlotDragOver(e, idx)}
      onDragLeave={() => setDragOverSlot((s) => (s === idx ? null : s))}
      onDrop={(e) => onSlotDrop(e, idx)}
      aria-hidden
    />
  );

  const sepLabel = (v) => (v === " " ? "␣" : v.trim() || "␣");

  return (
    <div className="tpl-builder">
      <div className="tpl-palette" aria-label="filename template palette">
        <div className="tpl-palette-row">
          {TPL_TOKEN_PALETTE.map((t) => (
            <button
              key={t.key}
              type="button"
              className="tpl-chip tpl-chip-token tpl-chip-palette"
              draggable
              onDragStart={(e) =>
                onPaletteDragStart(e, { kind: "palette-token", value: t.key })
              }
              onClick={() => setTpl(tpl + `{${t.key}}`)}
              title={`{${t.key}} — drag in, or click to append`}
            >
              {t.key}
            </button>
          ))}
        </div>
        <div className="tpl-palette-row">
          {TPL_SEP_PALETTE.map((s) => (
            <button
              key={s.label}
              type="button"
              className="tpl-chip tpl-chip-sep tpl-chip-palette"
              draggable
              onDragStart={(e) =>
                onPaletteDragStart(e, { kind: "palette-sep", value: s.value })
              }
              onClick={() => setTpl(tpl + s.value)}
              title={`separator "${s.value === " " ? "space" : s.value}"`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div
        className="tpl-canvas"
        role="list"
        aria-label="filename template"
        onDragOver={onCanvasDragOver}
        onDragLeave={onCanvasDragLeave}
        onDrop={onCanvasDrop}
      >
        {renderSlot(0)}
        {segments.map((seg, i) => (
          <Fragment key={i}>
            <span
              className={cls(
                "tpl-chip",
                seg.kind === "token" ? "tpl-chip-token" : "tpl-chip-sep",
                draggingIdx === i && "tpl-chip-dragging",
              )}
              draggable
              role="listitem"
              onDragStart={(e) => onChipDragStart(e, i)}
              onDragEnd={onChipDragEnd}
              title={
                seg.kind === "token"
                  ? `{${seg.value}}`
                  : `"${seg.value === " " ? "space" : seg.value}"`
              }
            >
              {seg.kind === "token" ? (
                seg.value
              ) : (
                <span className="tpl-chip-sep-label">
                  {sepLabel(seg.value)}
                </span>
              )}
              <button
                type="button"
                className="tpl-chip-x"
                onClick={(e) => {
                  e.stopPropagation();
                  removeAt(i);
                }}
                aria-label="remove"
              >
                ×
              </button>
            </span>
            {renderSlot(i + 1)}
          </Fragment>
        ))}
        {segments.length === 0 && (
          <span className="tpl-canvas-empty mono">drop tokens here</span>
        )}
      </div>

      <div className="tpl-preview">
        <span className="tpl-preview-label mono">preview</span>
        <span className="tpl-preview-value mono">{previewTemplate(tpl)}</span>
      </div>
    </div>
  );
}

// ---------- settings modal ----------
function SettingsModal({
  open,
  currentDir,
  currentTemplate,
  prefs,
  setPref,
  onClose,
  onSaved,
}) {
  const [path, setPath] = useState(currentDir || "");
  const [tpl, setTpl] = useState(currentTemplate || "{title}");
  const [maxC, setMaxC] = useState(prefs.max_concurrent || 1);
  const [expand, setExpand] = useState(!!prefs.expand_playlists);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (open) {
      setPath(currentDir || "");
      setTpl(currentTemplate || "{title}");
      setMaxC(prefs.max_concurrent || 1);
      setExpand(!!prefs.expand_playlists);
      setErr("");
      setBusy(false);
    }
  }, [
    open,
    currentDir,
    currentTemplate,
    prefs.max_concurrent,
    prefs.expand_playlists,
  ]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = async (e) => {
    e?.preventDefault?.();
    if (busy) return;
    const trimmedPath = path.trim();
    const trimmedTpl = tpl.trim() || "{title}";
    if (!trimmedPath) {
      setErr("Output folder is required.");
      return;
    }
    if (!/\{[a-zA-Z_][a-zA-Z0-9_]*\}/.test(trimmedTpl)) {
      setErr("Filename template must include at least one {token}.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const resp = await fetch("/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          out_dir: trimmedPath,
          filename_template: trimmedTpl,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setErr(data.error || "Could not save.");
        setBusy(false);
        return;
      }
      setPref("max_concurrent", Math.max(1, Math.min(4, Number(maxC) || 1)));
      setPref("expand_playlists", !!expand);
      onSaved({
        out_dir: data.out_dir || trimmedPath,
        out_dir_abs: data.out_dir_abs,
        filename_template: data.filename_template || trimmedTpl,
      });
      onClose();
    } catch (e2) {
      setErr(e2.message || "Network error.");
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form
        className="modal"
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <div className="modal-head">
          <div className="modal-title">Settings</div>
          <button
            type="button"
            className="iconbtn"
            onClick={onClose}
            aria-label="close settings"
          >
            <I.x width="14" height="14" />
          </button>
        </div>
        <div className="modal-body">
          <div className="modal-field">
            <label className="modal-label" htmlFor="out-dir-input">
              Output folder
            </label>
            <input
              id="out-dir-input"
              className="modal-input mono"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="~/Music/yt"
              spellCheck="false"
              autoComplete="off"
              autoFocus
            />
            <div className="modal-help">
              Files land here. The folder is created if it doesn't exist.
            </div>
          </div>

          <div className="modal-field">
            <label className="modal-label">Filename template</label>
            <TemplateBuilder tpl={tpl} setTpl={setTpl} />
            <div className="modal-help">
              Drag pills into the box (drop anywhere — they append after the
              last one), or click a palette pill to add. Tokens come from yt-dlp
              metadata.
            </div>
          </div>

          <div className="modal-row">
            <div className="modal-field modal-field-inline">
              <label className="modal-label" htmlFor="maxc-input">
                Parallel downloads
              </label>
              <div className="modal-stepper">
                <button
                  type="button"
                  className="modal-step"
                  onClick={() => setMaxC((n) => Math.max(1, n - 1))}
                  aria-label="fewer"
                >
                  −
                </button>
                <input
                  id="maxc-input"
                  className="modal-input mono modal-step-value"
                  type="number"
                  min="1"
                  max="4"
                  value={maxC}
                  onChange={(e) =>
                    setMaxC(
                      Math.max(1, Math.min(4, Number(e.target.value) || 1)),
                    )
                  }
                />
                <button
                  type="button"
                  className="modal-step"
                  onClick={() => setMaxC((n) => Math.min(4, n + 1))}
                  aria-label="more"
                >
                  +
                </button>
              </div>
            </div>
            <div className="modal-field modal-field-inline">
              <label className="modal-label" htmlFor="exp-input">
                Expand playlists
              </label>
              <button
                id="exp-input"
                type="button"
                className={cls("modal-toggle", expand && "on")}
                role="switch"
                aria-checked={expand}
                onClick={() => setExpand((v) => !v)}
              >
                <span className="modal-toggle-knob" />
              </button>
            </div>
          </div>

          {err && <div className="modal-error">{err}</div>}
        </div>
        <div className="modal-foot">
          <button
            type="button"
            className="ghostbtn mono"
            onClick={onClose}
            disabled={busy}
          >
            cancel
          </button>
          <button type="submit" className="inputbar-go" disabled={busy}>
            {busy ? "saving…" : "save"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------- main app ----------
function App() {
  const [t, setTweak] = window.useTweaks({
    accent: "amber",
    theme: "light",
    density: "comfy",
  });

  const accent = ACCENTS[t.accent] || ACCENTS.amber;

  const [prefs, setPref] = usePrefs();
  const [input, setInput] = useState("");
  const [queue, setQueue] = useState([]);
  const [outDir, setOutDir] = useState("");
  const [outDirAbs, setOutDirAbs] = useState("");
  const [filenameTemplate, setFilenameTemplate] = useState("{title}");
  const [clipboardHint, setClipboardHint] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const inputRef = useRef(null);
  const dismissedClipRef = useRef("");
  const activeWorkersRef = useRef(new Set());
  const queueRestoredRef = useRef(false);

  // theme + accent css vars
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = t.theme;
    root.dataset.density = t.density;
    root.style.setProperty("--accent", accent.c);
    root.style.setProperty("--accent-ink", accent.ink);
  }, [t.theme, t.density, accent]);

  // fetch real output dir + filename template on first load and whenever the
  // settings modal opens, so the modal always shows current server state even
  // after a server restart or external edit to config.json.
  useEffect(() => {
    fetch("/config")
      .then((r) => r.json())
      .then((c) => {
        setOutDir(c.out_dir || "");
        setOutDirAbs(c.out_dir_abs || "");
        if (c.filename_template) setFilenameTemplate(c.filename_template);
      })
      .catch(() => {});
  }, [settingsOpen]);

  // parallel download workers — one async runner per row, capped by max_concurrent.
  const startWorker = useCallback(async (row) => {
    setQueue((q) =>
      q.map((it) =>
        it.id === row.id
          ? { ...it, status: "working", progress: 0, phase: "starting" }
          : it,
      ),
    );
    try {
      const startResp = await fetch("/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: row.url,
          quality: row.quality,
          format: row.format,
        }),
      });
      if (!startResp.ok) {
        const data = await startResp
          .json()
          .catch(() => ({ error: "HTTP " + startResp.status }));
        setQueue((q) =>
          q.map((it) =>
            it.id === row.id
              ? {
                  ...it,
                  status: "error",
                  error: data.error || "download failed",
                }
              : it,
          ),
        );
        return;
      }
      const { job_id, out_dir } = await startResp.json();
      if (out_dir) setOutDir(out_dir);
      setQueue((q) =>
        q.map((it) => (it.id === row.id ? { ...it, jobId: job_id } : it)),
      );

      while (true) {
        await new Promise((r) => setTimeout(r, 400));
        const pResp = await fetch(`/progress/${job_id}`);
        if (pResp.status === 404) {
          // Job cleaned up server-side without us seeing a terminal state — exit quietly.
          return;
        }
        if (!pResp.ok) throw new Error("progress check failed");
        const job = await pResp.json();
        if (job.status === "cancelled") {
          setQueue((q) =>
            q.map((it) => {
              if (it.id !== row.id) return it;
              // onPromote may have re-queued this row mid-cancel — don't overwrite.
              if (it.status === "queued") return it;
              return {
                ...it,
                status: "cancelled",
                phase: "cancelled",
                progress: 0,
              };
            }),
          );
          return;
        }
        setQueue((q) =>
          q.map((it) =>
            it.id === row.id
              ? { ...it, progress: job.progress, phase: job.phase }
              : it,
          ),
        );
        if (job.status === "error") {
          setQueue((q) =>
            q.map((it) =>
              it.id === row.id
                ? {
                    ...it,
                    status: "error",
                    error: job.error || "download failed",
                  }
                : it,
            ),
          );
          return;
        }
        if (job.status === "done") {
          setQueue((q) =>
            q.map((it) =>
              it.id === row.id
                ? {
                    ...it,
                    status: "done",
                    progress: 100,
                    phase: "done",
                    title: job.final_name ? stripExt(job.final_name) : it.title,
                  }
                : it,
            ),
          );
          return;
        }
      }
    } catch (err) {
      setQueue((q) =>
        q.map((it) =>
          it.id === row.id
            ? { ...it, status: "error", error: err.message || "network error" }
            : it,
        ),
      );
    } finally {
      activeWorkersRef.current.delete(row.id);
    }
  }, []);

  useEffect(() => {
    const max = Math.max(1, Math.min(4, Number(prefs.max_concurrent) || 1));
    const slots = max - activeWorkersRef.current.size;
    if (slots <= 0) return;
    const toStart = queue
      .filter(
        (it) =>
          it.status === "queued" &&
          !it.removing &&
          !activeWorkersRef.current.has(it.id),
      )
      .slice(0, slots);
    toStart.forEach((row) => {
      activeWorkersRef.current.add(row.id);
      startWorker(row);
    });
  }, [queue, prefs.max_concurrent, startWorker]);

  // add one or many URLs
  const addUrls = useCallback(
    (raw) => {
      const urls = splitUrls(raw);
      if (urls.length === 0) return;
      let dupIds = [];
      setQueue((q) => {
        const byUrl = new Map(q.map((it) => [it.url, it.id]));
        dupIds = urls.map((u) => byUrl.get(u)).filter(Boolean);
        const fresh = urls.filter((u) => !byUrl.has(u));
        const dupSet = new Set(dupIds);
        // Bump jitterSeq on every duplicate press — TrackRow's effect watches
        // this counter and imperatively replays the shake via WAAPI, which
        // restarts cleanly even when called mid-animation.
        const stamped =
          dupSet.size === 0
            ? q
            : q.map((it) =>
                dupSet.has(it.id)
                  ? { ...it, jitterSeq: (it.jitterSeq || 0) + 1 }
                  : it,
              );
        if (fresh.length === 0) return stamped;
        const newRows = fresh.map((url) => ({
          id: uid(),
          url,
          status: "fetching",
          progress: 0,
          phase: "fetching",
          title: "",
          channel: "",
          dur: "",
          thumbnail: "",
          quality: prefs.quality,
          format: prefs.format,
        }));
        newRows.forEach((row) => {
          fetch("/info", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url: row.url,
              expand_playlist: !!prefs.expand_playlists,
            }),
          })
            .then(async (resp) => {
              const data = await resp.json().catch(() => ({}));
              if (!resp.ok) {
                setQueue((qs) =>
                  qs.map((it) =>
                    it.id === row.id
                      ? {
                          ...it,
                          status: "error",
                          error: data.error || "lookup failed",
                        }
                      : it,
                  ),
                );
                return;
              }
              if (
                data.type === "playlist" &&
                Array.isArray(data.entries) &&
                data.entries.length > 0
              ) {
                // Replace the placeholder row with one row per entry (cap at 100).
                const expanded = data.entries.slice(0, 100).map((e) => ({
                  id: uid(),
                  url: e.url || "",
                  status: e.url ? "queued" : "error",
                  progress: 0,
                  phase: e.url ? "queued" : "error",
                  title: e.title || e.url || "(unknown)",
                  channel: e.channel || data.title || "",
                  dur: e.duration || "",
                  thumbnail: e.thumbnail || "",
                  quality: row.quality,
                  format: row.format,
                  error: e.url ? null : "Playlist entry has no URL.",
                }));
                setQueue((qs) => {
                  const idx = qs.findIndex((it) => it.id === row.id);
                  if (idx < 0) return qs;
                  const seen = new Set(
                    qs.filter((it) => it.id !== row.id).map((it) => it.url),
                  );
                  const deduped = expanded.filter(
                    (e) => e.url && !seen.has(e.url),
                  );
                  return [
                    ...qs.slice(0, idx),
                    ...deduped,
                    ...qs.slice(idx + 1),
                  ];
                });
                return;
              }
              setQueue((qs) =>
                qs.map((it) =>
                  it.id === row.id
                    ? {
                        ...it,
                        status: "queued",
                        title: data.title || row.url,
                        channel: data.channel || "",
                        dur: data.duration || "",
                        thumbnail: data.thumbnail || "",
                      }
                    : it,
                ),
              );
            })
            .catch((err) => {
              setQueue((qs) =>
                qs.map((it) =>
                  it.id === row.id
                    ? {
                        ...it,
                        status: "error",
                        error: err.message || "network error",
                      }
                    : it,
                ),
              );
            });
        });
        return [...stamped, ...newRows];
      });
      setInput("");
    },
    [prefs.quality, prefs.format, prefs.expand_playlists],
  );

  const onSubmit = (e) => {
    e.preventDefault();
    addUrls(input);
  };

  const onPasteBtn = async () => {
    try {
      const txt = await navigator.clipboard.readText();
      if (txt) setInput(txt);
    } catch {}
    inputRef.current?.focus();
  };

  // clipboard hint on focus
  useEffect(() => {
    let cancelled = false;
    const tryRead = async () => {
      try {
        const txt = await navigator.clipboard.readText();
        if (cancelled || !txt) return;
        const urls = splitUrls(txt).filter((u) => YT_RE.test(u));
        if (urls.length === 0) return;
        setQueue((q) => {
          const existing = new Set(q.map((it) => it.url));
          const fresh = urls.find(
            (u) => !existing.has(u) && u !== dismissedClipRef.current,
          );
          if (fresh && !cancelled) setClipboardHint(fresh);
          return q;
        });
      } catch {
        // permission denied / focus required — ignore silently
      }
    };
    window.addEventListener("focus", tryRead);
    if (document.hasFocus()) tryRead();
    return () => {
      cancelled = true;
      window.removeEventListener("focus", tryRead);
    };
  }, []);

  useEffect(() => {
    if (!clipboardHint) return;
    const id = setTimeout(() => setClipboardHint(""), 8000);
    return () => clearTimeout(id);
  }, [clipboardHint]);

  const acceptClipboardHint = () => {
    if (!clipboardHint) return;
    addUrls(clipboardHint);
    setClipboardHint("");
  };
  const dismissClipboardHint = () => {
    dismissedClipRef.current = clipboardHint;
    setClipboardHint("");
  };

  // drag & drop on document
  useEffect(() => {
    let depth = 0;
    const onEnter = (e) => {
      const types = Array.from(e.dataTransfer?.types || []);
      if (!types.some((tp) => tp.startsWith("text/"))) return;
      e.preventDefault();
      depth++;
      setDragOver(true);
    };
    const onLeave = (e) => {
      e.preventDefault();
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragOver(false);
    };
    const onOver = (e) => {
      e.preventDefault();
    };
    const onDrop = (e) => {
      e.preventDefault();
      depth = 0;
      setDragOver(false);
      const text =
        e.dataTransfer?.getData("text/uri-list") ||
        e.dataTransfer?.getData("text/plain") ||
        "";
      if (text) addUrls(text);
    };
    document.addEventListener("dragenter", onEnter);
    document.addEventListener("dragleave", onLeave);
    document.addEventListener("dragover", onOver);
    document.addEventListener("drop", onDrop);
    return () => {
      document.removeEventListener("dragenter", onEnter);
      document.removeEventListener("dragleave", onLeave);
      document.removeEventListener("dragover", onOver);
      document.removeEventListener("drop", onDrop);
    };
  }, [addUrls]);

  const onRemove = (id) => {
    setQueue((qs) => {
      const row = qs.find((it) => it.id === id);
      if (row?.status === "working" && row.jobId) {
        fetch(`/cancel/${row.jobId}`, { method: "POST" }).catch(() => {});
      }
      return qs.map((it) => (it.id === id ? { ...it, removing: true } : it));
    });
    setTimeout(() => {
      setQueue((qs) => qs.filter((it) => it.id !== id));
    }, 200);
  };
  const onRetry = (id) =>
    setQueue((qs) =>
      qs.map((it) =>
        it.id === id
          ? {
              ...it,
              status: "queued",
              error: null,
              progress: 0,
              phase: "queued",
            }
          : it,
      ),
    );
  const onPromote = (id) => {
    const max = Math.max(1, Math.min(4, Number(prefs.max_concurrent) || 1));
    setQueue((qs) => {
      const target = qs.find((it) => it.id === id);
      if (!target || target.status !== "queued") return qs;
      const others = qs.filter((it) => it.id !== id);
      // At capacity: cancel the working row with the least progress to free a slot,
      // and re-queue it so the user doesn't lose it.
      if (activeWorkersRef.current.size >= max) {
        const workingRows = others.filter((it) => it.status === "working");
        if (workingRows.length > 0) {
          const victim = workingRows.reduce((lo, it) =>
            (it.progress || 0) < (lo.progress || 0) ? it : lo,
          );
          if (victim.jobId)
            fetch(`/cancel/${victim.jobId}`, { method: "POST" }).catch(
              () => {},
            );
          const updated = others.map((it) =>
            it.id === victim.id
              ? {
                  ...it,
                  status: "queued",
                  progress: 0,
                  phase: "queued",
                  jobId: null,
                }
              : it,
          );
          return [target, ...updated];
        }
      }
      // Free slot — just move the promoted row to the front so the worker pool picks it next.
      return [target, ...others];
    });
  };
  const onReveal = (id) => {
    const row = queue.find((it) => it.id === id);
    if (!row) return;
    // jobId is null when the server forgot the job (TTL expiry or restart).
    // Fall back to opening the output folder so the click still does something.
    if (!row.jobId) {
      fetch("/reveal-folder", { method: "POST" }).catch(() => {});
      return;
    }
    fetch(`/reveal/${row.jobId}`, { method: "POST" })
      .then((resp) => {
        if (!resp.ok) fetch("/reveal-folder", { method: "POST" }).catch(() => {});
      })
      .catch(() => {});
  };
  const onRevealFolder = () => {
    fetch("/reveal-folder", { method: "POST" }).catch(() => {});
  };
  const onRetryAll = () =>
    setQueue((qs) =>
      qs.map((it) =>
        it.status === "error"
          ? {
              ...it,
              status: "queued",
              error: null,
              progress: 0,
              phase: "queued",
            }
          : it,
      ),
    );
  const onClearDone = () =>
    setQueue((qs) => qs.filter((it) => it.status !== "done"));
  const onClearAll = () => {
    const active = queue.some(
      (it) => it.status === "working" || it.status === "fetching",
    );
    if (
      active &&
      !window.confirm("A track is in progress. Clear everything anyway?")
    )
      return;
    setQueue([]);
  };

  // keyboard shortcuts
  useEffect(() => {
    const isTypingIn = (el) => {
      if (!el) return false;
      const tag = (el.tagName || "").toLowerCase();
      return (
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        el.isContentEditable
      );
    };
    const focusInput = () => {
      if (!inputRef.current) return;
      inputRef.current.focus();
      inputRef.current.select?.();
    };
    const onKey = (e) => {
      // Ctrl/Cmd+K — focus input from anywhere.
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        focusInput();
        return;
      }
      // '/' — focus input when not typing.
      if (e.key === "/" && !isTypingIn(e.target)) {
        e.preventDefault();
        focusInput();
        return;
      }
      // Esc — clear input → dismiss clipboard hint. Settings modal has its own handler.
      if (e.key === "Escape" && !settingsOpen) {
        if (input.trim()) {
          setInput("");
          return;
        }
        if (clipboardHint) {
          dismissedClipRef.current = clipboardHint;
          setClipboardHint("");
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [input, clipboardHint, settingsOpen]);

  // queue persistence — save on change
  useEffect(() => {
    if (!queueRestoredRef.current) return; // skip first render before restore completes
    try {
      // Strip transient flags; keep enough to restore + re-sync.
      const slim = queue
        .filter((it) => it.status !== "fetching" && !it.removing)
        .map(
          ({
            id,
            url,
            status,
            progress,
            phase,
            title,
            channel,
            dur,
            thumbnail,
            quality,
            format,
            jobId,
            error,
          }) => ({
            id,
            url,
            status,
            progress,
            phase,
            title,
            channel,
            dur,
            thumbnail,
            quality,
            format,
            jobId,
            error,
          }),
        );
      localStorage.setItem("tapedeck.queue", JSON.stringify(slim));
    } catch {}
  }, [queue]);

  // queue persistence — restore on first mount, then re-sync working/queued rows with the server.
  useEffect(() => {
    let saved;
    try {
      saved = JSON.parse(localStorage.getItem("tapedeck.queue") || "null");
    } catch {}
    if (!Array.isArray(saved) || saved.length === 0) {
      queueRestoredRef.current = true;
      return;
    }
    // Working rows from a previous session lose their server-side worker — requeue with the
    // existing jobId so the re-sync below can pick them up if the server still knows them.
    const cleaned = saved
      .filter((r) => r && r.url && r.status !== "fetching")
      .map((r) =>
        r.status === "working"
          ? { ...r, status: "queued", progress: 0, phase: "queued" }
          : r,
      );
    setQueue(cleaned);
    queueRestoredRef.current = true;

    cleaned.forEach((r) => {
      if (!r.jobId) return;
      fetch(`/progress/${r.jobId}`)
        .then(async (resp) => {
          if (resp.status === 404) {
            setQueue((qs) =>
              qs.map((it) =>
                it.id === r.id
                  ? { ...it, jobId: null } // server forgot — let the worker pool restart it
                  : it,
              ),
            );
            return;
          }
          if (!resp.ok) return;
          const job = await resp.json();
          if (
            job.status === "done" ||
            job.status === "cancelled" ||
            job.status === "error"
          ) {
            setQueue((qs) =>
              qs.map((it) =>
                it.id === r.id
                  ? {
                      ...it,
                      status: job.status,
                      progress: job.progress || 100,
                      phase: job.phase,
                      error: job.error,
                    }
                  : it,
              ),
            );
          } else if (job.status === "working") {
            // Server still running it — re-attach as a worker.
            setQueue((qs) =>
              qs.map((it) =>
                it.id === r.id
                  ? {
                      ...it,
                      status: "working",
                      progress: job.progress,
                      phase: job.phase,
                    }
                  : it,
              ),
            );
            if (!activeWorkersRef.current.has(r.id)) {
              activeWorkersRef.current.add(r.id);
              // Poll-only path for re-attached workers.
              (async () => {
                try {
                  while (true) {
                    await new Promise((res) => setTimeout(res, 400));
                    const pr = await fetch(`/progress/${r.jobId}`);
                    if (pr.status === 404) return;
                    if (!pr.ok) return;
                    const j = await pr.json();
                    if (j.status === "cancelled") {
                      setQueue((qs) =>
                        qs.map((it) =>
                          it.id === r.id
                            ? { ...it, status: "cancelled", phase: "cancelled" }
                            : it,
                        ),
                      );
                      return;
                    }
                    setQueue((qs) =>
                      qs.map((it) =>
                        it.id === r.id
                          ? { ...it, progress: j.progress, phase: j.phase }
                          : it,
                      ),
                    );
                    if (j.status === "error") {
                      setQueue((qs) =>
                        qs.map((it) =>
                          it.id === r.id
                            ? { ...it, status: "error", error: j.error }
                            : it,
                        ),
                      );
                      return;
                    }
                    if (j.status === "done") {
                      setQueue((qs) =>
                        qs.map((it) =>
                          it.id === r.id
                            ? {
                                ...it,
                                status: "done",
                                progress: 100,
                                phase: "done",
                                title: j.final_name
                                  ? stripExt(j.final_name)
                                  : it.title,
                              }
                            : it,
                        ),
                      );
                      return;
                    }
                  }
                } finally {
                  activeWorkersRef.current.delete(r.id);
                }
              })();
            }
          }
        })
        .catch(() => {});
    });
  }, []);

  const stats = useMemo(() => {
    const done = queue.filter((it) => it.status === "done").length;
    const total = queue.length;
    const working = queue.filter(
      (it) => it.status === "working" || it.status === "queued",
    ).length;
    const failed = queue.filter((it) => it.status === "error").length;
    return { done, total, working, failed };
  }, [queue]);

  const folderLabel = outDir || `~${PATH_SEP}Music${PATH_SEP}yt`;
  // Top-right pill shows only the last segment so a custom path like
  // `D:\Audio\MyMix` doesn't blow up the chip — the full path is still
  // surfaced via the title attribute and aria-label.
  const folderBasename =
    folderLabel.split(/[\\/]+/).filter(Boolean).pop() || "yt";
  const pillLabel = `${PATH_SEP}${folderBasename}`;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden>
            <I.wave width="16" height="16" />
          </div>
          <div className="brand-text">
            <div className="brand-name">
              tapedeck<span className="brand-dot">.</span>local
            </div>
            <div className="brand-sub mono">v1.1 · runs on your machine</div>
          </div>
        </div>
        <div className="topbar-right">
          <button
            className="theme-toggle"
            onClick={() => setSettingsOpen(true)}
            title="settings"
            aria-label="settings"
          >
            <I.gear width="15" height="15" />
          </button>
          <button
            className="theme-toggle"
            onClick={() =>
              setTweak("theme", t.theme === "dark" ? "light" : "dark")
            }
            title={
              t.theme === "dark"
                ? "switch to light mode"
                : "switch to dark mode"
            }
            aria-label="toggle theme"
          >
            {t.theme === "dark" ? (
              <I.sun width="15" height="15" />
            ) : (
              <I.moon width="15" height="15" />
            )}
          </button>
          <button
            className="folder-pill mono"
            onClick={onRevealFolder}
            title={`open output folder — ${folderLabel}`}
            aria-label={`open output folder ${folderLabel}`}
          >
            <I.folder width="14" height="14" />
            <span>{pillLabel}</span>
          </button>
        </div>
      </header>

      <main className="stage">
        <section className="hero">
          <h1 className="title">
            <span className="title-mark" aria-hidden>
              <I.wave width="20" height="20" />
            </span>
            <span className="title-text">
              tapedeck<span className="brand-dot">.</span>local
            </span>
          </h1>
          <p className="hero-sub">
            Paste a link. Files land in{" "}
            <span className="lede-folder mono">{folderLabel}</span>. Nothing
            leaves your machine.
          </p>
        </section>

        <section className="panel">
          {clipboardHint && (
            <div className="clipboard-hint">
              <span className="mono dim">Clipboard:</span>
              <span className="mono hint-url">
                {clipboardHint.length > 64
                  ? clipboardHint.slice(0, 64) + "…"
                  : clipboardHint}
              </span>
              <button
                className="hint-cta"
                onClick={acceptClipboardHint}
                aria-label="add clipboard URL to queue"
              >
                add
              </button>
              <button
                className="hint-x"
                onClick={dismissClipboardHint}
                aria-label="dismiss clipboard hint"
              >
                ×
              </button>
            </div>
          )}

          <form className="inputbar" onSubmit={onSubmit}>
            <input
              id="urlinput"
              ref={inputRef}
              className="inputbar-input mono"
              placeholder={`paste a YouTube link (${PASTE_HINT}), then ↵ `}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoComplete="off"
              spellCheck="false"
            />
            <select
              className="toolbar-select mono"
              value={prefs.format}
              onChange={(e) => setPref("format", e.target.value)}
              title="format"
            >
              {FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            <select
              className="toolbar-select mono"
              value={prefs.quality}
              onChange={(e) => setPref("quality", e.target.value)}
              title="bitrate"
            >
              {QUALITIES.map((q) => (
                <option key={q} value={q}>
                  {q} kbps
                </option>
              ))}
            </select>
            <button
              type="button"
              className="inputbar-paste"
              onClick={onPasteBtn}
              title="paste from clipboard"
              aria-label="paste from clipboard"
            >
              <I.paste width="14" height="14" />
            </button>
            <button
              type="submit"
              className="inputbar-go"
              disabled={!input.trim()}
            >
              add
              <span className="kbd mono">↵</span>
            </button>
          </form>

          {queue.length === 0 ? (
            <div className="empty">
              <div className="empty-illus" aria-hidden>
                <div className="empty-bars">
                  {Array.from({ length: 24 }).map((_, i) => (
                    <span
                      key={i}
                      style={{
                        height: `${10 + Math.abs(Math.sin(i * 0.7)) * 28}px`,
                      }}
                    />
                  ))}
                </div>
              </div>
              <div className="empty-text">
                <div className="empty-title">Queue is empty</div>
                <div className="empty-sub">
                  Paste a link, drop one in, or hit {PASTE_HINT}.
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="bulk-strip">
                <div className="bulk-strip-left mono">
                  <span className="qh-strong">
                    {stats.total} {stats.total === 1 ? "track" : "tracks"}
                  </span>
                  {stats.working > 0 && (
                    <>
                      <span className="dot-sep">·</span>
                      <span>{stats.working} pending</span>
                    </>
                  )}
                  {stats.done > 0 && (
                    <>
                      <span className="dot-sep">·</span>
                      <span>{stats.done} saved</span>
                    </>
                  )}
                  {stats.failed > 0 && (
                    <>
                      <span className="dot-sep">·</span>
                      <span className="failed-count">
                        {stats.failed} failed
                      </span>
                    </>
                  )}
                </div>
                <div className="bulk-strip-right">
                  {stats.failed > 0 && (
                    <button className="ghostbtn mono" onClick={onRetryAll}>
                      retry failed
                    </button>
                  )}
                  {stats.done > 0 && (
                    <button className="ghostbtn mono" onClick={onClearDone}>
                      clear ✓
                    </button>
                  )}
                  {queue.length >= 2 && (
                    <button className="ghostbtn mono" onClick={onClearAll}>
                      clear all
                    </button>
                  )}
                </div>
              </div>
              <div className="queue">
                {queue.map((tr) => (
                  <TrackRow
                    key={tr.id}
                    track={tr}
                    accent={accent}
                    outDir={outDir}
                    onRemove={onRemove}
                    onRetry={onRetry}
                    onReveal={onReveal}
                    onPromote={onPromote}
                  />
                ))}
              </div>
            </>
          )}
        </section>
      </main>

      <footer className="footer">
        <div className="footer-accent" aria-hidden />
        <div className="footer-inner">
          <div className="footer-left">
            <span className="footer-mark" aria-hidden>
              <I.wave width="14" height="14" />
            </span>
            <span className="footer-brand">
              tapedeck<span className="brand-dot">.</span>local
            </span>
            <span className="footer-version mono">v1.1</span>
          </div>
          <div className="footer-right">
            <a
              className="footer-link"
              href="https://ko-fi.com/s/1bd08ce885"
              target="_blank"
              rel="noopener noreferrer"
              title="Buy me a coffee"
            >
              <I.coffee width="13" height="13" />
              <span>Coffee</span>
            </a>
            <a
              className="footer-link"
              href="mailto:me@cristiangabriel.dev"
              title="Email me"
            >
              <I.mail width="13" height="13" />
              <span>Contact</span>
            </a>
            <a
              className="footer-link mono"
              href="https://cristiangabriel.dev"
              target="_blank"
              rel="noopener noreferrer"
              title="Visit cristiangabriel.dev"
            >
              <span>cristiangabriel.dev</span>
              <span className="footer-arrow" aria-hidden>
                ↗
              </span>
            </a>
          </div>
        </div>
      </footer>

      <SettingsModal
        open={settingsOpen}
        currentDir={outDirAbs || outDir}
        currentTemplate={filenameTemplate}
        prefs={prefs}
        setPref={setPref}
        onClose={() => setSettingsOpen(false)}
        onSaved={({ out_dir, out_dir_abs, filename_template }) => {
          if (out_dir) setOutDir(out_dir);
          if (out_dir_abs) setOutDirAbs(out_dir_abs);
          if (filename_template) setFilenameTemplate(filename_template);
        }}
      />

      {dragOver && (
        <div className="dropzone-overlay" aria-hidden>
          <div className="dropzone-card">
            <I.wave width="28" height="28" />
            <div>Drop link to add</div>
          </div>
        </div>
      )}

      <window.TweaksPanel>
        <window.TweakSection label="Theme" />
        <window.TweakRadio
          label="Mode"
          value={t.theme}
          onChange={(v) => setTweak("theme", v)}
          options={["light", "dark"]}
        />
        <window.TweakSelect
          label="Accent"
          value={t.accent}
          onChange={(v) => setTweak("accent", v)}
          options={Object.entries(ACCENTS).map(([k, v]) => ({
            value: k,
            label: v.name,
          }))}
        />
        <window.TweakRadio
          label="Density"
          value={t.density}
          onChange={(v) => setTweak("density", v)}
          options={["comfy", "compact"]}
        />
      </window.TweaksPanel>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
