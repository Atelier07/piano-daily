// Thầy AI (Gemini, Interactions API). Khoá dán ở Cài đặt, chỉ lưu trong trình duyệt này.
(function (PD) {
  const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions';
  const MODELS = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite'];
  const KEY = 'pianoDaily.geminiKey', LAST = 'pianoDaily.aiModel';
  const getKey = () => { try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } };

  const LEARNER = `Bạn là thầy dạy piano kiên nhẫn, nói tiếng Việt tự nhiên, ngắn gọn, ấm áp nhưng thẳng thắn.
Học trò: người lớn mới học lại từ đầu, tự học 30 phút/ngày trên đàn Kawai ES110, mục tiêu tự chơi nhạc phim và nhạc chill cho mình nghe (không cần nhạc cổ điển).
Học trò thích đọc, hiểu "vì sao". Không dài dòng, không sáo rỗng kiểu "bạn làm rất tốt!" vô căn cứ. Không dùng markdown tiêu đề; được dùng gạch đầu dòng ngắn.`;

  function extract(j) {
    const out = [];
    for (const s of (j && Array.isArray(j.steps) ? j.steps : [])) {
      if (!s || s.type !== 'model_output') continue;
      for (const c of (Array.isArray(s.content) ? s.content : [])) if (c && typeof c.text === 'string') out.push(c.text);
    }
    return out.join('\n').trim();
  }

  async function ask(prompt) {
    const key = getKey();
    if (!key) throw new Error('Chưa có khoá Gemini — vào tab Cài đặt dán khoá là thầy nói được.');
    let models = MODELS.slice(); try { const l = localStorage.getItem(LAST); if (l && models.includes(l)) models = [l, ...models.filter((m) => m !== l)]; } catch (e) { /* */ }
    let last = '';
    for (const model of models) {
      const ctrl = new AbortController(); const tm = setTimeout(() => ctrl.abort(), 45000);
      try {
        const res = await fetch(ENDPOINT, { method: 'POST', signal: ctrl.signal, headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, input: prompt }) });
        let j = null; try { j = await res.json(); } catch (e) { /* */ }
        if (!res.ok || (j && j.error)) {
          const m = (j && j.error && j.error.message) || 'HTTP ' + res.status;
          if (/api key|api_key|permission|unauthenticated/i.test(m) || res.status === 401) throw Object.assign(new Error('Khoá Gemini không hợp lệ.'), { fatal: true });
          last = m; continue;
        }
        const t = extract(j); if (!t) { last = 'trả lời rỗng'; continue; }
        try { localStorage.setItem(LAST, model); } catch (e) { /* */ }
        return t;
      } catch (e) {
        if (e.fatal) throw e;
        last = e.name === 'AbortError' ? 'quá 45 giây' : (e.message || 'lỗi mạng');
      } finally { clearTimeout(tm); }
    }
    throw new Error('Thầy chưa trả lời được (' + last + '). Thử lại sau ít phút.');
  }

  PD.tutor = {
    hasKey: () => !!getKey(),
    setKey: (k) => { try { localStorage.setItem(KEY, k.trim()); } catch (e) { /* */ } },
    ask,
    feedback(def, r, dayInfo) {
      return ask(`${LEARNER}

Hôm nay: ${dayInfo || ''}
Học trò vừa làm bài tập "${def.title}" (kiểu: ${def.mode}${def.mode === 'tempo' ? `, nhịp ${r.bpm}` : ''}).
Mục đích bài: ${def.hint || def.title}
Các bước (nốt/ngón/phách): ${def.steps || (def.targets || []).join(' ') || ''}
Kết quả máy chấm qua MIDI (chính xác tuyệt đối về nốt và thời điểm, KHÔNG biết ngón nào, không thấy dáng tay):
${JSON.stringify(r)}
(meanOffset âm = đánh sớm hơn nhịp, dương = chậm; onTime = tỉ lệ bước đúng nhịp; problems = chỗ hay lỗi)

Nhận xét tối đa 4 câu: nói 1–2 điều quan trọng nhất dựa đúng vào số liệu, đoán nguyên nhân có thể (nói rõ là đoán), và 1 cách tập cụ thể cho lần sau (bao nhiêu lần, nhịp bao nhiêu). Nếu đạt tốt thì nói ngắn và gợi ý thử thách nhỏ tiếp theo.`);
    },
    chat(history, question, context) {
      const h = history.slice(-10).map((m) => (m.me ? 'Học trò: ' : 'Thầy: ') + m.text).join('\n');
      return ask(`${LEARNER}

Bối cảnh học trò: ${context}

Cuộc trò chuyện trước:
${h}

Học trò hỏi: ${question}

Trả lời ngắn, cụ thể, có "vì sao" khi cần. Nếu hỏi về một bài hát, có thể nêu hợp âm, cách rải tay trái, cách tập từng đoạn.`);
    },
  };
})(window.PD);
