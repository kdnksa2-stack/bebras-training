/* ===== الأدوات المشتركة لكل الصفحات ===== */
(function () {
  const LEVELS = { mid: 'أسئلة التدريب', book1: 'كتاب موهبة ١', book2: 'كتاب موهبة ٢' };
  const GRADE_LEVELS = ['mid'];
  const BOOK_PDF = 'assets/docs/bebras-activity-book.pdf';
  const DIFFS = { easy: 'سهل', medium: 'متوسط', hard: 'صعب' };
  const DIFF_ORDER = { easy: 0, medium: 1, hard: 2 };
  const TYPES = { mcq: 'اختيار من متعدد', short: 'إجابة قصيرة', order: 'ترتيب', drag: 'سحب وإفلات', map: 'الضغط على الرسم' };
  const NAV = [
    ['index.html', 'الرئيسية'],
    ['bank.html', 'التدريب'],
    ['quizzes.html', 'المسابقات'],
    ['challenges.html', 'التحديات الأسبوعية'],
    ['leaderboard.html', 'الترتيب'],
    ['achievements.html', 'الإنجازات'],
  ];
  // تحت «المزيد»
  const NAV_MORE = [
    ['lessons.html', 'الدروس'],
    ['summaries.html', 'الملخصات'],
    ['videos.html', 'الفيديوهات'],
    ['chat.html', 'المساعد الذكي'],
    ['about.html', 'عن المسابقة'],
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
      p.tried = p.tried || {};
      p.days = p.days || {};
      p.badges = p.badges || {};
      // نشاط هذا الأسبوع (يبدأ الأسبوع يوم الأحد) — للمهام الأسبوعية
      const wid = weekId();
      if (!p.wk || p.wk.id !== wid) p.wk = { id: wid, tried: {}, solved: {}, hard: {}, lessons: {}, faster: 0 };
      return p;
    },
    markLesson(id) { const p = progress.get(); p.lessons[id] = true; p.wk.lessons[id] = 1; save(p); },
    markSolved(qid, q) {
      const p = progress.get(); p.solved[qid] = true; p.tried[qid] = true;
      p.wk.solved[qid] = 1; p.wk.tried[qid] = 1; if (q && q.difficulty === 'hard') p.wk.hard[qid] = 1;
      save(p);
    },
    markTried(qid) { const p = progress.get(); p.tried[qid] = true; p.wk.tried[qid] = 1; save(p); },
    markDay() { const p = progress.get(); const d = localDay(); if (!p.days[d]) { p.days[d] = true; save(p); } },
    saveQuiz(id, score, total, seconds) {
      const p = progress.get();
      const prev = p.quizzes[id] || {};
      const t = Number(seconds) > 0 ? Math.round(seconds) : null;
      // «حسّن وقتك»: نفس الاختبار، نتيجة لا تقل عن أفضل نتيجة سابقة، وبوقت أقل من أفضل وقت سابق
      if (t && prev.bestTime && t < prev.bestTime && score >= (prev.best || 0)) p.wk.faster = 1;
      p.quizzes[id] = { last: score, total, best: Math.max(score, prev.best || 0), date: localDay(),
        time: t || prev.time || null, bestTime: t ? Math.min(t, prev.bestTime || t) : (prev.bestTime || null) };
      save(p);
    },
    reset() { try { localStorage.removeItem(KEY); } catch (e) { /* */ } },
  };

  // ----- التواريخ (بتوقيت الجهاز) -----
  function localDay(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
  function weekStart(d = new Date()) { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - x.getDay()); return x; }
  function weekId(d = new Date()) { return localDay(weekStart(d)); }

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
        <span class="gate-logo"><img class="logo-l" src="assets/brand/logo-icon.svg" alt="" width="120" height="120"><img class="logo-d" src="assets/brand/logo-icon-dark.svg" alt="" width="120" height="120"></span>
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
      b.querySelector('.acct-name').textContent = words(u.name)[0] || 'حسابي';
      b.title = `${u.name}${u.grade ? ' • ' + GRADE_NAMES[u.grade] : u.role === 'teacher' ? ' • معلم' : ''}`;
    }
  }
  async function ensureUser() {
    if (!getUser()) await gate();
    updateUserBtn();
    progress.markDay();
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

  // ----- أيقونات خطية بسيطة -----
  const ICONS = {
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9a6 6 0 0 1 12 0c0 4.5 1.5 6.5 2 7H4c.5-.5 2-2.5 2-7"/><path d="M10 19.5a2 2 0 0 0 4 0"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><circle cx="12" cy="8.5" r="4"/><path d="M4.5 20.5c.8-4 3.9-6 7.5-6s6.7 2 7.5 6z"/></svg>',
    chev: '<svg class="acct-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
  };

  // ----- الجرس: تنبيهات مفيدة من محتوى الموقع وتقدّم الطالب -----
  async function bellItems() {
    const items = [];
    try {
      const c = await json('data/config.json');
      const t = c.exam && Date.parse(c.exam.at);
      if (t && t > Date.now()) items.push(`<a href="index.html#countdown">📅 <strong>${esc(c.exam.title || 'الاختبار الأصلي لبيبراس')}</strong><br><span class="muted">${esc(c.exam.label || '')}</span></a>`);
    } catch (e) { /* */ }
    try {
      const p = progress.get();
      const list = await skills();
      const next = list.find((s) => !p.lessons[s.id]);
      if (next) items.push(`<a href="lessons.html?id=${next.id}">📘 الدرس التالي لك: <strong>${esc(next.title)}</strong></a>`);
      if (!Object.keys(p.quizzes).length) items.push('<a href="quizzes.html">⏱️ جرّب أول اختبار وقِس مستواك</a>');
    } catch (e) { /* */ }
    return items;
  }
  function setupBell() {
    const btn = document.getElementById('bell-btn');
    const pop = document.getElementById('bell-pop');
    const dot = btn.querySelector('.bell-dot');
    bellItems().then((it) => { dot.hidden = !it.length; });
    const close = () => { pop.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!pop.hidden) { close(); return; }
      const it = await bellItems();
      pop.innerHTML = `<h3>الإشعارات</h3>${it.length ? it.join('') : '<p class="muted">لا توجد إشعارات جديدة.</p>'}`;
      pop.hidden = false; btn.setAttribute('aria-expanded', 'true'); dot.hidden = true;
    });
    document.addEventListener('click', (e) => { if (!pop.hidden && !pop.contains(e.target)) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  }

  // ----- الرأس والتذييل -----
  function shell() {
    const page = location.pathname.split('/').pop() || 'index.html';
    const header = document.getElementById('site-header');
    if (header) {
      header.className = 'site-header';
      header.innerHTML = `
        <div class="wrap">
          <a class="brand" href="index.html" aria-label="بيبراس تدريب موهبة — الرئيسية"><span class="logo" aria-hidden="true"><img class="logo-l" src="assets/brand/logo-icon.svg" alt="" width="120" height="120"><img class="logo-d" src="assets/brand/logo-icon-dark.svg" alt="" width="120" height="120"></span><span class="brand-div" aria-hidden="true"></span><span class="brand-word">بيبراس</span></a>
          <nav class="nav" id="nav" aria-label="القائمة الرئيسية">
            ${NAV.map(([href, label]) => `<a href="${href}" class="${href === page ? 'active' : ''}">${label}</a>`).join('')}
            <div class="more-wrap"><button class="nav-more${NAV_MORE.some(([h]) => h === page) ? ' active' : ''}" id="more-btn" type="button" aria-expanded="false" aria-controls="more-pop">المزيد ${ICONS.chev}</button>
              <div class="more-pop" id="more-pop">${NAV_MORE.map(([href, label]) => `<a href="${href}" class="${href === page ? 'active' : ''}">${label}</a>`).join('')}</div></div>
          </nav>
          <div class="header-tools">
            <button class="user-btn admin-btn" id="admin-btn" type="button" hidden title="لوحة المشرف (مشاهدة)"><b aria-hidden="true">📊</b><span>لوحة المشرف</span></button>
            <div class="bell-wrap"><button class="bell-btn" id="bell-btn" type="button" aria-label="الإشعارات" aria-expanded="false" aria-controls="bell-pop">${ICONS.bell}<span class="bell-dot" hidden></span></button>
              <div class="bell-pop" id="bell-pop" hidden></div></div>
            <button class="acct-btn" id="user-btn" type="button" hidden aria-label="حسابي"><span class="acct-av" aria-hidden="true">${ICONS.user}</span><span class="acct-name">حسابي</span>${ICONS.chev}</button>
            <button class="icon-btn theme-btn" id="theme-btn" type="button"></button>
            <button class="icon-btn menu-btn" id="menu-btn" type="button" aria-label="القائمة" aria-expanded="false">☰</button>
          </div>
        </div>`;
      document.getElementById('theme-btn').addEventListener('click', toggleTheme);
      setupBell();
      const moreB = document.getElementById('more-btn');
      const moreP = document.getElementById('more-pop');
      moreB.addEventListener('click', (e) => { e.stopPropagation(); const o = moreP.classList.toggle('show'); moreB.setAttribute('aria-expanded', o); });
      document.addEventListener('click', (e) => { if (!moreP.contains(e.target)) { moreP.classList.remove('show'); moreB.setAttribute('aria-expanded', 'false'); } });
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


  // =====================================================================
  //  التحفيز: سلسلة الأيام، المهام الأسبوعية، الأوسمة، الترتيب
  // =====================================================================
  const GROUPS = [
    { key: 'logic', name: 'المنطق', skills: ['logic', 'graphs', 'trees', 'abstraction'] },
    { key: 'algo', name: 'الخوارزميات', skills: ['algorithms', 'loops', 'sorting', 'stackqueue'] },
    { key: 'num', name: 'الأعداد والبيانات', skills: ['binary', 'data', 'patterns', 'optimization'] },
  ];
  function weekGroup() { return GROUPS[Math.floor(weekStart().getTime() / (7 * 864e5)) % GROUPS.length]; }
  function streak(p) {
    const has = (d) => !!p.days[localDay(d)];
    const d = new Date(); if (!has(d)) d.setDate(d.getDate() - 1);
    let n = 0; while (has(d) && n < 3650) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  // الأيقونات (24×24)
  const GI = {
    star: '<path d="M12 3.2l2.7 5.5 6 .9-4.35 4.2 1 6L12 17l-5.35 2.8 1-6L3.3 9.6l6-.9z" fill="currentColor"/>',
    bolt: '<path d="M13.2 2.5 5 13.6h6.2L10.3 21.5 19 10.2h-6.3z" fill="currentColor"/>',
    puzzle: '<path d="M9.5 4.5h2.2a2.3 2.3 0 1 1 4.6 0h2.2v4.4a2.3 2.3 0 1 1 0 4.6v5H14a2.3 2.3 0 1 0-4.6 0H5v-5a2.3 2.3 0 1 0 0-4.6V4.5z" fill="currentColor"/>',
    target: '<g fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/></g><circle cx="12" cy="12" r="1.6" fill="currentColor"/><path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    flame: '<path d="M12.3 2.2c.8 3.6 5.6 5.6 5.6 10.6a5.9 5.9 0 0 1-11.8 0c0-2.4 1.1-4.1 2.4-5.3 0 2.2 1 3.4 2.3 3.6-.3-3.1.2-6 1.5-8.9z" fill="currentColor"/>',
    crown: '<path d="M3 8.2l4.6 3.9L12 5.5l4.4 6.6L21 8.2l-1.8 10.3H4.8z" fill="currentColor"/>',
    book: '<path d="M3.5 5.5c3-1 5.8-.8 8.5 1 2.7-1.8 5.5-2 8.5-1v13c-3-1-5.8-.8-8.5 1-2.7-1.8-5.5-2-8.5-1z M12 6.5v13" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
    cap: '<path d="M2.5 9 12 4.5 21.5 9 12 13.5z" fill="currentColor"/><path d="M6.5 11.3v4.4c3.3 2.6 7.7 2.6 11 0v-4.4M20 9.8v5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    shield: '<path d="M12 2.5l8 3v6.2c0 4.9-3.4 8.4-8 9.8-4.6-1.4-8-4.9-8-9.8V5.5z" fill="currentColor"/><path d="m8.5 12 2.4 2.4 4.6-4.8" fill="none" stroke="#141238" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    trophy: '<path d="M7 3.5h10v5.2a5 5 0 0 1-10 0z" fill="currentColor"/><path d="M7 5.5H3.8a3.6 3.6 0 0 0 3.7 4.3M17 5.5h3.2a3.6 3.6 0 0 1-3.7 4.3M12 13.8v3.4M8 20.5h8M9.5 20.5l.8-3.3h3.4l.8 3.3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    hundred: '<text x="12" y="16.2" text-anchor="middle" font-size="10.5" font-weight="800" font-family="system-ui,sans-serif" fill="currentColor">100</text>',
    grid: '<g fill="currentColor"><rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.6"/><rect x="13" y="3.5" width="7.5" height="7.5" rx="1.6"/><rect x="3.5" y="13" width="7.5" height="7.5" rx="1.6"/><rect x="13" y="13" width="7.5" height="7.5" rx="1.6" opacity=".55"/></g>',
    clock: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4.3l2.8 1.8M9.5 2.5h5"/></g>',
    layers: '<path d="m12 3 9 5-9 5-9-5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="m3 12.5 9 5 9-5M3 16.5l9 5 9-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
    check: '<circle cx="12" cy="12" r="10" fill="currentColor"/><path d="m7.5 12.3 3 3 6-6.3" fill="none" stroke="#0e1030" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  };
  const BADGE_COLORS = { gold: ['#ffd86b', '#f29d0f'], purple: ['#b79bff', '#6d3fe6'], teal: ['#5ff0d8', '#13a7a0'], orange: ['#ffc15a', '#f0731c'], red: ['#ff9a6b', '#e2483d'], blue: ['#8fd0ff', '#3b7cf0'], pink: ['#ff9ee6', '#c63fd6'] };
  function badgeSvg(b, size = 64) {
    const [c1, c2] = b.earned ? BADGE_COLORS[b.color] : ['#4b4a7c', '#33325f'];
    const id = 'hx' + b.id + (b.earned ? '' : 'l');
    return `<svg class="hexb${b.earned ? '' : ' locked'}" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>
      <linearGradient id="${id}i" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2366"/><stop offset="1" stop-color="#141238"/></linearGradient></defs>
      <path d="M32 3.5 56.5 17.7v28.6L32 60.5 7.5 46.3V17.7z" fill="url(#${id}i)" stroke="url(#${id})" stroke-width="4" stroke-linejoin="round"/>
      <g transform="translate(18 18) scale(1.17)" style="color:${b.earned ? c1 : '#5d5b8f'}">${GI[b.icon]}</g></svg>`;
  }
  // المهام الأسبوعية الخمس
  function weekTasks(p, qs) {
    const g = weekGroup();
    const inGroup = qs.filter((q) => g.skills.includes(q.skill)).map((q) => q.id);
    const grpSolved = inGroup.filter((id) => p.wk.solved[id]).length;
    const anyBest = Object.values(p.quizzes).some((r) => r.bestTime);
    const T = [
      { id: 'ten', title: 'حل 10 أسئلة متنوعة', icon: 'check', cur: Object.keys(p.wk.tried).length, goal: 10, href: 'bank.html' },
      { id: 'hard', title: 'حل مسألة تحدٍّ', icon: 'check', cur: Object.keys(p.wk.hard).length, goal: 1, href: 'bank.html?difficulty=hard' },
      { id: 'faster', title: 'حسّن وقتك في الحل', icon: 'clock', cur: p.wk.faster ? 1 : 0, goal: 1, href: 'quizzes.html', note: anyBest ? 'أعد اختبارًا سابقًا بنفس النتيجة أو أفضل وفي وقت أقل' : 'حل اختبارًا، ثم أعده في وقت أقل' },
      { id: 'group', title: `أكمل مجموعة (${g.name})`, icon: 'layers', cur: grpSolved, goal: 10, href: `bank.html?skills=${g.skills.join(',')}&gname=${encodeURIComponent(g.name)}` },
      { id: 'lesson', title: 'أكمل درسًا جديدًا', icon: 'book', cur: Object.keys(p.wk.lessons).length, goal: 1, href: 'lessons.html' },
    ];
    T.forEach((t) => { t.cur = Math.min(t.cur, t.goal); t.done = t.cur >= t.goal; });
    return T;
  }
  // الأوسمة الـ12 وشروطها (من التقدّم المحفوظ في الجهاز)
  function badges(p, qs, quizzes, skillList) {
    const solved = Object.keys(p.solved).length;
    const hardAll = qs.filter((q) => q.difficulty === 'hard' && p.solved[q.id]).length;
    const lessons = Object.keys(p.lessons).length;
    const st = streak(p);
    const bestPct = Math.max(0, ...Object.values(p.quizzes).map((r) => (r.total ? r.best / r.total : 0)));
    const sims = quizzes.filter((z) => z.sim && p.quizzes[z.id]).length;
    const skillsHit = new Set(qs.filter((q) => p.solved[q.id]).map((q) => q.skill)).size;
    const wt = weekTasks(p, qs); const wDone = wt.filter((t) => t.done).length;
    const nSk = skillList.length || 12;
    const L = [
      { id: 'start', name: 'بداية قوية', desc: 'أول إجابة صحيحة', icon: 'star', color: 'gold', cur: solved, goal: 1 },
      { id: 'persist', name: 'مُثابر', desc: 'تدرّب 3 أيام متتالية', icon: 'bolt', color: 'orange', cur: st, goal: 3 },
      { id: 'puzzler', name: 'محلّ الألغاز', desc: 'حل 25 سؤالًا', icon: 'puzzle', color: 'teal', cur: solved, goal: 25 },
      { id: 'accurate', name: 'دقّة الحل', desc: '90% أو أكثر في اختبار', icon: 'target', color: 'purple', cur: Math.round(bestPct * 100), goal: 90 },
      { id: 'week7', name: 'سلسلة أسبوع', desc: 'تدرّب 7 أيام متتالية', icon: 'flame', color: 'red', cur: st, goal: 7 },
      { id: 'hero', name: 'بطل الأسبوع', desc: 'أكمل كل المهام الأسبوعية', icon: 'crown', color: 'gold', cur: wDone, goal: wt.length },
      { id: 'reader', name: 'قارئ نشيط', desc: 'أكمل 6 دروس', icon: 'book', color: 'blue', cur: lessons, goal: 6 },
      { id: 'scholar', name: 'سيد الدروس', desc: `أكمل الدروس الـ${nSk}`, icon: 'cap', color: 'purple', cur: lessons, goal: nSk },
      { id: 'brave', name: 'متحدٍّ', desc: 'حل 5 أسئلة صعبة', icon: 'shield', color: 'pink', cur: hardAll, goal: 5 },
      { id: 'sim', name: 'محاكي المسابقة', desc: 'أكمل محاكاة المسابقة', icon: 'trophy', color: 'gold', cur: sims, goal: 1 },
      { id: 'all', name: 'شامل', desc: 'حل سؤالًا من كل مهارة', icon: 'grid', color: 'teal', cur: skillsHit, goal: nSk },
      { id: 'hundred', name: 'المئة', desc: 'حل 100 سؤال', icon: 'hundred', color: 'blue', cur: solved, goal: 100 },
    ];
    let changed = false;
    L.forEach((b) => {
      b.earned = b.cur >= b.goal;
      if (b.earned && !p.badges[b.id]) { p.badges[b.id] = Date.now(); changed = true; b.isNew = true; }
      b.at = p.badges[b.id] || 0;
    });
    if (changed) save(p);
    return L;
  }
  function weekEnds() { const e = weekStart(); e.setDate(e.getDate() + 7); return e; }
  // الترتيب من الخادم (يُحفظ دقيقة واحدة)
  async function board(period = 'all') {
    const u = getUser();
    const k = 'bebras-board-' + period;
    try { const c = JSON.parse(sessionStorage.getItem(k)); if (c && Date.now() - c.t < 60000 && c.uid === (u && u.id)) return c.d; } catch (e) { /* */ }
    const c = await json('data/config.json');
    const base = c.boardEndpoint || (c.chatEndpoint ? c.chatEndpoint.replace(/\/+$/, '') + '/board' : '');
    if (!base) throw new Error('no_board');
    const r = await fetch(`${base}?period=${period}${u ? '&uid=' + encodeURIComponent(u.id) : ''}`);
    if (!r.ok) throw new Error('board ' + r.status);
    const d = await r.json();
    try { sessionStorage.setItem(k, JSON.stringify({ t: Date.now(), uid: u && u.id, d })); } catch (e) { /* */ }
    return d;
  }
  const game = { GROUPS, weekGroup, streak, badges, badgeSvg, weekTasks, weekEnds, board, GI, localDay };

  window.App = { game, user: getUser, log, LEVELS, GRADE_LEVELS, BOOK_PDF, DIFFS, TYPES, json, esc, fmt, param, progress, skills, skillMap, questions, loadError, shuffle, sortByDifficulty, printHTML, ask };
  document.addEventListener('DOMContentLoaded', () => { shell(); ensureUser(); });
})();
