// Bộ máy bài tập: chấm từng phím qua MIDI.
// Kiểu bài (mode):
//   wait  – không nhịp, web chờ bạn bấm đúng mới đi tiếp (tập nốt, ngón, hợp âm)
//   tempo – có máy đếm nhịp, chấm đúng nốt + lệch nhịp bao nhiêu ms
//   find  – tìm hết các phím được yêu cầu, thứ tự tuỳ ý
//   free  – ngẫu hứng tự do trong các nốt cho phép, có nền hợp âm
//   quiz  – luyện tai: nghe rồi chọn đáp án
(function (PD) {
  // "E4/3*2" = nốt E4, ngón 3, 2 phách.  "C4+E4+G4/1-3-5*4" = hợp âm.  "~E" = E ở quãng tám nào cũng được.
  PD.parseSteps = function (src) {
    if (Array.isArray(src)) return src;
    return String(src).trim().split(/\s+/).map((tok) => {
      let beats = 1, finger = '';
      const star = tok.indexOf('*'); if (star >= 0) { beats = Number(tok.slice(star + 1)); tok = tok.slice(0, star); }
      const sl = tok.indexOf('/'); if (sl >= 0) { finger = tok.slice(sl + 1); tok = tok.slice(0, sl); }
      let vel = null; if (tok.endsWith('!')) { vel = 'loud'; tok = tok.slice(0, -1); } else if (tok.endsWith('_')) { vel = 'soft'; tok = tok.slice(0, -1); }
      if (tok.startsWith('~')) return { pc: true, pcs: tok.slice(1).split('+').map((p) => PD.midi(p + '4') % 12), label: tok.slice(1).replace(/\+/g, ' '), b: beats, f: finger, vel };
      if (tok === 'R') return { rest: true, notes: [], b: beats, label: '–' };
      const notes = PD.chord(tok);
      return { notes, b: beats, f: finger, vel, label: notes.map(PD.pcName).join(' ') };
    });
  };

  PD.Exercise = function (root, def, opts = {}) {
    const st = opts.state || {};
    const steps = def.steps ? PD.parseSteps(def.steps) : [];
    let bpm = (st.bpm) || def.bpm || 60;
    const bpb = def.bpb || 4;
    const reps = def.reps || 1;
    const pass = def.pass || 0.9;
    root.innerHTML = '';
    const box = document.createElement('div'); root.appendChild(box);
    box.innerHTML = `
      <div class="ex-head"><h3 style="margin:0">${PD.esc(def.title)}</h3><span class="spacer"></span><span class="tag">${({ wait: 'chờ bạn', tempo: 'theo nhịp', find: 'tìm phím', free: 'ngẫu hứng', quiz: 'luyện tai' })[def.mode] || ''}</span></div>
      ${def.hint ? `<p class="small">${PD.md(def.hint)}</p>` : ''}
      <div class="bigmsg" data-r="msg"></div>
      <div class="beat" data-r="beat"></div>
      <div data-r="kb"></div>
      <div class="steps" data-r="steps"></div>
      <div data-r="quiz"></div>
      <div class="row" data-r="ctl"></div>
      <div data-r="res"></div>`;
    const $ = (r) => box.querySelector(`[data-r="${r}"]`);
    const kb = def.mode === 'quiz' && !def.kb ? null : PD.Keyboard($('kb'), { low: def.low || 'C3', high: def.high || 'C5', bigLabels: true });
    let unsub = null, metro = null, raf = null, running = false, finished = false;

    // ---------- nhãn phím ----------
    function showStepKeys(i) {
      if (!kb) return;
      const s = steps[i];
      if (!s || s.rest) { kb.highlight([]); kb.labels({}); return; }
      if (def.hideKeys) { kb.highlight([]); kb.labels({}); return; }
      const ns = s.pc ? [] : s.notes; kb.highlight(ns);
      const map = {}; const fs = String(s.f || '').split('-');
      ns.forEach((n, j) => { map[n] = (def.labels === 'name' || !s.f) ? PD.pcName(n) : (fs[j] || ''); });
      kb.labels(map);
    }
    function drawSteps(states) {
      if (!steps.length || def.mode === 'free') { $('steps').innerHTML = ''; return; }
      $('steps').innerHTML = steps.map((s, i) => `<span class="step ${states ? states[i] || '' : ''}" data-i="${i}">${PD.esc(s.label)}${s.b !== 1 && def.mode === 'tempo' ? `<sup>${s.b}</sup>` : ''}</span>`).join('');
    }
    function setStep(i, cls) { const e = $('steps').querySelector(`[data-i="${i}"]`); if (e) e.className = 'step ' + cls; }
    function msg(t) { $('msg').textContent = t; }

    // ---------- điều khiển ----------
    function controls() {
      const c = $('ctl'); c.innerHTML = '';
      const b = (txt, fn, cls = '') => { const x = document.createElement('button'); x.className = 'btn ' + cls; x.textContent = txt; x.onclick = fn; c.appendChild(x); return x; };
      if (!running) b(finished ? 'Làm lại' : 'Bắt đầu', start, 'primary');
      else b('Dừng', () => stop(true));
      if (steps.length && def.mode !== 'free' && !running) b('Nghe mẫu', () => PD.playSeq(steps.filter((s) => !s.pc), def.mode === 'tempo' ? bpm : 80));
      if (def.mode === 'tempo' || def.mode === 'free') {
        const lab = document.createElement('span'); lab.className = 'sans small'; lab.textContent = `Nhịp ${bpm}`;
        if (!running) b('−', () => { bpm = Math.max(40, bpm - 5); controls(); }, 'small');
        c.appendChild(lab);
        if (!running) b('+', () => { bpm = Math.min(160, bpm + 5); controls(); }, 'small');
      }
    }

    function start() {
      PD.audio(); finished = false; running = true; $('res').innerHTML = '';
      ({ wait: startWait, tempo: startTempo, find: startFind, free: startFree, quiz: startQuiz })[def.mode]();
      controls();
    }
    function stop(aborted) {
      running = false; if (unsub) unsub(); unsub = null; if (metro) metro.stop(); metro = null; if (raf) cancelAnimationFrame(raf); raf = null;
      $('beat').innerHTML = ''; controls(); if (aborted) msg('');
    }
    function finish(result) {
      stop(false); finished = true;
      result.id = def.id; result.title = def.title; result.mode = def.mode; result.bpm = bpm;
      result.passed = result.passed ?? (result.accuracy >= pass);
      renderResult(result);
      opts.onDone && opts.onDone(result);
    }

    // ---------- WAIT ----------
    function startWait() {
      let i = 0, rep = 0, ok = 0, wrong = 0, softMiss = 0; const held = new Set(); const missMap = {};
      drawSteps(); setStep(0, 'cur'); showStepKeys(0); msg(reps > 1 ? `Lượt 1/${reps}` : '');
      const t0 = performance.now();
      const satisfied = (s) => s.pc ? [...held].some((n) => s.pcs.includes(n % 12)) : s.notes.every((n) => held.has(n));
      unsub = PD.onInput((ev) => {
        if (ev.type === 'off') { held.delete(ev.note); return; }
        if (ev.type !== 'on') return;
        const s = steps[i];
        const inStep = s.pc ? s.pcs.includes(ev.note % 12) : s.notes.includes(ev.note);
        if (!inStep) { wrong++; missMap[i] = (missMap[i] || 0) + 1; kb && kb.flash(ev.note, 'wrong'); return; }
        if (s.vel === 'soft' && ev.vel > 60 && ev.src === 'midi') { softMiss++; msg('Nhẹ hơn chút'); return; }
        if (s.vel === 'loud' && ev.vel < 80 && ev.src === 'midi') { softMiss++; msg('Mạnh hơn chút'); return; }
        held.add(ev.note);
        if (!satisfied(s)) return;
        ok++; setStep(i, 'ok'); i++;
        if (i >= steps.length) {
          rep++;
          if (rep >= reps) {
            const acc = ok / (ok + wrong + softMiss);
            const worst = Object.entries(missMap).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${steps[k].label} (sai ${v} lần)`);
            return finish({ accuracy: acc, wrong, velMiss: softMiss, seconds: Math.round((performance.now() - t0) / 1000), problems: worst });
          }
          i = 0; drawSteps(); msg(`Lượt ${rep + 1}/${reps}`);
        }
        setStep(i, 'cur'); showStepKeys(i); held.clear();
      });
    }

    // ---------- TEMPO ----------
    function startTempo() {
      // dàn các lượt nối tiếp nhau
      const seq = []; let pos = bpb; // sau 1 ô nhịp đếm vào
      for (let r = 0; r < reps; r++) steps.forEach((s, i) => { seq.push({ s, i, beat: pos, got: new Map(), done: false, miss: false }); pos += s.b; });
      const endBeat = pos;
      drawSteps(); let wrong = 0;
      $('beat').innerHTML = Array.from({ length: bpb }, () => '<span></span>').join('');
      const dots = [...$('beat').children];
      metro = PD.Metronome(bpm, bpb, (k) => {
        dots.forEach((d, j) => d.classList.toggle('on', j === k % bpb));
        if (k < bpb) msg(String(bpb - k)); else if (k === bpb) msg('');
        if (k >= endBeat + 1) evaluate();
      });
      const win = (e) => Math.min(320, metro.beatMs * Math.min(e.s.b, 1) * 0.55);
      unsub = PD.onInput((ev) => {
        if (ev.type !== 'on') return;
        let best = null, bestD = 1e9;
        for (const e of seq) {
          if (e.done || e.miss || e.s.rest) continue;
          const T = metro.beatTime(e.beat); const d = ev.t - T;
          if (Math.abs(d) > win(e)) continue;
          const match = e.s.pc ? e.s.pcs.includes(ev.note % 12) : e.s.notes.includes(ev.note);
          if (!match || e.got.has(ev.note)) continue;
          if (Math.abs(d) < bestD) { best = e; bestD = Math.abs(d); best._d = d; }
        }
        if (!best) { wrong++; kb && kb.flash(ev.note, 'wrong'); return; }
        best.got.set(ev.note, best._d);
        const need = best.s.pc ? 1 : best.s.notes.length;
        if (best.got.size >= need) {
          best.done = true; const offs = [...best.got.values()]; best.off = offs.reduce((a, b) => a + b, 0) / offs.length;
          const tol = Math.max(70, metro.beatMs * 0.12);
          best.cls = Math.abs(best.off) <= tol ? 'ok' : best.off < 0 ? 'early' : 'late';
          if (best.i >= 0) setStep(best.i, best.cls);
        }
      });
      // con trỏ: tô bước sắp tới
      let lastCur = -1;
      const tick = () => {
        const now = performance.now();
        for (const e of seq) if (!e.done && !e.miss && !e.s.rest && now > metro.beatTime(e.beat) + win(e)) { e.miss = true; setStep(e.i, 'miss'); }
        const next = seq.find((e) => !e.s.rest && metro.beatTime(e.beat) + win(e) > now);
        const idx = next ? seq.indexOf(next) : -1;
        if (idx !== lastCur && next) {
          lastCur = idx;
          if (next.i === 0 && idx > 0) drawSteps(); // sang lượt mới
          setStep(next.i, 'cur'); showStepKeys(next.i);
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      function evaluate() {
        const real = seq.filter((e) => !e.s.rest);
        const notesTotal = real.reduce((a, e) => a + (e.s.pc ? 1 : e.s.notes.length), 0);
        const notesHit = real.reduce((a, e) => a + Math.min(e.got.size, e.s.pc ? 1 : e.s.notes.length), 0);
        const hits = real.filter((e) => e.done);
        const offs = hits.map((e) => e.off);
        const mean = offs.length ? offs.reduce((a, b) => a + b, 0) / offs.length : 0;
        const meanAbs = offs.length ? offs.reduce((a, b) => a + Math.abs(b), 0) / offs.length : 0;
        const onTime = real.length ? hits.filter((e) => e.cls === 'ok').length / real.length : 0;
        const acc = notesHit / (notesTotal + wrong);
        // bước hay lỗi nhất
        const byStep = {};
        real.forEach((e) => { if (e.cls !== 'ok') { const k = e.s.label; byStep[k] = byStep[k] || { miss: 0, late: 0, early: 0 }; byStep[k][e.miss ? 'miss' : e.cls]++; } });
        const problems = Object.entries(byStep).sort((a, b) => (b[1].miss + b[1].late + b[1].early) - (a[1].miss + a[1].late + a[1].early)).slice(0, 3)
          .map(([k, v]) => `${k}: ${v.miss ? `trượt ${v.miss}` : ''}${v.late ? ` chậm ${v.late}` : ''}${v.early ? ` sớm ${v.early}` : ''}`.trim());
        finish({ accuracy: acc, wrong, onTime, meanOffset: Math.round(mean), meanAbsOffset: Math.round(meanAbs), problems, passed: acc >= pass && onTime >= 0.75 });
      }
    }

    // ---------- FIND ----------
    function startFind() {
      const targets = new Set(def.targets.map(PD.midi)); const found = new Set(); let wrong = 0;
      kb && kb.highlight([]); kb && kb.labels({}); msg(`Còn ${targets.size} phím`);
      unsub = PD.onInput((ev) => {
        if (ev.type !== 'on') return;
        if (!targets.has(ev.note)) { wrong++; kb && kb.flash(ev.note, 'wrong'); return; }
        if (found.has(ev.note)) return;
        found.add(ev.note); kb && kb.highlight([...found]); kb && kb.labels(Object.fromEntries([...found].map((n) => [n, PD.pcName(n)])));
        msg(targets.size - found.size ? `Còn ${targets.size - found.size} phím` : 'Đủ rồi!');
        if (found.size === targets.size) finish({ accuracy: found.size / (found.size + wrong), wrong });
      });
    }

    // ---------- FREE ----------
    function startFree() {
      const allowed = new Set(def.allowed.map((p) => PD.midi(p + '4') % 12));
      const backing = def.backing ? PD.parseSteps(def.backing) : null;
      let inS = 0, outS = 0; const secs = def.seconds || 90; const t0 = performance.now();
      kb && kb.highlight(Object.keys(kb.keys).map(Number).filter((n) => allowed.has(n % 12)));
      let bIdx = 0, bLeft = 0;
      metro = PD.Metronome(bpm, bpb, (k) => {
        if (backing) {
          if (bLeft <= 0) { const s = backing[bIdx % backing.length]; PD.playChord(s.notes, 0, s.b * 60 / bpm * 0.95); bLeft = s.b; bIdx++; }
          bLeft--;
        }
        const left = Math.max(0, Math.round(secs - (performance.now() - t0) / 1000)); msg(`${left}s`);
        if (left <= 0) {
          const ratio = inS / Math.max(1, inS + outS);
          finish({ accuracy: ratio, notes: inS + outS, outside: outS, passed: ratio >= 0.85 && inS + outS >= 30 });
        }
      });
      unsub = PD.onInput((ev) => {
        if (ev.type !== 'on') return;
        if (allowed.has(ev.note % 12)) inS++; else { outS++; kb && kb.flash(ev.note, 'wrong'); }
      });
    }

    // ---------- QUIZ (tai) ----------
    function startQuiz() {
      const qs = PD.quizGen(def.gen, def.count || 8); let qi = 0, right = 0;
      const q = $('quiz');
      const ask = () => {
        const cur = qs[qi]; msg(`${qi + 1}/${qs.length}`);
        q.innerHTML = `<div class="quiz-choices">${cur.choices.map((c, j) => `<button class="btn" data-j="${j}">${PD.esc(c)}</button>`).join('')}</div><button class="btn small" data-again>Nghe lại</button>`;
        cur.play();
        q.querySelector('[data-again]').onclick = () => cur.play();
        q.querySelectorAll('[data-j]').forEach((btn) => btn.onclick = () => {
          const j = Number(btn.dataset.j); const okk = j === cur.a; if (okk) right++;
          btn.style.background = okk ? 'var(--good-soft)' : 'var(--bad-soft)';
          q.querySelectorAll('[data-j]').forEach((x) => x.disabled = true);
          if (!okk) q.querySelector(`[data-j="${cur.a}"]`).style.background = 'var(--good-soft)';
          setTimeout(() => { qi++; if (qi >= qs.length) { q.innerHTML = ''; finish({ accuracy: right / qs.length, right, total: qs.length, passed: right / qs.length >= 0.75 }); } else ask(); }, okk ? 600 : 1500);
        });
      };
      ask();
    }

    // ---------- kết quả ----------
    function renderResult(r) {
      const pct = (x) => Math.round(x * 100) + '%';
      const cells = [[r.mode === 'free' ? 'Trong gam' : 'Đúng nốt', pct(r.accuracy)]];
      if (r.mode === 'tempo') { cells.push(['Đúng nhịp', pct(r.onTime)]); cells.push(['Lệch trung bình', (r.meanOffset > 0 ? 'chậm ' : r.meanOffset < 0 ? 'sớm ' : '') + Math.abs(r.meanOffset) + ' ms']); }
      if (r.mode === 'wait' && r.seconds) cells.push(['Thời gian', r.seconds + ' giây']);
      if (r.mode === 'free') cells.push(['Số nốt', r.notes]);
      if (r.wrong) cells.push(['Phím sai', r.wrong]);
      let advice = '';
      if (r.passed && r.mode === 'tempo' && def.target && bpm < def.target) advice = `Đạt rồi. Lần sau web tăng lên nhịp ${Math.min(def.target, bpm + 5)}.`;
      else if (r.passed) advice = 'Đạt rồi.';
      else if (r.mode === 'tempo') advice = 'Chưa đạt. Thử giảm nhịp 5–10 rồi đánh lại — chậm mà đúng tốt hơn nhanh mà sai.';
      else advice = 'Chưa đạt. Đánh lại chậm hơn, nhìn phím sáng mà bấm.';
      $('res').innerHTML = `<div class="score">${cells.map(([k, v]) => `<div><b>${v}</b>${k}</div>`).join('')}</div>
        <p><span class="pill ${r.passed ? 'ok' : 'no'}">${r.passed ? 'Đạt' : 'Chưa đạt'}</span> ${advice}</p>
        ${r.problems && r.problems.length ? `<p class="small muted">Chỗ hay lỗi: ${PD.esc(r.problems.join(' · '))}</p>` : ''}
        <div class="row"><button class="btn small" data-r="ask">Thầy nhận xét</button></div><div data-r="tutor"></div>`;
      $('res').querySelector('[data-r="ask"]').onclick = async (e) => {
        e.target.disabled = true; const out = $('res').querySelector('[data-r="tutor"]');
        out.className = 'tutor'; out.textContent = 'Thầy đang xem…';
        try { out.textContent = await PD.tutor.feedback(def, r, opts.dayInfo); }
        catch (err) { out.textContent = err.message; e.target.disabled = false; }
      };
    }

    drawSteps(); if (steps.length) showStepKeys(0); controls();
    return { destroy() { stop(true); kb && kb.destroy(); root.innerHTML = ''; } };
  };

  // ---------- câu hỏi luyện tai ----------
  PD.quizGen = function (gen, count) {
    const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
    const qs = [];
    for (let i = 0; i < count; i++) {
      if (gen === 'majmin') {
        const r = rnd(55, 67); const maj = Math.random() < 0.5; const notes = [r, r + (maj ? 4 : 3), r + 7];
        qs.push({ choices: ['Trưởng (sáng)', 'Thứ (buồn)'], a: maj ? 0 : 1, play: () => { PD.playChord(notes, 0.05, 1.6); notes.forEach((n, j) => PD.playNote(n, 1.9 + j * 0.35, 0.5)); } });
      } else if (gen === 'updown') {
        const a = rnd(57, 72); let b = a + rnd(-5, 5); if (b === a) b = a + 2;
        qs.push({ choices: ['Đi lên', 'Đi xuống'], a: b > a ? 0 : 1, play: () => { PD.playNote(a, 0.05, 0.7); PD.playNote(b, 0.8, 0.9); } });
      } else if (gen === 'halfwhole') {
        const a = rnd(57, 70); const whole = Math.random() < 0.5; const b = a + (whole ? 2 : 1);
        qs.push({ choices: ['Nửa cung (sát)', 'Nguyên cung (cách 1)'], a: whole ? 1 : 0, play: () => { PD.playNote(a, 0.05, 0.7); PD.playNote(b, 0.8, 0.9); } });
      } else if (gen === 'chordcolor') {
        const r = rnd(55, 64); const kinds = [['Trưởng', [0, 4, 7]], ['Thứ', [0, 3, 7]], ['Maj7 (mơ màng)', [0, 4, 7, 11]], ['Sus2 (lơ lửng)', [0, 2, 7]]];
        const k = rnd(0, 3); const notes = kinds[k][1].map((x) => r + x);
        qs.push({ choices: kinds.map((x) => x[0]), a: k, play: () => { PD.playChord(notes, 0.05, 2); } });
      }
    }
    return qs;
  };
})(window.PD);
