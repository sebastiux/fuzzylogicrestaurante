import { parseFIS, evaluate, evalMF } from './fuzzy.js';

// Copia de respaldo de matlab/propina.fis para cuando la pagina se abre
// con file:// (sin servidor, fetch falla). En GitHub Pages se usa el archivo.
const FIS_FALLBACK = `[System]
Name='propina'
Type='mamdani'
Version=2.0
NumInputs=2
NumOutputs=1
NumRules=9
AndMethod='min'
OrMethod='max'
ImpMethod='min'
AggMethod='max'
DefuzzMethod='centroid'
[Input1]
Name='tiempo'
Range=[0 60]
NumMFs=3
MF1='rapido':'trapmf',[0 0 10 20]
MF2='normal':'trimf',[10 25 40]
MF3='lento':'trapmf',[30 45 60 60]
[Input2]
Name='precio'
Range=[0 2000]
NumMFs=3
MF1='barato':'trapmf',[0 0 200 600]
MF2='moderado':'trimf',[300 800 1300]
MF3='caro':'trapmf',[1000 1500 2000 2000]
[Output1]
Name='propina'
Range=[0 25]
NumMFs=5
MF1='muy_baja':'trapmf',[0 0 3 6]
MF2='baja':'trimf',[3 7 11]
MF3='media':'trimf',[9 12.5 16]
MF4='alta':'trimf',[14 18 22]
MF5='muy_alta':'trapmf',[20 23 25 25]
[Rules]
1 1, 4 (1) : 1
1 2, 4 (1) : 1
1 3, 5 (1) : 1
2 1, 3 (1) : 1
2 2, 3 (1) : 1
2 3, 4 (1) : 1
3 1, 1 (1) : 1
3 2, 2 (1) : 1
3 3, 3 (1) : 1`;

// Rampa secuencial (un solo tono, claro -> oscuro) para la superficie
const SEQ = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'];

const PRETTY = { rapido: 'rápido', muy_baja: 'muy baja', muy_alta: 'muy alta' };
const pretty = (s) => PRETTY[s] ?? s.replace(/_/g, ' ');
const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const fmt = (v, d = 2) => v.toLocaleString('es-MX', { minimumFractionDigits: d, maximumFractionDigits: d });
const $ = (id) => document.getElementById(id);
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const state = { fis: null, tiempo: 15, precio: 800, result: null, surface: null, hover: null };

// ---------- carga ----------
async function loadFIS() {
  try {
    const res = await fetch('matlab/propina.fis', { cache: 'no-cache' });
    if (!res.ok) throw new Error(res.status);
    return { fis: parseFIS(await res.text()), source: 'matlab/propina.fis' };
  } catch {
    return { fis: parseFIS(FIS_FALLBACK), source: 'copia interna' };
  }
}

// ---------- canvas ----------
function prepCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  // La altura CSS se guarda una vez: canvas.height (abajo) reescribe el atributo
  if (!canvas.dataset.cssHeight) canvas.dataset.cssHeight = canvas.getAttribute('height');
  const h = Number(canvas.dataset.cssHeight);
  canvas.style.height = `${h}px`;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}

function niceTicks(lo, hi, n = 5) {
  const step0 = (hi - lo) / n;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0);
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}

function frame(ctx, w, h, range, { yTicks = [0, 0.5, 1] } = {}) {
  const pad = { l: 30, r: 10, t: 22, b: 24 };
  const sx = (x) => pad.l + ((x - range[0]) / (range[1] - range[0])) * (w - pad.l - pad.r);
  const sy = (y) => h - pad.b - y * (h - pad.t - pad.b);

  ctx.font = '11px system-ui, sans-serif';
  ctx.lineWidth = 1;
  ctx.strokeStyle = css('--grid');
  ctx.fillStyle = css('--muted');
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (const y of yTicks) {
    ctx.beginPath();
    ctx.moveTo(pad.l, Math.round(sy(y)) + 0.5);
    ctx.lineTo(w - pad.r, Math.round(sy(y)) + 0.5);
    ctx.stroke();
    ctx.fillText(y === 0.5 ? '.5' : String(y), pad.l - 6, sy(y));
  }
  ctx.strokeStyle = css('--axis');
  ctx.beginPath();
  ctx.moveTo(pad.l, Math.round(sy(0)) + 0.5);
  ctx.lineTo(w - pad.r, Math.round(sy(0)) + 0.5);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const t of niceTicks(range[0], range[1], w < 320 ? 4 : 6)) {
    const label = t.toLocaleString('es-MX');
    const half = ctx.measureText(label).width / 2;
    ctx.fillText(label, Math.min(w - half - 1, sx(t)), sy(0) + 6);
  }
  return { sx, sy, pad };
}

function mfPath(ctx, mf, range, sx, sy, n = 200) {
  ctx.beginPath();
  for (let k = 0; k <= n; k++) {
    const x = range[0] + ((range[1] - range[0]) * k) / n;
    const y = evalMF(mf, x);
    k ? ctx.lineTo(sx(x), sy(y)) : ctx.moveTo(sx(x), sy(y));
  }
}

function peakOf(mf, range) {
  let best = range[0], bestY = -1, n = 400, start = null;
  for (let k = 0; k <= n; k++) {
    const x = range[0] + ((range[1] - range[0]) * k) / n;
    const y = evalMF(mf, x);
    if (y > bestY + 1e-9) { bestY = y; best = x; start = x; }
    else if (Math.abs(y - bestY) < 1e-9) best = (start + x) / 2;
  }
  return best;
}

function drawLabels(ctx, items, sx, sy, w, pad) {
  ctx.font = '11px system-ui, sans-serif';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = css('--ink-2');
  for (const { x, text } of items) {
    const tw = ctx.measureText(text).width;
    const cx = Math.min(w - pad.r - tw / 2, Math.max(pad.l + tw / 2, sx(x)));
    ctx.textAlign = 'center';
    ctx.fillText(text, cx, sy(1) - 4);
  }
}

const SERIES = () => [css('--series-1'), css('--series-2'), css('--series-3')];

function drawInputPlot(canvasId, legendId, variable, value, degrees) {
  const canvas = $(canvasId);
  const { ctx, w, h } = prepCanvas(canvas);
  const { sx, sy, pad } = frame(ctx, w, h, variable.range);
  const colors = SERIES();

  variable.mfs.forEach((mf, i) => {
    ctx.strokeStyle = colors[i % colors.length];
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    mfPath(ctx, mf, variable.range, sx, sy);
    ctx.stroke();
  });
  drawLabels(ctx, variable.mfs.map((mf) => ({ x: peakOf(mf, variable.range), text: pretty(mf.name) })), sx, sy, w, pad);

  // marcador del valor actual
  const X = sx(value);
  ctx.strokeStyle = css('--ink');
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath(); ctx.moveTo(X, sy(0)); ctx.lineTo(X, sy(1)); ctx.stroke();
  ctx.setLineDash([]);
  degrees.forEach((mu, i) => {
    if (mu <= 0) return;
    ctx.beginPath();
    ctx.arc(X, sy(mu), 4.5, 0, Math.PI * 2);
    ctx.fillStyle = colors[i % colors.length];
    ctx.strokeStyle = css('--marker-ring');
    ctx.lineWidth = 2;
    ctx.fill(); ctx.stroke();
  });

  $(legendId).innerHTML = variable.mfs.map((mf, i) =>
    `<li><i style="background:${colors[i % colors.length]}"></i>${pretty(mf.name)} <b>μ ${fmt(degrees[i])}</b></li>`).join('');
}

function drawOutputPlot(output, res) {
  const { ctx, w, h } = prepCanvas($('plot-salida'));
  const { sx, sy, pad } = frame(ctx, w, h, output.range);
  const { xs, aggregated, value } = res.outputs[0];

  ctx.strokeStyle = css('--axis');
  ctx.lineWidth = 1;
  output.mfs.forEach((mf) => { mfPath(ctx, mf, output.range, sx, sy); ctx.stroke(); });
  drawLabels(ctx, output.mfs.map((mf) => ({ x: peakOf(mf, output.range), text: pretty(mf.name) })), sx, sy, w, pad);

  const accent = css('--series-1');
  ctx.beginPath();
  ctx.moveTo(sx(xs[0]), sy(0));
  xs.forEach((x, k) => ctx.lineTo(sx(x), sy(aggregated[k])));
  ctx.lineTo(sx(xs[xs.length - 1]), sy(0));
  ctx.closePath();
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = accent;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.beginPath();
  xs.forEach((x, k) => (k ? ctx.lineTo(sx(x), sy(aggregated[k])) : ctx.moveTo(sx(x), sy(aggregated[k]))));
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.stroke();

  const X = sx(value);
  ctx.strokeStyle = css('--series-2');
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 3]);
  ctx.beginPath(); ctx.moveTo(X, sy(0)); ctx.lineTo(X, sy(1)); ctx.stroke();
  ctx.setLineDash([]);

  $('legend-salida').innerHTML =
    `<li><i class="area" style="background:${accent}"></i>conjunto agregado</li>` +
    `<li><i class="dash" style="color:${css('--series-2')}"></i>centroide <b>${fmt(value)} %</b></li>`;
}

// ---------- superficie ----------
function rampColor(t) {
  const p = Math.min(1, Math.max(0, t)) * (SEQ.length - 1);
  const i = Math.min(SEQ.length - 2, Math.floor(p));
  const f = p - i;
  const a = SEQ[i].match(/\w\w/g).map((c) => parseInt(c, 16));
  const b = SEQ[i + 1].match(/\w\w/g).map((c) => parseInt(c, 16));
  return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * f)).join(',')})`;
}

function computeSurface(fis) {
  const [t, p] = fis.inputs;
  const nx = 61, ny = 41;
  const z = [];
  let min = Infinity, max = -Infinity;
  for (let j = 0; j < ny; j++) {
    const row = [];
    const pv = p.range[0] + ((p.range[1] - p.range[0]) * j) / (ny - 1);
    for (let i = 0; i < nx; i++) {
      const tv = t.range[0] + ((t.range[1] - t.range[0]) * i) / (nx - 1);
      const v = evaluate(fis, [tv, pv]).outputs[0].value;
      row.push(v);
      min = Math.min(min, v); max = Math.max(max, v);
    }
    z.push(row);
  }
  return { z, nx, ny, min, max };
}

function heatGeometry(w, h) {
  const pad = { l: 52, r: 10, t: 8, b: 34 };
  return { pad, pw: w - pad.l - pad.r, ph: h - pad.t - pad.b };
}

function drawHeatmap() {
  const { fis, surface } = state;
  const canvas = $('heatmap');
  const { ctx, w, h } = prepCanvas(canvas);
  const { pad, pw, ph } = heatGeometry(w, h);
  const [t, p] = fis.inputs;
  const out = fis.outputs[0];
  const { z, nx, ny } = surface;
  const cw = pw / nx, ch = ph / ny;

  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      ctx.fillStyle = rampColor((z[j][i] - out.range[0]) / (out.range[1] - out.range[0]));
      ctx.fillRect(pad.l + i * cw, pad.t + (ny - 1 - j) * ch, Math.ceil(cw) + 0.5, Math.ceil(ch) + 0.5);
    }
  }

  const sx = (v) => pad.l + ((v - t.range[0]) / (t.range[1] - t.range[0])) * pw;
  const sy = (v) => pad.t + ph - ((v - p.range[0]) / (p.range[1] - p.range[0])) * ph;

  ctx.font = '11px system-ui, sans-serif';
  ctx.fillStyle = css('--muted');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const v of niceTicks(t.range[0], t.range[1], 6)) ctx.fillText(String(v), sx(v), pad.t + ph + 6);
  ctx.fillText('tiempo (min)', pad.l + pw / 2, pad.t + ph + 20);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (const v of niceTicks(p.range[0], p.range[1], 4)) ctx.fillText(`$${v.toLocaleString('es-MX')}`, pad.l - 6, sy(v));

  // punto actual
  const cx = sx(state.result.inputs[0]);
  const cy = sy(state.result.inputs[1]);
  ctx.beginPath();
  ctx.arc(cx, cy, 6, 0, Math.PI * 2);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#0b0b0b';
  ctx.stroke();

  if (state.hover) {
    ctx.strokeStyle = 'rgba(255,255,255,.9)';
    ctx.lineWidth = 1;
    ctx.strokeRect(pad.l + state.hover.i * cw, pad.t + (ny - 1 - state.hover.j) * ch, cw, ch);
  }

  $('scale-bar').style.background = `linear-gradient(90deg, ${SEQ.join(',')})`;
  $('scale-min').textContent = `${out.range[0]} %`;
  $('scale-max').textContent = `${out.range[1]} %`;
}

function heatHit(evt) {
  const canvas = $('heatmap');
  const rect = canvas.getBoundingClientRect();
  const mx = evt.clientX - rect.left, my = evt.clientY - rect.top;
  const { pad, pw, ph } = heatGeometry(rect.width, rect.height);
  const { nx, ny, z } = state.surface;
  const i = Math.floor(((mx - pad.l) / pw) * nx);
  const jFromTop = Math.floor(((my - pad.t) / ph) * ny);
  if (i < 0 || i >= nx || jFromTop < 0 || jFromTop >= ny) return null;
  const j = ny - 1 - jFromTop;
  const [t, p] = state.fis.inputs;
  return {
    i, j, mx, my,
    tiempo: t.range[0] + ((t.range[1] - t.range[0]) * i) / (nx - 1),
    precio: p.range[0] + ((p.range[1] - p.range[0]) * j) / (ny - 1),
    value: z[j][i],
  };
}

function bindHeatmap() {
  const canvas = $('heatmap');
  const tip = $('tooltip');
  canvas.addEventListener('pointermove', (e) => {
    const hit = heatHit(e);
    state.hover = hit;
    if (!hit) { tip.hidden = true; drawHeatmap(); return; }
    tip.innerHTML = `<b>${fmt(hit.value)} %</b><br>${fmt(hit.tiempo, 0)} min · ${money.format(hit.precio)}`;
    tip.hidden = false;
    const box = canvas.getBoundingClientRect();
    const left = hit.mx + 14 + tip.offsetWidth > box.width ? hit.mx - tip.offsetWidth - 14 : hit.mx + 14;
    tip.style.left = `${Math.max(0, left)}px`;
    tip.style.top = `${Math.max(0, hit.my - tip.offsetHeight - 10)}px`;
    drawHeatmap();
  });
  canvas.addEventListener('pointerleave', () => { state.hover = null; tip.hidden = true; drawHeatmap(); });
  canvas.addEventListener('click', (e) => {
    const hit = heatHit(e);
    if (!hit) return;
    state.tiempo = hit.tiempo;
    state.precio = hit.precio;
    syncInputs();
    update();
  });
}

// ---------- reglas ----------
function renderRules(res) {
  const { fis } = state;
  const out = fis.outputs[0];
  const name = (v, idx) => (idx === 0 ? '—' : (idx < 0 ? 'no ' : '') + pretty(v.mfs[Math.abs(idx) - 1].name));
  $('rules-body').innerHTML = fis.rules.map((r, k) => {
    const f = res.firing[k];
    const conn = r.connection === 'or' ? 'o' : 'y';
    return `<tr class="${f > 0 ? 'on' : ''}">
      <td>${k + 1}</td>
      <td>${name(fis.inputs[0], r.antecedent[0])}</td>
      <td>${conn === 'y' ? '' : 'o '}${name(fis.inputs[1], r.antecedent[1])}</td>
      <td>${name(out, r.consequent[0])}</td>
      <td class="num"><div class="fire"><span>${fmt(f)}</span><div class="bar"><span style="width:${f * 100}%"></span></div></div></td>
    </tr>`;
  }).join('');
}

// ---------- ciclo principal ----------
function syncInputs() {
  $('tiempo-num').value = +state.tiempo.toFixed(1);
  $('tiempo-range').value = state.tiempo;
  $('precio-num').value = +state.precio.toFixed(2);
  $('precio-range').value = state.precio;
}

function update() {
  const { fis } = state;
  const res = evaluate(fis, [state.tiempo, state.precio]);
  state.result = res;
  const pct = res.outputs[0].value;
  const tipAmount = state.precio * (pct / 100);

  $('pct').textContent = fmt(pct, 1);
  $('monto').textContent = money.format(tipAmount);
  $('total').textContent = money.format(state.precio + tipAmount);

  // etiqueta linguistica: conjunto de salida con mayor pertenencia en el centroide
  const out = fis.outputs[0];
  const best = out.mfs.map((mf) => evalMF(mf, pct)).reduce((b, v, i, a) => (v > a[b] ? i : b), 0);
  $('nivel').textContent = pretty(out.mfs[best].name);

  const [t, p] = fis.inputs;
  const notes = [];
  if (state.precio > p.range[1]) notes.push(`Por encima de ${money.format(p.range[1])} el sistema lo trata como ese máximo; la propina se calcula sobre el monto real.`);
  $('precio-note').hidden = !notes.length;
  $('precio-note').textContent = notes.join(' ');
  if (state.tiempo > t.range[1]) $('status').textContent = `Tiempo saturado a ${t.range[1]} min.`;
  else $('status').textContent = state.source;

  drawInputPlot('plot-tiempo', 'legend-tiempo', t, res.inputs[0], res.fuzzified[0]);
  drawInputPlot('plot-precio', 'legend-precio', p, res.inputs[1], res.fuzzified[1]);
  drawOutputPlot(out, res);
  renderRules(res);
  drawHeatmap();
}

function bindInput(name, idx) {
  const v = state.fis.inputs[idx];
  const range = $(`${name}-range`), num = $(`${name}-num`);
  range.min = v.range[0];
  range.max = v.range[1];
  $(`${name}-min`).textContent = v.range[0].toLocaleString('es-MX');
  $(`${name}-max`).textContent = v.range[1].toLocaleString('es-MX');
  range.addEventListener('input', () => { state[name] = Number(range.value); num.value = range.value; update(); });
  num.addEventListener('input', () => {
    const n = Number(num.value);
    if (num.value === '' || !Number.isFinite(n) || n < 0) return;
    state[name] = n;
    range.value = Math.min(v.range[1], n);
    update();
  });
}

async function main() {
  const { fis, source } = await loadFIS();
  state.fis = fis;
  state.source = source === 'matlab/propina.fis'
    ? `Sistema "${fis.name}" cargado desde ${source}.`
    : 'Usando copia interna del sistema (abre la página desde un servidor para leer el .fis).';

  $('imp').textContent = fis.impMethod;
  $('agg').textContent = fis.aggMethod;
  $('defuzz').textContent = fis.defuzzMethod;

  bindInput('tiempo', 0);
  bindInput('precio', 1);
  syncInputs();
  state.surface = computeSurface(fis);
  bindHeatmap();
  update();

  // Redibuja solo si cambia el ancho (evita un ciclo resize -> redibujo -> resize)
  let raf, lastWidth = 0;
  new ResizeObserver(([entry]) => {
    const width = Math.round(entry.contentRect.width);
    if (width === lastWidth) return;
    lastWidth = width;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(update);
  }).observe(document.querySelector('main'));
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', update);
}

main().catch((err) => {
  $('status').textContent = `Error al cargar el sistema difuso: ${err.message}`;
  console.error(err);
});
