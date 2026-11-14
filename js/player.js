// Màn hình nốt rơi cho bài hát: nốt rơi xuống đúng phím, chế độ chờ, tốc độ, lặp đoạn, tự chơi tay kia.
(function (PD) {
  // đổi tick → giây theo bản đồ tempo
  function tickToSec(mid) {
    const tempos = (mid.tempos && mid.tempos.length ? mid.tempos.slice() : [{ tick: 0, us: 60000000 / (mid.bpm || 120) }]).sort((a, b) => a.tick - b.tick);
    if (tempos[0].tick > 0) tempos.unshift({ tick: 0, us: 500000 });
    return (tick) => {
      let s = 0;
      for (let i = 0; i < tempos.length; i++) {
        const a = tempos[i], b = tempos[i + 1];
        const endT = b && b.tick < tick ? b.tick : tick;
        if (endT > a.tick) s += (endT - a.tick) / mid.ppq * a.us / 1e6;
        if (!b || b.tick >= tick) break;
      }
      return s;
    };
  }

  PD.buildSong = function (mid, split = 60) {
    const sec = tickToSec(mid);
    const tracks = [...new Set(mid.notes.map((x) => x.track))].sort((a, b) => a - b);
    const notes = mid.notes.map((x) => ({
      n: x.n, start: sec(x.tick), end: sec(x.tick + (x.dur || mid.ppq / 2)), vel: x.vel || 80,
      hand: tracks.length === 2 ? (x.track === tracks[0] ? 'R' : 'L') : (x.n >= split ? 'R' : 'L'),
    }));
    // ô nhịp → giây để chia đoạn
    const barTicks = mid.ppq * mid.tsig[0] * (4 / mid.tsig[1]);
    const lastTick = Math.max(...mid.notes.map((x) => x.tick + (x.dur || 0)));
    const bars = []; for (let t = 0; t <= lastTick + barTicks; t += barTicks) bars.push(sec(t));
    const lo = Math.min(...notes.map((x) => x.n)), hi = Math.max(...notes.map((x) => x.n));
    return { notes, bars, length: Math.max(...notes.map((x) => x.end)), low: Math.max(21, lo - (lo % 12)), high: Math.min(108, hi + ((12 - (hi % 12)) % 12)) };
  };

  PD.Player = function (root, song, opts = {}) {
    root.innerHTML = `
      <div class="row small sans" style="gap:6px">
        <span>Bạn chơi:</span>
        <select data-r="hand"><option value="R">Tay phải (máy chơi tay trái)</option><option value="L">Tay trái (máy chơi tay phải)</option><option value="B">Hai tay</option><option value="N">Chỉ nghe</option></select>
        <span>Đoạn:</span><select data-r="sec"></select>
        <label><input type="checkbox" data-r="wait" checked> Chờ bấm đúng</label>
      </div>
      <div class="row small sans" style="gap:6px;margin-top:6px">
        <span>Tốc độ</span><input type="range" min="30" max="100" step="5" value="60" data-r="speed"><span data-r="spv">60%</span>
        <label><input type="checkbox" data-r="loop" checked> Lặp đoạn</label>
      </div>
      <div style="position:relative;margin-top:10px"><canvas data-r="cv" style="width:100%;height:260px;display:block;background:var(--card);border:1px solid var(--line);border-bottom:none;border-radius:8px 8px 0 0"></canvas></div>
      <div data-r="kb" style="margin-top:-14px"></div>
      <div class="row"><button class="btn primary" data-r="play">▶ Chơi</button><button class="btn" data-r="back">⟲ Về đầu đoạn</button><span class="spacer"></span><span class="sans small" data-r="stat"></span></div>`;
    const $ = (r) => root.querySelector(`[data-r="${r}"]`);
    const kb = PD.Keyboard($('kb'), { low: song.low, high: song.high, fit: true });
    const cv = $('cv'); const g = cv.getContext('2d');
    const css = getComputedStyle(document.documentElement);
    const COL = { R: css.getPropertyValue('--accent').trim() || '#a4532c', L: css.getPropertyValue('--good').trim() || '#4f7a4a', line: css.getPropertyValue('--line').trim() || '#ddd' };

    // đoạn = 2 ô nhịp
    const per = 2; const secs = [];
    for (let i = 0; i + 1 < song.bars.length; i += per) { const a = song.bars[i], b = song.bars[Math.min(i + per, song.bars.length - 1)]; if (song.notes.some((x) => x.start >= a - 0.01 && x.start < b - 0.01)) secs.push([a, b, i / per]); }
    $('sec').innerHTML = `<option value="all">Cả bài</option>` + secs.map((s, j) => `<option value="${j}">Đoạn ${j + 1} (ô ${s[2] * per + 1}–${s[2] * per + per})</option>`).join('');
    if (opts.hand) $('hand').value = opts.hand;
    if (opts.section != null) $('sec').value = String(opts.section);

    let t = 0, playing = false, last = 0, raf = null, speed = 0.6;
    let range = [0, song.length + 0.5];
    const held = new Set(); let st = { hit: 0, miss: 0, wrong: 0 };
    const autoOn = new Set();
    const mine = (x) => { const h = $('hand').value; return h === 'B' || x.hand === h; };
    const auto = (x) => { const h = $('hand').value; return h === 'N' || (h !== 'B' && x.hand !== h); };
    function setRange() {
      const v = $('sec').value; range = v === 'all' ? [0, song.length + 0.5] : [secs[v][0], secs[v][1]];
      reset();
    }
    function reset() {
      allOff(); t = range[0] - 1.2; st = { hit: 0, miss: 0, wrong: 0 };
      song.notes.forEach((x) => { x.done = false; x.miss = false; x.sent = false; });
      stat();
    }
    function allOff() { autoOn.forEach((n) => PD.noteOff(n)); autoOn.clear(); }
    function stat() {
      const tot = st.hit + st.miss + st.wrong;
      $('stat').textContent = tot ? `Đúng ${st.hit} · trượt ${st.miss} · sai ${st.wrong} · ${Math.round(100 * st.hit / Math.max(1, tot))}%` : '';
    }

    // nốt của bạn đang tới hạn (chế độ chờ)
    function dueGroup() {
      const pend = song.notes.filter((x) => mine(x) && !x.done && x.start >= range[0] - 0.01 && x.start < range[1] - 0.01 && x.start <= t + 0.001);
      if (!pend.length) return null;
      const s0 = Math.min(...pend.map((x) => x.start));
      return song.notes.filter((x) => mine(x) && !x.done && Math.abs(x.start - s0) < 0.04);
    }

    const unsub = PD.onInput((ev) => {
      if (ev.type === 'off') { held.delete(ev.note); return; }
      if (ev.type !== 'on' || !root.isConnected) return;
      held.add(ev.note);
      if (!playing || $('hand').value === 'N') return;
      // tìm nốt của bạn gần thời điểm hiện tại
      const win = $('wait').checked ? 0.6 : 0.18 * Math.max(0.6, 1 / speed);
      let best = null, bd = 1e9;
      for (const x of song.notes) {
        if (!mine(x) || x.done || x.n !== ev.note) continue;
        const d = Math.abs(x.start - t); if (d < win && d < bd && x.start >= range[0] - 0.01 && x.start < range[1]) { best = x; bd = d; }
      }
      if (best) { best.done = true; st.hit++; } else { st.wrong++; kb.flash(ev.note, 'wrong'); }
      stat();
    });

    function frame(now) {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (playing) {
        let nt = t + dt * speed;
        if ($('wait').checked && $('hand').value !== 'N') {
          const grp = dueGroup();
          if (grp) nt = Math.min(nt, Math.min(...grp.map((x) => x.start))); // đứng chờ
        }
        // máy chơi tay kia
        for (const x of song.notes) {
          if (!auto(x) || x.sent || x.start < range[0] - 0.01 || x.start >= range[1]) continue;
          if (x.start <= nt) {
            x.sent = true; const dur = Math.max(0.08, (x.end - x.start) / speed);
            PD.noteOn(x.n, Math.round(x.vel * 0.8)); autoOn.add(x.n);
            setTimeout(() => { PD.noteOff(x.n); autoOn.delete(x.n); }, dur * 1000);
          }
        }
        // nốt bị bỏ qua (không chờ)
        if (!$('wait').checked) for (const x of song.notes) if (mine(x) && !x.done && !x.miss && x.start < nt - 0.25 && x.start >= range[0]) { x.miss = true; st.miss++; stat(); }
        t = nt;
        if (t >= range[1]) {
          const res = { ...st, section: $('sec').value, hand: $('hand').value, wait: $('wait').checked, speed };
          if ($('loop').checked) { reset(); t = range[0] - 1.2; } else { playing = false; $('play').textContent = '▶ Chơi'; allOff(); }
          if (opts.onLoop) { const m = opts.onLoop(res); if (m) $('stat').textContent = m; }
        }
      }
      draw();
      raf = requestAnimationFrame(frame);
    }

    function keyX(n) { const k = kb.keys[n]; if (!k) return null; return { x: k.offsetLeft, w: k.offsetWidth, black: PD.isBlack(n) }; }
    function draw() {
      const dpr = window.devicePixelRatio || 1; const W = cv.clientWidth, H = cv.clientHeight;
      const kbEl = kb.keys[song.low].parentElement; const scale = W / kbEl.clientWidth;
      if (cv.width !== W * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
      const pps = H / 3; // 3 giây nhìn trước
      // vạch ô nhịp
      g.strokeStyle = COL.line; g.lineWidth = 1;
      song.bars.forEach((b) => { const y = H - (b - t) * pps; if (y > 0 && y < H) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } });
      // vùng đoạn
      if ($('sec').value !== 'all') { g.fillStyle = 'rgba(128,128,128,.06)'; const y1 = H - (range[1] - t) * pps; g.fillRect(0, Math.max(0, y1), W, H); }
      const upcoming = new Set();
      for (const x of song.notes) {
        const y2 = H - (x.start - t) * pps, y1 = H - (x.end - t) * pps;
        if (y2 < 0 || y1 > H) continue;
        const k = keyX(x.n); if (!k) continue;
        const pad = k.black ? 1 : 3;
        const isMine = mine(x) && $('hand').value !== 'N';
        g.globalAlpha = x.done ? 0.25 : x.miss ? 0.35 : isMine ? 1 : 0.45;
        g.fillStyle = x.miss ? '#b0442f' : COL[x.hand];
        const h = Math.max(6, y2 - y1);
        roundRect(g, k.x * scale + pad, y2 - h, k.w * scale - pad * 2, h, 4); g.fill();
        if (isMine && !x.done && x.start - t < 0.6 && x.start - t > -0.3) upcoming.add(x.n);
      }
      g.globalAlpha = 1;
      kb.highlight([...upcoming]);
    }
    function roundRect(c, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

    $('play').onclick = () => { PD.audio(); playing = !playing; $('play').textContent = playing ? '❚❚ Dừng' : '▶ Chơi'; if (!playing) allOff(); };
    $('back').onclick = () => reset();
    $('sec').onchange = () => { setRange(); opts.onChange && opts.onChange({ section: $('sec').value }); };
    $('hand').onchange = () => { reset(); opts.onChange && opts.onChange({ hand: $('hand').value }); };
    $('speed').oninput = () => { speed = Number($('speed').value) / 100; $('spv').textContent = $('speed').value + '%'; };
    setRange(); last = performance.now(); raf = requestAnimationFrame(frame);
    return { sectionCount: secs.length, destroy() { cancelAnimationFrame(raf); unsub(); allOff(); kb.destroy(); root.innerHTML = ''; } };
  };
})(window.PD);
