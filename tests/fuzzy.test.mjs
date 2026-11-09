// Pruebas del motor difuso contra matlab/propina.fis.
// Ejecutar con: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseFIS, evaluate } from '../js/fuzzy.js';

const fis = parseFIS(readFileSync(new URL('../matlab/propina.fis', import.meta.url), 'utf8'));
const propina = (t, p) => evaluate(fis, [t, p]).outputs[0].value;

test('lee el .fis completo', () => {
  assert.equal(fis.type, 'mamdani');
  assert.deepEqual(fis.inputs.map((v) => v.name), ['tiempo', 'precio']);
  assert.equal(fis.outputs[0].mfs.length, 5);
  assert.equal(fis.rules.length, 9);
});

test('casos de referencia (centroide de 101 puntos, como MATLAB)', () => {
  const casos = [
    [5, 150, 18.0], [5, 1800, 23.2098], [25, 800, 12.5], [50, 150, 2.268],
    [50, 1800, 12.5], [15, 450, 15.5968], [15, 800, 15.8859], [35, 1100, 11.6632],
  ];
  for (const [t, p, esperado] of casos) {
    const y = propina(t, p);
    assert.ok(Math.abs(y - esperado) < 1e-3, `${t} min, $${p}: ${y} != ${esperado}`);
  }
});

test('fuerza de disparo del caso 15 min / $800', () => {
  const r = evaluate(fis, [15, 800]);
  assert.ok(Math.abs(r.firing[1] - 0.5) < 1e-9);
  assert.ok(Math.abs(r.firing[4] - 1 / 3) < 1e-9);
  assert.equal(r.firing.filter((w) => w > 0).length, 2);
});

test('satura entradas fuera de rango', () => {
  assert.equal(propina(80, 5000), propina(60, 2000));
});
