import { simular, gerarEscala, linhaDoTempo, DIAS, FASES } from './calc.js';

const $ = (s) => document.querySelector(s);
const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const pct = (v) => (v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const EXEMPLO = [
  { cargo: 'Atendente', pessoas: 6, salario: 1900, horas: 44 },
  { cargo: 'Caixa', pessoas: 3, salario: 2000, horas: 44 },
  { cargo: 'Repositor', pessoas: 2, salario: 1800, horas: 44 },
  { cargo: 'Cozinheiro', pessoas: 2, salario: 2600, horas: 44 },
];
const novoCargo = () => ({ cargo: '', pessoas: '', salario: '', horas: 44 });

let state = { cargos: [novoCargo()], dias: [1, 1, 1, 1, 1, 1, 0].map(Boolean), regime: '0.37', encargos: '', fase: 'f2', escala: 0 };
try { Object.assign(state, JSON.parse(localStorage.getItem('nova-jornada') || '{}')); } catch {}
if (new URLSearchParams(location.search).has('exemplo')) state.cargos = EXEMPLO.map((c) => ({ ...c }));
const salvar = () => { try { localStorage.setItem('nova-jornada', JSON.stringify(state)); } catch {} };
const encargos = () => (state.regime === 'custom' ? (Number(state.encargos) || 0) / 100 : Number(state.regime));
const validos = () => state.cargos.filter((c) => Number(c.pessoas) > 0 && Number(c.salario) > 0 && Number(c.horas) > 0);

/* ---------- Passo 1: cargos ---------- */
function renderCargos() {
  $('#roles').innerHTML = state.cargos.map((c, i) => `
    <div class="role" data-i="${i}">
      <div class="f-cargo"><label for="c${i}">Cargo</label><input id="c${i}" data-k="cargo" value="${esc(c.cargo)}" placeholder="Ex.: Atendente"></div>
      <div><label for="p${i}">Funcionários</label><input id="p${i}" data-k="pessoas" type="number" inputmode="numeric" min="0" value="${esc(c.pessoas)}" placeholder="0"></div>
      <div><label for="s${i}">Salário (R$)</label><input id="s${i}" data-k="salario" type="number" inputmode="decimal" min="0" step="50" value="${esc(c.salario)}" placeholder="2.000"></div>
      <div><label for="h${i}">Horas/semana</label><input id="h${i}" data-k="horas" type="number" inputmode="numeric" min="1" max="60" value="${esc(c.horas)}"></div>
      <button class="del" type="button" aria-label="Remover cargo" data-del="${i}">×</button>
    </div>`).join('');
}
$('#roles').addEventListener('input', (e) => {
  const k = e.target.dataset.k; if (!k) return;
  state.cargos[e.target.closest('.role').dataset.i][k] = e.target.value;
  atualizar();
});
$('#roles').addEventListener('click', (e) => {
  const i = e.target.dataset.del; if (i == null) return;
  state.cargos.splice(i, 1);
  if (!state.cargos.length) state.cargos.push(novoCargo());
  renderCargos(); atualizar();
});
$('#add').onclick = () => { state.cargos.push(novoCargo()); renderCargos(); $(`#c${state.cargos.length - 1}`).focus(); };
$('#exemplo').onclick = () => { state.cargos = EXEMPLO.map((c) => ({ ...c })); renderCargos(); atualizar(); $('#resultado').scrollIntoView(); };
$('#limpar').onclick = () => { state.cargos = [novoCargo()]; renderCargos(); atualizar(); };

/* ---------- Excel ---------- */
let xlsxPronto;
const carregarXLSX = () => (xlsxPronto ??= new Promise((ok, erro) => {
  const s = document.createElement('script');
  s.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
  s.onload = () => ok(window.XLSX); s.onerror = () => erro(new Error('Não foi possível carregar o leitor de planilhas.'));
  document.head.appendChild(s);
}));
const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const num = (v) => (typeof v === 'number' ? v : Number(String(v).replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')) || '');

async function importar(file) {
  try {
    const XLSX = await carregarXLSX();
    const wb = XLSX.read(await file.arrayBuffer());
    const linhas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
    const cab = (linhas[0] || []).map(norm);
    const col = (re, padrao) => { const i = cab.findIndex((h) => re.test(h)); return i >= 0 ? i : padrao; };
    const ic = col(/cargo|funcao|posto/, 0), ip = col(/funcion|pessoa|qtd|quant|colab|n[ºo°]/, 1),
      is = col(/sal|remun/, 2), ih = col(/hora|jornada|carga/, 3);
    const cargos = linhas.slice(1).filter((l) => l[ic] !== '' || l[ip] !== '')
      .map((l) => ({ cargo: String(l[ic]).trim(), pessoas: num(l[ip]), salario: num(l[is]), horas: num(l[ih]) || 44 }));
    if (!cargos.length) throw new Error('Não encontramos cargos na planilha. Use o modelo para conferir as colunas.');
    state.cargos = cargos; renderCargos(); atualizar(); $('#resultado').scrollIntoView();
  } catch (err) { alert(err.message); }
}
$('#file').onchange = (e) => e.target.files[0] && importar(e.target.files[0]);
const drop = $('#drop');
['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('on'); }));
['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove('on'); }));
drop.addEventListener('drop', (e) => e.dataTransfer.files[0] && importar(e.dataTransfer.files[0]));
$('#modelo').onclick = async () => {
  try {
    const XLSX = await carregarXLSX();
    const ws = XLSX.utils.aoa_to_sheet([['Cargo', 'Funcionários', 'Salário', 'Horas por semana'], ...EXEMPLO.map((c) => [c.cargo, c.pessoas, c.salario, c.horas])]);
    ws['!cols'] = [{ wch: 22 }, { wch: 14 }, { wch: 12 }, { wch: 18 }];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Equipe');
    XLSX.writeFile(wb, 'modelo-nova-jornada.xlsx');
  } catch (err) { alert(err.message); }
};

/* ---------- Passo 2 ---------- */
$('#dias').innerHTML = DIAS.map((d, i) => `<button type="button" class="chip" data-d="${i}" aria-pressed="${state.dias[i]}">${d}</button>`).join('');
$('#dias').onclick = (e) => {
  const d = e.target.dataset.d; if (d == null) return;
  state.dias[d] = !state.dias[d]; e.target.setAttribute('aria-pressed', state.dias[d]); atualizar();
};
$('#regime').value = state.regime;
$('#encargos').value = state.encargos;
$('#encargos').hidden = state.regime !== 'custom';
$('#regime').onchange = (e) => { state.regime = e.target.value; $('#encargos').hidden = state.regime !== 'custom'; atualizar(); };
$('#encargos').oninput = (e) => { state.encargos = e.target.value; atualizar(); };

/* ---------- Resultado ---------- */
$('#out').innerHTML = `
  <div id="vazio" class="card empty"><p style="font-size:1.2rem;margin:0 0 16px">Preencha pelo menos um cargo, com quantas pessoas, salário e horas, para ver a conta.</p><button class="btn btn-primary" type="button" onclick="document.querySelector('#exemplo').click()">Usar um exemplo</button></div>
  <div id="cheio" hidden>
    <h2>O resultado</h2>
    <div class="tabs" role="tablist">${FASES.slice(1).map((f) => `<button class="tab" role="tab" data-f="${f.id}">${f.nome} · ${f.limite}h</button>`).join('')}</div>
    <div class="kpis">
      <div class="kpi big" id="k-main"><div class="l">Sua folha vai aumentar, por mês</div><div class="v" id="k-mes"></div><div class="s" id="k-mes-s"></div></div>
      <div class="kpi"><div class="l">Por ano</div><div class="v" id="k-ano"></div><div class="s">com 13º salário</div></div>
      <div class="kpi"><div class="l">Contratações</div><div class="v" id="k-contr"></div><div class="s" id="k-contr-s"></div></div>
      <div class="kpi"><div class="l">Custo da hora</div><div class="v" id="k-hora"></div><div class="s" id="k-hora-s"></div></div>
    </div>
    <div class="charts">
      <div class="card"><h4>Folha mensal em cada fase</h4><p class="sub">Salários + encargos</p><div class="chart-box"><canvas id="g-fases"></canvas></div></div>
      <div class="card"><h4>Os próximos 18 meses</h4><p class="sub">Custo mensal a partir da promulgação</p><div class="chart-box"><canvas id="g-tempo"></canvas></div></div>
    </div>
    <div class="card" style="margin-top:16px"><h4>O que fazer em cada cargo</h4><p class="sub">As horas que sobram podem virar hora extra ou uma contratação. Aqui está o que sai mais em conta.</p>
      <div class="scroll"><table class="table"><thead><tr><th>Cargo</th><th>Horas que faltam/semana</th><th>Contratar</th><th>Hora extra</th><th>Recomendação</th></tr></thead><tbody id="t-cargos"></tbody></table></div>
    </div>
    <div class="card" style="margin-top:16px"><h4>Sua nova escala</h4><p class="sub" id="e-sub"></p>
      <div class="field no-print" style="max-width:360px;margin-bottom:16px"><label for="e-cargo">Cargo</label><select id="e-cargo"></select></div>
      <div class="scroll"><table class="roster" id="e-grade"></table></div>
      <div class="legend"><span><i style="background:var(--ok-soft)"></i>Trabalha</span><span><i style="background:#d1fae5;outline:2px dashed var(--accent-2)"></i>Nova contratação</span><span><i style="background:var(--amber-soft)"></i>Folga</span><span><i style="background:var(--surface-2)"></i>Fechado</span></div>
      <div id="e-nota"></div>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:24px" class="no-print">
      <button class="btn btn-primary" type="button" onclick="print()">Imprimir ou salvar em PDF</button>
      <a class="btn btn-ghost" href="#simulador">Ajustar dados</a>
    </div>
  </div>`;

document.querySelectorAll('.tab').forEach((t) => (t.onclick = () => { state.fase = t.dataset.f; atualizar(); }));
$('#e-cargo').onchange = (e) => { state.escala = Number(e.target.value); atualizar(); };

Chart.defaults.font.family = "-apple-system, BlinkMacSystemFont, 'Inter', system-ui, sans-serif";
Chart.defaults.font.size = 13;
Chart.defaults.color = '#6e6e73';
const eixoBRL = { ticks: { callback: (v) => 'R$ ' + (v >= 1000 ? (v / 1000).toLocaleString('pt-BR') + ' mil' : v) }, grid: { color: '#ebebf0' }, border: { display: false } };
const tip = { callbacks: { label: (c) => ' ' + brl(c.parsed.y) } };
const gFases = new Chart($('#g-fases'), {
  type: 'bar',
  data: { labels: FASES.map((f) => `${f.nome} · ${f.limite}h`), datasets: [{ data: [], backgroundColor: ['#c7c7cc', '#ff9f0a', '#ff3b30'], borderRadius: 10, maxBarThickness: 64 }] },
  options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: tip }, scales: { y: { ...eixoBRL, beginAtZero: true }, x: { grid: { display: false }, border: { display: false } } } },
});
const meses = Array.from({ length: 18 }, (_, m) => { const d = new Date(2026, 9 + m, 1); return d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') + '/' + String(d.getFullYear()).slice(2); });
const gTempo = new Chart($('#g-tempo'), {
  type: 'line',
  data: { labels: meses, datasets: [{ data: [], stepped: true, borderColor: '#0071e3', borderWidth: 3, pointRadius: 0, fill: true, backgroundColor: 'rgba(0,113,227,.08)' }] },
  options: { maintainAspectRatio: false, interaction: { intersect: false, mode: 'index' }, plugins: { legend: { display: false }, tooltip: tip }, scales: { y: eixoBRL, x: { grid: { display: false }, border: { display: false }, ticks: { maxRotation: 0, autoSkipPadding: 12 } } } },
});

function atualizar() {
  salvar();
  const cargos = validos();
  $('#vazio').hidden = !!cargos.length; $('#cheio').hidden = !cargos.length;
  if (!cargos.length) return;

  const enc = encargos();
  const fase = FASES.find((f) => f.id === state.fase) || FASES[2];
  const r = simular(cargos, fase.limite, enc);
  const porFase = FASES.map((f) => simular(cargos, f.limite, enc).novaFolha);
  document.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-selected', t.dataset.f === fase.id));

  const semImpacto = r.extra === 0;
  $('#k-main').classList.toggle('ok', semImpacto);
  $('#k-mes').textContent = semImpacto ? 'Sem impacto' : '+' + brl(r.extra);
  $('#k-mes-s').textContent = semImpacto ? 'Sua equipe já cabe no novo limite.' : `${pct(r.percentual)} a mais. De ${brl(r.folha)} para ${brl(r.novaFolha)} por mês.`;
  $('#k-ano').textContent = brl(r.extra * 13);
  $('#k-contr').textContent = r.contratar;
  $('#k-contr-s').textContent = r.contratar === 1 ? 'pessoa nova' : 'pessoas novas';
  const maior = Math.max(0, ...r.linhas.map((l) => l.aumentoHora));
  $('#k-hora').textContent = '+' + pct(maior);
  $('#k-hora-s').textContent = `${r.afetados} de ${r.pessoas} funcionários afetados`;

  gFases.data.datasets[0].data = porFase; gFases.update();
  gTempo.data.datasets[0].data = linhaDoTempo(cargos, enc); gTempo.update();

  $('#t-cargos').innerHTML = r.linhas.map((l) => {
    const rec = l.estrategia === 'contratar' ? `<span class="pill c">Contratar ${l.contratar}</span>`
      : l.estrategia === 'horaExtra' ? '<span class="pill h">Hora extra</span>' : '<span class="pill n">Nada muda</span>';
    return `<tr><td data-l="Cargo"><b>${esc(l.cargo || 'Sem nome')}</b><br><span class="hint">${l.pessoas} × ${l.horas}h</span></td>
      <td class="num" data-l="Faltam/semana">${l.horasFaltando ? l.horasFaltando.toLocaleString('pt-BR') + 'h' : '—'}</td>
      <td class="num" data-l="Contratar">${l.horasFaltando ? brl(l.custoContratar) + '/mês' : '—'}</td>
      <td class="num" data-l="Hora extra">${l.horasFaltando ? brl(l.custoHE) + '/mês' : '—'}</td>
      <td data-l="Recomendação">${rec}</td></tr>`;
  }).join('');

  // Escala
  if (state.escala >= cargos.length) state.escala = 0;
  $('#e-cargo').innerHTML = cargos.map((c, i) => `<option value="${i}" ${i === state.escala ? 'selected' : ''}>${esc(c.cargo || 'Cargo ' + (i + 1))}</option>`).join('');
  const l = r.linhas[state.escala];
  const novos = l.estrategia === 'contratar' ? l.contratar : 0;
  const total = l.pessoas + novos;
  const e = gerarEscala(total, state.dias, Math.min(l.horas, fase.limite));
  const mostrar = Math.min(total, 15);
  const horasTxt = e.horasDia.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'h';
  $('#e-sub').textContent = e.diasTrabalho
    ? `Escala ${e.diasTrabalho}x${7 - e.diasTrabalho} com ${horasTxt} por dia e folgas em rodízio. ${total} pessoas no total.`
    : 'Marque pelo menos um dia aberto no passo 2.';
  $('#e-grade').innerHTML = `<tr><th></th>${DIAS.map((d) => `<th>${d}</th>`).join('')}</tr>` +
    e.grade.slice(0, mostrar).map((linha, p) => `<tr><td class="name">${p >= l.pessoas ? 'Nova ' + (p - l.pessoas + 1) : 'Pessoa ' + (p + 1)}</td>${linha.map((t, d) =>
      !state.dias[d] ? '<td class="x">—</td>' : t ? `<td class="t${p >= l.pessoas ? ' nova' : ''}">${horasTxt}</td>` : '<td class="f">Folga</td>').join('')}</tr>`).join('') +
    `<tr class="cov"><td class="name">Na loja</td>${e.cobertura.map((n, d) => `<td>${state.dias[d] ? n : ''}</td>`).join('')}</tr>`;
  $('#e-nota').innerHTML = [
    total > mostrar && `<div class="note">Mostrando ${mostrar} de ${total} pessoas. O rodízio continua igual para as demais.</div>`,
    e.acimaDe8 && `<div class="note">Com tão poucos dias abertos, cada dia passaria de 8 horas, o máximo da nova regra. Reduza as horas por dia ou abra mais dias.</div>`,
  ].filter(Boolean).join('');
}

renderCargos();
atualizar();
