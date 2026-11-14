// Bài của bạn: đọc file MIDI (.mid) → chia đoạn → tập từng đoạn bằng bộ máy bài tập.
(function (PD) {
  // ---------- đọc Standard MIDI File ----------
  PD.parseMidiFile = function (buf) {
    const d = new DataView(buf); let p = 0;
    const str = (n) => { let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(d.getUint8(p + i)); p += n; return s; };
    const u32 = () => { const v = d.getUint32(p); p += 4; return v; }; const u16 = () => { const v = d.getUint16(p); p += 2; return v; };
    const vlq = () => { let v = 0, b; do { b = d.getUint8(p++); v = (v << 7) | (b & 0x7f); } while (b & 0x80); return v; };
    if (str(4) !== 'MThd') throw new Error('Không phải file MIDI');
    const hl = u32(); const fmt = u16(); const ntr = u16(); const div = u16(); p += hl - 6;
    if (div & 0x8000) throw new Error('File MIDI dạng SMPTE chưa hỗ trợ');
    const notes = []; const tempos = []; let tsig = [4, 4];
    for (let t = 0; t < ntr && p < d.byteLength; t++) {
      if (str(4) !== 'MTrk') break; const len = u32(); const end = p + len; let tick = 0, run = 0; const open = {};
      while (p < end) {
        tick += vlq(); let st = d.getUint8(p);
        if (st & 0x80) p++; else st = run;
        const type = st & 0xf0, ch = st & 0x0f;
        if (st === 0xff) { const mt = d.getUint8(p++); const ml = vlq();
          if (mt === 0x51) tempos.push({ tick, us: (d.getUint8(p) << 16) | (d.getUint8(p + 1) << 8) | d.getUint8(p + 2) });
          if (mt === 0x58) tsig = [d.getUint8(p), 2 ** d.getUint8(p + 1)];
          p += ml; continue; }
        if (st === 0xf0 || st === 0xf7) { p += vlq(); continue; }
        run = st;
        if (type === 0x90 || type === 0x80) {
          const n = d.getUint8(p++), v = d.getUint8(p++); const k = ch + ':' + n;
          if (type === 0x90 && v > 0) { open[k] = { n, tick, track: t, ch, vel: v }; }
          else if (open[k]) { const o = open[k]; o.dur = tick - o.tick; notes.push(o); delete open[k]; }
        } else if (type === 0xc0 || type === 0xd0) p += 1; else p += 2;
      }
      p = end;
    }
    notes.sort((a, b) => a.tick - b.tick || a.n - b.n);
    const bpm = tempos.length ? Math.round(60000000 / tempos[0].us) : 120;
    return { ppq: div, notes, bpm, tsig, tempos, format: fmt, tracks: ntr };
  };

  // gom nốt bắt đầu gần nhau thành 1 bước (hợp âm); hand: 'R' | 'L' | 'B'
  PD.songToSections = function (mid, hand = 'R', barsPer = 2, split = 60) {
    const tracks = [...new Set(mid.notes.map((x) => x.track))];
    const pick = (x) => {
      if (hand === 'B') return true;
      if (tracks.length === 2) return hand === 'R' ? x.track === tracks[0] : x.track === tracks[1];
      return hand === 'R' ? x.n >= split : x.n < split;
    };
    const ns = mid.notes.filter(pick); const tol = mid.ppq / 8;
    const steps = [];
    for (const x of ns) {
      const last = steps[steps.length - 1];
      if (last && x.tick - last.tick <= tol) { if (!last.notes.includes(x.n)) last.notes.push(x.n); }
      else steps.push({ tick: x.tick, notes: [x.n] });
    }
    steps.forEach((s, i) => { const next = steps[i + 1]; s.b = Math.max(0.25, Math.round(((next ? next.tick : s.tick + mid.ppq) - s.tick) / mid.ppq * 4) / 4); s.label = s.notes.map(PD.pcName).join(' '); });
    const barTicks = mid.ppq * mid.tsig[0] * (4 / mid.tsig[1]);
    const secs = [];
    steps.forEach((s) => { const k = Math.floor(s.tick / (barTicks * barsPer)); (secs[k] = secs[k] || []).push(s); });
    return secs.filter(Boolean).map((st, i) => {
      // khoảng nốt để vẽ bàn phím
      const all = st.flatMap((s) => s.notes); let lo = Math.min(...all), hi = Math.max(...all);
      lo = lo - (lo % 12); hi = hi + (12 - (hi % 12)) % 12; if (hi - lo < 24) hi = lo + 24;
      // phách cuối mỗi đoạn không kéo sang đoạn sau
      const copy = st.map((s) => ({ ...s })); copy[copy.length - 1].b = Math.min(copy[copy.length - 1].b, 2);
      return { i, steps: copy, low: lo, high: hi };
    });
  };
})(window.PD);
