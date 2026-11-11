/* ===== الأدوات المشتركة لكل الصفحات ===== */
(function () {
  const LEVELS = { m1: 'أول متوسط', m2: 'ثاني متوسط', m3: 'ثالث متوسط', book1: 'كتاب موهبة ١', book2: 'كتاب موهبة ٢' };
  const GRADE_LEVELS = ['m1', 'm2', 'm3'];
  const BOOK_PDF = 'assets/docs/bebras-activity-book.pdf';
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
    ['videos.html', 'الفيديوهات'],
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

  // ----- هوية الطالب/المعلم + السجلات -----
  // يُطلب الاسم مرة واحدة ويُحفظ في الجهاز. السجلات (زيارات، تدريب، اختبارات) تُرسل للخادم ويراها المشرف فقط.
  const UKEY = 'bebras-user-v1';
  let memUser = null;
  function getUser() {
    try { const u = JSON.parse(localStorage.getItem(UKEY)); if (u && u.id && u.name && u.role) return u; } catch (e) { /* */ }
    return memUser;
  }
  function setUser(u) { memUser = u; try { localStorage.setItem(UKEY, JSON.stringify(u)); } catch (e) { /* */ } }
  function newId() {
    try { return crypto.randomUUID(); } catch (e) { return 'u-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12); }
  }
  let logUrl = null;
  async function logEndpoint() {
    if (logUrl !== null) return logUrl;
    try { const c = await json('data/config.json'); logUrl = c.logEndpoint || (c.chatEndpoint ? c.chatEndpoint.replace(/\/+$/, '') + '/log' : ''); } catch (e) { logUrl = ''; }
    return logUrl;
  }
  async function log(type, data = {}) {
    const u = getUser();
    if (!u) return;
    const url = await logEndpoint();
    if (!url) return;
    const body = JSON.stringify({ user: { id: u.id, role: u.role, name: u.name, grade: u.grade || null }, type, page: location.pathname.split('/').pop() || 'index.html', ...data });
    // text/plain = «طلب بسيط» بدون فحص مسبق (preflight)، لأن المتصفحات ترفض keepalive مع الفحص المسبق
    try { fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body, keepalive: true }).catch(() => {}); } catch (e) { /* */ }
  }
  const GRADE_NAMES = { m1: 'أول متوسط', m2: 'ثاني متوسط', m3: 'ثالث متوسط' };
  const words = (s) => String(s).trim().split(/\s+/).filter(Boolean);

  function gate(prefill) {
    return new Promise((resolve) => {
      const u = prefill || {};
      const w = document.createElement('div');
      w.className = 'ask-overlay gate';
      w.innerHTML = `<form class="ask-box card gate-box" role="dialog" aria-modal="true" aria-labelledby="gate-t" novalidate>
        <img class="gate-logo" src="assets/book/beaver-ksa.png" alt="" width="105" height="164">
        <h2 id="gate-t">أهلًا بك في بيبراس تدريب موهبة 👋</h2>
        <p class="muted" style="margin-top:0">قبل البدء، عرّفنا بنفسك:</p>
        <div class="gate-roles" role="radiogroup" aria-label="أنا">
          <label><input type="radio" name="role" value="student" ${u.role !== 'teacher' ? 'checked' : ''}><span>🎒 طالب</span></label>
          <label><input type="radio" name="role" value="teacher" ${u.role === 'teacher' ? 'checked' : ''}><span>👨‍🏫 معلم</span></label>
        </div>
        <label class="gate-f"><span class="gate-name-l">اسمك</span><input name="name" maxlength="80" autocomplete="name" value="${esc(u.name || '')}"></label>
        <label class="gate-f gate-grade"><span>صفّك</span><select name="grade">
          <option value="">اختر صفّك…</option>${Object.entries(GRADE_NAMES).map(([v, t]) => `<option value="${v}" ${u.grade === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <p class="gate-err" role="alert"></p>
        <button class="btn" type="submit">ابدأ ←</button>
        <p class="gate-note"></p>
      </form>`;
      document.body.appendChild(w);
      const f = w.querySelector('form');
      const err = w.querySelector('.gate-err');
      const sync = () => {
        const teacher = f.role.value === 'teacher';
        w.querySelector('.gate-grade').hidden = teacher;
        w.querySelector('.gate-name-l').textContent = teacher ? 'اسمك الثلاثي' : 'اسمك';
        f.name.placeholder = teacher ? 'مثال: محمد عبدالله القحطاني' : 'اكتب اسمك';
        w.querySelector('.gate-note').textContent = `🔒 يُحفظ اسمك${teacher ? '' : ' وصفّك'} ونتائجك ويراها مشرف الموقع فقط لمتابعة التقدّم. لا تكتب رقم جوالك أو أي معلومات أخرى.`;
        err.textContent = '';
      };
      f.querySelectorAll('[name="role"]').forEach((r) => r.addEventListener('change', sync));
      sync();
      setTimeout(() => f.name.focus(), 50);
      f.addEventListener('submit', (e) => {
        e.preventDefault();
        const role = f.role.value;
        const name = f.name.value.replace(/\s+/g, ' ').trim();
        const grade = f.grade.value;
        if (/[0-9٠-٩@]/.test(name)) { err.textContent = 'اكتب الاسم بالحروف فقط.'; return; }
        if (role === 'teacher') {
          if (words(name).length < 3 || words(name).some((x) => x.length < 2)) { err.textContent = 'اكتب اسمك الثلاثي (ثلاث كلمات على الأقل).'; return; }
        } else {
          if (name.length < 2) { err.textContent = 'اكتب اسمك.'; return; }
          if (!grade) { err.textContent = 'اختر صفّك.'; return; }
        }
        const user = { id: u.id || newId(), role, name, grade: role === 'student' ? grade : null };
        setUser(user);
        w.remove();
        updateUserBtn();
        resolve(user);
      });
    });
  }
  function updateUserBtn() {
    const b = document.getElementById('user-btn');
    const u = getUser();
    if (!b) return;
    b.hidden = !u;
    if (u) {
      b.querySelector('span').textContent = words(u.name)[0];
      b.title = `${u.name}${u.grade ? ' • ' + GRADE_NAMES[u.grade] : u.role === 'teacher' ? ' • معلم' : ''}`;
    }
  }
  async function ensureUser() {
    if (!getUser()) await gate();
    updateUserBtn();
    log('visit', { title: document.title });
    checkAdminAccess();
  }

  // زر «لوحة المشرف»: يظهر فقط لمن منحه المالك صلاحية المشاهدة، وعلى جهازه الذي سجّل منه
  async function accessBase() {
    try { const c = await json('data/config.json'); return (c.chatEndpoint || '').replace(/\/+$/, ''); } catch (e) { return ''; }
  }
  async function checkAdminAccess() {
    const u = getUser();
    const b = document.getElementById('admin-btn');
    if (!u || !b) return;
    const ck = 'bebras-admin-ok:' + u.id;
    let cached = null;
    try { cached = JSON.parse(sessionStorage.getItem(ck)); } catch (e) { /* */ }
    let viewer = cached && Date.now() - cached.t < 10 * 60000 ? cached.v : null;
    if (viewer === null) {
      const base = await accessBase();
      if (!base) return;
      try {
        const r = await fetch(base + '/access/check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uid: u.id }) });
        viewer = r.ok ? !!(await r.json()).viewer : false;
        try { sessionStorage.setItem(ck, JSON.stringify({ v: viewer, t: Date.now() })); } catch (e) { /* */ }
      } catch (e) { return; }
    }
    b.hidden = !viewer;
  }
  async function openAdmin() {
    const u = getUser();
    const b = document.getElementById('admin-btn');
    if (!u) return;
    b.disabled = true;
    try {
      const base = await accessBase();
      const r = await fetch(base + '/access/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uid: u.id }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.url) { try { sessionStorage.removeItem('bebras-admin-ok:' + u.id); } catch (e) { /* */ } b.hidden = true; ask(j.message || 'ليست لديك صلاحية دخول لوحة المشرف.', { yes: 'حسنًا', no: '' }); return; }
      location.href = j.url;
    } catch (e) { ask('تعذّر الاتصال. حاول مرة أخرى.', { yes: 'حسنًا', no: '' }); }
    finally { b.disabled = false; }
  }

  // ----- الرأس والتذييل -----
  function shell() {
    const page = location.pathname.split('/').pop() || 'index.html';
    const header = document.getElementById('site-header');
    if (header) {
      header.className = 'site-header';
      header.innerHTML = `
        <div class="wrap">
          <a class="brand" href="index.html"><span class="logo" aria-hidden="true"><img src="assets/book/beaver-ksa.png" alt="" width="105" height="164"></span>بيبراس تدريب موهبة</a>
          <nav class="nav" id="nav" aria-label="القائمة الرئيسية">
            ${NAV.map(([href, label]) => `<a href="${href}" class="${href === page ? 'active' : ''}">${label}</a>`).join('')}
          </nav>
          <div class="header-tools">
            <button class="user-btn admin-btn" id="admin-btn" type="button" hidden title="لوحة المشرف (مشاهدة)"><b aria-hidden="true">📊</b><span>لوحة المشرف</span></button>
            <button class="user-btn" id="user-btn" type="button" hidden aria-label="حسابي"><b aria-hidden="true">👤</b><span></span></button>
            <button class="icon-btn" id="theme-btn" type="button"></button>
            <button class="icon-btn menu-btn" id="menu-btn" type="button" aria-label="القائمة" aria-expanded="false">☰</button>
          </div>
        </div>`;
      document.getElementById('theme-btn').addEventListener('click', toggleTheme);
      document.getElementById('admin-btn').addEventListener('click', openAdmin);
      document.getElementById('user-btn').addEventListener('click', () => {
        const u = getUser();
        if (!u) return;
        const who = `${u.name}${u.grade ? ' (' + GRADE_NAMES[u.grade] + ')' : u.role === 'teacher' ? ' (معلم)' : ''}`;
        ask(`أنت مسجّل باسم:\n${who}\n\nهل تريد تعديل الاسم أو الصف؟`, { yes: 'تعديل', no: 'إغلاق' }).then((ok) => { if (ok) gate(u); });
      });
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
        <a class="footer-logo" href="https://www.mawhiba.sa" target="_blank" rel="noopener" title="موهبة"><img src="assets/book/mawhiba-logo.png" alt="موهبة Mawhiba" width="247" height="96"></a>
        <nav class="footer-links" aria-label="مواقع رسمية"><span class="footer-label">مواقع رسمية:</span>
          ${official.map(([t, u]) => `<a href="${u}" target="_blank" rel="noopener">${t}</a>`).join('')}</nav>
        <p class="footer-note">موقع تعليمي مجاني غير رسمي للتدريب على التفكير الحاسوبي • أسئلة البنك من تأليف الموقع، ومهام «كتاب موهبة» من <a href="${BOOK_PDF}" target="_blank" rel="noopener">كتاب النشاط الرسمي</a> لفريق بيبراس السعودي • للتسجيل والمواعيد: <a href="https://bebrasksa.org" target="_blank" rel="noopener">bebrasksa.org</a><br>🔒 نحفظ الاسم والصف والنتائج فقط، ويراها مشرف الموقع لمتابعة التقدّم، ولا نشاركها مع أي جهة. المحادثات مع المساعد لا تُحفظ.</p>
        <p class="footer-credit">إعداد وتصميم <span class="creator">أحمد أيمن الغامدي</span></p>
        <nav class="footer-contact" aria-label="للاستفسار"><span class="footer-label">للاستفسار:</span>
          <a href="tel:+966552922353" rel="noopener"><span aria-hidden="true">📞</span> <bdi dir="ltr">0552922353</bdi></a>
          <a href="https://wa.me/966552922353" target="_blank" rel="noopener"><span aria-hidden="true">💬</span> واتساب</a>
          <a href="https://www.snapchat.com/add/cv29q" target="_blank" rel="noopener"><span aria-hidden="true">👻</span> سناب شات <bdi dir="ltr">cv29q</bdi></a>
          <a href="https://www.tiktok.com/@a_alghamdi707" target="_blank" rel="noopener"><span aria-hidden="true">🎵</span> تيك توك <bdi dir="ltr">@a_alghamdi707</bdi></a>
        </nav>
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

  window.App = { user: getUser, log, LEVELS, GRADE_LEVELS, BOOK_PDF, DIFFS, TYPES, json, esc, fmt, param, progress, skills, skillMap, questions, loadError, shuffle, sortByDifficulty, printHTML, ask };
  document.addEventListener('DOMContentLoaded', () => { shell(); ensureUser(); });
})();
