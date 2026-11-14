// Lõi: tên nốt, âm thanh, máy đếm nhịp, MIDI, bàn phím trên màn hình, lưu tiến độ.
// Script thường (không module) để mở thẳng file:// vẫn chạy.
window.PD = window.PD || {};

(function (PD) {
  // ---------- tên nốt ----------
  const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const SOLFA = { C: 'Đô', D: 'Rê', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Si' };
  const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  PD.NAMES = NAMES;
  PD.midi = function (s) {
    if (typeof s === 'number') return s;
    const m = /^([A-G])([#b]?)(-?\d)$/.exec(String(s).trim());
    if (!m) throw new Error('Nốt không hợp lệ: ' + s);
    return 12 * (Number(m[3]) + 1) + PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  };
  PD.name = (n) => NAMES[n % 12] + (Math.floor(n / 12) - 1);
  PD.pcName = (n) => NAMES[((n % 12) + 12) % 12];
  PD.solfa = (n) => SOLFA[NAMES[n % 12]] || '';
  PD.isBlack = (n) => NAMES[n % 12].includes('#');
  // "C4+E4+G4" → [60,64,67]
  PD.chord = (s) => (Array.isArray(s) ? s : String(s).split('+')).map(PD.midi);

  // ---------- âm thanh (piano tổng hợp đơn giản; đàn thật tự kêu khi bạn đánh) ----------
  let ctx = null;
  PD.audio = function () {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };
  PD.playNote = function (n, when = 0, dur = 1.2, vel = 0.7) {
    if (PD.outReady()) {
      setTimeout(() => PD.noteOn(n, Math.round(vel * 110)), when * 1000);
      setTimeout(() => PD.noteOff(n), (when + dur) * 1000);
      return;
    }
    const c = PD.audio();
    const t = c.currentTime + when;
    const f = 440 * Math.pow(2, (n - 69) / 12);
    const out = c.createGain();
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = Math.min(9000, f * 6);
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(0.28 * vel, t + 0.008);
    out.gain.exponentialRampToValueAtTime(0.09 * vel, t + 0.35);
    out.gain.exponentialRampToValueAtTime(0.0008, t + dur + 0.8);
    [[1, 'triangle', 1], [2, 'sine', 0.35], [3, 'sine', 0.12]].forEach(([mult, type, g]) => {
      const o = c.createOscillator(); const og = c.createGain();
      o.type = type; o.frequency.value = f * mult; og.gain.value = g;
      o.connect(og); og.connect(lp); o.start(t); o.stop(t + dur + 1);
    });
    lp.connect(out); out.connect(c.destination);
  };
  PD.playSynth = function (n, when, dur, vel) { const o = OUT; OUT = null; try { PD.playNote(n, when, dur, vel); } finally { OUT = o; } };
  PD.playChord = (notes, when = 0, dur = 1.6) => notes.forEach((n) => PD.playNote(n, when, dur));
  // phát chuỗi: [{notes:[...], beats}] ở bpm
  PD.playSeq = function (steps, bpm = 70) {
    const beat = 60 / bpm; let t = 0.05;
    steps.forEach((s) => { PD.playChord(s.notes, t, s.beats * beat * 0.95); t += s.beats * beat; });
    return t;
  };
  PD.click = function (when, accent) {
    const c = PD.audio(); const o = c.createOscillator(); const g = c.createGain();
    o.frequency.value = accent ? 1600 : 1050;
    g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(accent ? 0.35 : 0.22, when + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
    o.connect(g); g.connect(c.destination); o.start(when); o.stop(when + 0.06);
  };

  // Máy đếm nhịp: lên lịch theo đồng hồ âm thanh; trả về hàm đổi số phách → giờ performance.now()
  PD.Metronome = function (bpm, beatsPerBar, onBeat) {
    const c = PD.audio();
    const beatSec = 60 / bpm;
    const lat = (c.outputLatency || c.baseLatency || 0);
    const audio0 = c.currentTime + 0.25;
    const perf0 = performance.now() + 250 + lat * 1000;
    let k = 0, timer = null, stopped = false;
    function pump() {
      if (stopped) return;
      while (audio0 + k * beatSec < c.currentTime + 0.3) {
        const when = audio0 + k * beatSec; const beat = k;
        PD.click(when, k % beatsPerBar === 0);
        const delay = Math.max(0, (when - c.currentTime) * 1000 + lat * 1000);
        setTimeout(() => { if (!stopped && onBeat) onBeat(beat); }, delay);
        k++;
      }
      timer = setTimeout(pump, 60);
    }
    pump();
    return { beatTime: (b) => perf0 + b * beatSec * 1000, beatMs: beatSec * 1000, stop() { stopped = true; clearTimeout(timer); } };
  };

  // ---------- nhập nốt: MIDI + bấm chuột + bàn phím máy tính ----------
  const listeners = new Set();
  PD.onInput = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
  function emit(ev) { listeners.forEach((fn) => { try { fn(ev); } catch (e) { console.error(e); } }); }
  PD.emit = emit;
  PD.midiState = { connected: false, names: [] };
  let OUT = null; const sent = {};
  PD.outReady = () => !!OUT && PD.useOut();
  PD.useOut = () => { try { return localStorage.getItem('pianoDaily.out') !== '0'; } catch (e) { return true; } };
  PD.setUseOut = (v) => { try { localStorage.setItem('pianoDaily.out', v ? '1' : '0'); } catch (e) { /* */ } };
  PD.noteOn = function (n, vel = 80) {
    if (PD.outReady()) { sent[n] = performance.now(); OUT.send([0x90, n, Math.max(1, Math.min(127, vel))]); return; }
    PD.playSynth(n, 0, 0.9, vel / 127);
  };
  PD.noteOff = function (n) { if (PD.outReady()) { sent[n] = performance.now(); OUT.send([0x80, n, 0]); } };
  PD.allNotesOff = function () { if (OUT) for (let n = 21; n <= 108; n++) OUT.send([0x80, n, 0]); };
  PD.connectMIDI = async function (onChange) {
    if (!navigator.requestMIDIAccess) { onChange && onChange('Trình duyệt không hỗ trợ MIDI (dùng Chrome).'); return; }
    try {
      const acc = await navigator.requestMIDIAccess();
      const bind = () => {
        const ins = [...acc.inputs.values()];
        ins.forEach((i) => {
          i.onmidimessage = (e) => {
            const [cmd, a, b] = e.data; const type = cmd & 0xf0;
            if ((type === 0x90 || type === 0x80) && sent[a] && e.timeStamp - sent[a] < 120) return; // tiếng vọng nốt web vừa gửi
            if (type === 0x90 && b > 0) emit({ type: 'on', note: a, vel: b, t: e.timeStamp, src: 'midi' });
            else if (type === 0x80 || (type === 0x90 && b === 0)) emit({ type: 'off', note: a, t: e.timeStamp, src: 'midi' });
            else if (type === 0xb0 && a === 64) emit({ type: 'pedal', down: b >= 64, t: e.timeStamp, src: 'midi' });
          };
        });
        const outs = [...acc.outputs.values()];
        OUT = outs.find((o) => ins.some((i) => i.name === o.name)) || outs[0] || null;
        if (OUT && OUT.connection !== 'open') OUT.open().catch(() => {});
        PD.midiState = { connected: ins.length > 0, names: ins.map((i) => i.name), out: OUT ? OUT.name : null };
        onChange && onChange();
      };
      bind(); acc.onstatechange = bind;
    } catch (e) { onChange && onChange('Không xin được quyền MIDI: ' + e.message); }
  };
  // bàn phím máy tính (khi chưa nối đàn): hàng A S D F G H J K = C4..C5, W E T Y U = phím đen
  const KEYMAP = { a: 60, w: 61, s: 62, e: 63, d: 64, f: 65, t: 66, g: 67, y: 68, h: 69, u: 70, j: 71, k: 72, o: 73, l: 74 };
  let octShift = 0; const down = new Set();
  window.addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('input,textarea,select')) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'z') { octShift -= 12; return; } if (k === 'x') { octShift += 12; return; }
    if (!(k in KEYMAP) || down.has(k)) return;
    down.add(k); const n = KEYMAP[k] + octShift; PD.playNote(n);
    emit({ type: 'on', note: n, vel: 80, t: e.timeStamp, src: 'kbd' });
  });
  window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase(); if (!down.has(k)) return; down.delete(k);
    emit({ type: 'off', note: KEYMAP[k] + octShift, t: e.timeStamp, src: 'kbd' });
  });

  // ---------- bàn phím trên màn hình ----------
  // opts: {low, high, labels: {midi: text}, highlight: [midi], bigLabels, interactive}
  PD.Keyboard = function (container, opts = {}) {
    const low = PD.midi(opts.low ?? 'C3'), high = PD.midi(opts.high ?? 'C5');
    const el = document.createElement('div'); el.className = 'kb';
    const wrap = document.createElement('div'); wrap.className = 'kbwrap'; wrap.appendChild(el);
    container.appendChild(wrap);
    const keys = {}; const whites = [];
    for (let n = low; n <= high; n++) if (!PD.isBlack(n)) whites.push(n);
    const ww = 100 / whites.length;
    if (whites.length > 22 && !opts.fit) el.style.minWidth = (whites.length * 26) + 'px';
    whites.forEach((n, i) => { const d = document.createElement('div'); d.className = 'w'; d.style.left = (i * ww) + '%'; d.style.width = ww + '%'; el.appendChild(d); keys[n] = d; });
    for (let n = low; n <= high; n++) if (PD.isBlack(n)) {
      const i = whites.indexOf(n - 1); if (i < 0) continue;
      const d = document.createElement('div'); d.className = 'b';
      d.style.left = ((i + 1) * ww - ww * 0.32) + '%'; d.style.width = (ww * 0.64) + '%'; el.appendChild(d); keys[n] = d;
    }
    function label(n, text) {
      const k = keys[n]; if (!k) return; let l = k.querySelector('.lbl');
      if (!text) { if (l) l.remove(); return; }
      if (!l) { l = document.createElement('div'); l.className = 'lbl' + (opts.bigLabels ? ' big' : ''); k.appendChild(l); }
      l.textContent = text;
    }
    const api = {
      keys,
      highlight(list) { Object.values(keys).forEach((k) => k.classList.remove('hl')); (list || []).forEach((n) => keys[n] && keys[n].classList.add('hl')); },
      labels(map) { Object.keys(keys).forEach((n) => label(Number(n), map && map[n])); },
      flash(n, cls = 'hit', ms = 280) { const k = keys[n]; if (!k) return; k.classList.add(cls); setTimeout(() => k.classList.remove(cls), ms); },
      press(n, on) { const k = keys[n]; if (!k) return; k.classList.toggle('hit', on); },
      destroy() { off(); wrap.remove(); },
    };
    if (opts.labels) api.labels(opts.labels);
    if (opts.highlight) api.highlight(opts.highlight);
    // bấm chuột/chạm
    Object.entries(keys).forEach(([n, k]) => {
      k.addEventListener('pointerdown', (e) => {
        e.preventDefault(); const m = Number(n); PD.playNote(m);
        emit({ type: 'on', note: m, vel: 80, t: performance.now(), src: 'mouse' });
        setTimeout(() => emit({ type: 'off', note: m, t: performance.now(), src: 'mouse' }), 250);
      });
    });
    // hiển thị phím đang bấm
    const off = PD.onInput((ev) => {
      if (!el.isConnected) return;
      if (ev.type === 'on') api.press(ev.note, true);
      else if (ev.type === 'off') { const k = keys[ev.note]; if (k) setTimeout(() => k.classList.remove('hit'), 200); }
    });
    return api;
  };

  // ---------- lưu tiến độ ----------
  const KEY = 'pianoDaily.v1';
  const blank = () => ({ day: 1, done: {}, ex: {}, review: [], songs: [], sessions: {}, settings: { minutes: 30 }, created: PD.today() });
  PD.today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  PD.load = function () { try { const s = JSON.parse(localStorage.getItem(KEY)); return s ? Object.assign(blank(), s) : blank(); } catch (e) { return blank(); } };
  PD.save = function (s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { console.warn('Không lưu được', e); } };
  // chuỗi ngày: lỡ 1 ngày vẫn giữ chuỗi
  PD.streak = function (s) {
    const days = new Set(Object.entries(s.sessions || {}).filter(([, v]) => v && v.finished).map(([k]) => k));
    let n = 0, gap = 0; const d = new Date();
    if (!days.has(PD.today())) d.setDate(d.getDate() - 1); // hôm nay chưa học thì tính từ hôm qua
    for (let i = 0; i < 400; i++) {
      const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      if (days.has(k)) { n++; gap = 0; } else { gap++; if (gap > 1) break; }
      d.setDate(d.getDate() - 1);
    }
    return n;
  };
  PD.esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  PD.md = (s) => PD.esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>');
})(window.PD);
