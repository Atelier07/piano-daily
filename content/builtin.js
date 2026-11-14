// Bài mẫu có sẵn: Satie (hết bản quyền) + các bản chill tự soạn cho web này.
// Dựng thành cấu trúc giống file MIDI đã đọc (track 0 = tay phải, track 1 = tay trái).
window.PD = window.PD || {};
(function (PD) {
  const PPQ = 480;
  let seed = 7; const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  function make(bpm, tsig, ev) {
    const bar = PPQ * tsig[0];
    const notes = ev.map(([b, beat, n, len, vel, track]) => ({
      n: PD.midi(n), tick: (b - 1) * bar + Math.round((beat - 1) * PPQ), dur: Math.max(60, Math.round(len * PPQ) - 12),
      vel: Math.max(25, Math.min(110, Math.round(vel + (rnd() - 0.5) * 10))), track, ch: 0,
    })).sort((a, b) => a.tick - b.tick || a.n - b.n);
    return { ppq: PPQ, notes, bpm, tsig, tempos: [{ tick: 0, us: Math.round(60000000 / bpm) }], tracks: 2, format: 1 };
  }
  // tay trái rải: các nốt ngân tới hết ô (giống đạp pedal)
  function arp(ev, b, beats, notes, order, step, vel = 46) {
    order.forEach((k, j) => { const beat = 1 + j * step; if (beat > beats + 0.001) return; ev.push([b, beat, notes[k], beats + 1 - beat, vel - (j ? 6 : 0), 1]); });
  }
  const mel = (ev, b, list, vel = 70) => list.forEach(([beat, n, len]) => ev.push([b, beat, n, len, vel, 0]));

  // ---- Satie – Gymnopédie No.1 (1888), đoạn đầu ----
  function gymno() {
    const ev = [];
    for (let b = 1; b <= 21; b++) {
      const g = b % 2 === 1;
      ev.push([b, 1, g ? 'G2' : 'D2', 3, 52, 1]);
      (g ? ['B3', 'D4', 'F#4'] : ['A3', 'C#4', 'F#4']).forEach((n) => ev.push([b, 2, n, 2, 38, 1]));
    }
    [[5, 2, 'F#5', 1], [5, 3, 'A5', 1], [6, 1, 'G5', 1], [6, 2, 'F#5', 1], [6, 3, 'C#5', 1], [7, 1, 'B4', 1], [7, 2, 'C#5', 1], [7, 3, 'D5', 1], [8, 1, 'A4', 3], [9, 1, 'F#4', 12],
      [13, 2, 'F#5', 1], [13, 3, 'A5', 1], [14, 1, 'G5', 1], [14, 2, 'F#5', 1], [14, 3, 'C#5', 1], [15, 1, 'B4', 1], [15, 2, 'C#5', 1], [15, 3, 'D5', 1], [16, 1, 'A4', 3], [17, 1, 'C#5', 3], [18, 1, 'F#5', 3], [19, 1, 'E5', 9],
    ].forEach(([b, beat, n, len]) => ev.push([b, beat, n, len, 68, 0]));
    return make(72, [3, 4], ev);
  }

  // ---- Sáng chủ nhật: vòng C–G–Am–F (dùng đúng kỹ năng ngày 10–14) ----
  function sunday() {
    const ev = []; const CH = { C: ['C3', 'G3', 'C4', 'E4'], G: ['G2', 'D3', 'G3', 'B3'], Am: ['A2', 'E3', 'A3', 'C4'], F: ['F2', 'C3', 'F3', 'A3'] };
    const prog = ['C', 'G', 'Am', 'F'];
    const M = [
      [[1, 'G4', 1], [2, 'C5', 1], [3, 'E5', 2]], [[1, 'D5', 2], [3, 'B4', 1], [4, 'D5', 1]], [[1, 'C5', 2], [3, 'A4', 1], [4, 'E5', 1]], [[1, 'C5', 3], [4, 'A4', 1]],
      [[1, 'G4', 1], [2, 'C5', 1], [3, 'E5', 1], [4, 'G5', 1]], [[1, 'F5', 1.5], [2.5, 'E5', 0.5], [3, 'D5', 2]], [[1, 'E5', 1], [2, 'C5', 1], [3, 'A4', 1], [4, 'C5', 1]], [[1, 'A4', 4]],
      [[1, 'E5', 2], [3, 'G5', 2]], [[1, 'D5', 2], [3, 'B4', 2]], [[1, 'C5', 1], [2, 'E5', 1], [3, 'A5', 2]], [[1, 'G5', 1], [2, 'F5', 1], [3, 'E5', 1], [4, 'C5', 1]],
      [[1, 'E5', 2], [3, 'D5', 1], [4, 'C5', 1]], [[1, 'D5', 2], [3, 'G4', 2]], [[1, 'A4', 1], [2, 'C5', 1], [3, 'E5', 1], [4, 'D5', 1]], [[1, 'C5', 2], [3, 'A4', 2]],
    ];
    for (let b = 1; b <= 16; b++) { const c = CH[prog[(b - 1) % 4]]; arp(ev, b, 4, [...c, c[2]], [0, 1, 2, 3, 2, 1, 2, 1], 0.5); mel(ev, b, M[b - 1]); }
    ev.push([17, 1, 'C3', 4, 48, 1], [17, 1, 'G3', 4, 40, 1], [17, 1, 'E4', 4, 40, 1], [17, 1, 'C5', 4, 66, 0]);
    return make(76, [4, 4], ev);
  }

  // ---- Mưa đêm: lofi Fmaj7–Em7–Dm7–Cmaj7 ----
  function rain() {
    const ev = []; const CH = [['F2', 'E3', 'A3', 'C4'], ['E2', 'D3', 'G3', 'B3'], ['D2', 'C3', 'F3', 'A3'], ['C2', 'B2', 'E3', 'G3']];
    const M = [
      [[1, 'E5', 1.5], [2.5, 'C5', 0.5], [3, 'A4', 2]], [[1, 'D5', 1.5], [2.5, 'B4', 0.5], [3, 'G4', 2]], [[1, 'C5', 1], [2, 'D5', 1], [3, 'F5', 1], [4, 'E5', 1]], [[1, 'E5', 3], [4, 'G4', 1]],
      [[1, 'A5', 1.5], [2.5, 'G5', 0.5], [3, 'E5', 2]], [[1, 'G5', 1.5], [2.5, 'D5', 0.5], [3, 'B4', 2]], [[1, 'A4', 1], [2, 'C5', 1], [3, 'D5', 1], [3.5, 'E5', 0.5], [4, 'F5', 1]], [[1, 'E5', 2], [3, 'D5', 1], [4, 'C5', 1]],
    ];
    for (let b = 1; b <= 16; b++) {
      const c = CH[(b - 1) % 4];
      c.forEach((n, j) => ev.push([b, 1, n, 1.5, j ? 40 : 50, 1]));
      c.slice(1).forEach((n) => ev.push([b, 2.5, n, 2.5, 34, 1])); // nhắc lại lệch phách — chất lofi
      if (b > 2) mel(ev, b, M[(b - 3) % 8], 64);
    }
    ['C2', 'B2', 'E3', 'G3', 'D4'].forEach((n) => ev.push([17, 1, n, 4, 42, 1])); ev.push([17, 1, 'E5', 4, 60, 0]);
    return make(68, [4, 4], ev);
  }

  // ---- Canon chill: vòng hợp âm Pachelbel (hết bản quyền), tay trái rải ----
  function canon() {
    const ev = []; const CH = { D: ['D3', 'A3', 'D4', 'F#4'], A: ['A2', 'E3', 'A3', 'C#4'], Bm: ['B2', 'F#3', 'B3', 'D4'], 'F#m': ['F#2', 'C#3', 'F#3', 'A3'], G: ['G2', 'D3', 'G3', 'B3'] };
    const prog = ['D', 'A', 'Bm', 'F#m', 'G', 'D', 'G', 'A'];
    const top = [['F#5', 'E5', 'D5', 'C#5', 'B4', 'A4', 'B4', 'C#5'], ['D5', 'C#5', 'B4', 'A4', 'G4', 'F#4', 'G4', 'E4']];
    for (let b = 1; b <= 24; b++) {
      const c = CH[prog[(b - 1) % 8]]; arp(ev, b, 4, c, [0, 1, 2, 3, 2, 1, 2, 1], 0.5, 44);
      const pass = Math.floor((b - 1) / 8);
      if (pass === 1) mel(ev, b, [[1, top[0][(b - 1) % 8], 4]], 66);
      if (pass === 2) { const n = top[1][(b - 1) % 8]; mel(ev, b, [[1, top[0][(b - 1) % 8], 2], [3, n, 2]], 66); }
    }
    ['D3', 'A3', 'F#4'].forEach((n) => ev.push([25, 1, n, 4, 44, 1])); ev.push([25, 1, 'D5', 4, 62, 0]);
    return make(66, [4, 4], ev);
  }

  // ---- Valse buổi chiều: 3/4, Am–F–C–G ----
  function valse() {
    const ev = []; const CH = { Am: ['A2', 'C4', 'E4'], F: ['F2', 'A3', 'C4'], C: ['C3', 'E4', 'G4'], G: ['G2', 'B3', 'D4'] };
    const prog = ['Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'Am'];
    const M = [
      [[1, 'E5', 2], [3, 'D5', 1]], [[1, 'C5', 2], [3, 'A4', 1]], [[1, 'G4', 1], [2, 'C5', 1], [3, 'E5', 1]], [[1, 'D5', 3]],
      [[1, 'E5', 2], [3, 'A5', 1]], [[1, 'G5', 1], [2, 'F5', 1], [3, 'C5', 1]], [[1, 'E5', 2], [3, 'G4', 1]], [[1, 'B4', 2], [3, 'D5', 1]],
      [[1, 'C5', 1], [2, 'E5', 1], [3, 'A5', 1]], [[1, 'A5', 2], [3, 'G5', 1]], [[1, 'E5', 1], [2, 'G5', 1], [3, 'E5', 1]], [[1, 'D5', 2], [3, 'B4', 1]],
      [[1, 'C5', 2], [3, 'B4', 1]], [[1, 'A4', 2], [3, 'C5', 1]], [[1, 'B4', 1], [2, 'D5', 1], [3, 'G5', 1]], [[1, 'A4', 3]],
    ];
    prog.forEach((ch, i) => {
      const b = i + 1; const [root, ...up] = CH[ch];
      ev.push([b, 1, root, 3, 50, 1]); [2, 3].forEach((beat) => up.forEach((n) => ev.push([b, beat, n, 0.9, 34, 1])));
      mel(ev, b, M[i], 68);
    });
    return make(84, [3, 4], ev);
  }

  PD.BUILTIN = [
    { title: 'Sáng chủ nhật (tự soạn)', note: 'Vòng C–G–Am–F, tay trái rải. Học xong ngày 14 là tập được — bài "thật" đầu tiên của bạn.', fromDay: 11, mid: sunday() },
    { title: 'Mưa đêm (tự soạn, lofi)', note: 'Hợp âm maj7/m7 nhắc lệch phách kiểu lofi. Hợp sau ngày 25 (hợp âm màu).', fromDay: 25, mid: rain() },
    { title: 'Canon chill — vòng Pachelbel', note: 'Vòng hợp âm Canon (hết bản quyền) rải tay trái, tay phải nốt dài. Nghe thư giãn, tập tay trái rất tốt.', fromDay: 18, mid: canon() },
    { title: 'Valse buổi chiều (tự soạn, 3/4)', note: 'Nhịp 3/4 kiểu điệu valse — chất La La Land. Hợp sau ngày 15.', fromDay: 15, mid: valse() },
    { title: 'Gymnopédie No.1 — Erik Satie (đoạn đầu)', link: 'https://en.wikipedia.org/wiki/Gymnop%C3%A9dies', note: 'Bản piano chill kinh điển, hết bản quyền. Tay trái 2 hợp âm luân phiên.', fromDay: 15, mid: gymno() },
  ];
})(window.PD);
