// node calc.test.mjs
import assert from 'node:assert/strict';
import { impactoCargo, simular, gerarEscala, limitePorMes } from './calc.js';

// 10 pessoas a 44h, R$ 2.000, sem encargos, teto 40h → faltam 40h/semana = 1 contratação.
const r = impactoCargo({ cargo: 'Caixa', pessoas: 10, salario: 2000, horas: 44 }, 40, 0);
assert.equal(r.horasFaltando, 40);
assert.equal(r.contratar, 1);
assert.equal(r.custoContratar, 2000);
assert.ok(Math.abs(r.aumentoHora - 0.1) < 1e-9);
assert.equal(r.estrategia, 'contratar'); // HE: 40×4,33×10×1,5 = 2600 > 2000

// Quem já faz 40h não é afetado.
assert.equal(impactoCargo({ pessoas: 3, salario: 3000, horas: 40 }, 40, 0.5).custoExtra, 0);

// 1 pessoa a 44h → 2h/semana faltando: hora extra sai mais barata que contratar.
assert.equal(impactoCargo({ pessoas: 1, salario: 2000, horas: 44 }, 42, 0).estrategia, 'horaExtra');

const s = simular([{ pessoas: 10, salario: 2000, horas: 44 }], 40, 0);
assert.equal(s.novaFolha, 22000);

// Loja aberta Seg–Sáb: cada um trabalha 5 dias, 8h, folgas espalhadas.
const e = gerarEscala(6, [1, 1, 1, 1, 1, 1, 0].map(Boolean), 40);
assert.equal(e.horasDia, 8);
assert.deepEqual(e.cobertura, [5, 5, 5, 5, 5, 5, 0]);
e.grade.forEach((l) => assert.equal(l.filter(Boolean).length, 5));

assert.deepEqual([0, 1, 2, 13, 14].map(limitePorMes), [44, 44, 42, 42, 40]);
console.log('ok');
