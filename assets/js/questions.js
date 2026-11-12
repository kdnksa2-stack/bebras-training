/* ===== محرك الأسئلة: العرض، التفاعل، التصحيح، والطباعة =====
   الأنواع: mcq (اختيار)، short (إجابة قصيرة)، order (ترتيب)، drag (سحب وإفلات)، map (الضغط على الرسم)
*/
(function () {
  const { esc, fmt } = App;
  const LETTERS = ['أ', 'ب', 'جـ', 'د', 'هـ', 'و'];

  // توحيد الكتابة للمقارنة: الأرقام العربية، الهمزات، التاء المربوطة، المسافات
  function norm(s) {
    return String(s ?? '')
      .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
      .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
      .replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ـ/g, '')
      .replace(/[ً-ْ]/g, '').replace(/[\s.,،]+/g, '').toLowerCase();
  }
  const sameArr = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => x === b[i]);

  function isAnswered(q, r) {
    if (r === undefined || r === null) return false;
    if (q.type === 'short') return String(r).trim() !== '';
    if (q.type === 'drag') return Object.keys(r).length > 0;
    if (q.type === 'map' && q.mode !== 'single') return r.length > 0;
    return true;
  }

  function isCorrect(q, r) {
    if (!isAnswered(q, r)) return false;
    switch (q.type) {
      case 'mcq': return r === q.answer;
      case 'short': return [q.answer, ...(q.accept || [])].some((a) => norm(a) === norm(r));
      case 'order': return sameArr(r, q.answer);
      case 'drag': return q.items.every((it) => r[it.id] === q.answer[it.id]);
      case 'map':
        if (q.mode === 'single') return Array.isArray(q.answer) ? q.answer.includes(r) : r === q.answer;
        if (q.mode === 'set') return sameArr([...r].sort(), [...q.answer].sort());
        // path: إجابة واحدة أو عدة مسارات صحيحة
        return Array.isArray(q.answer[0]) ? q.answer.some((a) => sameArr(r, a)) : sameArr(r, q.answer);
      default: return false;
    }
  }

  // نص مقروء لأي قيمة (إجابة الطالب أو الإجابة الصحيحة)
  function valueText(q, v) {
    if (!isAnswered(q, v)) return 'لم تتم الإجابة';
    const itemLabel = (id) => (q.items.find((i) => i.id === id) || {}).label || id;
    switch (q.type) {
      case 'mcq': return `${LETTERS[v]}) ${optText(q.options[v])}`;
      case 'short': return String(v) + (q.unit ? ' ' + q.unit : '');
      case 'order': return v.map(itemLabel).join(' ← ');
      case 'drag': return q.bins.map((b) => `${b.label}: ${q.items.filter((i) => v[i.id] === b.id).map((i) => i.label).join('، ') || '—'}`).join(' | ');
      case 'map': {
        const L = (id) => Fig.labelOf(q.figure, id);
        if (q.mode === 'single') return L(v);
        return v.map(L).join(q.mode === 'path' ? ' ← ' : '، ');
      }
      default: return String(v);
    }
  }
  function answerValue(q) {
    if (q.type === 'map' && q.mode === 'single' && Array.isArray(q.answer)) return q.answer[0];
    if (q.type === 'map' && q.mode === 'path' && Array.isArray(q.answer[0])) return q.answer[0];
    return q.answer;
  }
  function answerText(q) {
    let t = valueText(q, answerValue(q));
    if (q.type === 'map' && q.mode === 'single' && Array.isArray(q.answer) && q.answer.length > 1) {
      t = q.answer.map((id) => Fig.labelOf(q.figure, id)).join(' أو ');
    }
    if (q.type === 'short' && q.accept && q.accept.length) t += ` (تُقبل أيضًا: ${q.accept.join('، ')})`;
    return t;
  }
  const optText = (o) => (typeof o === 'object' ? o.text || '' : o);

  function badges(q, skills) {
    const sk = skills && skills[q.skill];
    return `<span class="badge lvl">${esc(App.LEVELS[q.level] || q.level)}</span>
      <span class="badge diff-${q.difficulty}">${esc(App.DIFFS[q.difficulty] || '')}</span>
      ${sk ? `<span class="badge">${sk.icon} ${esc(sk.title)}</span>` : ''}
      <span class="badge">${esc(App.TYPES[q.type] || '')}</span>`;
  }

  function solutionHTML(q) {
    return `<div class="solution">
      <h4>✅ الإجابة الصحيحة</h4><p>${esc(answerText(q))}</p>
      <h4>🪜 الحل خطوة بخطوة</h4><ol class="steps">${(q.solution || []).map((s) => `<li>${fmt(s)}</li>`).join('')}</ol>
      ${q.solutionFigure ? Fig.render(q.solutionFigure) : ''}
      <div class="ct"><h4>💡 وين التفكير الحاسوبي هنا؟</h4><p>${fmt(q.ct || '')}</p></div>
    </div>`;
  }

  /* ---------- سؤال مشابه: نفس المهارة بقصة مختلفة ----------
     الأفضلية: نفس الصف/المستوى، ثم سؤال لم يُحل بعد، ويُختار عشوائيًا من الأفضل */
  async function similarHTML(q, newTab) {
    try {
      const all = await App.questions();
      const p = App.progress.get();
      const pool = all.filter((x) => x.skill === q.skill && x.id !== q.id);
      if (!pool.length) return '';
      const score = (x) => (x.level === q.level ? 2 : 0) + (p.solved[x.id] ? 0 : 1);
      const best = Math.max(...pool.map(score));
      const cands = pool.filter((x) => score(x) === best);
      const s = cands[Math.floor(Math.random() * cands.length)];
      const href = `bank.html?skill=${encodeURIComponent(q.skill)}&q=${encodeURIComponent(s.id)}`;
      return `<div class="similar"><a class="btn secondary" href="${href}"${newTab ? ' target="_blank" rel="noopener"' : ''}>🔁 سؤال مشابه: ${esc(s.title)}</a>
        <span class="muted">نفس الفكرة بقصة مختلفة${s.level !== q.level ? ` (${esc(App.LEVELS[s.level] || '')})` : ''}</span></div>`;
    } catch (e) { return ''; }
  }

  /* ---------- واجهات التفاعل ---------- */
  function mountMCQ(q, box, st, locked) {
    box.innerHTML = `<p class="choose">اختر الإجابة الصحيحة:</p><div class="opts" role="radiogroup" aria-label="اختر الإجابة الصحيحة">${q.options.map((o, i) => `
      <button type="button" class="opt" role="radio" aria-checked="false" data-i="${i}"><span class="l">${LETTERS[i]}</span>
        <span>${fmt(optText(o))}${typeof o === 'object' && o.figure ? Fig.render(o.figure) : ''}</span></button>`).join('')}</div>`;
    const btns = [...box.querySelectorAll('.opt')];
    const paint = () => btns.forEach((b, i) => { b.classList.toggle('sel', st.resp === i); b.setAttribute('aria-checked', st.resp === i); });
    btns.forEach((b, i) => b.addEventListener('click', () => { if (locked()) return; st.resp = i; paint(); st.changed(); }));
    paint();
    st.markResult = (ok) => btns.forEach((b, i) => {
      b.classList.toggle('right', ok !== null && i === q.answer);
      b.classList.toggle('wrong', ok === false && i === st.resp);
    });
  }

  function mountShort(q, box, st, locked) {
    box.innerHTML = `<div class="short-row"><label>الإجابة: <input type="text" class="short-in" autocomplete="off" ${q.numeric ? 'inputmode="numeric"' : ''}></label>${q.unit ? `<span>${esc(q.unit)}</span>` : ''}</div>`;
    const inp = box.querySelector('input');
    if (st.resp) inp.value = st.resp;
    inp.addEventListener('input', () => { if (locked()) return; st.resp = inp.value; st.changed(); });
    st.onLock = () => { inp.readOnly = true; };
  }

  function mountOrder(q, box, st, locked) {
    if (!Array.isArray(st.resp)) st.resp = q.items.map((i) => i.id);
    box.innerHTML = `<p class="dnd-tip">اسحب من المقبض ⋮⋮ أو استخدم الأسهم لتغيير الترتيب. الأول في الأعلى.</p><ol class="order-list"></ol>`;
    const list = box.querySelector('ol');
    const label = (id) => q.items.find((i) => i.id === id).label;
    function draw() {
      list.innerHTML = st.resp.map((id, k) => `<li data-id="${esc(id)}"><span class="handle" aria-hidden="true">⋮⋮</span><span class="num">${k + 1}</span><span class="lbl">${fmt(label(id))}</span>
        <button type="button" class="mv" data-d="-1" aria-label="أعلى">▲</button><button type="button" class="mv" data-d="1" aria-label="أسفل">▼</button></li>`).join('');
    }
    function fromDom() { st.resp = [...list.children].map((li) => li.dataset.id); st.touched = true; draw(); st.changed(); }
    list.addEventListener('click', (e) => {
      const b = e.target.closest('.mv');
      if (!b || locked()) return;
      const id = b.closest('li').dataset.id;
      const i = st.resp.indexOf(id), j = i + Number(b.dataset.d);
      if (j < 0 || j >= st.resp.length) return;
      [st.resp[i], st.resp[j]] = [st.resp[j], st.resp[i]];
      st.touched = true; draw(); st.changed();
    });
    // سحب بالمؤشر يعمل على اللمس والفأرة
    let drag = null;
    list.addEventListener('pointerdown', (e) => {
      const h = e.target.closest('.handle');
      if (!h || locked()) return;
      drag = h.closest('li');
      drag.classList.add('dragging');
      h.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    list.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const over = document.elementFromPoint(e.clientX, e.clientY);
      const li = over && over.closest('.order-list li');
      if (!li || li === drag || li.parentNode !== list) return;
      const r = li.getBoundingClientRect();
      list.insertBefore(drag, e.clientY < r.top + r.height / 2 ? li : li.nextSibling);
    });
    const end = () => { if (!drag) return; drag.classList.remove('dragging'); drag = null; fromDom(); };
    list.addEventListener('pointerup', end);
    list.addEventListener('pointercancel', end);
    draw();
  }

  function mountDrag(q, box, st, locked) {
    if (!st.resp || typeof st.resp !== 'object') st.resp = {};
    box.innerHTML = `<div class="dnd"><p class="dnd-tip">اضغط على بطاقة ثم اضغط على المكان المناسب (أو اسحبها بالفأرة). اضغط على البطاقة مرة أخرى لإعادتها.</p>
      <div class="pool" data-bin=""></div>
      <div class="bins">${q.bins.map((b) => `<div class="bin" data-bin="${esc(b.id)}"><div class="bin-label">${fmt(b.label)}</div><div class="bin-drop"></div></div>`).join('')}</div></div>`;
    let picked = null;
    const pool = box.querySelector('.pool');
    const zone = (binId) => (binId ? box.querySelector(`.bin[data-bin="${CSS.escape(binId)}"] .bin-drop`) : pool);
    function draw() {
      pool.innerHTML = '';
      box.querySelectorAll('.bin-drop').forEach((z) => { z.innerHTML = ''; });
      q.items.forEach((it) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'chip' + (picked === it.id ? ' picked' : ''); b.draggable = true; b.dataset.item = it.id;
        b.innerHTML = fmt(it.label);
        zone(st.resp[it.id] || '').appendChild(b);
      });
      if (!pool.children.length) pool.innerHTML = '<span class="dnd-tip">✓ وُضعت كل البطاقات</span>';
    }
    function place(itemId, binId) {
      const bin = q.bins.find((b) => b.id === binId);
      if (bin && bin.cap) {
        const inside = q.items.filter((i) => st.resp[i.id] === binId && i.id !== itemId);
        if (inside.length >= bin.cap) delete st.resp[inside[0].id];
      }
      if (binId) st.resp[itemId] = binId; else delete st.resp[itemId];
      picked = null; draw(); st.changed();
    }
    box.addEventListener('click', (e) => {
      if (locked()) return;
      const chip = e.target.closest('.chip');
      const target = e.target.closest('.bin, .pool');
      if (chip) {
        const id = chip.dataset.item;
        if (picked === id) { picked = null; if (st.resp[id]) place(id, ''); else draw(); return; }
        // بطاقة مختارة + ضغط على بطاقة داخل صندوق = ضع المختارة في ذلك الصندوق
        if (picked && target && target.dataset.bin) { place(picked, target.dataset.bin); return; }
        picked = id; draw(); return;
      }
      if (target && picked) place(picked, target.dataset.bin);
    });
    box.addEventListener('dragstart', (e) => { const c = e.target.closest('.chip'); if (c && !locked()) e.dataTransfer.setData('text/plain', c.dataset.item); });
    box.addEventListener('dragover', (e) => { const t = e.target.closest('.bin, .pool'); if (t) { e.preventDefault(); t.classList.add('over'); } });
    box.addEventListener('dragleave', (e) => { const t = e.target.closest('.bin, .pool'); if (t) t.classList.remove('over'); });
    box.addEventListener('drop', (e) => {
      const t = e.target.closest('.bin, .pool');
      if (!t || locked()) return;
      e.preventDefault(); t.classList.remove('over');
      const id = e.dataTransfer.getData('text/plain');
      if (q.items.some((i) => i.id === id)) place(id, t.dataset.bin);
    });
    draw();
  }

  function mountMap(q, box, st, locked) {
    const mode = q.mode || 'single';
    if (mode !== 'single' && !Array.isArray(st.resp)) st.resp = [];
    const tip = { single: 'اضغط على إجابتك في الرسم.', set: 'اضغط على كل الخانات المطلوبة (اضغط مرة ثانية للإلغاء).', path: 'اضغط على النقاط بالترتيب لتكوين المسار.' }[mode];
    box.innerHTML = `<p class="dnd-tip">${tip}</p><div class="map-fig">${Fig.render(q.figure, { clickable: true })}</div>
      <div class="path-out"></div>
      ${mode !== 'single' ? '<div class="btn-row"><button type="button" class="btn small secondary" data-act="undo">↩️ تراجع</button><button type="button" class="btn small secondary" data-act="clear">🗑️ مسح</button></div>' : ''}`;
    const out = box.querySelector('.path-out');
    function paint() {
      const sel = mode === 'single' ? (st.resp ? [st.resp] : []) : st.resp;
      box.querySelectorAll('.hit').forEach((h) => h.classList.toggle('on', sel.includes(h.dataset.id)));
      out.textContent = sel.length ? (mode === 'path' ? 'مسارك: ' : 'اختيارك: ') + valueText(q, st.resp) : 'لم تختر بعد.';
    }
    box.querySelector('.map-fig').addEventListener('click', (e) => {
      const h = e.target.closest('.hit');
      if (!h || locked()) return;
      const id = h.dataset.id;
      if (mode === 'single') st.resp = id;
      else if (mode === 'set') st.resp = st.resp.includes(id) ? st.resp.filter((x) => x !== id) : [...st.resp, id];
      else if (st.resp[st.resp.length - 1] !== id) st.resp = [...st.resp, id];
      paint(); st.changed();
    });
    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b || locked()) return;
      st.resp = b.dataset.act === 'undo' ? st.resp.slice(0, -1) : [];
      paint(); st.changed();
    });
    st.onLock = () => box.querySelector('.map-fig').classList.add('dis');
    paint();
  }

  const MOUNTERS = { mcq: mountMCQ, short: mountShort, order: mountOrder, drag: mountDrag, map: mountMap };

  /* ---------- العرض الكامل للسؤال ----------
     opts.mode: 'practice' (بنك الأسئلة) | 'exam' (اختبار) | 'review' (مراجعة)
  */
  function mount(q, el, opts = {}) {
    const mode = opts.mode || 'practice';
    const st = { resp: opts.response, locked: mode === 'review', changed: () => opts.onChange && opts.onChange(st.resp), markResult: null, onLock: null };
    const locked = () => st.locked;
    const figInBody = q.type !== 'map' && q.figure ? Fig.render(q.figure) : '';
    el.innerHTML = `<article class="q" data-id="${esc(q.id)}">
      <div class="q-head">${opts.number ? `<span class="badge">سؤال ${opts.number}</span>` : ''}${badges(q, opts.skills)}</div>
      <h3 class="q-title">${esc(q.title)}</h3>
      <div class="q-story">${fmt(q.story)}</div>
      ${figInBody}
      <div class="q-ask"><strong>السؤال:</strong> ${fmt(q.question)}</div>
      <div class="q-interact"></div>
      ${mode === 'practice' ? `<div class="q-actions">
          <button type="button" class="btn secondary" data-a="hint">💡 تلميح</button>
          <button type="button" class="btn" data-a="check">تحقق من إجابتي</button>
          <button type="button" class="btn ghost" data-a="sol">عرض الحل</button>
        </div>
        <div class="q-hint" hidden>💡 ${fmt(q.hint)}</div>` : ''}
      <div class="q-feedback"></div>
      <div class="q-sol" hidden></div>
    </article>`;
    const box = el.querySelector('.q-interact');
    MOUNTERS[q.type](q, box, st, locked);
    const fb = el.querySelector('.q-feedback');
    const sol = el.querySelector('.q-sol');
    const showSolution = () => {
      sol.innerHTML = solutionHTML(q);
      sol.hidden = false;
      // في المراجعة بعد الاختبار يُفتح في تبويب جديد حتى لا تضيع صفحة النتيجة
      similarHTML(q, mode === 'review').then((h) => { if (h && !sol.querySelector('.similar')) sol.insertAdjacentHTML('beforeend', h); });
    };

    if (mode === 'review') {
      st.locked = true;
      if (st.onLock) st.onLock();
      const ok = isCorrect(q, st.resp);
      if (st.markResult) st.markResult(ok);
      fb.innerHTML = `<p class="ans-line me ${ok ? 'ok' : 'no'}"><strong>${ok ? '✓ إجابتك صحيحة:' : '✗ إجابتك:'}</strong> ${esc(valueText(q, st.resp))}</p>`;
      showSolution();
    }
    if (mode === 'practice') {
      el.querySelector('[data-a="hint"]').addEventListener('click', () => { el.querySelector('.q-hint').hidden = false; });
      el.querySelector('[data-a="sol"]').addEventListener('click', showSolution);
      el.querySelector('[data-a="check"]').addEventListener('click', () => {
        if (!isAnswered(q, st.resp) || (q.type === 'order' && !st.touched)) {
          fb.className = 'q-feedback feedback no';
          fb.textContent = q.type === 'order' ? 'رتّب العناصر أولًا ثم اضغط «تحقق».' : 'أجب أولًا ثم اضغط «تحقق».';
          return;
        }
        const ok = isCorrect(q, st.resp);
        if (App.log) App.log('practice', { ref: q.id, title: q.title, ok });
        fb.className = 'q-feedback feedback ' + (ok ? 'ok' : 'no');
        fb.textContent = ok ? '🎉 أحسنت! إجابة صحيحة.' : 'ليست صحيحة بعد. جرّب مرة أخرى، أو افتح التلميح، أو اعرض الحل.';
        if (st.markResult) st.markResult(ok ? true : null);
        if (ok) { App.progress.markSolved(q.id); showSolution(); if (opts.onSolved) opts.onSolved(q); }
      });
    }
    return st;
  }

  /* ---------- نسخة الطباعة ---------- */
  function printHTML(q, n, withSpace = true) {
    let body = '';
    const fig = Fig.render(q.figure);
    switch (q.type) {
      case 'mcq':
        body = `<p><strong>اختر الإجابة الصحيحة:</strong></p><ul class="opts-p">${q.options.map((o, i) => `<li>${LETTERS[i]}) ${fmt(optText(o))}${typeof o === 'object' && o.figure ? Fig.render(o.figure) : ''}</li>`).join('')}</ul>`;
        break;
      case 'short':
        body = `<div>الإجابة: ............................................ ${q.unit ? esc(q.unit) : ''}</div>`;
        break;
      case 'order':
        body = `<p>اكتب رقم الترتيب (1، 2، 3...) في المربع بجانب كل عنصر:</p><table><tbody>${q.items.map((i) => `<tr><td style="width:46px">&nbsp;</td><td>${fmt(i.label)}</td></tr>`).join('')}</tbody></table>`;
        break;
      case 'drag':
        body = `<p>اكتب اسم المكان المناسب أمام كل بطاقة. الأماكن: <strong>${q.bins.map((b) => esc(b.label)).join(' • ')}</strong></p><table><tbody>${q.items.map((i) => `<tr><td>${fmt(i.label)}</td><td style="min-width:180px">&nbsp;</td></tr>`).join('')}</tbody></table>`;
        break;
      case 'map':
        body = `<p>${q.mode === 'path' ? 'ارسم المسار على الشكل أو اكتبه بالترتيب:' : 'ضع دائرة على إجابتك في الشكل أو اكتبها:'}</p><div class="line"></div>`;
        break;
    }
    return `<section class="pq"><h3>${n}. ${esc(q.title)} <span style="font-weight:400;font-size:.85rem">(${esc(App.DIFFS[q.difficulty])})</span></h3>
      <div>${fmt(q.story)}</div>${fig}<p><strong>السؤال:</strong> ${fmt(q.question)}</p>${body}
      ${withSpace ? '<div class="space">مساحة للحل</div>' : ''}</section>`;
  }

  function answerKeyHTML(list, withSteps) {
    return `<section class="answer-key"><h2>🔑 مفتاح الإجابات</h2><ol>${list.map((q) => `<li><strong>${esc(answerText(q))}</strong>${
      withSteps ? `<div style="font-size:.9rem">${(q.solution || []).map((s) => fmt(s)).join(' — ')}</div>` : ''}</li>`).join('')}</ol></section>`;
  }

  window.Q = { mount, isCorrect, isAnswered, answerText, valueText, printHTML, answerKeyHTML, badges, norm, LETTERS };
})();
