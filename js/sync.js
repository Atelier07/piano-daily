// Đồng bộ tiến độ với repo riêng tư piano-daily-data qua chương trình nền trên Mac (localhost:8765).
// Bản nào mới hơn (trường `updated`) thì thắng. Không có chương trình nền → vẫn chạy bằng bản trong trình duyệt.
(function (PD) {
  const URL_ = 'http://127.0.0.1:8765/progress', KEY = 'pianoDaily.v1';
  const lastErr = () => { PD.syncState = 'off'; };
  let timer = null;
  PD.pushRemote = function (s) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      fetch(URL_, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) })
        .then((r) => { PD.syncState = r.ok ? 'ok' : 'off'; }).catch(lastErr);
    }, 800);
  };
  function start() { const a = document.createElement('script'); a.src = 'js/app.js'; document.body.appendChild(a); }
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 2500);
  fetch(URL_, { signal: ctl.signal }).then((r) => r.json()).then((remote) => {
    clearTimeout(t); PD.syncState = 'ok';
    let local = null; try { local = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* */ }
    const ru = remote && remote.updated || 0, lu = local && local.updated || 0;
    if (remote && remote.day && ru >= lu) { try { localStorage.setItem(KEY, JSON.stringify(remote)); } catch (e) { /* */ } }
    else if (local) PD.pushRemote(local);
    start();
  }).catch(() => { clearTimeout(t); PD.syncState = 'off'; start(); });
})(window.PD);
