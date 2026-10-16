// Depende de calc.js e Chart.js, carregados antes na página.
const $ = (s) => document.querySelector(s);
const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const pct = (v) => (v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%';
const nf = (v) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

// Prazos contados a partir da promulgação prevista (16/10/2026).
const QUANDO = { f1: 'a partir de dez/2026', f2: 'a partir de dez/2027' };

const EXEMPLO = [
  { cargo: 'Atendente', pessoas: 6, salario: 1900, horas: 44 },
  { cargo: 'Caixa', pessoas: 3, salario: 2000, horas: 44 },
  { cargo: 'Repositor', pessoas: 2, salario: 1800, horas: 44 },
  { cargo: 'Cozinheiro', pessoas: 2, salario: 2600, horas: 44 },
];
const novoCargo = () => ({ cargo: '', pessoas: '', salario: '', horas: 44 });
const inicial = (vazio) => ({ cargos: vazio ? [novoCargo()] : EXEMPLO.map((c) => ({ ...c })), exemplo: !vazio, dias: [1, 1, 1, 1, 1, 1, 0].map(Boolean), regime: '0.37', encargos: '', fase: 'f2', escala: -1 });
const CHAVE = 'nova-jornada-v2';
const CORES_CARGO = ['#0071e3', '#34a853', '#9334e6', '#d93025', '#12b5cb', '#e52592', '#3f51b5', '#5f6368']; // sem laranja: é a cor da folga
const corCargo = (i) => CORES_CARGO[i % CORES_CARGO.length];

let state = inicial();
try { Object.assign(state, JSON.parse(localStorage.getItem(CHAVE) || '{}')); } catch {}
if (new URLSearchParams(location.search).has('exemplo')) state.cargos = EXEMPLO.map((c) => ({ ...c }));
const salvar = () => { try { localStorage.setItem(CHAVE, JSON.stringify(state)); } catch {} };
const encargos = () => (state.regime === 'custom' ? (Number(state.encargos) || 0) / 100 : Number(state.regime));
const validos = () => state.cargos.filter((c) => Number(c.pessoas) > 0 && Number(c.salario) > 0 && Number(c.horas) > 0);

/* ---------- Aviso (snackbar) ---------- */
let snackTimer;
function avisar(texto, desfazer) {
  $('#snack-t').textContent = texto;
  const b = $('#snack-b');
  b.hidden = !desfazer;
  b.onclick = () => { desfazer(); $('#snack').classList.remove('on'); };
  $('#snack').classList.add('on');
  clearTimeout(snackTimer);
  snackTimer = setTimeout(() => $('#snack').classList.remove('on'), desfazer ? 7000 : 4000);
}

/* ---------- Passo 1: cargos ---------- */
const ICON_X = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 5l10 10M15 5L5 15"/></svg>';
function renderCargos() {
  $('#aviso-ex').hidden = !state.exemplo;
  $('#roles').innerHTML = state.cargos.map((c, i) => `
    <div class="role" data-i="${i}">
      <div class="f-cargo"><label for="c${i}">Cargo</label><div class="inp"><input id="c${i}" data-k="cargo" value="${esc(c.cargo)}" placeholder="Ex.: Atendente" autocomplete="off"></div></div>
      <div><label for="p${i}">Funcionários</label><div class="inp"><input id="p${i}" data-k="pessoas" type="number" inputmode="numeric" min="0" value="${esc(c.pessoas)}" placeholder="0"></div></div>
      <div><label for="s${i}">Salário de cada um</label><div class="inp has-pre"><span class="pre">R$</span><input id="s${i}" data-k="salario" type="number" inputmode="decimal" min="0" step="50" value="${esc(c.salario)}" placeholder="2000"></div></div>
      <div><label for="h${i}">Horas por semana</label><div class="inp has-suf"><input id="h${i}" data-k="horas" type="number" inputmode="numeric" min="1" max="60" value="${esc(c.horas)}"><span class="suf">h</span></div></div>
      <button class="del" type="button" aria-label="Remover ${esc(c.cargo || 'cargo')}" data-del="${i}">${ICON_X}</button>
    </div>`).join('');
}
$('#roles').addEventListener('input', (e) => {
  const k = e.target.dataset.k; if (!k) return;
  state.cargos[e.target.closest('.role').dataset.i][k] = e.target.value;
  if (state.exemplo) { state.exemplo = false; $('#aviso-ex').hidden = true; }
  atualizar();
});
$('#roles').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-del]'); if (!btn) return;
  const i = Number(btn.dataset.del);
  const antes = structuredClone(state.cargos);
  const [removido] = state.cargos.splice(i, 1);
  if (!state.cargos.length) state.cargos.push(novoCargo());
  renderCargos(); atualizar();
  if (removido.cargo || removido.pessoas) avisar(`${removido.cargo || 'Cargo'} removido.`, () => { state.cargos = antes; renderCargos(); atualizar(); });
});
$('#add').onclick = () => { state.cargos.push(novoCargo()); renderCargos(); $(`#c${state.cargos.length - 1}`).focus(); };
$('#exemplo').onclick = () => {
  const antes = structuredClone(state.cargos);
  state.cargos = EXEMPLO.map((c) => ({ ...c })); state.exemplo = true; renderCargos(); atualizar();
  avisar('Preenchemos com um mercadinho de exemplo.', () => { state.cargos = antes; renderCargos(); atualizar(); });
};

/* ---------- Começar de novo ---------- */
function recomecar() {
  const antes = structuredClone(state);
  state = inicial(true);
  try { localStorage.removeItem(CHAVE); } catch {}
  renderTudo();
  $('#simulador').scrollIntoView();
  avisar('Tudo apagado. Pode começar de novo.', () => { state = antes; renderTudo(); });
}
$('#limpar').onclick = recomecar;
$('#limpar-ex').onclick = () => { state.cargos = [novoCargo()]; state.exemplo = false; renderCargos(); atualizar(); $('#c0').focus(); };

/* ---------- Excel ---------- */
let xlsxPronto;
const carregarXLSX = () => (xlsxPronto ??= new Promise((ok, erro) => {
  const s = document.createElement('script');
  s.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
  s.onload = () => ok(window.XLSX);
  s.onerror = () => { xlsxPronto = null; erro(new Error('Não conseguimos abrir o leitor de planilhas. Verifique a internet e tente de novo.')); };
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
    if (!cargos.length) throw new Error('Não encontramos cargos na planilha. Baixe o modelo para ver como ela deve ficar.');
    const antes = structuredClone(state.cargos);
    state.cargos = cargos; state.exemplo = false; renderCargos(); atualizar();
    avisar(`${plural(cargos.length, 'cargo importado', 'cargos importados')} de “${file.name}”.`, () => { state.cargos = antes; renderCargos(); atualizar(); });
  } catch (err) { avisar(err.message); }
  $('#file').value = '';
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
    avisar('Modelo baixado. Troque os exemplos pelos seus dados e envie de volta.');
  } catch (err) { avisar(err.message); }
};

/* ---------- Passo 2 ---------- */
const NOMES_DIA = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'];
function renderPasso2() {
  $('#dias').innerHTML = DIAS.map((d, i) => `<button type="button" class="chip" data-d="${i}" aria-pressed="${state.dias[i]}" aria-label="${NOMES_DIA[i]}">${d}</button>`).join('');
  document.querySelectorAll('[name=regime]').forEach((r) => (r.checked = r.value === state.regime));
  $('#encargos').value = state.encargos;
  $('#encargos-wrap').hidden = state.regime !== 'custom';
}
$('#dias').onclick = (e) => {
  const d = e.target.closest('[data-d]')?.dataset.d; if (d == null) return;
  state.dias[d] = !state.dias[d]; e.target.setAttribute('aria-pressed', state.dias[d]); atualizar();
};
$('#regime').onchange = (e) => {
  state.regime = e.target.value;
  $('#encargos-wrap').hidden = state.regime !== 'custom';
  if (state.regime === 'custom') $('#encargos').focus();
  atualizar();
};
$('#encargos').oninput = (e) => { state.encargos = e.target.value; atualizar(); };

/* ---------- Resultado ---------- */
$('#out').innerHTML = `
  <div id="vazio" class="card empty">
    <div class="ill"><svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 22V12M11 22V6M17 22v-8M23 22V9"/></svg></div>
    <h3>Seu resultado aparece aqui</h3>
    <p>Preencha pelo menos um cargo com número de funcionários, salário e horas por semana. Quer só ver como funciona?</p>
    <button class="btn btn-primary" type="button" id="vazio-ex">Ver com um exemplo</button>
  </div>
  <div id="cheio" hidden>
    <div class="res-head">
      <div><p class="kicker">Resultado</p><h2>O impacto na sua empresa.</h2></div>
      <div><div class="seg" role="tablist" aria-label="Fase da transição">${FASES.slice(1).map((f) => `<button role="tab" data-f="${f.id}">${f.nome} · ${f.limite}h</button>`).join('')}</div></div>
    </div>

    <div class="hero-res" id="hero-res">
      <div class="glow" aria-hidden="true"></div>
      <div class="hr-main">
        <span class="hr-chip" id="h-chip"></span>
        <p class="l" id="h-l"></p>
        <p class="v"><span id="h-v"></span><small id="h-v-s">por mês</small></p>
        <div class="hr-pills" id="h-pills"><span class="hp" id="h-pct"></span><span class="hp" id="h-ano"></span></div>
        <p class="say" id="h-say"></p>
      </div>
      <div class="hr-side">
        <p class="hr-t">Folha mensal com encargos</p>
        <div class="steps3" id="h-bars">${FASES.map((f, i) => `<div class="st" data-f="${f.id}"><div class="st-top"><span class="st-n">${f.nome} <em>${f.limite}h</em></span><span class="st-v"><b data-i="${i}"></b><small></small></span></div><div class="tr"><div class="fl"></div></div></div>`).join('')}</div>
        <p class="hr-foot" id="h-foot"></p>
      </div>
    </div>

    <div class="kpis">
      <div class="kpi"><p class="l">Custo extra no ano</p><p class="v" id="k-ano"></p><p class="s">12 salários + 13º, já com encargos.</p></div>
      <div class="kpi"><p class="l">Pessoas para contratar</p><p class="v" id="k-contr"></p><p class="s" id="k-contr-s"></p></div>
      <div class="kpi"><p class="l">Cada hora fica mais cara</p><p class="v" id="k-hora"></p><p class="s" id="k-hora-s"></p></div>
    </div>

    <div class="charts">
      <div class="card"><h4>De onde vem o aumento</h4><p class="sub">Custo extra por mês, por cargo.</p><div class="chart-box"><canvas id="g-cargos" aria-label="Gráfico do aumento por cargo"></canvas></div></div>
      <div class="card"><h4>Mês a mês</h4><p class="sub">Quanto a folha vai custar nos próximos 18 meses.</p><div class="chart-box"><canvas id="g-tempo" aria-label="Gráfico da folha nos próximos 18 meses"></canvas></div></div>
    </div>

    <div class="card">
      <h4>O que fazer em cada cargo</h4>
      <p class="sub">Com menos horas por pessoa, sobram horas descobertas. Elas podem virar hora extra ou uma nova contratação. Em verde, a opção mais barata.</p>
      <table class="table"><thead><tr><th>Cargo</th><th>Horas descobertas</th><th>Se contratar</th><th>Se pagar hora extra</th><th>Sugestão</th></tr></thead><tbody id="t-cargos"></tbody></table>
    </div>

    <div class="card">
      <h4>Sua nova escala</h4>
      <p class="sub" id="e-sub"></p>
      <div class="no-print" style="max-width:320px;margin-bottom:16px"><label class="lbl small" for="e-cargo" style="color:var(--muted)">Ver a escala de</label><select id="e-cargo" style="width:100%"></select></div>
      <div class="scroll"><table class="roster" id="e-grade"></table></div>
      <div class="legend" id="e-legenda"></div>
      <div id="e-nota"></div>
    </div>

    <details class="card how">
      <summary>Como chegamos nesse número</summary>
      <ol id="how"></ol>
    </details>

    <div class="actions no-print">
      <button class="btn btn-primary" type="button" id="imprimir">Salvar em PDF ou imprimir</button>
      <a class="btn btn-outline" href="#simulador">Ajustar os dados</a>
      <button class="btn btn-danger" type="button" id="limpar2">Começar de novo</button>
    </div>
  </div>`;

$('#vazio-ex').onclick = () => $('#exemplo').click();
$('#imprimir').onclick = () => print();
$('#limpar2').onclick = recomecar;
document.querySelectorAll('.seg button').forEach((t) => (t.onclick = () => { state.fase = t.dataset.f; atualizar(); }));
$('#e-cargo').onchange = (e) => { state.escala = Number(e.target.value); atualizar(); };

/* ---------- Animação ---------- */
const calmo = matchMedia('(prefers-reduced-motion: reduce)').matches;
let heroVisto = false;
function contar(el, alvo, fmt) {
  const de = heroVisto ? Number(el.dataset.v || 0) : alvo;
  el.dataset.v = alvo;
  cancelAnimationFrame(el._raf);
  if (calmo || de === alvo) { el.textContent = fmt(alvo); return; }
  const t0 = performance.now(), dur = 900;
  const passo = (t) => {
    const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
    el.textContent = fmt(Math.round(de + (alvo - de) * e));
    if (p < 1) el._raf = requestAnimationFrame(passo);
  };
  el._raf = requestAnimationFrame(passo);
}
new IntersectionObserver((es, obs) => {
  if (!es[0].isIntersecting) return;
  obs.disconnect();
  heroVisto = true;
  $('#hero-res').classList.add('in');
  document.querySelectorAll('#hero-res [data-v]').forEach((el) => {
    const alvo = Number(el.dataset.v); el.dataset.v = 0;
    contar(el, alvo, el.id === 'h-v' ? (v) => (alvo ? '+' + brl(v) : 'R$ 0') : brl);
  });
}, { threshold: 0.35 }).observe($('#hero-res'));

/* ---------- Gráficos ---------- */
const temGrafico = typeof Chart !== 'undefined';
let gCargos, gTempo;
if (temGrafico) {
Chart.defaults.animation.duration = 900;
Chart.defaults.animation.easing = 'easeOutQuart';
Chart.defaults.font.family = "-apple-system, BlinkMacSystemFont, 'Inter', system-ui, sans-serif";
Chart.defaults.font.size = 12;
Chart.defaults.color = '#6e6e73';
const tooltip = { backgroundColor: '#1d1d1f', padding: 10, cornerRadius: 10, displayColors: false, titleFont: { weight: '600' } };
const reais = (v) => (v >= 1000 ? 'R$ ' + (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil' : 'R$ ' + v);
const CORES = CORES_CARGO;

gCargos = new Chart($('#g-cargos'), {
  type: 'bar',
  data: { labels: [], datasets: [{ data: [], backgroundColor: CORES, borderRadius: 8, borderSkipped: false, barThickness: 22 }] },
  options: {
    indexAxis: 'y', maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { ...tooltip, callbacks: { label: (c) => ' ' + brl(c.parsed.x) + ' por mês' } } },
    scales: { x: { ticks: { callback: reais }, grid: { color: '#f0f0f3' }, border: { display: false } }, y: { grid: { display: false }, border: { display: false }, ticks: { color: '#1d1d1f', font: { weight: '600' } } } },
  },
});
const meses = Array.from({ length: 18 }, (_, m) => { const d = new Date(2026, 9 + m, 1); return d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') + '/' + String(d.getFullYear()).slice(2); });
gTempo = new Chart($('#g-tempo'), {
  type: 'line',
  data: { labels: meses, datasets: [{ data: [], stepped: true, borderColor: '#0071e3', borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: '#0071e3', fill: true,
    backgroundColor: (ctx) => { const { chart } = ctx; if (!chart.chartArea) return 'rgba(0,113,227,.08)'; const g = chart.ctx.createLinearGradient(0, chart.chartArea.top, 0, chart.chartArea.bottom); g.addColorStop(0, 'rgba(0,113,227,.18)'); g.addColorStop(1, 'rgba(0,113,227,0)'); return g; } }] },
  options: {
    maintainAspectRatio: false, interaction: { intersect: false, mode: 'index' },
    plugins: { legend: { display: false }, tooltip: { ...tooltip, callbacks: { label: (c) => ' Folha: ' + brl(c.parsed.y) } } },
    scales: { y: { ticks: { callback: reais }, grid: { color: '#f0f0f3' }, border: { display: false } }, x: { grid: { display: false }, border: { display: false }, ticks: { maxRotation: 0, autoSkipPadding: 14 } } },
  },
});

}

/* ---------- Atualização ---------- */
let ultimo = null;
function atualizar() {
  salvar();
  const cargos = validos();
  const enc = encargos();

  const totalPessoas = cargos.reduce((t, c) => t + Number(c.pessoas), 0);
  const folhaHoje = simular(cargos, 44, enc).folha;
  $('#teamsum').innerHTML = cargos.length
    ? `<span><b>${plural(totalPessoas, 'funcionário', 'funcionários')}</b> em ${plural(cargos.length, 'cargo', 'cargos')}</span><span>Folha hoje: <b>${brl(folhaHoje)}</b> por mês, com encargos</span>`
    : '';

  $('#vazio').hidden = !!cargos.length; $('#cheio').hidden = !cargos.length;
  ultimo = null;
  if (!cargos.length) return atualizarDock();

  const fase = FASES.find((f) => f.id === state.fase) || FASES[2];
  const r = simular(cargos, fase.limite, enc);
  ultimo = r;
  const porFase = FASES.map((f) => simular(cargos, f.limite, enc).novaFolha);
  document.querySelectorAll('.seg button').forEach((t) => t.setAttribute('aria-selected', t.dataset.f === fase.id));

  // Destaque principal
  const sem = r.extra === 0;
  const afetados = r.linhas.filter((l) => l.horasFaltando > 0);
  const contratar = afetados.filter((l) => l.estrategia === 'contratar');
  const extra = afetados.filter((l) => l.estrategia === 'horaExtra');
  const nomes = (ls) => ls.map((l) => esc(l.cargo || 'sem nome')).join(', ');
  $('#hero-res').classList.toggle('ok', sem);
  $('#h-chip').textContent = `${fase.nome} · ${fase.limite}h por semana · ${QUANDO[fase.id]}`;
  $('#h-l').textContent = sem ? 'Nada muda na sua folha' : 'Sua folha vai subir';
  contar($('#h-v'), sem ? 0 : r.extra, (v) => (sem ? 'R$ 0' : '+' + brl(v)));
  $('#h-pills').hidden = sem;
  $('#h-pct').textContent = `+${pct(r.percentual)} na folha`;
  $('#h-ano').textContent = `${brl(r.extra * 13)} por ano`;
  $('#h-say').innerHTML = sem
    ? 'Sua equipe já trabalha dentro do novo limite de horas. Não há custo extra nesta fase.'
    : `A folha passa de ${brl(r.folha)} para <b>${brl(r.novaFolha)}</b> por mês. ` +
      [contratar.length && `Para ${nomes(contratar)}, o mais barato é <b>contratar</b>.`, extra.length && `Para ${nomes(extra)}, sai mais em conta pagar <b>hora extra</b>.`].filter(Boolean).join(' ');
  const max = Math.max(...porFase);
  document.querySelectorAll('#h-bars .st').forEach((el, i) => {
    el.classList.toggle('cur', el.dataset.f === fase.id || (i === 0 && sem && fase.id === 'hoje'));
    el.style.setProperty('--w', ((porFase[i] / max) * 100).toFixed(1) + '%');
    contar(el.querySelector('b'), porFase[i], brl);
    el.querySelector('small').textContent = i && porFase[i] > porFase[0] ? '+' + brl(porFase[i] - porFase[0]) : '';
  });
  $('#h-foot').textContent = sem ? '' : `Da jornada de hoje até as 40h, a diferença é de ${brl(porFase[2] - porFase[0])} por mês.`;

  $('#k-ano').textContent = brl(r.extra * 13);
  $('#k-contr').textContent = r.contratar;
  $('#k-contr-s').textContent = r.contratar ? `Se seguir as sugestões abaixo. Cada pessoa nova trabalha ${fase.limite}h.` : 'Nas sugestões abaixo, hora extra sai mais barato que contratar.';
  const maior = Math.max(0, ...r.linhas.map((l) => l.aumentoHora));
  $('#k-hora').textContent = maior ? '+' + pct(maior) : '0%';
  $('#k-hora-s').textContent = `O salário fica igual e as horas diminuem. ${afetados.length ? `Afeta ${plural(r.afetados, 'funcionário', 'funcionários')} de ${totalPessoas}.` : ''}`;

  if (temGrafico) {
  gCargos.data.labels = r.linhas.map((l) => l.cargo || 'Sem nome');
  gCargos.data.datasets[0].data = r.linhas.map((l) => Math.round(l.custoExtra));
  gCargos.update();
  gTempo.data.datasets[0].data = linhaDoTempo(cargos, enc).map(Math.round);
  gTempo.update();
  }

  $('#t-cargos').innerHTML = r.linhas.map((l) => {
    const sug = l.estrategia === 'contratar' ? `<span class="tag c">Contratar ${l.contratar}</span>`
      : l.estrategia === 'horaExtra' ? '<span class="tag h">Hora extra</span>' : '<span class="tag n">Nada muda</span>';
    const tem = l.horasFaltando > 0;
    return `<tr><td class="who"><b>${esc(l.cargo || 'Sem nome')}</b><small>${plural(l.pessoas, 'pessoa', 'pessoas')} · ${l.horas}h por semana</small></td>
      <td class="num" data-l="Horas descobertas">${tem ? nf(l.horasFaltando) + 'h por semana' : '—'}</td>
      <td class="num${l.estrategia === 'contratar' ? ' best' : ''}" data-l="Se contratar">${tem ? brl(l.custoContratar) + '/mês' : '—'}</td>
      <td class="num${l.estrategia === 'horaExtra' ? ' best' : ''}" data-l="Se pagar hora extra">${tem ? brl(l.custoHE) + '/mês' : '—'}</td>
      <td data-l="Sugestão">${sug}</td></tr>`;
  }).join('');

  renderEscala(cargos, r, fase);
  renderComo(r, fase, enc);
  atualizarDock();
}

function renderEscala(cargos, r, fase) {
  if (state.escala >= cargos.length) state.escala = -1;
  const todos = state.escala < 0;
  $('#e-cargo').innerHTML = `<option value="-1" ${todos ? 'selected' : ''}>Todos os cargos</option>` +
    cargos.map((c, i) => `<option value="${i}" ${i === state.escala ? 'selected' : ''}>${esc(c.cargo || 'Cargo ' + (i + 1))}</option>`).join('');

  // Monta a escala de cada cargo, com o rodízio deslocado para espalhar as folgas.
  let offset = 0;
  const grupos = r.linhas.map((l, i) => {
    const novos = l.estrategia === 'contratar' ? l.contratar : 0;
    const total = l.pessoas + novos;
    const e = gerarEscala(total, state.dias, Math.min(l.horas, fase.limite), offset);
    offset += total;
    return { i, l, novos, total, e, nome: l.cargo || 'Cargo ' + (i + 1), cor: corCargo(i) };
  }).filter((g) => todos || g.i === state.escala);

  const e0 = grupos[0].e;
  const pessoas = grupos.reduce((t, g) => t + g.total, 0);
  const limite = todos ? 40 : 15;
  if (!e0.diasTrabalho) {
    $('#e-sub').textContent = 'Marque pelo menos um dia de funcionamento no passo 2 para ver a escala.';
    $('#e-grade').innerHTML = ''; $('#e-legenda').innerHTML = ''; $('#e-nota').innerHTML = '';
    return;
  }
  const novosTot = grupos.reduce((t, g) => t + g.novos, 0);
  $('#e-sub').textContent = (todos
    ? `A equipe inteira: ${plural(pessoas, 'pessoa', 'pessoas')}. Cada cor é um cargo. `
    : '') + `Cada pessoa trabalha ${e0.diasTrabalho} dias e folga ${7 - e0.diasTrabalho}, e as folgas giram para nunca faltar gente.` +
    (novosTot ? ` Inclui ${plural(novosTot, 'pessoa nova', 'pessoas novas')}.` : '');

  let linhas = 0;
  const corpo = grupos.map((g) => g.e.grade.map((linha, p) => {
    if (linhas++ >= limite) return '';
    const nova = p >= g.l.pessoas;
    const h = nf(g.e.horasDia) + 'h';
    const nome = (todos ? esc(g.nome) + ' ' : 'Pessoa ') + (nova ? `nova ${p - g.l.pessoas + 1}` : p + 1);
    const cel = linha.map((t, d) => !state.dias[d] ? '<td class="x">—</td>'
      : t ? `<td class="t${nova ? ' nova' : ''}" style="--c:${g.cor}">${h}</td>` : '<td class="f">Folga</td>').join('');
    return `<tr${p === 0 && todos ? ' class="grp"' : ''}><td class="name"><i style="background:${g.cor}"></i>${nome}</td>${cel}</tr>`;
  }).join('')).join('');
  const cobertura = DIAS.map((_, d) => grupos.reduce((t, g) => t + g.e.cobertura[d], 0));
  $('#e-grade').innerHTML = `<tr><th></th>${DIAS.map((d) => `<th>${d}</th>`).join('')}</tr>` + corpo +
    `<tr class="cov"><td class="name">${todos ? 'Total trabalhando' : 'Trabalhando'}</td>${cobertura.map((n, d) => `<td>${state.dias[d] ? n : ''}</td>`).join('')}</tr>`;

  $('#e-legenda').innerHTML = grupos.map((g) => `<span><i style="background:${g.cor}"></i>${esc(g.nome)}</span>`).join('') +
    (novosTot ? '<span><i class="lg-nova"></i>Nova contratação</span>' : '') +
    '<span><i style="background:var(--amber-soft)"></i>Folga</span><span><i style="background:var(--surface-2)"></i>Fechado</span>';

  const NOMES = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'];
  const buracos = grupos.flatMap((g) => DIAS.map((_, d) => d).filter((d) => state.dias[d] && g.e.cobertura[d] === 0)
    .map((d) => `${esc(g.nome)} na ${NOMES[d]}`));
  $('#e-nota').innerHTML = [
    pessoas > limite && `<div class="note">Mostrando ${limite} de ${pessoas} pessoas. O rodízio segue igual para as demais.</div>`,
    buracos.length && `<div class="note">Fica sem ninguém do cargo: ${buracos.join(', ')}. Com poucas pessoas num cargo, alguém de outro cargo precisa cobrir esse dia, ou vale contratar.</div>`,
    grupos.some((g) => g.e.acimaDe8) && '<div class="note">Com poucos dias abertos, cada dia passaria de 8 horas, o máximo da nova regra. Abra mais dias ou reduza as horas.</div>',
  ].filter(Boolean).join('');
}

function renderComo(r, fase, enc) {
  const l = r.linhas.find((x) => x.horasFaltando > 0);
  if (!l) { $('#how').innerHTML = `<li>Ninguém na sua equipe passa de ${fase.limite}h por semana, então não há horas descobertas nem custo extra.</li>`; return; }
  const valorHora = l.salario / (fase.limite * 5);
  $('#how').innerHTML = `
    <li>Pegamos um cargo como exemplo: <b>${esc(l.cargo || 'sem nome')}</b>, ${plural(l.pessoas, 'pessoa', 'pessoas')} com ${l.horas}h por semana.</li>
    <li>Com o novo limite de ${fase.limite}h, cada pessoa deixa de trabalhar ${nf(l.horas - fase.limite)}h. No total, ficam <b>${nf(l.horasFaltando)}h por semana descobertas</b>.</li>
    <li>O salário não muda, então a hora passa a valer ${brl(l.salario)} ÷ ${fase.limite * 5}h = <b>${valorHora.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</b> (era ${(l.salario / (l.horas * 5)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}).</li>
    <li><b>Hora extra:</b> ${nf(l.horasFaltando)}h × 4,33 semanas × a hora com 50% a mais, mais ${pct(enc)} de encargos = <b>${brl(l.custoHE)} por mês</b>.</li>
    <li><b>Contratar:</b> ${plural(l.contratar, 'pessoa nova', 'pessoas novas')} com o mesmo salário, mais encargos = <b>${brl(l.custoContratar)} por mês</b>.</li>
    <li>Escolhemos a opção mais barata e repetimos a conta para cada cargo. A soma dá o aumento da folha.</li>`;
}

/* ---------- Barra de resumo ---------- */
addEventListener('scroll', () => atualizarDock(), { passive: true });
function atualizarDock() {
  // Aparece enquanto a pessoa preenche (simulador na tela) e o resultado ainda está abaixo.
  const sim = $('#simulador').getBoundingClientRect(), res = $('#resultado').getBoundingClientRect();
  const on = !!ultimo && sim.top < innerHeight * 0.5 && res.top > innerHeight * 0.75;
  $('#dock').classList.toggle('on', on);
  $('#dock').setAttribute('aria-hidden', !on);
  if (ultimo) $('#dock-v').textContent = ultimo.extra ? `+${brl(ultimo.extra)}/mês` : 'nenhum';
}

/* ---------- Entrada suave ao rolar ---------- */
if (!calmo && 'IntersectionObserver' in window) {
  const revelar = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('vis'); revelar.unobserve(e.target); }
  }), { threshold: 0.12 });
  document.querySelectorAll('.weeks, .stage, .stat, .sheet, .kpi, .card, .faq details').forEach((el, i) => {
    el.classList.add('reveal'); el.style.setProperty('--d', (i % 4) * 70 + 'ms'); revelar.observe(el);
  });
}

function renderTudo() { renderCargos(); renderPasso2(); atualizar(); }
renderTudo();
