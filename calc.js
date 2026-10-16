// Cálculos do simulador. Script comum (funciona até abrindo o arquivo direto) e também no Node (teste).

const SEMANAS_MES = 52 / 12;
const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

// PEC 221/2019: 44h hoje → 42h após 60 dias → 40h após mais 12 meses.
const FASES = [
  { id: 'hoje', limite: 44, nome: 'Hoje', quando: 'Até a regra entrar em vigor' },
  { id: 'f1', limite: 42, nome: 'Fase 1', quando: '60 dias após a promulgação' },
  { id: 'f2', limite: 40, nome: 'Fase 2', quando: '12 meses depois da Fase 1' },
];

function limitePorMes(mes) {
  if (mes < 2) return 44;
  if (mes < 14) return 42;
  return 40;
}

// Impacto de um cargo num teto semanal.
function impactoCargo(c, limite, encargos) {
  const pessoas = Math.max(0, Number(c.pessoas) || 0);
  const salario = Math.max(0, Number(c.salario) || 0);
  const horas = Math.max(0, Number(c.horas) || 0);
  const fator = 1 + encargos;
  const folha = pessoas * salario * fator;
  const excesso = Math.max(0, horas - limite);
  const horasFaltando = pessoas * excesso; // por semana
  const base = { cargo: c.cargo, pessoas, salario, horas, folha, horasFaltando,
    contratar: 0, custoContratar: 0, custoHE: 0, custoExtra: 0, estrategia: 'nada', aumentoHora: 0 };
  if (!horasFaltando || !salario) return base;

  // Salário mantido, menos horas: o valor da hora sobe (divisor CLT = horas semanais × 5).
  const valorHora = salario / (limite * 5);
  const contratar = Math.ceil(horasFaltando / limite);
  const custoContratar = contratar * salario * fator;
  const custoHE = horasFaltando * SEMANAS_MES * valorHora * 1.5 * fator;
  const estrategia = custoHE < custoContratar ? 'horaExtra' : 'contratar';
  return { ...base, contratar, custoContratar, custoHE,
    custoExtra: Math.min(custoHE, custoContratar), estrategia,
    aumentoHora: horas / limite - 1 };
}

function simular(cargos, limite, encargos) {
  const linhas = cargos.map((c) => impactoCargo(c, limite, encargos));
  const soma = (k) => linhas.reduce((t, l) => t + l[k], 0);
  const folha = soma('folha');
  const extra = soma('custoExtra');
  const pessoas = soma('pessoas');
  return {
    limite, linhas, folha, extra, novaFolha: folha + extra,
    pessoas, afetados: linhas.filter((l) => l.horasFaltando > 0).reduce((t, l) => t + l.pessoas, 0),
    contratar: linhas.filter((l) => l.estrategia === 'contratar').reduce((t, l) => t + l.contratar, 0),
    percentual: folha ? extra / folha : 0,
  };
}

// Escala 5x2 rotativa para os dias em que o negócio abre.
function gerarEscala(nPessoas, abertos, limite) {
  const dias = abertos.map((a, i) => (a ? i : -1)).filter((i) => i >= 0);
  const D = dias.length;
  const W = Math.min(D, 5);
  const folgasExtras = D - W;
  const grade = [];
  for (let p = 0; p < nPessoas; p++) {
    const linha = abertos.map(() => false);
    dias.forEach((d) => (linha[d] = true));
    for (let j = 0; j < folgasExtras; j++) linha[dias[(p * folgasExtras + j) % D]] = false;
    grade.push(linha);
  }
  const cobertura = abertos.map((_, d) => grade.filter((l) => l[d]).length);
  const horasDia = W ? limite / W : 0;
  return { grade, cobertura, horasDia, diasTrabalho: W, acimaDe8: horasDia > Math.max(8, limite / 5) + 1e-9 };
}

function linhaDoTempo(cargos, encargos, meses = 18) {
  return Array.from({ length: meses }, (_, m) => simular(cargos, limitePorMes(m), encargos).novaFolha);
}

if (typeof module !== 'undefined') module.exports = { SEMANAS_MES, DIAS, FASES, limitePorMes, impactoCargo, simular, gerarEscala, linhaDoTempo };
