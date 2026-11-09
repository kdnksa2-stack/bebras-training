/* ===== المساعد الذكي كنافذة جانبية (في صفحة الاختبارات) =====
   - نافذة على جانب الصفحة، يمكن تصغيرها إلى زر عائم، وتتذكر حالتها.
   - في الاختبار: يرسل context: 'exam' فيعطي المساعد تلميحات فقط بدون الجواب النهائي.
   - زر «أرسل السؤال الحالي» ينسخ نص السؤال الظاهر على الشاشة إلى مربع الكتابة.
   يحتاج: core.js، و marked + DOMPurify + KaTeX (تُحمَّل عند أول فتح إذا لم تكن موجودة).
*/
(function () {
  const KEY_MIN = 'helper-minimized';
  const CONTEXT = document.body.dataset.helperContext || 'exam';
  const LIBS = [
    ['css', 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css'],
    ['js', 'https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js', () => window.marked],
    ['js', 'https://cdn.jsdelivr.net/npm/dompurify@3.1.6/dist/purify.min.js', () => window.DOMPurify],
    ['js', 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js', () => window.katex],
  ];
  let libsReady = null;
  function loadLibs() {
    if (libsReady) return libsReady;
    libsReady = Promise.all(LIBS.map(([kind, url, has]) => new Promise((resolve) => {
      if (kind === 'css') {
        if (!document.querySelector(`link[href="${url}"]`)) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = url; document.head.appendChild(l); }
        return resolve();
      }
      if (has && has()) return resolve();
      const s = document.createElement('script'); s.src = url; s.onload = resolve; s.onerror = resolve; document.head.appendChild(s);
    })));
    return libsReady;
  }

  const esc = (s) => App.esc(s);
  function renderMath(src, display) {
    try { return window.katex.renderToString(src, { displayMode: display, throwOnError: false, output: 'html' }); } catch (e) { return esc(src); }
  }
  function md(text) {
    if (!window.marked || !window.DOMPurify) return esc(text).replace(/\n/g, '<br>');
    const maths = [];
    const keep = (html) => `@@M${maths.push(html) - 1}@@`;
    const t = String(text)
      .replace(/\$\$([\s\S]+?)\$\$/g, (_, m) => keep(renderMath(m, true)))
      .replace(/\\\[([\s\S]+?)\\\]/g, (_, m) => keep(renderMath(m, true)))
      .replace(/\\\(([\s\S]+?)\\\)/g, (_, m) => keep(renderMath(m, false)))
      .replace(/(^|[^\\$])\$([^\n$]+?)\$/g, (_, pre, m) => pre + keep(renderMath(m, false)));
    const html = window.DOMPurify.sanitize(window.marked.parse(t, { breaks: true, gfm: true }));
    return html.replace(/@@M(\d+)@@/g, (_, i) => maths[Number(i)]);
  }

  // نص السؤال الظاهر حاليًا على الشاشة (أقرب سؤال لمنتصف الشاشة)
  function currentQuestionText() {
    const arts = [...document.querySelectorAll('article.q')];
    if (!arts.length) return '';
    const mid = innerHeight / 2;
    let best = arts[0], bestD = Infinity;
    for (const a of arts) {
      const r = a.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) continue;
      const d = r.top <= mid && r.bottom >= mid ? 0 : Math.min(Math.abs(r.top - mid), Math.abs(r.bottom - mid));
      if (d < bestD) { bestD = d; best = a; }
    }
    const txt = (sel) => (best.querySelector(sel) || {}).innerText || '';
    const title = txt('.q-title').trim();
    const isBook = /^[١٢]-/.test(title);
    const opts = [...best.querySelectorAll('.opt')].map((o) => o.innerText.replace(/\s+/g, ' ').trim());
    return [
      `أحل هذا السؤال في الاختبار${isBook ? ' (مهمة من كتاب موهبة)' : ''}: «${title}»`,
      txt('.q-story').trim(),
      txt('.q-ask').replace(/^السؤال:\s*/, 'السؤال: ').trim(),
      opts.length ? 'الخيارات: ' + opts.join(' / ') : '',
      'أعطني تلميحًا يساعدني أفكر.',
    ].filter(Boolean).join('\n');
  }

  function build(cfg) {
    const MAX = cfg.maxMessageChars || 1000;
    const history = [];
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <aside class="helper" id="helper" aria-label="المساعد الذكي" hidden>
        <div class="helper-head">
          <strong>🤖 المساعد الذكي</strong>
          <span class="helper-mode">${CONTEXT === 'exam' ? 'وضع الاختبار: تلميحات فقط' : ''}</span>
          <span class="helper-tools">
            <button type="button" class="icon-btn" data-h="new" title="محادثة جديدة" aria-label="محادثة جديدة">✨</button>
            <button type="button" class="icon-btn" data-h="min" title="تصغير" aria-label="تصغير المساعد">—</button>
          </span>
        </div>
        <div class="helper-log" aria-live="polite">
          <div class="msg bot"><p>أهلًا! أنا معك أثناء الاختبار 👋</p><p>أعطيك <strong>تلميحات</strong> وأشرح لك الفكرة، لكن لا أعطيك الجواب النهائي. الحل الكامل يظهر بعد تسليم الاختبار.</p></div>
        </div>
        <button type="button" class="btn small secondary helper-cur" data-h="cur">📋 أرسل السؤال الحالي للمساعد</button>
        <form class="helper-form" autocomplete="off">
          <textarea rows="2" placeholder="اكتب سؤالك هنا…" aria-label="سؤالك للمساعد"></textarea>
          <button class="btn small" type="submit">إرسال</button>
        </form>
        <div class="helper-foot">لا تكتب معلومات شخصية. المحادثة لا تُحفظ.</div>
      </aside>
      <button type="button" class="helper-fab" id="helper-fab" aria-label="فتح المساعد الذكي" hidden>🤖 المساعد</button>`;
    document.body.append(...wrap.children);
    const panel = document.getElementById('helper');
    const fab = document.getElementById('helper-fab');
    const log = panel.querySelector('.helper-log');
    const input = panel.querySelector('textarea');
    const sendBtn = panel.querySelector('.helper-form .btn');

    function add(role, content) {
      const d = document.createElement('div');
      d.className = 'msg ' + role;
      if (role === 'bot') d.innerHTML = md(content); else d.textContent = content;
      d.dir = 'auto';
      log.appendChild(d);
      log.scrollTop = log.scrollHeight;
    }
    function setMin(min) {
      panel.hidden = min;
      fab.hidden = !min;
      document.body.classList.toggle('helper-open', !min);
      try { localStorage.setItem(KEY_MIN, min ? '1' : '0'); } catch (e) { /* */ }
      if (!min) { loadLibs(); setTimeout(() => input.focus({ preventScroll: true }), 50); }
    }
    let saved = null;
    try { saved = localStorage.getItem(KEY_MIN); } catch (e) { /* */ }
    // أول مرة: مفتوح على الشاشات الكبيرة، مصغّر على الجوال
    setMin(saved === null ? !matchMedia('(min-width: 1100px)').matches : saved === '1');

    fab.addEventListener('click', () => setMin(false));
    panel.addEventListener('click', (e) => {
      const b = e.target.closest('[data-h]');
      if (!b) return;
      if (b.dataset.h === 'min') setMin(true);
      if (b.dataset.h === 'new') { history.length = 0; log.querySelectorAll('.msg:not(:first-child), .typing').forEach((m) => m.remove()); }
      if (b.dataset.h === 'cur') {
        const t = currentQuestionText();
        if (!t) { add('err', 'افتح سؤالًا في الاختبار أولًا.'); return; }
        input.value = t.slice(0, MAX); input.focus();
      }
    });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); } });
    panel.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); ask(); });

    let busy = false;
    async function ask() {
      const text = input.value.trim();
      if (!text || busy) return;
      if (text.length > MAX) { add('err', `سؤالك طويل. اختصره إلى ${MAX} حرف أو أقل.`); return; }
      if (!cfg.chatEndpoint) { add('err', 'المساعد غير مفعّل بعد.'); return; }
      busy = true; sendBtn.disabled = true;
      input.value = '';
      add('user', text);
      history.push({ role: 'user', content: text });
      const typing = document.createElement('div');
      typing.className = 'typing';
      typing.innerHTML = 'يفكّر <span>●</span><span>●</span><span>●</span>';
      log.appendChild(typing); log.scrollTop = log.scrollHeight;
      try {
        await loadLibs();
        const res = await fetch(cfg.chatEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: history.slice(-(cfg.maxHistory || 12)), context: CONTEXT }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || (res.status === 429 ? 'أرسلت رسائل كثيرة بسرعة. انتظر دقيقة ثم حاول مرة أخرى.' : 'حدث خطأ في الاتصال. حاول مرة أخرى.'));
        history.push({ role: 'assistant', content: data.reply });
        add('bot', data.reply);
      } catch (e) {
        history.pop();
        add('err', e.message && /[؀-ۿ]/.test(e.message) ? e.message : 'تعذّر الاتصال بالمساعد. تأكد من الإنترنت وحاول مرة أخرى.');
      } finally {
        typing.remove(); busy = false; sendBtn.disabled = false;
      }
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    let cfg = {};
    try { cfg = await App.json('data/config.json'); } catch (e) { return; }
    if (!cfg.chatEndpoint) return; // بدون رابط المساعد لا نعرض النافذة
    build(cfg);
  });
})();
