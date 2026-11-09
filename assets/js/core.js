/* ===== الأدوات المشتركة لكل الصفحات ===== */
(function () {
  const LEVELS = { g34: 'الصف ٣–٤ ابتدائي', g56: 'الصف ٥–٦ ابتدائي', mid: 'المتوسط', sec: 'الثانوي' };
  const DIFFS = { easy: 'سهل', medium: 'متوسط', hard: 'صعب' };
  const DIFF_ORDER = { easy: 0, medium: 1, hard: 2 };
  const TYPES = { mcq: 'اختيار من متعدد', short: 'إجابة قصيرة', order: 'ترتيب', drag: 'سحب وإفلات', map: 'الضغط على الرسم' };
  const NAV = [
    ['index.html', 'الرئيسية'],
    ['about.html', 'عن المسابقة'],
    ['lessons.html', 'الدروس'],
    ['summaries.html', 'الملخصات'],
    ['bank.html', 'بنك الأسئلة'],
    ['quizzes.html', 'الاختبارات'],
    ['chat.html', 'المساعد الذكي'],
  ];

  const cache = {};
  function json(path) {
    if (!cache[path]) {
      cache[path] = fetch(path, { cache: 'no-cache' }).then((r) => {
        if (!r.ok) throw new Error('تعذر تحميل ' + path);
        return r.json();
      });
    }
    return cache[path];
  }

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // تنسيق بسيط للنصوص القادمة من ملفات JSON: **غامق**، `كود`، وأسطر جديدة
  function fmt(s) {
    return esc(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  function param(name) {
    return new URLSearchParams(location.search).get(name);
  }

  // ----- التقدم المحفوظ في المتصفح فقط -----
  const KEY = 'bebras-progress-v1';
  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  function save(p) {
    try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) { /* التخزين غير متاح */ }
  }
  const progress = {
    get() {
      const p = load();
      p.lessons = p.lessons || {};
      p.solved = p.solved || {};
      p.quizzes = p.quizzes || {};
      return p;
    },
    markLesson(id) { const p = progress.get(); p.lessons[id] = true; save(p); },
    markSolved(qid) { const p = progress.get(); p.solved[qid] = true; save(p); },
    saveQuiz(id, score, total) {
      const p = progress.get();
      const prev = p.quizzes[id] || {};
      p.quizzes[id] = { last: score, total, best: Math.max(score, prev.best || 0), date: new Date().toISOString().slice(0, 10) };
      save(p);
    },
    reset() { try { localStorage.removeItem(KEY); } catch (e) { /* */ } },
  };

  // ----- الوضع الداكن/الفاتح -----
  function currentTheme() {
    const t = document.documentElement.dataset.theme;
    if (t) return t;
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function toggleTheme() {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch (e) { /* */ }
    updateThemeBtn();
  }
  function updateThemeBtn() {
    const b = document.getElementById('theme-btn');
    if (b) {
      const dark = currentTheme() === 'dark';
      b.textContent = dark ? '☀️' : '🌙';
      b.title = dark ? 'الوضع الفاتح' : 'الوضع الداكن';
      b.setAttribute('aria-label', b.title);
    }
  }

  // ----- الرأس والتذييل -----
  function shell() {
    const page = location.pathname.split('/').pop() || 'index.html';
    const header = document.getElementById('site-header');
    if (header) {
      header.className = 'site-header';
      header.innerHTML = `
        <div class="wrap">
          <a class="brand" href="index.html"><span class="logo" aria-hidden="true">🦫</span>بيبراس تدريب موهبة</a>
          <nav class="nav" id="nav" aria-label="القائمة الرئيسية">
            ${NAV.map(([href, label]) => `<a href="${href}" class="${href === page ? 'active' : ''}">${label}</a>`).join('')}
          </nav>
          <div class="header-tools">
            <button class="icon-btn" id="theme-btn" type="button"></button>
            <button class="icon-btn menu-btn" id="menu-btn" type="button" aria-label="القائمة" aria-expanded="false">☰</button>
          </div>
        </div>`;
      document.getElementById('theme-btn').addEventListener('click', toggleTheme);
      const mb = document.getElementById('menu-btn');
      mb.addEventListener('click', () => {
        const nav = document.getElementById('nav');
        nav.classList.toggle('open');
        mb.setAttribute('aria-expanded', nav.classList.contains('open'));
      });
      updateThemeBtn();
    }
    const footer = document.getElementById('site-footer');
    if (footer) {
      footer.className = 'site-footer';
      const official = [
        ['موهبة', 'https://www.mawhiba.sa'],
        ['بيبراس موهبة (الموقع الرسمي)', 'https://bebrasksa.org'],
        ['بيبراس العالمية', 'https://www.bebras.org'],
        ['وزارة التعليم', 'https://moe.gov.sa'],
      ];
      footer.innerHTML = `<div class="wrap">
        <nav class="footer-links" aria-label="مواقع رسمية"><span class="footer-label">مواقع رسمية:</span>
          ${official.map(([t, u]) => `<a href="${u}" target="_blank" rel="noopener">${t}</a>`).join('')}</nav>
        <p class="footer-note">موقع تعليمي مجاني غير رسمي للتدريب على التفكير الحاسوبي • الأسئلة من تأليف الموقع وليست أسئلة رسمية • للتسجيل والمواعيد: <a href="https://bebrasksa.org" target="_blank" rel="noopener">bebrasksa.org</a><br>تقدّمك يُحفظ في جهازك فقط، ولا نجمع أي بيانات شخصية.</p>
        <p class="footer-credit">إعداد وتصميم <span class="creator">أحمد أيمن الغامدي</span></p>
      </div>`;
    }
  }

  // ----- تحميل البيانات -----
  async function skills() { return json('data/skills.json'); }
  async function skillMap() {
    const list = await skills();
    const m = {};
    list.forEach((s) => { m[s.id] = s; });
    return m;
  }
  async function questions() {
    const idx = await json('data/questions/index.json');
    const parts = await Promise.all(idx.files.map((f) => json('data/questions/' + f)));
    return parts.flat();
  }

  function loadError(el, err) {
    const local = location.protocol === 'file:';
    el.innerHTML = `<div class="notice err"><strong>تعذّر تحميل المحتوى.</strong><br>${
      local
        ? 'افتح الموقع عبر خادم (مثل GitHub Pages)، أو شغّل في مجلد الموقع الأمر: <code>python -m http.server 8000</code> ثم افتح <code>http://localhost:8000</code>.'
        : esc(err && err.message)
    }</div>`;
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function sortByDifficulty(list) {
    return list.map((q, i) => [q, i]).sort((x, y) => (DIFF_ORDER[x[0].difficulty] - DIFF_ORDER[y[0].difficulty]) || (x[1] - y[1])).map((x) => x[0]);
  }

  // طباعة محتوى مخصص: يوضع في #print-area ثم يُطبع ويُزال
  function printHTML(html) {
    let area = document.getElementById('print-area');
    if (!area) {
      area = document.createElement('div');
      area.id = 'print-area';
      document.body.appendChild(area);
    }
    area.innerHTML = html;
    document.body.classList.add('has-print');
    const done = () => { document.body.classList.remove('has-print'); area.innerHTML = ''; window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(() => window.print(), 60);
  }

  // نافذة تأكيد داخل الصفحة (بديل confirm/alert اللذين لا يعملان في بعض المتصفحات المضمّنة)
  function ask(msg, opts) {
    const o = Object.assign({ yes: 'نعم', no: 'إلغاء' }, opts);
    return new Promise((resolve) => {
      const wrap = document.createElement('div');
      wrap.className = 'ask-overlay';
      wrap.innerHTML = `<div class="ask-box card" role="dialog" aria-modal="true">
        <p>${esc(msg).replace(/\n/g, '<br>')}</p>
        <div class="ask-actions"><button class="btn" type="button" data-v="1">${esc(o.yes)}</button>${
          o.no ? `<button class="btn secondary" type="button" data-v="0">${esc(o.no)}</button>` : ''}</div></div>`;
      const close = (v) => { wrap.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
      const onKey = (e) => { if (e.key === 'Escape') close(false); };
      wrap.addEventListener('click', (e) => {
        const b = e.target.closest('[data-v]');
        if (b) close(b.dataset.v === '1'); else if (e.target === wrap) close(false);
      });
      document.addEventListener('keydown', onKey);
      document.body.appendChild(wrap);
      wrap.querySelector('[data-v="1"]').focus();
    });
  }

  window.App = { LEVELS, DIFFS, TYPES, json, esc, fmt, param, progress, skills, skillMap, questions, loadError, shuffle, sortByDifficulty, printHTML, ask };
  document.addEventListener('DOMContentLoaded', shell);
})();
