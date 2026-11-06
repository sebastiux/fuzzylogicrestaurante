// Motor de inferencia difusa compatible con archivos .fis de MATLAB
// (Fuzzy Logic Toolbox). Replica evalfis para sistemas Mamdani:
// AND/OR, implicacion, agregacion y defuzzificacion sobre 101 puntos.

// ---------- Funciones de pertenencia (mismas definiciones que MATLAB) ----------
const MF = {
  trimf(x, [a, b, c]) {
    if (x === b) return 1;
    if (a !== b && a < x && x < b) return (x - a) / (b - a);
    if (b !== c && b < x && x < c) return (c - x) / (c - b);
    return 0;
  },
  trapmf(x, [a, b, c, d]) {
    let y1 = 0;
    if (x >= b) y1 = 1;
    else if (a <= x && x < b) y1 = (x - a) / (b - a);
    let y2 = 0;
    if (x <= c) y2 = 1;
    else if (c < x && x <= d) y2 = (d - x) / (d - c);
    return Math.min(y1, y2);
  },
  gaussmf: (x, [s, c]) => Math.exp(-((x - c) ** 2) / (2 * s * s)),
  gauss2mf(x, [s1, c1, s2, c2]) {
    const l = x <= c1 ? Math.exp(-((x - c1) ** 2) / (2 * s1 * s1)) : 1;
    const r = x >= c2 ? Math.exp(-((x - c2) ** 2) / (2 * s2 * s2)) : 1;
    return l * r;
  },
  gbellmf: (x, [a, b, c]) => 1 / (1 + Math.abs((x - c) / a) ** (2 * b)),
  sigmf: (x, [a, c]) => 1 / (1 + Math.exp(-a * (x - c))),
  dsigmf: (x, [a1, c1, a2, c2]) =>
    Math.abs(1 / (1 + Math.exp(-a1 * (x - c1))) - 1 / (1 + Math.exp(-a2 * (x - c2)))),
  psigmf: (x, [a1, c1, a2, c2]) =>
    (1 / (1 + Math.exp(-a1 * (x - c1)))) * (1 / (1 + Math.exp(-a2 * (x - c2)))),
};

export function evalMF(mf, x) {
  const fn = MF[mf.type];
  if (!fn) throw new Error(`Funcion de pertenencia no soportada: ${mf.type}`);
  return fn(x, mf.params);
}

const AND = { min: (a, b) => Math.min(a, b), prod: (a, b) => a * b };
const OR = { max: (a, b) => Math.max(a, b), probor: (a, b) => a + b - a * b };
const IMP = { min: Math.min, prod: (a, b) => a * b };
const AGG = { max: Math.max, sum: (a, b) => a + b, probor: (a, b) => a + b - a * b };

// ---------- Parser de .fis ----------
const unquote = (s) => s.trim().replace(/^'(.*)'$/, '$1');
const nums = (s) => s.replace(/[\[\]]/g, ' ').trim().split(/[\s,]+/).filter(Boolean).map(Number);

export function parseFIS(text) {
  const fis = { inputs: [], outputs: [], rules: [] };
  let section = null;
  let current = null;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('%') || line.startsWith('#')) continue;

    const head = line.match(/^\[(\w+?)(\d*)\]$/);
    if (head) {
      section = head[1];
      if (section === 'Input' || section === 'Output') {
        current = { name: '', range: [0, 1], mfs: [] };
        (section === 'Input' ? fis.inputs : fis.outputs)[Number(head[2]) - 1] = current;
      }
      continue;
    }

    if (section === 'Rules') {
      // "1 1, 4 (1) : 1"
      const m = line.match(/^([^,]+),([^(]+)\(([^)]+)\)\s*:\s*(\d+)/);
      if (!m) continue;
      fis.rules.push({
        antecedent: nums(m[1]),
        consequent: nums(m[2]),
        weight: Number(m[3]),
        connection: Number(m[4]) === 2 ? 'or' : 'and',
      });
      continue;
    }

    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim();

    if (section === 'System') {
      const map = {
        Name: 'name', Type: 'type', AndMethod: 'andMethod', OrMethod: 'orMethod',
        ImpMethod: 'impMethod', AggMethod: 'aggMethod', DefuzzMethod: 'defuzzMethod',
      };
      if (map[key]) fis[map[key]] = unquote(val);
    } else if (current) {
      if (key === 'Name') current.name = unquote(val);
      else if (key === 'Range') current.range = nums(val);
      else if (/^MF\d+$/.test(key)) {
        const m = val.match(/^'([^']*)'\s*:\s*'([^']*)'\s*,\s*(\[.*\])/);
        if (m) current.mfs[Number(key.slice(2)) - 1] = { name: m[1], type: m[2], params: nums(m[3]) };
      }
    }
  }

  if (String(fis.type).toLowerCase() !== 'mamdani') {
    throw new Error(`Solo se soportan sistemas Mamdani (el archivo es "${fis.type}")`);
  }
  return fis;
}

// ---------- Defuzzificacion ----------
function defuzz(xs, mu, method, range) {
  const total = mu.reduce((s, v) => s + v, 0);
  if (total === 0) return (range[0] + range[1]) / 2; // mismo fallback que MATLAB

  switch (method) {
    case 'centroid':
      return xs.reduce((s, x, i) => s + x * mu[i], 0) / total;
    case 'bisector': {
      let acc = 0;
      for (let i = 0; i < xs.length; i++) {
        acc += mu[i];
        if (acc >= total / 2) return xs[i];
      }
      return xs[xs.length - 1];
    }
    case 'mom': case 'som': case 'lom': {
      const max = Math.max(...mu);
      const at = xs.filter((_, i) => mu[i] === max);
      if (method === 'som') return at[0];
      if (method === 'lom') return at[at.length - 1];
      return at.reduce((s, x) => s + x, 0) / at.length;
    }
    default:
      throw new Error(`Defuzzificacion no soportada: ${method}`);
  }
}

const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, v));

// ---------- Inferencia ----------
export function evaluate(fis, inputValues, { samples = 101 } = {}) {
  const and = AND[fis.andMethod];
  const or = OR[fis.orMethod];
  const imp = IMP[fis.impMethod];
  const agg = AGG[fis.aggMethod];

  const x = fis.inputs.map((inp, i) => clamp(inputValues[i], inp.range));

  // Grado de pertenencia de cada entrada a cada uno de sus conjuntos
  const fuzzified = fis.inputs.map((inp, i) => inp.mfs.map((mf) => evalMF(mf, x[i])));

  // Fuerza de disparo de cada regla
  const firing = fis.rules.map((r) => {
    const degrees = [];
    r.antecedent.forEach((idx, i) => {
      if (idx === 0) return; // "no importa"
      const mu = fuzzified[i][Math.abs(idx) - 1];
      degrees.push(idx < 0 ? 1 - mu : mu);
    });
    if (!degrees.length) return 0;
    const op = r.connection === 'or' ? or : and;
    return degrees.reduce((a, b) => op(a, b)) * r.weight;
  });

  const outputs = fis.outputs.map((out, o) => {
    const [lo, hi] = out.range;
    const xs = Array.from({ length: samples }, (_, k) => lo + ((hi - lo) * k) / (samples - 1));
    const aggregated = new Array(samples).fill(0);

    fis.rules.forEach((r, ri) => {
      const idx = r.consequent[o];
      if (!idx) return;
      const mf = out.mfs[Math.abs(idx) - 1];
      for (let k = 0; k < samples; k++) {
        let mu = evalMF(mf, xs[k]);
        if (idx < 0) mu = 1 - mu;
        aggregated[k] = agg(aggregated[k], imp(firing[ri], mu));
      }
    });

    const value = defuzz(xs, aggregated, fis.defuzzMethod, out.range);
    return { value, xs, aggregated };
  });

  return { inputs: x, fuzzified, firing, outputs };
}
