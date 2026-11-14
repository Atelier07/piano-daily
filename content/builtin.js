// Bài mẫu có sẵn (hết bản quyền hoặc tự soạn), dựng thành cấu trúc giống file MIDI đã đọc.
window.PD = window.PD || {};
(function (PD) {
  const PPQ = 480;
  // ev: [ô (từ 1), phách (từ 1), nốt, số phách, lực, track]
  function make(title, bpm, tsig, ev) {
    const bar = PPQ * tsig[0];
    const notes = ev.map(([b, beat, n, len, vel, track]) => ({
      n: PD.midi(n), tick: (b - 1) * bar + Math.round((beat - 1) * PPQ), dur: Math.round(len * PPQ) - 10, vel, track, ch: 0,
    })).sort((a, b) => a.tick - b.tick || a.n - b.n);
    return { ppq: PPQ, notes, bpm, tsig, tempos: [{ tick: 0, us: Math.round(60000000 / bpm) }], tracks: 2, format: 1 };
  }

  // ---- Satie – Gymnopédie No.1 (1888), đoạn đầu ----
  function gymno() {
    const ev = [];
    const LAST = 21;
    // tay trái: ô lẻ Gmaj7 (G2 | B3 D4 F#4), ô chẵn Dmaj7 (D2 | A3 C#4 F#4)
    for (let b = 1; b <= LAST; b++) {
      const g = b % 2 === 1;
      ev.push([b, 1, g ? 'G2' : 'D2', 3, 52, 1]);
      (g ? ['B3', 'D4', 'F#4'] : ['A3', 'C#4', 'F#4']).forEach((n) => ev.push([b, 2, n, 2, 38, 1]));
    }
    // tay phải: giai điệu
    const mel = [
      [5, 2, 'F#5', 1], [5, 3, 'A5', 1], [6, 1, 'G5', 1], [6, 2, 'F#5', 1], [6, 3, 'C#5', 1],
      [7, 1, 'B4', 1], [7, 2, 'C#5', 1], [7, 3, 'D5', 1], [8, 1, 'A4', 3], [9, 1, 'F#4', 12],
      [13, 2, 'F#5', 1], [13, 3, 'A5', 1], [14, 1, 'G5', 1], [14, 2, 'F#5', 1], [14, 3, 'C#5', 1],
      [15, 1, 'B4', 1], [15, 2, 'C#5', 1], [15, 3, 'D5', 1], [16, 1, 'A4', 3], [17, 1, 'C#5', 3], [18, 1, 'F#5', 3], [19, 1, 'E5', 9],
    ];
    mel.forEach(([b, beat, n, len]) => ev.push([b, beat, n, len, 68, 0]));
    return make('Gymnopédie No.1', 72, [3, 4], ev);
  }

  PD.BUILTIN = [
    { title: 'Gymnopédie No.1 — Erik Satie (đoạn đầu)', link: 'https://en.wikipedia.org/wiki/Gymnop%C3%A9dies', note: 'Bản piano "chill" kinh điển, hết bản quyền. Nhịp 3/4 chậm; tay trái chỉ 2 hợp âm luân phiên (Gmaj7 – Dmaj7) — rất hợp người mới.', mid: gymno() },
  ];
})(window.PD);
