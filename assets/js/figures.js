/* ===== رسم الأشكال التوضيحية بـ SVG من وصف JSON =====
   الأنواع: graph, grid, tree, row, stack, bits, table, multi, svg
*/
(function () {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const FILLS = ['a', 'b', 'c', 'd', 'e', 'f', 'wall', 'empty', 'dark', 'light'];
  const fc = (f, def = 'empty') => 'f-' + (FILLS.includes(f) ? f : def);
  let uid = 0;

  function svg(w, h, inner, extra = '') {
    return `<svg class="fig-svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="max-width:100%;height:auto" xmlns="http://www.w3.org/2000/svg" ${extra}>${inner}</svg>`;
  }
  function text(x, y, t, size = 16, cls = 't', weight = 700) {
    return `<text x="${x}" y="${y}" class="${cls}" font-size="${size}" font-weight="${weight}" text-anchor="middle" dominant-baseline="central">${esc(t)}</text>`;
  }
  const textWidth = (t, size) => Math.max(1, String(t ?? '').length) * size * 0.62;

  // ----- رسم بياني: عقد وحواف -----
  function graph(s, o) {
    const R = s.r || 24;
    const byId = {};
    s.nodes.forEach((n) => { byId[n.id] = n; });
    const pad = R + 22;
    const w = s.w || Math.max(...s.nodes.map((n) => n.x)) + pad;
    const h = s.h || Math.max(...s.nodes.map((n) => n.y)) + pad + (s.nodes.some((n) => n.sub) ? 14 : 0);
    const mid = 'arr' + (++uid);
    let out = '';
    if (s.directed) {
      out += `<defs><marker id="${mid}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker></defs>`;
    }
    (s.edges || []).forEach((e) => {
      const a = byId[e.a], b = byId[e.b];
      if (!a || !b) return;
      let x1 = a.x, y1 = a.y, x2 = b.x, y2 = b.y;
      const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
      if (s.directed) { x2 -= (dx / len) * (R + 3); y2 -= (dy / len) * (R + 3); x1 += (dx / len) * R; y1 += (dy / len) * R; }
      out += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="ln" ${s.directed ? `marker-end="url(#${mid})"` : ''}/>`;
      if (e.w !== undefined && e.w !== '') {
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const lw = Math.max(24, textWidth(e.w, 14) + 10);
        out += `<rect x="${mx - lw / 2}" y="${my - 12}" width="${lw}" height="24" rx="12" class="wbg"/>` + text(mx, my, e.w, 14);
      }
    });
    s.nodes.forEach((n) => {
      const cls = o.clickable ? 'hit' : '';
      out += `<g class="node ${cls}" data-id="${esc(n.id)}"><circle cx="${n.x}" cy="${n.y}" r="${R}" class="${fc(n.fill, 'a')} bd"/>${text(n.x, n.y, n.label ?? n.id, n.size || 17)}</g>`;
      if (n.sub) out += text(n.x, n.y + R + 13, n.sub, 13, 'tm', 600);
    });
    return svg(w, h, out);
  }

  // ----- شبكة مربعات -----
  function tokens(row) {
    if (Array.isArray(row)) return row;
    return row.includes(' ') ? row.trim().split(/\s+/) : Array.from(row);
  }
  function grid(s, o) {
    const cs = s.cell || 46;
    const rows = s.rows.map(tokens);
    const nr = rows.length, nc = Math.max(...rows.map((r) => r.length));
    const lab = s.rowLabels ? 34 : 0;
    const top = s.colLabels ? 26 : 0;
    const w = nc * cs + lab + 4, h = nr * cs + top + 4;
    const legend = s.legend || {};
    let out = '';
    if (s.colLabels) s.colLabels.forEach((t, c) => { out += text(2 + c * cs + cs / 2, 13, t, 13, 'tm'); });
    rows.forEach((row, r) => {
      if (s.rowLabels) out += text(nc * cs + 4 + lab / 2, top + 2 + r * cs + cs / 2, s.rowLabels[r] ?? '', 14, 'tm');
      for (let c = 0; c < nc; c++) {
        const tok = row[c] ?? '.';
        const L = legend[tok] || {};
        let fill = L.fill || (tok === '#' ? 'wall' : 'empty');
        const label = L.text !== undefined ? L.text : (tok === '.' || tok === '#' ? '' : tok);
        const x = 2 + c * cs, y = top + 2 + r * cs;
        const id = `${r}-${c}`;
        if (o.clickable) {
          out += `<g class="hit" data-id="${id}"><rect x="${x}" y="${y}" width="${cs}" height="${cs}" class="${fc(fill)} bd" stroke-width="1.2"/>${label ? text(x + cs / 2, y + cs / 2, label, cs * 0.5) : ''}</g>`;
        } else {
          out += `<rect x="${x}" y="${y}" width="${cs}" height="${cs}" class="${fc(fill)} bd" stroke-width="1.2"/>`;
          if (label) out += text(x + cs / 2, y + cs / 2, label, L.size || cs * 0.5);
        }
      }
    });
    return svg(w, h, out);
  }

  // ----- شجرة -----
  function tree(s) {
    const gapX = s.gapX || 96, gapY = s.gapY || 78, size = s.size || 15;
    let leaf = 0, maxDepth = 0;
    const nodes = [];
    function walk(n, d, parent) {
      const me = { n, d, parent, kids: [] };
      nodes.push(me);
      maxDepth = Math.max(maxDepth, d);
      const ch = n.children || [];
      if (!ch.length) { me.x = leaf++ * gapX; }
      else {
        ch.forEach((c) => me.kids.push(walk(c, d + 1, me)));
        me.x = (me.kids[0].x + me.kids[me.kids.length - 1].x) / 2;
      }
      return me;
    }
    walk(s.root, 0, null);
    const boxW = (n) => Math.max(46, textWidth(n.label, size) + 18);
    const maxW = Math.max(...nodes.map((m) => boxW(m.n)));
    const padX = maxW / 2 + 6, padY = 26;
    // اتجاه من اليمين لليسار اختياري: الافتراضي من اليسار (رسم مكاني)
    const width = (leaf - 1) * gapX + padX * 2, height = maxDepth * gapY + padY * 2;
    const X = (m) => (s.rtl ? (leaf - 1) * gapX - m.x : m.x) + padX;
    const Y = (m) => m.d * gapY + padY;
    let out = '';
    nodes.forEach((m) => {
      if (!m.parent) return;
      const x1 = X(m.parent), y1 = Y(m.parent), x2 = X(m), y2 = Y(m);
      out += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="ln"/>`;
      if (m.n.edge !== undefined) {
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
        const lw = Math.max(24, textWidth(m.n.edge, 13) + 10);
        out += `<rect x="${mx - lw / 2}" y="${my - 11}" width="${lw}" height="22" rx="11" class="wbg"/>` + text(mx, my, m.n.edge, 13);
      }
    });
    nodes.forEach((m) => {
      const bw = boxW(m.n), x = X(m), y = Y(m);
      const leafNode = !(m.n.children || []).length;
      out += `<rect x="${x - bw / 2}" y="${y - 17}" width="${bw}" height="34" rx="${leafNode ? 17 : 8}" class="${fc(m.n.fill, leafNode ? 'c' : 'a')} bd"/>` + text(x, y, m.n.label, size);
    });
    return svg(width, height, out);
  }

  // ----- صف عناصر (يُقرأ من اليمين إلى اليسار) -----
  function norm(it) { return typeof it === 'object' ? it : { label: it }; }
  function row(s) {
    const items = s.items.map(norm);
    const size = s.size || 52, gap = s.arrows ? 30 : 10;
    const endW = (t) => (t ? textWidth(t, 14) + 16 : 0);
    const startW = endW(s.start), finishW = endW(s.end);
    const subH = items.some((i) => i.sub) ? 20 : 0;
    const w = items.length * size + (items.length - 1) * gap + startW + finishW + 8;
    const h = size + 8 + subH;
    let out = '';
    const xOf = (i) => w - 4 - startW - (i + 1) * size - i * gap;
    if (s.start) out += text(w - startW / 2 - 2, 4 + size / 2, s.start, 14, 'tm');
    if (s.end) out += text(finishW / 2 + 2, 4 + size / 2, s.end, 14, 'tm');
    items.forEach((it, i) => {
      const x = xOf(i);
      out += `<rect x="${x}" y="4" width="${size}" height="${size}" rx="10" class="${fc(it.fill, 'light')} bd"/>` + text(x + size / 2, 4 + size / 2, it.label, it.size || size * 0.44);
      if (it.sub) out += text(x + size / 2, size + 16, it.sub, 13, 'tm', 600);
      if (s.arrows && i < items.length - 1) {
        const ax = x - 4, bx = x - gap + 4, y = 4 + size / 2;
        out += `<line x1="${ax}" y1="${y}" x2="${bx + 6}" y2="${y}" class="ln"/><path d="M${bx},${y} l8,-5 l0,10 z" style="fill:var(--muted)"/>`;
      }
    });
    return svg(w, h, out);
  }

  // ----- مكدس (العنصر الأول في القائمة هو الأسفل) -----
  function stack(s) {
    const items = s.items.map(norm);
    const bw = s.width || 130, bh = 36, pad = 10;
    const w = bw + pad * 2 + 8, h = Math.max(items.length, s.slots || 0) * (bh + 4) + pad + 40;
    let out = `<path d="M4,30 L4,${h - 4} L${w - 4},${h - 4} L${w - 4},30" class="ln"/>`;
    out += text(w / 2, 14, s.label || 'الأعلى ↓', 13, 'tm');
    items.forEach((it, i) => {
      const y = h - 8 - (i + 1) * (bh + 4) + 4;
      out += `<rect x="${pad + 4}" y="${y}" width="${bw}" height="${bh}" rx="8" class="${fc(it.fill, 'a')} bd"/>` + text(w / 2, y + bh / 2, it.label, 16);
    });
    return svg(w, h, out);
  }

  // ----- مصابيح ثنائية (تُقرأ من اليسار: الخانة الكبرى أولًا) -----
  function bits(s) {
    const b = Array.from(String(s.bits));
    const n = b.length, cw = 58;
    const w = n * cw + 8, h = (s.weights !== false ? 22 : 0) + 72 + (s.digits !== false ? 24 : 0);
    let out = '';
    b.forEach((v, i) => {
      const x = 4 + i * cw + cw / 2;
      let y = 4;
      if (s.weights !== false) { out += text(x, y + 10, s.labels ? s.labels[i] : 2 ** (n - 1 - i), 14, 'tm'); y += 22; }
      const on = v === '1';
      out += `<circle cx="${x}" cy="${y + 26}" r="22" class="${on ? 'bulb-on' : 'bulb-off'} bd"/>`;
      out += `<rect x="${x - 9}" y="${y + 50}" width="18" height="12" rx="3" class="f-wall"/>`;
      y += 66;
      if (s.digits !== false) out += text(x, y + 12, v, 18);
    });
    return `<div dir="ltr" style="display:inline-block">${svg(w, h, out)}</div>`;
  }

  function table(s) {
    const head = s.head ? `<thead><tr>${s.head.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>` : '';
    const body = `<tbody>${s.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>`;
    return `<table class="fig-table">${head}${body}</table>`;
  }

  function multi(s, o) {
    return `<div class="fig-multi">${s.items.map((it) => `<div>${inner(it, o)}${it.caption ? `<div class="muted" style="font-size:.88rem">${esc(it.caption)}</div>` : ''}</div>`).join('')}</div>`;
  }

  function inner(s, o = {}) {
    if (!s) return '';
    switch (s.type) {
      case 'graph': return graph(s, o);
      case 'grid': return grid(s, o);
      case 'tree': return tree(s, o);
      case 'row': return row(s, o);
      case 'stack': return stack(s, o);
      case 'bits': return bits(s, o);
      case 'table': return table(s, o);
      case 'multi': return multi(s, o);
      case 'svg': return s.svg; // نص SVG جاهز من ملفات المحتوى
      default: return '';
    }
  }

  function render(s, o = {}) {
    if (!s) return '';
    const cap = s.caption && s.type !== 'multi' ? `<figcaption>${esc(s.caption)}</figcaption>` : '';
    return `<figure class="fig${o.clickable ? '' : ''}">${inner(s, o)}${cap}</figure>`;
  }

  // اسم مقروء لعنصر قابل للضغط (عقدة أو خلية)
  function labelOf(s, id) {
    if (!s) return id;
    if (s.type === 'graph') {
      const n = s.nodes.find((x) => x.id === id);
      return n ? (n.label ?? n.id) + (n.sub ? ` (${n.sub})` : '') : id;
    }
    if (s.type === 'grid') {
      const [r, c] = String(id).split('-').map(Number);
      return `الصف ${r + 1}، العمود ${c + 1} من اليسار`;
    }
    return id;
  }

  window.Fig = { render, labelOf };
})();
