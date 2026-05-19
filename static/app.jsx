const { useState, useEffect, useRef, useMemo, useCallback } = React;

// ---------- helpers ----------
const cls = (...a) => a.filter(Boolean).join(' ');
const uid = () => Math.random().toString(36).slice(2, 9);
const stripExt = (n) => n.replace(/\.(mp3|m4a|opus|wav|flac|ogg)$/i, '');

const isMac = typeof navigator !== 'undefined' && /Mac|iP(hone|od|ad)/i.test(navigator.platform || '');
const PASTE_HINT = isMac ? '⌘V' : 'Ctrl+V';

const URL_RE = /^https?:\/\/\S+/i;
const YT_RE = /^https?:\/\/\S*(youtu\.?be|youtube\.com)\S*/i;

function splitUrls(raw) {
  if (Array.isArray(raw)) return raw.flatMap(splitUrls);
  return String(raw || '')
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter((s) => URL_RE.test(s));
}

const ACCENTS = {
  amber:   { name: 'Amber',   c: 'oklch(0.70 0.16 55)',  ink: 'oklch(0.20 0.04 60)' },
  forest:  { name: 'Forest',  c: 'oklch(0.55 0.12 155)', ink: '#fff' },
  ink:     { name: 'Ink',     c: 'oklch(0.22 0.02 270)', ink: '#fff' },
  coral:   { name: 'Coral',   c: 'oklch(0.68 0.18 25)',  ink: '#fff' },
};

// ---------- icons ----------
const I = {
  wave: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" {...p}>
      <path d="M3 12h2M7 8v8M11 5v14M15 9v6M19 11v2M21 12h.01"/>
    </svg>
  ),
  paste: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="8" y="2" width="8" height="4" rx="1"/>
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
    </svg>
  ),
  x: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" {...p}>
      <path d="M6 6l12 12M18 6L6 18"/>
    </svg>
  ),
  check: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M4 12l5 5L20 6"/>
    </svg>
  ),
  folder: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>
    </svg>
  ),
  dot: (p) => <svg viewBox="0 0 8 8" {...p}><circle cx="4" cy="4" r="3" fill="currentColor"/></svg>,
  spin: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}>
      <path d="M21 12a9 9 0 1 1-6.2-8.55" />
    </svg>
  ),
  reveal: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M5 12h14M13 6l6 6-6 6"/>
    </svg>
  ),
  sun: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
    </svg>
  ),
  moon: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  ),
  gear: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  coffee: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M4 9h13v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V9z"/>
      <path d="M17 11h2a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-2"/>
      <path d="M7 3v3M10 3v3M13 3v3"/>
    </svg>
  ),
  mail: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="5" width="18" height="14" rx="2"/>
      <path d="M3 7l9 6 9-6"/>
    </svg>
  ),
};

const QUALITIES = ['128', '192', '256', '320'];
const FORMATS = ['mp3', 'm4a', 'opus', 'wav', 'flac'];

// ---------- prefs (localStorage) ----------
function usePrefs() {
  const defaults = { format: 'mp3', quality: '320' };
  const [prefs, setPrefs] = useState(() => {
    try {
      const raw = localStorage.getItem('tapedeck.prefs');
      return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
    } catch {
      return defaults;
    }
  });
  const setPref = useCallback((k, v) => {
    setPrefs((p) => {
      const next = { ...p, [k]: v };
      try { localStorage.setItem('tapedeck.prefs', JSON.stringify(next)); } catch {}
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
        <span key={i} className={cls('eq-bar', playing && 'on')} style={{ animationDelay: `${i * 0.12}s` }}/>
      ))}
    </div>
  );
}

// ---------- one row ----------
function TrackRow({ track, accent, outDir, onRemove, onRetry, onReveal }) {
  const { id, status, phase, progress, title, channel, dur, url, error } = track;

  const statusNode = () => {
    if (status === 'fetching') return <span className="row-status fetching"><I.spin width="12" height="12" className="spin"/> resolving…</span>;
    if (status === 'queued')   return <span className="row-status queued"><I.dot width="6" height="6"/> queued</span>;
    if (status === 'working') {
      if (phase === 'converting') return <span className="row-status working">converting…</span>;
      return <span className="row-status working">downloading {Math.round(progress || 0)}%</span>;
    }
    if (status === 'done')     return <span className="row-status done"><I.check width="12" height="12"/> saved</span>;
    if (status === 'error')    return <span className="row-status error" title={error}>failed</span>;
    return null;
  };

  return (
    <div className={cls('row', `row-${status}`)}>
      <div className="row-thumb" aria-hidden>
        {status === 'fetching'
          ? <I.spin width="18" height="18" className="spin" />
          : status === 'working'
            ? <Equalizer playing />
            : status === 'done'
              ? <I.check width="18" height="18" />
              : <I.wave width="18" height="18" />}
      </div>

      <div className="row-main">
        <div className="row-title">
          {status === 'fetching' ? <span className="row-pending">resolving metadata…</span> : title}
        </div>
        <div className="row-meta">
          {status === 'fetching'
            ? <span className="mono dim">{url.length > 56 ? url.slice(0, 56) + '…' : url}</span>
            : <>
                <span>{channel}</span>
                <span className="dot-sep">·</span>
                <span className="mono">{dur}</span>
                {status === 'done' && outDir && <>
                  <span className="dot-sep">·</span>
                  <span className="mono dim">{outDir}</span>
                </>}
              </>}
        </div>
        {status === 'working' && (
          <div className="row-progress-inline" aria-hidden>
            <div className="row-progress-fill" style={{ width: `${progress || 0}%`, background: accent.c }}/>
          </div>
        )}
      </div>

      <div className="row-status-cell">{statusNode()}</div>

      <div className="row-actions">
        {status === 'error' && <button className="iconbtn" title="retry" onClick={() => onRetry(id)}><I.spin width="14" height="14"/></button>}
        {status === 'done' && <button className="iconbtn" title="reveal in folder" onClick={() => onReveal(id)}><I.reveal width="14" height="14"/></button>}
        <button className="iconbtn" title="remove" onClick={() => onRemove(id)}><I.x width="14" height="14"/></button>
      </div>
    </div>
  );
}

// ---------- settings modal ----------
function SettingsModal({ open, currentDir, onClose, onSaved }) {
  const [path, setPath] = useState(currentDir || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (open) {
      setPath(currentDir || '');
      setErr('');
      setBusy(false);
    }
  }, [open, currentDir]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = async (e) => {
    e?.preventDefault?.();
    const trimmed = path.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setErr('');
    try {
      const resp = await fetch('/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ out_dir: trimmed }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setErr(data.error || 'Could not save.');
        setBusy(false);
        return;
      }
      onSaved(data.out_dir || trimmed);
      onClose();
    } catch (e2) {
      setErr(e2.message || 'Network error.');
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form className="modal" onMouseDown={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="modal-head">
          <div className="modal-title">Settings</div>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="close">
            <I.x width="14" height="14"/>
          </button>
        </div>
        <div className="modal-body">
          <div className="modal-field">
            <label className="modal-label" htmlFor="out-dir-input">Output folder</label>
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
            <div className="modal-help">Files land here. The folder is created if it doesn't exist.</div>
          </div>
          {err && <div className="modal-error">{err}</div>}
        </div>
        <div className="modal-foot">
          <button type="button" className="ghostbtn mono" onClick={onClose} disabled={busy}>cancel</button>
          <button type="submit" className="inputbar-go" disabled={busy || !path.trim()}>
            {busy ? 'saving…' : 'save'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------- main app ----------
function App() {
  const [t, setTweak] = window.useTweaks({
    accent: 'amber',
    theme: 'light',
    density: 'comfy',
  });

  const accent = ACCENTS[t.accent] || ACCENTS.amber;

  const [prefs, setPref] = usePrefs();
  const [input, setInput] = useState('');
  const [queue, setQueue] = useState([]);
  const [outDir, setOutDir] = useState('');
  const [outDirAbs, setOutDirAbs] = useState('');
  const [clipboardHint, setClipboardHint] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const inputRef = useRef(null);
  const dismissedClipRef = useRef('');

  // theme + accent css vars
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = t.theme;
    root.dataset.density = t.density;
    root.style.setProperty('--accent', accent.c);
    root.style.setProperty('--accent-ink', accent.ink);
  }, [t.theme, t.density, accent]);

  // fetch real output dir
  useEffect(() => {
    fetch('/config').then((r) => r.json()).then((c) => {
      setOutDir(c.out_dir || '');
      setOutDirAbs(c.out_dir_abs || '');
    }).catch(() => {});
  }, []);

  // serial download worker
  const workerActiveRef = useRef(false);
  useEffect(() => {
    if (workerActiveRef.current) return;
    const next = queue.find((it) => it.status === 'queued');
    if (!next) return;
    workerActiveRef.current = true;

    (async () => {
      setQueue((q) => q.map((it) => it.id === next.id ? { ...it, status: 'working', progress: 0, phase: 'starting' } : it));
      try {
        const startResp = await fetch('/download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: next.url, quality: next.quality, format: next.format }),
        });
        if (!startResp.ok) {
          const data = await startResp.json().catch(() => ({ error: 'HTTP ' + startResp.status }));
          setQueue((q) => q.map((it) => it.id === next.id ? { ...it, status: 'error', error: data.error || 'download failed' } : it));
          return;
        }
        const { job_id, out_dir } = await startResp.json();
        if (out_dir) setOutDir(out_dir);
        setQueue((q) => q.map((it) => it.id === next.id ? { ...it, jobId: job_id } : it));

        while (true) {
          await new Promise((r) => setTimeout(r, 400));
          const pResp = await fetch(`/progress/${job_id}`);
          if (!pResp.ok) throw new Error('progress check failed');
          const job = await pResp.json();
          setQueue((q) => q.map((it) => it.id === next.id ? { ...it, progress: job.progress, phase: job.phase } : it));
          if (job.status === 'error') {
            setQueue((q) => q.map((it) => it.id === next.id ? { ...it, status: 'error', error: job.error || 'download failed' } : it));
            return;
          }
          if (job.status === 'done') {
            setQueue((q) => q.map((it) => it.id === next.id
              ? { ...it, status: 'done', progress: 100, phase: 'done', title: job.final_name ? stripExt(job.final_name) : it.title }
              : it));
            break;
          }
        }
      } catch (err) {
        setQueue((q) => q.map((it) => it.id === next.id ? { ...it, status: 'error', error: err.message || 'network error' } : it));
      } finally {
        workerActiveRef.current = false;
      }
    })();
  }, [queue]);

  // add one or many URLs
  const addUrls = useCallback((raw) => {
    const urls = splitUrls(raw);
    if (urls.length === 0) return;
    setQueue((q) => {
      const existing = new Set(q.map((it) => it.url));
      const fresh = urls.filter((u) => !existing.has(u));
      if (fresh.length === 0) return q;
      const newRows = fresh.map((url) => ({
        id: uid(),
        url,
        status: 'fetching',
        progress: 0,
        phase: 'fetching',
        title: '',
        channel: '',
        dur: '',
        quality: prefs.quality,
        format: prefs.format,
      }));
      newRows.forEach((row) => {
        fetch('/info', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: row.url }),
        }).then(async (resp) => {
          const data = await resp.json().catch(() => ({}));
          if (!resp.ok) {
            setQueue((qs) => qs.map((it) => it.id === row.id ? { ...it, status: 'error', error: data.error || 'lookup failed' } : it));
            return;
          }
          setQueue((qs) => qs.map((it) => it.id === row.id
            ? { ...it, status: 'queued', title: data.title || row.url, channel: data.channel || '', dur: data.duration || '' }
            : it));
        }).catch((err) => {
          setQueue((qs) => qs.map((it) => it.id === row.id ? { ...it, status: 'error', error: err.message || 'network error' } : it));
        });
      });
      return [...q, ...newRows];
    });
    setInput('');
  }, [prefs.quality, prefs.format]);

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
          const fresh = urls.find((u) => !existing.has(u) && u !== dismissedClipRef.current);
          if (fresh && !cancelled) setClipboardHint(fresh);
          return q;
        });
      } catch {
        // permission denied / focus required — ignore silently
      }
    };
    window.addEventListener('focus', tryRead);
    if (document.hasFocus()) tryRead();
    return () => { cancelled = true; window.removeEventListener('focus', tryRead); };
  }, []);

  useEffect(() => {
    if (!clipboardHint) return;
    const id = setTimeout(() => setClipboardHint(''), 8000);
    return () => clearTimeout(id);
  }, [clipboardHint]);

  const acceptClipboardHint = () => {
    if (!clipboardHint) return;
    addUrls(clipboardHint);
    setClipboardHint('');
  };
  const dismissClipboardHint = () => {
    dismissedClipRef.current = clipboardHint;
    setClipboardHint('');
  };

  // drag & drop on document
  useEffect(() => {
    let depth = 0;
    const onEnter = (e) => {
      const types = Array.from(e.dataTransfer?.types || []);
      if (!types.some((tp) => tp.startsWith('text/'))) return;
      e.preventDefault();
      depth++;
      setDragOver(true);
    };
    const onLeave = (e) => {
      e.preventDefault();
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragOver(false);
    };
    const onOver = (e) => { e.preventDefault(); };
    const onDrop = (e) => {
      e.preventDefault();
      depth = 0;
      setDragOver(false);
      const text = e.dataTransfer?.getData('text/uri-list') || e.dataTransfer?.getData('text/plain') || '';
      if (text) addUrls(text);
    };
    document.addEventListener('dragenter', onEnter);
    document.addEventListener('dragleave', onLeave);
    document.addEventListener('dragover', onOver);
    document.addEventListener('drop', onDrop);
    return () => {
      document.removeEventListener('dragenter', onEnter);
      document.removeEventListener('dragleave', onLeave);
      document.removeEventListener('dragover', onOver);
      document.removeEventListener('drop', onDrop);
    };
  }, [addUrls]);

  const onRemove = (id) => setQueue((qs) => qs.filter((it) => it.id !== id));
  const onRetry = (id) => setQueue((qs) => qs.map((it) => it.id === id ? { ...it, status: 'queued', error: null, progress: 0, phase: 'queued' } : it));
  const onReveal = (id) => {
    const row = queue.find((it) => it.id === id);
    if (!row || !row.jobId) return;
    fetch(`/reveal/${row.jobId}`, { method: 'POST' }).catch(() => {});
  };
  const onRevealFolder = () => {
    fetch('/reveal-folder', { method: 'POST' }).catch(() => {});
  };
  const onRetryAll = () => setQueue((qs) => qs.map((it) => it.status === 'error'
    ? { ...it, status: 'queued', error: null, progress: 0, phase: 'queued' } : it));
  const onClearDone = () => setQueue((qs) => qs.filter((it) => it.status !== 'done'));
  const onClearAll = () => {
    const active = queue.some((it) => it.status === 'working' || it.status === 'fetching');
    if (active && !window.confirm('A track is in progress. Clear everything anyway?')) return;
    setQueue([]);
  };

  const stats = useMemo(() => {
    const done = queue.filter((it) => it.status === 'done').length;
    const total = queue.length;
    const working = queue.filter((it) => it.status === 'working' || it.status === 'queued').length;
    const failed = queue.filter((it) => it.status === 'error').length;
    return { done, total, working, failed };
  }, [queue]);

  const folderLabel = outDir || '~/Music/yt';

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden>
            <I.wave width="16" height="16" />
          </div>
          <div className="brand-text">
            <div className="brand-name">tapedeck<span className="brand-dot">.</span>local</div>
            <div className="brand-sub mono">v1.0 · runs on your machine</div>
          </div>
        </div>
        <div className="topbar-right">
          <button
            className="theme-toggle"
            onClick={() => setSettingsOpen(true)}
            title="settings"
            aria-label="settings">
            <I.gear width="15" height="15" />
          </button>
          <button
            className="theme-toggle"
            onClick={() => setTweak('theme', t.theme === 'dark' ? 'light' : 'dark')}
            title={t.theme === 'dark' ? 'switch to light mode' : 'switch to dark mode'}
            aria-label="toggle theme">
            {t.theme === 'dark' ? <I.sun width="15" height="15" /> : <I.moon width="15" height="15" />}
          </button>
          <button className="folder-pill mono" onClick={onRevealFolder} title="open output folder">
            <I.folder width="14" height="14" />
            <span>{folderLabel}</span>
          </button>
        </div>
      </header>

      <main className="stage">
        <section className="hero">
          <h1 className="title">
            <span className="title-mark" aria-hidden>
              <I.wave width="20" height="20" />
            </span>
            <span className="title-text">tapedeck<span className="brand-dot">.</span>local</span>
          </h1>
          <p className="hero-sub">
            Paste a link. Files land in <span className="lede-folder mono">{folderLabel}</span>. Nothing leaves your machine.
          </p>
        </section>

        <section className="panel">

          {clipboardHint && (
            <div className="clipboard-hint">
              <span className="mono dim">Clipboard:</span>
              <span className="mono hint-url">{clipboardHint.length > 64 ? clipboardHint.slice(0, 64) + '…' : clipboardHint}</span>
              <button className="hint-cta" onClick={acceptClipboardHint}>add</button>
              <button className="hint-x" onClick={dismissClipboardHint} aria-label="dismiss">×</button>
            </div>
          )}

          <form className="inputbar" onSubmit={onSubmit}>
            <input
              id="urlinput"
              ref={inputRef}
              className="inputbar-input mono"
              placeholder={`paste a YouTube link, then ↵ (${PASTE_HINT})`}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoComplete="off"
              spellCheck="false"
            />
            <select
              className="toolbar-select mono"
              value={prefs.format}
              onChange={(e) => setPref('format', e.target.value)}
              title="format">
              {FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <select
              className="toolbar-select mono"
              value={prefs.quality}
              onChange={(e) => setPref('quality', e.target.value)}
              title="bitrate">
              {QUALITIES.map((q) => <option key={q} value={q}>{q} kbps</option>)}
            </select>
            <button type="button" className="inputbar-paste" onClick={onPasteBtn} title="paste from clipboard">
              <I.paste width="14" height="14" />
            </button>
            <button type="submit" className="inputbar-go" disabled={!input.trim()}>
              add
              <span className="kbd mono">↵</span>
            </button>
          </form>

          {queue.length === 0 ? (
            <div className="empty">
              <div className="empty-illus" aria-hidden>
                <div className="empty-bars">
                  {Array.from({ length: 24 }).map((_, i) => (
                    <span key={i} style={{ height: `${10 + Math.abs(Math.sin(i * 0.7)) * 28}px` }}/>
                  ))}
                </div>
              </div>
              <div className="empty-text">
                <div className="empty-title">Queue is empty</div>
                <div className="empty-sub">Paste a link, drop one in, or hit {PASTE_HINT}.</div>
              </div>
            </div>
          ) : (
            <>
              <div className="bulk-strip">
                <div className="bulk-strip-left mono">
                  <span className="qh-strong">{stats.total} {stats.total === 1 ? 'track' : 'tracks'}</span>
                  {stats.working > 0 && <><span className="dot-sep">·</span><span>{stats.working} pending</span></>}
                  {stats.done > 0    && <><span className="dot-sep">·</span><span>{stats.done} saved</span></>}
                  {stats.failed > 0  && <><span className="dot-sep">·</span><span className="failed-count">{stats.failed} failed</span></>}
                </div>
                <div className="bulk-strip-right">
                  {stats.failed > 0 && <button className="ghostbtn mono" onClick={onRetryAll}>retry failed</button>}
                  {stats.done > 0   && <button className="ghostbtn mono" onClick={onClearDone}>clear ✓</button>}
                  {queue.length >= 2 && <button className="ghostbtn mono" onClick={onClearAll}>clear all</button>}
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
            <div className="footer-brand-row">
              <span className="footer-mark" aria-hidden><I.wave width="13" height="13" /></span>
              <span className="footer-brand">tapedeck<span className="brand-dot">.</span>local</span>
              <span className="footer-version mono">v1.0</span>
            </div>
            <div className="footer-tagline mono">Local audio extraction · yt-dlp + ffmpeg</div>
          </div>
          <div className="footer-right">
            <a
              className="footer-link"
              href="https://ko-fi.com/s/1bd08ce885"
              target="_blank"
              rel="noopener noreferrer"
              title="Buy me a coffee">
              <I.coffee width="13" height="13" />
              <span>Coffee</span>
            </a>
            <a
              className="footer-link"
              href="mailto:me@cristiangabriel.dev"
              title="Email me">
              <I.mail width="13" height="13" />
              <span>Contact</span>
            </a>
            <a
              className="footer-link mono"
              href="https://cristiangabriel.dev"
              target="_blank"
              rel="noopener noreferrer"
              title="Visit cristiangabriel.dev">
              <span>cristiangabriel.dev</span>
              <span className="footer-arrow" aria-hidden>↗</span>
            </a>
          </div>
        </div>
      </footer>

      <SettingsModal
        open={settingsOpen}
        currentDir={outDirAbs || outDir}
        onClose={() => setSettingsOpen(false)}
        onSaved={(displayPath) => {
          setOutDir(displayPath);
          fetch('/config').then((r) => r.json()).then((c) => {
            setOutDir(c.out_dir || displayPath);
            setOutDirAbs(c.out_dir_abs || '');
          }).catch(() => {});
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
          onChange={(v) => setTweak('theme', v)}
          options={['light', 'dark']}
        />
        <window.TweakSelect
          label="Accent"
          value={t.accent}
          onChange={(v) => setTweak('accent', v)}
          options={Object.entries(ACCENTS).map(([k, v]) => ({ value: k, label: v.name }))}
        />
        <window.TweakRadio
          label="Density"
          value={t.density}
          onChange={(v) => setTweak('density', v)}
          options={['comfy', 'compact']}
        />
      </window.TweaksPanel>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
