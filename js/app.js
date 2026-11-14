// Giao diện: Hôm nay · Lộ trình · Bài của bạn · Hỏi thầy · Cài đặt
(function (PD) {
  let S = PD.load();
  const save = () => PD.save(S);
  const main = document.getElementById('main');
  let current = null; // bài tập đang mở
  const closeEx = () => { if (current) { current.destroy(); current = null; } };

  // ---------- MIDI ----------
  const dot = document.getElementById('midiDot');
  function midiUI(err) {
    if (err) { dot.textContent = '○ Nối đàn'; dot.title = err; dot.className = ''; return; }
    dot.textContent = PD.midiState.connected ? '● Đã nối ' + PD.midiState.names[0] : '○ Nối đàn';
    dot.className = PD.midiState.connected ? 'on' : '';
  }
  dot.onclick = () => PD.connectMIDI(midiUI);
  PD.connectMIDI(midiUI);

  // ---------- tiện ích ----------
  const dayDef = (n) => PD.DAYS.find((d) => d.day === n);
  const exState = (id) => S.ex[id] || (S.ex[id] = { attempts: 0, best: 0, passed: false });
  const sess = () => S.sessions[PD.today()] || (S.sessions[PD.today()] = { done: {}, minutes: 0 });
  function record(r) {
    const e = exState(r.id); e.attempts++; e.last = r.accuracy; e.best = Math.max(e.best, r.accuracy);
    if (r.passed) {
      e.passed = true;
      const def = PD.EX[r.id];
      if (def && def.mode === 'tempo' && def.target) e.bpm = Math.min(def.target, r.bpm + 5);
      S.review = S.review.filter((x) => x !== r.id);
    } else {
      if (PD.EX[r.id] && !S.review.includes(r.id)) S.review.push(r.id);
      if (PD.EX[r.id] && PD.EX[r.id].mode === 'tempo') e.bpm = r.bpm;
    }
    sess().done[r.id] = true; save();
  }
  function lessonHTML(blocks) {
    return blocks.map((b, i) => {
      if (b.h) return `<h3>${PD.md(b.h)}</h3>`;
      if (b.p) return `<p>${PD.md(b.p).replace(/\n/g, '<br>')}</p>`;
      if (b.why) return `<div class="why">${PD.md(b.why)}</div>`;
      if (b.tip) return `<div class="tip">${PD.md(b.tip)}</div>`;
      if (b.kb) return `<div data-kb="${i}"></div>${b.cap ? `<div class="cap">${PD.md(b.cap)}</div>` : ''}`;
      if (b.play) return `<button class="btn small" data-play="${i}">▶ ${PD.esc(b.label || 'Nghe')}</button>`;
      return '';
    }).join('');
  }
  function mountLesson(el, blocks) {
    el.innerHTML = `<div class="lesson">${lessonHTML(blocks)}</div>`;
    blocks.forEach((b, i) => {
      if (b.kb) {
        const labels = {}; Object.entries(b.kb.labels || {}).forEach(([k, v]) => labels[PD.midi(k)] = v);
        PD.Keyboard(el.querySelector(`[data-kb="${i}"]`), { low: b.kb.low, high: b.kb.high, highlight: (b.kb.hl || []).map(PD.midi), labels });
      }
      if (b.play) el.querySelector(`[data-play="${i}"]`).onclick = () => {
        const notes = b.play.map((x) => PD.chord(x));
        if (b.chord) PD.playChord(notes.flat()); else PD.playSeq(notes.map((n) => ({ notes: n, beats: 1 })), 100);
      };
    });
  }

  // ---------- HÔM NAY ----------
  function viewToday(opts = {}) {
    closeEx();
    const n = opts.day || S.day; const d = dayDef(n);
    if (!d) {
      main.innerHTML = `<h1>Bạn đã học hết phần đã viết</h1><p>Các ngày tiếp theo đang được soạn. Trong lúc chờ: ôn lại bài cũ ở <b>Lộ trình</b>, hoặc tập bài trong <b>Bài của bạn</b>.</p>`;
      return;
    }
    const review = opts.day ? [] : S.review.filter((id) => !d.foundation.includes(id) && !d.practice.includes(id)).slice(0, 2);
    const found = [...review, ...d.foundation];
    const s = sess(); const short = !!opts.short;
    const streak = PD.streak(S);
    const doneMark = (id) => (s.done[id] ? 'on' : '');
    const passMark = (id) => (S.ex[id] && S.ex[id].passed ? '<span class="pill ok">đã đạt</span>' : '');
    const item = (id, label) => `<div class="item" data-ex="${id}"><span class="check ${doneMark(id)}">${s.done[id] ? '✓' : ''}</span><span class="t">${PD.esc(label || PD.EX[id].title)}</span>${passMark(id)}<button class="btn small" data-open="${id}">Tập</button></div><div data-slot="${id}"></div>`;
    main.innerHTML = `
      <div class="row"><span class="tag">Tuần ${d.week} · Ngày ${d.day}${d.milestone ? ' · Mốc' : ''}</span><span class="spacer"></span>${opts.day ? '<span class="tag">xem lại</span>' : `<span class="sans small muted">Chuỗi ${streak} ngày</span>`}</div>
      <h1>${PD.esc(d.title)}</h1>
      <p class="muted">${PD.esc(d.goal)}</p>
      ${short ? '<p class="small muted">Buổi 10 phút: chỉ ôn nền. Vẫn tính chuỗi ngày, không sang bài mới.</p>' : ''}
      ${found.length ? `<div class="part" data-part="found"><span class="tag">1 · Nền ~10 phút</span>${review.map((id) => item(id, PD.EX[id].title + ' (ôn lại — lần trước chưa đạt)')).join('')}${d.foundation.map((id) => item(id)).join('')}</div>` : ''}
      ${short ? '' : `<div class="part" data-part="learn"><span class="tag">${found.length ? '2' : '1'} · Bài mới ~5 phút</span>
        <div class="item"><span class="check ${s.done['learn-' + d.day] ? 'on' : ''}">${s.done['learn-' + d.day] ? '✓' : ''}</span><span class="t">Đọc: ${PD.esc(d.title)}</span><button class="btn small" data-learn>Đọc</button></div>
        <div data-slot="learn"></div></div>
      <div class="part" data-part="practice"><span class="tag">${found.length ? '3' : '2'} · Luyện ~15 phút</span>${d.practice.map((id) => item(id)).join('')}</div>`}
      <div class="row" style="margin-top:20px"><button class="btn primary" data-finish>${short ? 'Xong buổi ngắn' : 'Xong buổi hôm nay'}</button>
        ${!short && !opts.day ? '<button class="btn" data-short>Hôm nay mệt: buổi 10 phút</button>' : ''}</div>
      <p class="small muted" data-msg></p>`;
    const openEx = (id) => {
      closeEx(); main.querySelectorAll('[data-slot]').forEach((x) => { if (x.dataset.slot !== 'learn') x.innerHTML = ''; });
      const slot = main.querySelector(`[data-slot="${id}"]`); const card = document.createElement('div'); card.className = 'card'; slot.appendChild(card);
      current = PD.Exercise(card, { id, ...PD.EX[id] }, { state: S.ex[id], dayInfo: `Ngày ${d.day}: ${d.title}`, onDone: (r) => { record(r); const it = main.querySelector(`[data-ex="${id}"] .check`); if (it) { it.classList.add('on'); it.textContent = '✓'; } } });
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    main.querySelectorAll('[data-open]').forEach((b) => b.onclick = () => openEx(b.dataset.open));
    const lb = main.querySelector('[data-learn]');
    if (lb) lb.onclick = () => {
      const slot = main.querySelector('[data-slot="learn"]');
      if (slot.innerHTML) { slot.innerHTML = ''; return; }
      const card = document.createElement('div'); card.className = 'card'; slot.appendChild(card); mountLesson(card, d.learn);
      const ok = document.createElement('button'); ok.className = 'btn primary'; ok.textContent = 'Hiểu rồi'; card.appendChild(ok);
      ok.onclick = () => { s.done['learn-' + d.day] = true; save(); slot.innerHTML = ''; const c = lb.parentElement.querySelector('.check'); c.classList.add('on'); c.textContent = '✓'; };
    };
    const sb = main.querySelector('[data-short]'); if (sb) sb.onclick = () => viewToday({ short: true });
    main.querySelector('[data-finish]').onclick = () => {
      const m = main.querySelector('[data-msg]');
      const need = short ? found : [...d.practice];
      const missing = need.filter((id) => !s.done[id]);
      if (!short && !s.done['learn-' + d.day]) { m.textContent = 'Còn phần đọc bài mới chưa xong.'; return; }
      if (missing.length) { m.textContent = 'Còn bài chưa tập: ' + missing.map((id) => PD.EX[id].title).join(', '); return; }
      s.finished = true;
      if (!short && !opts.day) {
        if (d.milestone && !d.practice.every((id) => S.ex[id] && S.ex[id].passed)) {
          save(); m.textContent = 'Đã ghi buổi học. Mốc chưa đạt nên mai làm lại ngày này — không sao, mốc là để chắc nền.'; return;
        }
        S.done[d.day] = PD.today(); S.day = d.day + 1;
      }
      save();
      main.innerHTML = `<h1>Xong buổi rồi.</h1><p class="streak">${PD.streak(S)} ngày</p><p class="muted">Chuỗi ngày học. Lỡ một ngày vẫn giữ chuỗi; lỡ hai ngày liền mới mất.</p>
        ${!short && !opts.day ? `<p>Ngày mai: <b>${PD.esc((dayDef(S.day) || { title: 'đang soạn' }).title)}</b></p>` : ''}
        <p class="small muted">Còn sức thì ngồi chơi tự do vài phút — vòng hợp âm, bài đã thuộc — không chấm gì cả.</p>`;
    };
  }

  // ---------- LỘ TRÌNH ----------
  function viewRoadmap() {
    closeEx();
    const weeks = {};
    PD.DAYS.forEach((d) => (weeks[d.week] = weeks[d.week] || []).push(d));
    const passed = Object.values(S.ex).filter((e) => e.passed).length;
    main.innerHTML = `<h1>Lộ trình</h1>
      <div class="score"><div><b>${S.day - 1}</b>ngày đã học</div><div><b>${PD.streak(S)}</b>chuỗi ngày</div><div><b>${passed}</b>bài đã đạt</div></div>
      <p class="small muted">Mốc dự kiến (ước lượng, 30 phút/ngày): ~1 tháng rải hợp âm hai tay ra chất nhạc nhẹ · ~3 tháng tự ngẫu hứng chill, chơi bản nhạc phim đơn giản · 6–12 tháng chơi thuần thục.</p>
      ${Object.entries(weeks).map(([w, ds]) => `<div class="week"><h2>Tuần ${w}</h2>${ds.map((d) => {
        const st = S.done[d.day] ? 'done' : d.day === S.day ? 'cur' : d.day > S.day ? 'lock' : '';
        return `<div class="daylink ${st}"><span class="n">Ngày ${d.day}</span><span class="spacer" style="flex:1">${PD.esc(d.title)}${d.milestone ? ' · <b>mốc</b>' : ''}</span>${S.done[d.day] ? '<span class="pill ok">xong</span>' : ''}${d.day <= S.day ? `<button class="btn small" data-day="${d.day}">${d.day === S.day ? 'Học' : 'Xem lại'}</button>` : ''}</div>`;
      }).join('')}</div>`).join('')}
      <div class="week"><h2>Sắp tới</h2>${PD.OUTLINE.map(([n, t]) => `<div class="daylink lock"><span class="n">Ngày ${n}</span><span>${PD.esc(t)}</span></div>`).join('')}
      <p class="small muted">Sau ngày 30: đảo hợp âm, dịch giọng, hai tay độc lập, bài La La Land, bài bạn chọn. Mỗi tháng có bài kiểm tra nền.</p></div>`;
    main.querySelectorAll('[data-day]').forEach((b) => b.onclick = () => { const n = Number(b.dataset.day); setTab('today'); viewToday(n === S.day ? {} : { day: n }); });
  }

  // ---------- BÀI CỦA BẠN ----------
  const SUGGEST = [
    { title: 'City of Stars — La La Land', link: 'https://www.sheetmusicplus.com/en/product/city-of-stars-from-la-la-land-20401949.html', note: 'Có bản Easy Piano (~4–5 USD). Trên MuseScore thường có bản tải được file MIDI.', after: 'sau ngày 30' },
    { title: "Mia & Sebastian's Theme — La La Land", link: 'https://www.musicnotes.com/shows/la-la-land', note: 'Nhịp 3/4, rất hợp với bài đệm valse ở ngày 15.', after: 'sau ngày 30' },
    { title: 'Lullaby — Enzalla', link: 'https://youtu.be/t_9Fk3HTV4w', note: 'Chưa tìm thấy sheet bán sẵn. Cần file MIDI (tìm trên MuseScore, hoặc mình làm công cụ tách nốt từ bản thu).', after: 'sau ngày 25 (hợp âm màu)' },
  ];
  function viewSongs() {
    closeEx();
    main.innerHTML = `<h1>Bài của bạn</h1>
      <p class="muted">Thêm bài bạn thích. Có file <b>MIDI (.mid)</b> thì web chia thành từng đoạn 2 ô nhịp, chấm từng phím như bài tập. Xong bài này chọn bài kế tiếp.</p>
      <div class="card"><h3 style="margin-top:0">Thêm bài</h3>
        <p><input type="text" id="sTitle" placeholder="Tên bài"></p>
        <p><input type="url" id="sLink" placeholder="Link nghe (YouTube…)"></p>
        <p class="small">File MIDI (không bắt buộc): <input type="file" id="sFile" accept=".mid,.midi,audio/midi"></p>
        <button class="btn primary" id="sAdd">Thêm vào hàng đợi</button> <span class="small muted" id="sMsg"></span></div>
      <h2>Hàng đợi</h2><div id="sList"></div>
      <h2>Bài mẫu có sẵn</h2>${PD.BUILTIN.map((x, i) => `<div class="item"><span class="t"><b>${PD.esc(x.title)}</b><br><span class="small muted">${PD.esc(x.note)}</span></span><button class="btn small" data-bi="${i}">Thêm &amp; mở</button></div>`).join('')}
      <h2>Gợi ý đã tìm</h2>${SUGGEST.map((x, i) => `<div class="item"><span class="t"><b>${PD.esc(x.title)}</b><br><span class="small muted">${PD.esc(x.note)} Nên học ${PD.esc(x.after)}.</span></span><a class="btn small" href="${x.link}" target="_blank" rel="noopener">Mở</a><button class="btn small" data-sug="${i}">Thêm</button></div>`).join('')}
      <div id="sDetail"></div>`;
    const list = () => {
      document.getElementById('sList').innerHTML = S.songs.length ? S.songs.map((x, i) => `<div class="item"><span class="t"><b>${PD.esc(x.title)}</b> ${x.mid ? `<span class="pill">${x.mid.notes.length} nốt</span>` : '<span class="pill">chưa có MIDI</span>'}${x.done ? ' <span class="pill ok">xong</span>' : ''}</span>${x.link ? `<a class="btn small" href="${x.link}" target="_blank" rel="noopener">Nghe</a>` : ''}<button class="btn small" data-song="${i}">Mở</button></div>`).join('') : '<p class="muted small">Chưa có bài nào.</p>';
      document.querySelectorAll('[data-song]').forEach((b) => b.onclick = () => songDetail(Number(b.dataset.song)));
    };
    list();
    document.querySelectorAll('[data-bi]').forEach((b) => b.onclick = () => {
      const x = PD.BUILTIN[b.dataset.bi]; let k = S.songs.findIndex((s) => s.title === x.title);
      if (k < 0) { S.songs.push({ title: x.title, link: x.link, mid: x.mid }); k = S.songs.length - 1; save(); }
      list(); songDetail(k);
    });
    document.querySelectorAll('[data-sug]').forEach((b) => b.onclick = () => { const x = SUGGEST[b.dataset.sug]; if (!S.songs.some((s) => s.title === x.title)) { S.songs.push({ title: x.title, link: x.link }); save(); } list(); });
    document.getElementById('sAdd').onclick = async () => {
      const title = document.getElementById('sTitle').value.trim(); const link = document.getElementById('sLink').value.trim();
      const f = document.getElementById('sFile').files[0]; const m = document.getElementById('sMsg');
      if (!title) { m.textContent = 'Nhập tên bài đã.'; return; }
      const song = { title, link };
      if (f) { try { song.mid = PD.parseMidiFile(await f.arrayBuffer()); } catch (e) { m.textContent = 'Đọc MIDI lỗi: ' + e.message; return; } }
      S.songs.push(song); save(); m.textContent = 'Đã thêm.'; list();
    };
  }
  function songDetail(i) {
    closeEx();
    const song = S.songs[i]; const el = document.getElementById('sDetail');
    song.prog = song.prog || {};
    const hand = song.hand || 'R';
    el.innerHTML = `<div class="card"><div class="row"><h2 style="margin:0">${PD.esc(song.title)}</h2><span class="spacer"></span><button class="btn small" data-del>Xoá</button></div>
      ${song.mid ? `<p class="small muted">Nhịp gốc ${song.mid.bpm} · ${song.mid.tsig[0]}/${song.mid.tsig[1]} · ${song.mid.tracks} track</p>
        <div class="row"><span class="small">Tập:</span>${[['R', 'Tay phải'], ['L', 'Tay trái'], ['B', 'Hai tay']].map(([k, t]) => `<button class="btn small ${hand === k ? 'primary' : ''}" data-hand="${k}">${t}</button>`).join('')}</div>
        <div id="secs"></div>` : `<p>Chưa có file MIDI. Thêm file để tập từng đoạn:</p><input type="file" id="addMid" accept=".mid,.midi,audio/midi">
        <p class="small muted">Chưa có MIDI vẫn hỏi được thầy ở tab Hỏi thầy: "Bài ${PD.esc(song.title)} dùng hợp âm gì, tay trái rải thế nào?" — nhưng nên kiểm lại bằng tai, AI có thể nhớ sai hợp âm.</p>`}
      <div class="row"><button class="btn small" data-done>${song.done ? 'Đánh dấu chưa xong' : 'Đánh dấu đã xong bài'}</button></div><div id="secEx"></div></div>`;
    el.scrollIntoView({ behavior: 'smooth' });
    el.querySelector('[data-del]').onclick = () => { S.songs.splice(i, 1); save(); viewSongs(); };
    el.querySelector('[data-done]').onclick = () => { song.done = !song.done; save(); viewSongs(); };
    const am = el.querySelector('#addMid');
    if (am) am.onchange = async () => { try { song.mid = PD.parseMidiFile(await am.files[0].arrayBuffer()); save(); songDetail(i); } catch (e) { alertBox(el, 'Đọc MIDI lỗi: ' + e.message); } };
    if (!song.mid) return;
    el.querySelectorAll('[data-hand]').forEach((b) => b.onclick = () => { song.hand = b.dataset.hand; save(); songDetail(i); });
    // màn hình nốt rơi
    const pl = document.createElement('div'); pl.className = 'card'; el.querySelector('#secs').before(pl);
    const intro = document.createElement('p'); intro.className = 'small muted';
    intro.innerHTML = 'Cách tập: chọn <b>một đoạn</b>, tốc độ 50–60%, bật <b>Chờ bấm đúng</b>. Thuộc rồi tắt chờ, tăng tốc dần. Máy tự chơi tay kia qua loa đàn để bạn nghe cả bài.';
    pl.before(intro);
    current = PD.Player(pl, PD.buildSong(song.mid), { hand: song.ph || 'R', section: song.psec ?? 'all', onChange: (c) => { if (c.hand) song.ph = c.hand; if (c.section != null) song.psec = c.section; save(); } });
    const old = document.createElement('details'); old.innerHTML = '<summary class="small sans">Tập kiểu từng ô (bản cũ)</summary>'; el.querySelector('#secs').before(old); old.appendChild(el.querySelector('#secs'));
    const secs = PD.songToSections(song.mid, hand);
    el.querySelector('#secs').innerHTML = secs.map((s) => { const k = hand + s.i; const pr = song.prog[k];
      return `<div class="item"><span class="check ${pr && pr.passed ? 'on' : ''}">${pr && pr.passed ? '✓' : ''}</span><span class="t">Đoạn ${s.i + 1} <span class="small muted">${s.steps.length} bước</span></span><button class="btn small" data-sec="${s.i}" data-mode="wait">Chờ</button><button class="btn small" data-sec="${s.i}" data-mode="tempo">Theo nhịp</button></div>`; }).join('');
    el.querySelectorAll('[data-sec]').forEach((b) => b.onclick = () => {
      closeEx(); const s = secs.find((x) => x.i === Number(b.dataset.sec)); const mode = b.dataset.mode; const k = hand + s.i;
      const box = el.querySelector('#secEx'); box.innerHTML = '<div class="card"></div>';
      current = PD.Exercise(box.firstChild, { id: 'song', title: `${song.title} — đoạn ${s.i + 1}`, mode, steps: s.steps, low: s.low, high: s.high, bpm: Math.min(70, Math.round(song.mid.bpm / 2)), bpb: song.mid.tsig[0], reps: mode === 'wait' ? 2 : 1, hint: mode === 'wait' ? 'Tập chậm cho thuộc ngón trước, rồi mới bật nhịp.' : 'Nhịp mặc định bằng một nửa bản gốc. Đạt rồi tăng dần.' },
        { state: song.prog[k] && song.prog[k].bpm ? { bpm: song.prog[k].bpm } : {}, dayInfo: `Đang tập bài riêng: ${song.title}`, onDone: (r) => { const p = song.prog[k] = song.prog[k] || {}; if (r.passed && mode === 'tempo') { p.passed = true; p.bpm = r.bpm + 5; } save(); } });
      box.scrollIntoView({ behavior: 'smooth' });
    });
  }
  function alertBox(el, t) { const p = document.createElement('p'); p.className = 'small'; p.style.color = 'var(--bad)'; p.textContent = t; el.prepend(p); }

  // ---------- HỎI THẦY ----------
  const chat = [];
  function viewTutor() {
    closeEx();
    main.innerHTML = `<h1>Hỏi thầy</h1>
      ${PD.tutor.hasKey() ? '' : '<p class="tip">Chưa có khoá Gemini. Vào <b>Cài đặt</b> dán khoá là thầy trả lời được.</p>'}
      <p class="muted small">Hỏi gì cũng được: vì sao bài này khó, tập đoạn này thế nào, bài hát X dùng hợp âm gì, tay đau phải làm sao…</p>
      <div class="chat" id="chat"></div>
      <textarea id="q" rows="3" placeholder="Hỏi thầy…"></textarea>
      <button class="btn primary" id="send">Gửi</button>`;
    const box = document.getElementById('chat');
    const draw = () => { box.innerHTML = chat.map((m) => `<div class="msg ${m.me ? 'me' : 'ai'}">${PD.esc(m.text)}</div>`).join(''); };
    draw();
    document.getElementById('send').onclick = async () => {
      const q = document.getElementById('q'); const text = q.value.trim(); if (!text) return;
      const prev = chat.slice(); chat.push({ me: true, text }); q.value = ''; chat.push({ text: 'Thầy đang nghĩ…' }); draw();
      const d = dayDef(S.day) || {};
      const weak = S.review.map((id) => PD.EX[id] && PD.EX[id].title).filter(Boolean).join(', ');
      const ctx = `đang ở ngày ${S.day} (${d.title || 'đã hết phần soạn sẵn'}). Bài chưa đạt cần ôn: ${weak || 'không'}. Bài hát trong hàng đợi: ${S.songs.map((x) => x.title).join(', ') || 'chưa có'}.`;
      try { chat[chat.length - 1].text = await PD.tutor.chat(prev, text, ctx); } catch (e) { chat[chat.length - 1].text = e.message; }
      draw();
    };
  }

  // ---------- CÀI ĐẶT ----------
  function viewSettings() {
    closeEx();
    main.innerHTML = `<h1>Cài đặt</h1>
      <div class="card"><h3 style="margin-top:0">Nối đàn ES110</h3>
        <p class="small">Bật đàn → Mac: Audio MIDI Setup → ⌘2 (Studio MIDI) → biểu tượng Bluetooth → Kết nối. Sau đó bấm "Nối đàn" góc trên phải.</p>
        <p class="small"><label><input type="checkbox" id="useOut" ${PD.useOut() ? 'checked' : ''}> Phát tiếng mẫu qua loa đàn (tiếng piano thật)</label> <span class="muted">${PD.midiState.out ? '— đang dùng ' + PD.esc(PD.midiState.out) : '— chưa thấy đàn'}</span></p>
        <p class="small">Chưa có đàn bên cạnh? Dùng bàn phím máy: hàng <b>A S D F G H J K</b> = C D E F G A B C, <b>W E T Y U</b> = phím đen, <b>Z/X</b> = hạ/nâng quãng tám. Hoặc bấm chuột lên phím trên màn hình.</p></div>
      <div class="card"><h3 style="margin-top:0">Khoá Gemini (thầy AI)</h3>
        <p class="small muted">Khoá chỉ lưu trong trình duyệt này, không gửi đi đâu ngoài Google.</p>
        <input type="password" id="key" placeholder="${PD.tutor.hasKey() ? 'Đã có khoá — dán khoá mới để thay' : 'Dán khoá Gemini vào đây'}">
        <button class="btn" id="saveKey">Lưu khoá</button> <button class="btn" id="testKey">Thử thầy</button> <span class="small" id="keyMsg"></span></div>
      <div class="card"><h3 style="margin-top:0">Tiến độ</h3>
        <p class="small muted">Tiến độ lưu trong trình duyệt. Thỉnh thoảng tải bản sao lưu về cho chắc.</p>
        <button class="btn" id="exp">Tải bản sao lưu</button> <label class="btn">Nhập bản sao lưu<input type="file" id="imp" accept=".json" hidden></label>
        <button class="btn" id="reset">Học lại từ đầu</button> <span class="small" id="pMsg"></span></div>`;
    document.getElementById('useOut').onchange = (e) => PD.setUseOut(e.target.checked);
    const km = document.getElementById('keyMsg');
    document.getElementById('saveKey').onclick = () => { const v = document.getElementById('key').value.trim(); if (v) { PD.tutor.setKey(v); km.textContent = 'Đã lưu.'; } };
    document.getElementById('testKey').onclick = async () => { km.textContent = 'Đang hỏi…'; try { km.textContent = await PD.tutor.ask('Chào học trò mới bằng một câu ngắn tiếng Việt.'); } catch (e) { km.textContent = e.message; } };
    document.getElementById('exp').onclick = () => {
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' }));
      a.download = `piano-daily-${PD.today()}.json`; a.click();
    };
    document.getElementById('imp').onchange = async (e) => { try { S = Object.assign(PD.load(), JSON.parse(await e.target.files[0].text())); save(); document.getElementById('pMsg').textContent = 'Đã nhập.'; } catch (err) { document.getElementById('pMsg').textContent = 'File lỗi.'; } };
    let armed = false;
    document.getElementById('reset').onclick = (e) => {
      if (!armed) { armed = true; e.target.textContent = 'Bấm lần nữa để xoá hết tiến độ'; return; }
      localStorage.removeItem('pianoDaily.v1'); S = PD.load(); document.getElementById('pMsg').textContent = 'Đã xoá. Bắt đầu lại từ ngày 1.'; e.target.textContent = 'Học lại từ đầu'; armed = false;
    };
  }

  // ---------- điều hướng ----------
  const VIEWS = { today: () => viewToday(), road: viewRoadmap, songs: viewSongs, tutor: viewTutor, set: viewSettings };
  function setTab(t) { document.querySelectorAll('nav button').forEach((b) => b.classList.toggle('on', b.dataset.tab === t)); try { localStorage.setItem('pianoDaily.tab', t); } catch (e) { /* */ } }
  document.querySelectorAll('nav button').forEach((b) => b.onclick = () => { setTab(b.dataset.tab); VIEWS[b.dataset.tab](); window.scrollTo(0, 0); });
  setTab('today'); viewToday();
})(window.PD);
