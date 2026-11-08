// js/app.js
import { calcularBrutoCLT } from './engine-clt.js';
import { calcularBrutoPublico } from './engine-pss.js';
import { calcularINSS, calcularRPPS, calcularIRPF, TABELAS } from './irpf-marginal.js';
import { SEMANAS_TRABALHADAS } from './constantes.js';

/* ============================================================
   Configuração
   ============================================================ */
const CHAVE_STORAGE = 'calculadora-professor:v1';

// Uma escola é marcada como "menos compensa" quando o retorno real por hora
// fica abaixo desta fração do valor da hora-aula dela.
const FATOR_ALERTA = 0.6;

const LIMITES = { aulas: 60, diasSemana: 7, kmIdaVolta: 500, minutosDia: 300 };

const REGIMES = {
  pss: 'PSS / Temporário',
  qpm: 'Efetivo / QPM',
  clt: 'Particular (CLT)'
};

// Campos globais do formulário (id -> valor padrão, para restaurar do localStorage)
const CAMPOS_GLOBAIS = [
  'input-pct-ha', 'input-valor-hora', 'input-gratificacoes',
  'input-consumo', 'input-gasolina', 'input-rpps-aliq', 'input-rpps-adic'
];

/* ============================================================
   Utilitários
   ============================================================ */
const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtMoeda = (v) => formatadorMoeda.format(Number.isFinite(v) ? v : 0);
const fmtCampo = (n) => String(Math.round(Number(n) * 100) / 100).replace('.', ',');
const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

export function escaparHTML(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Converte texto digitado no padrão brasileiro em número.
 * "25,5" -> 25.5 | "1.234,56" -> 1234.56 | "1.500" -> 1500 | "" -> NaN
 */
export function parseNumeroBR(valor) {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : NaN;
  let s = String(valor ?? '').trim().replace(/[^\d.,]/g, '');
  if (!s) return NaN;
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if ((s.match(/\./g) || []).length > 1 || /^\d{1,3}\.\d{3}$/.test(s)) {
    s = s.replace(/\./g, ''); // ponto usado como separador de milhar
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/* ============================================================
   Estado
   ============================================================ */
const ESCOLAS_PADRAO = () => ([
  { id: 1, nome: 'Escola Principal (Sede)', aulas: 20, diasSemana: 5, kmIdaVolta: 10, minutosDia: 20, regime: null, valorHora: null, aberta: false },
  { id: 2, nome: 'Escola B', aulas: 6, diasSemana: 2, kmIdaVolta: 25, minutosDia: 45, regime: null, valorHora: null, aberta: false }
]);

let escolas = ESCOLAS_PADRAO();
let nextId = 3;
let contadorNomes = 2; // próxima letra: C
let ultimaRemovida = null;

function sanitizarEscola(o, idFallback) {
  const num = (v, max, pad = 0) => {
    const n = parseNumeroBR(v);
    return Number.isNaN(n) ? pad : clamp(n, 0, max);
  };
  const vh = parseNumeroBR(o?.valorHora);
  return {
    id: Number.isInteger(o?.id) ? o.id : idFallback,
    nome: String(o?.nome || `Escola ${idFallback}`).slice(0, 60),
    aulas: num(o?.aulas, LIMITES.aulas),
    diasSemana: num(o?.diasSemana, LIMITES.diasSemana),
    kmIdaVolta: num(o?.kmIdaVolta, LIMITES.kmIdaVolta),
    minutosDia: num(o?.minutosDia, LIMITES.minutosDia),
    regime: REGIMES[o?.regime] ? o.regime : null,
    valorHora: Number.isNaN(vh) ? null : clamp(vh, 0, 1000),
    aberta: false
  };
}

function salvarEstado() {
  try {
    const globais = {};
    CAMPOS_GLOBAIS.forEach((id) => { globais[id] = document.getElementById(id)?.value ?? ''; });
    globais.regime = document.querySelector('input[name="regime"]:checked')?.value || 'pss';
    globais.preset = document.querySelector('input[name="preset-ha"]:checked')?.value || '0.3333';
    localStorage.setItem(CHAVE_STORAGE, JSON.stringify({ escolas, nextId, contadorNomes, globais }));
  } catch (_) { /* armazenamento indisponível: segue sem persistir */ }
}

function restaurarEstado() {
  try {
    const bruto = localStorage.getItem(CHAVE_STORAGE);
    if (!bruto) return;
    const dados = JSON.parse(bruto);
    if (Array.isArray(dados.escolas) && dados.escolas.length) {
      escolas = dados.escolas.slice(0, 12).map((e, i) => sanitizarEscola(e, i + 1));
      nextId = Math.max(Number(dados.nextId) || 0, ...escolas.map((e) => e.id)) + 1;
      contadorNomes = Number(dados.contadorNomes) || escolas.length;
    }
    const g = dados.globais || {};
    CAMPOS_GLOBAIS.forEach((id) => {
      const el = document.getElementById(id);
      if (el && typeof g[id] === 'string' && g[id] !== '') el.value = g[id];
    });
    const rr = document.querySelector(`input[name="regime"][value="${g.regime}"]`);
    if (rr) rr.checked = true;
    const rp = document.querySelector(`input[name="preset-ha"][value="${g.preset}"]`);
    if (rp) rp.checked = true;
  } catch (_) { /* dados corrompidos: ignora e usa o padrão */ }
}

/* ============================================================
   Parâmetros globais
   ============================================================ */
function lerNumero(id, padrao, min = 0, max = Infinity) {
  const el = document.getElementById(id);
  if (!el) return padrao;
  const n = parseNumeroBR(el.value);
  return Number.isNaN(n) ? padrao : clamp(n, min, max);
}

function getParametrosGlobais() {
  return {
    regime: document.querySelector('input[name="regime"]:checked')?.value || 'pss',
    pctHoraAtividade: lerNumero('input-pct-ha', 33.33, 0, 100) / 100,
    valorHora: lerNumero('input-valor-hora', 25, 0, 1000),
    gratificacoes: lerNumero('input-gratificacoes', 0, 0, 1e6),
    consumoKm: lerNumero('input-consumo', 10, 1, 100),
    precoGasolina: lerNumero('input-gasolina', 5.9, 0, 50),
    rppsAliq: lerNumero('input-rpps-aliq', 14, 0, 40) / 100,
    rppsAdic: lerNumero('input-rpps-adic', 3.9, 0, 40) / 100
  };
}

/* ============================================================
   Cálculo (funções puras)
   ============================================================ */
function custoCombustivelEscola(esc, params) {
  const kmMes = esc.diasSemana * SEMANAS_TRABALHADAS * esc.kmIdaVolta;
  const litros = params.consumoKm > 0 ? kmMes / params.consumoKm : 0;
  return litros * params.precoGasolina;
}

/**
 * Cada escola é um vínculo, com regime e valor de hora próprios.
 * - INSS: calculado sobre a SOMA dos vínculos do regime geral (PSS/CLT), com teto único.
 * - RPPS: calculado por vínculo (QPM), sobre o bruto daquele vínculo.
 * - IRPF: calculado sobre a soma de tudo (é o valor devido no acerto anual;
 *   mensalmente cada fonte pagadora retém separadamente, com valor menor).
 * - Gratificações fixas são atribuídas à primeira escola da lista.
 */
export function calcularCenario(lista, params) {
  const pct = params.pctHoraAtividade;
  const totalAulasSala = lista.reduce((acc, e) => acc + e.aulas, 0);
  const horasAtividade = Number((totalAulasSala * pct).toFixed(1));
  const jornadaTotalSemanal = totalAulasSala + horasAtividade;

  const vinculos = lista.map((esc, i) => {
    const regime = esc.regime || params.regime;
    const valorHora = esc.valorHora ?? params.valorHora;
    const grat = i === 0 ? params.gratificacoes : 0;
    let bruto;
    if (regime === 'clt') {
      bruto = calcularBrutoCLT({
        aulasSemanais: esc.aulas, valorHoraAula: valorHora, pctHoraAtividade: pct
      }).brutoTotal + grat;
    } else {
      bruto = calcularBrutoPublico({
        aulasSemanais: esc.aulas, valorHoraAula: valorHora,
        proporcaoPlanejamento: pct, gratificacoesFixas: grat
      }).brutoTotal;
    }
    return { id: esc.id, regime, bruto };
  });

  let bruto = 0;
  let brutoRegimeGeral = 0;
  let descontoRPPS = 0;
  vinculos.forEach((v) => {
    bruto += v.bruto;
    if (v.regime === 'qpm') {
      descontoRPPS += calcularRPPS(v.bruto, params.rppsAliq, params.rppsAdic).totalDeducoes;
    } else {
      brutoRegimeGeral += v.bruto;
    }
  });

  const inss = calcularINSS(brutoRegimeGeral);
  const descontoPrev = inss + descontoRPPS;
  const irpf = calcularIRPF(bruto, descontoPrev);
  const liquidoContracheque = bruto - descontoPrev - irpf.irpf;

  const gastoCombustivelTotal = lista.reduce((acc, e) => acc + custoCombustivelEscola(e, params), 0);

  return {
    totalAulasSala, horasAtividade, jornadaTotalSemanal,
    bruto, descontoPrev, irpf: irpf.irpf, irpfDetalhe: irpf,
    gastoCombustivelTotal, liquidoContracheque,
    saldoLiquidoReal: liquidoContracheque - gastoCombustivelTotal,
    vinculos
  };
}

/**
 * Para cada escola: quanto ela acrescenta ao seu bolso (contracheque - gasolina)
 * dividido pelas horas mensais que ela consome (aulas + atividade + deslocamento).
 * Ordenado do menor para o maior retorno por hora.
 */
export function analisarRanking(lista, params, atual) {
  // Só entram no ranking escolas com aulas preenchidas (escola vazia não é comparável).
  const ativas = lista.filter((e) => e.aulas > 0);
  if (ativas.length <= 1) return [];

  return ativas.map((esc) => {
    const restante = lista.filter((e) => e.id !== esc.id);
    const sem = calcularCenario(restante, params);

    const ganhoContracheque = atual.liquidoContracheque - sem.liquidoContracheque;
    const economiaGasolina = custoCombustivelEscola(esc, params);
    const ganhoReal = ganhoContracheque - economiaGasolina;

    const horasSala = esc.aulas * (1 + params.pctHoraAtividade) * SEMANAS_TRABALHADAS;
    const horasDeslocamento = esc.diasSemana * SEMANAS_TRABALHADAS * (esc.minutosDia / 60);
    const horasMes = horasSala + horasDeslocamento;

    const valorRef = esc.valorHora ?? params.valorHora;
    const retorno = horasMes > 0 ? ganhoReal / horasMes : 0;

    return {
      id: esc.id, nome: esc.nome, horasMes,
      ganhoContracheque, economiaGasolina, ganhoReal, retorno,
      alerta: retorno < valorRef * FATOR_ALERTA
    };
  }).sort((a, b) => a.retorno - b.retorno);
}

/* ============================================================
   Interface: cards de escola
   ============================================================ */
const CLASSE_INPUT = 'w-full h-11 rounded-lg border border-slate-300 bg-white px-3 text-base font-semibold focus:ring-2 focus:ring-indigo-500';

function htmlCampo(esc, chave, rotulo, valor, placeholder = '0') {
  const id = `esc-${esc.id}-${chave}`;
  return `
    <div>
      <label for="${id}" class="block text-sm font-semibold text-slate-700 mb-1">${rotulo}</label>
      <input type="text" inputmode="decimal" id="${id}" data-id="${esc.id}" data-campo="${chave}"
             value="${escaparHTML(valor)}" placeholder="${escaparHTML(placeholder)}" class="${CLASSE_INPUT}">
    </div>`;
}

// Mostra vazio quando o valor é 0, para o campo não parecer "preenchido".
const valorOuVazio = (n) => (n ? fmtCampo(n) : '');

export function textoResumoEscola(esc) {
  if (!esc.aulas) return 'Preencha os dados desta escola';
  const partes = [`${fmtCampo(esc.aulas)} aulas/sem`, `${fmtCampo(esc.diasSemana)} dias/sem`];
  if (esc.kmIdaVolta) partes.push(`${fmtCampo(esc.kmIdaVolta)} km/dia`);
  return partes.join(' · ');
}

export function htmlCardEscola(esc, index) {
  const id = esc.id;
  const opcoes = [['', 'Igual ao geral'], ...Object.entries(REGIMES)]
    .map(([v, t]) => `<option value="${v}" ${(esc.regime || '') === v ? 'selected' : ''}>${t}</option>`)
    .join('');

  return `
    <summary class="flex items-center gap-3 p-4 rounded-xl hover:bg-slate-50">
      <span class="w-7 h-7 shrink-0 rounded-full bg-slate-100 text-slate-700 text-xs font-black flex items-center justify-center">${index + 1}</span>
      <span class="flex-1 min-w-0">
        <span class="block font-bold text-slate-900 truncate" data-nome-resumo="${id}">${escaparHTML(esc.nome)}</span>
        <span class="block text-sm text-slate-600" data-resumo="${id}">${escaparHTML(textoResumoEscola(esc))}</span>
      </span>
      <span class="text-right shrink-0">
        <span class="block text-xs text-slate-600">Bruto/mês</span>
        <strong class="text-sm text-slate-900" data-bruto="${id}">R$ 0,00</strong>
      </span>
      <svg class="seta w-5 h-5 shrink-0 text-slate-500 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
    </summary>

    <div class="px-4 pb-4 pt-4 space-y-5 border-t border-slate-100">
      <div>
        <label for="esc-${id}-nome" class="block text-sm font-semibold text-slate-700 mb-1">Nome da escola</label>
        <input type="text" id="esc-${id}-nome" data-id="${id}" data-campo="nome" maxlength="60"
               value="${escaparHTML(esc.nome)}" class="${CLASSE_INPUT}">
      </div>

      <fieldset>
        <legend class="text-sm font-bold text-slate-900 mb-2">Aulas</legend>
        <div class="grid grid-cols-2 gap-3">
          ${htmlCampo(esc, 'aulas', 'Aulas por semana', valorOuVazio(esc.aulas))}
          ${htmlCampo(esc, 'diasSemana', 'Dias por semana na escola', valorOuVazio(esc.diasSemana))}
        </div>
      </fieldset>

      <fieldset>
        <legend class="text-sm font-bold text-slate-900 mb-2">Deslocamento até esta escola</legend>
        <div class="grid grid-cols-2 gap-3">
          ${htmlCampo(esc, 'kmIdaVolta', 'Km por dia (ida e volta)', valorOuVazio(esc.kmIdaVolta))}
          ${htmlCampo(esc, 'minutosDia', 'Tempo por dia (min, ida e volta)', valorOuVazio(esc.minutosDia))}
        </div>
      </fieldset>

      <fieldset>
        <legend class="text-sm font-bold text-slate-900">Só desta escola (opcional)</legend>
        <p class="text-sm text-slate-600 mb-2">Deixe como está para usar as informações gerais.</p>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="esc-${id}-regime" class="block text-sm font-semibold text-slate-700 mb-1">Regime</label>
            <select id="esc-${id}-regime" data-id="${id}" data-campo="regime" class="${CLASSE_INPUT}">${opcoes}</select>
          </div>
          ${htmlCampo(esc, 'valorHora', 'Valor da hora-aula (R$)', esc.valorHora == null ? '' : fmtCampo(esc.valorHora), 'igual ao geral')}
        </div>
      </fieldset>

      <div class="flex justify-end">
        <button type="button" data-id="${id}" class="btn-remover-escola text-sm font-semibold text-rose-700 hover:text-rose-900 px-3 py-2 rounded-lg hover:bg-rose-50 transition">
          Excluir esta escola
        </button>
      </div>
    </div>
  `;
}

function atualizarContadorEscolas() {
  const el = document.getElementById('contador-escolas');
  if (el) el.textContent = escolas.length === 1 ? '1 escola' : `${escolas.length} escolas`;
}

function renderizarFormularioEscolas() {
  const container = document.getElementById('container-escolas');
  if (!container) return;
  container.innerHTML = '';

  escolas.forEach((esc, index) => {
    const card = document.createElement('details');
    card.className = 'border border-slate-200 rounded-xl bg-white';
    card.dataset.cardId = esc.id;
    if (esc.aberta) card.open = true;
    card.innerHTML = htmlCardEscola(esc, index);
    container.appendChild(card);
  });

  if (!escolas.length) {
    container.innerHTML = `
      <div class="p-6 text-center border-2 border-dashed border-slate-300 rounded-xl bg-slate-50">
        <p class="text-sm text-slate-700">Nenhuma escola cadastrada. Adicione a primeira escola onde você dá aula.</p>
      </div>`;
  }
  atualizarContadorEscolas();
}

function aoEditarEscola(e) {
  const el = e.target;
  const campo = el?.dataset?.campo;
  if (!campo) return;
  const esc = escolas.find((x) => x.id === Number(el.dataset.id));
  if (!esc) return;

  if (campo === 'nome') {
    esc.nome = el.value.trim().slice(0, 60) || `Escola ${esc.id}`;
  } else if (campo === 'regime') {
    esc.regime = REGIMES[el.value] ? el.value : null;
  } else if (campo === 'valorHora') {
    const n = parseNumeroBR(el.value);
    esc.valorHora = Number.isNaN(n) ? null : clamp(n, 0, 1000);
  } else {
    const n = parseNumeroBR(el.value);
    esc[campo] = clamp(Number.isNaN(n) ? 0 : n, 0, LIMITES[campo] ?? 1e6);
  }
  processarSimulacao();
}

function adicionarEscola() {
  const id = nextId++;
  const letra = String.fromCharCode(65 + (contadorNomes++ % 26));
  const nome = `Escola ${letra}`;

  // Recolhe as outras para o foco ficar na escola nova; ela começa vazia (sem números inventados).
  escolas.forEach((e) => { e.aberta = false; });
  escolas.push({
    id, nome, aulas: 0, diasSemana: 0, kmIdaVolta: 0, minutosDia: 0,
    regime: null, valorHora: null, aberta: true
  });
  renderizarFormularioEscolas();
  processarSimulacao();

  const campoNome = document.getElementById(`esc-${id}-nome`);
  if (campoNome) {
    campoNome.scrollIntoView({ behavior: 'smooth', block: 'center' });
    campoNome.focus();
    campoNome.select();
  }
  mostrarToast(`${nome} adicionada. Preencha os dados dela.`);
}

function removerEscola(id) {
  const index = escolas.findIndex((e) => e.id === id);
  if (index < 0) return;
  ultimaRemovida = { escola: escolas[index], index };
  const nome = escolas[index].nome;
  escolas.splice(index, 1);
  renderizarFormularioEscolas();
  processarSimulacao();

  mostrarToast(`"${nome}" removida.`, 'Desfazer', () => {
    if (!ultimaRemovida) return;
    escolas.splice(ultimaRemovida.index, 0, ultimaRemovida.escola);
    ultimaRemovida = null;
    renderizarFormularioEscolas();
    processarSimulacao();
  });
}

let timerToast;
function mostrarToast(texto, rotuloAcao, aoClicar) {
  let t = document.getElementById('toast-app');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast-app';
    t.setAttribute('role', 'status');
    t.className = 'fixed bottom-4 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-sm rounded-xl px-4 py-3 shadow-lg items-center gap-3 z-50';
    document.body.appendChild(t);
  }
  t.innerHTML = '';
  const span = document.createElement('span');
  span.textContent = texto;
  t.appendChild(span);
  if (rotuloAcao) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'font-bold text-indigo-300 hover:text-indigo-200 underline';
    b.textContent = rotuloAcao;
    b.addEventListener('click', () => { aoClicar(); t.style.display = 'none'; });
    t.appendChild(b);
  }
  t.style.display = 'flex';
  clearTimeout(timerToast);
  timerToast = setTimeout(() => { t.style.display = 'none'; }, 6000);
}

/* ============================================================
   Interface: elementos criados dinamicamente
   ============================================================ */
function prepararCamposGlobais() {
  // Troca type=number por texto decimal: aceita vírgula e não muda valor com o scroll.
  ['input-pct-ha', 'input-valor-hora', 'input-gratificacoes', 'input-consumo', 'input-gasolina'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const n = parseNumeroBR(el.value);
    el.setAttribute('type', 'text');
    el.setAttribute('inputmode', 'decimal');
    el.removeAttribute('step'); el.removeAttribute('min'); el.removeAttribute('max');
    if (!Number.isNaN(n)) el.value = fmtCampo(n);
  });

  // Bloco de alíquotas do RPPS (aparece só quando algum vínculo é QPM)
  const gasolina = document.getElementById('input-gasolina');
  const grade = gasolina?.closest('.grid');
  if (grade && !document.getElementById('bloco-rpps')) {
    const bloco = document.createElement('div');
    bloco.id = 'bloco-rpps';
    bloco.className = 'grid grid-cols-2 gap-4 pt-2 border-t border-slate-100';
    bloco.style.display = 'none';
    bloco.innerHTML = `
      <div>
        <label for="input-rpps-aliq" class="block text-xs font-semibold text-slate-700 mb-1">Alíquota RPPS do seu ente (%)</label>
        <input type="text" inputmode="decimal" id="input-rpps-aliq" value="14" class="${CLASSE_INPUT}">
      </div>
      <div>
        <label for="input-rpps-adic" class="block text-xs font-semibold text-slate-700 mb-1">Contribuição adicional (%)</label>
        <input type="text" inputmode="decimal" id="input-rpps-adic" value="3,9" class="${CLASSE_INPUT}">
      </div>`;
    grade.insertAdjacentElement('afterend', bloco);
  }

  document.getElementById('res-salario-liquido')?.setAttribute('aria-live', 'polite');
  document.getElementById('res-salario-liquido')?.setAttribute('aria-atomic', 'true');
}

function atualizarVisibilidadeCampos(params) {
  // Campo de percentual só aparece em "Outro %"
  const custom = document.querySelector('input[name="preset-ha"]:checked')?.value === 'custom';
  const campoPct = document.getElementById('input-pct-ha')?.parentElement?.parentElement;
  if (campoPct) campoPct.style.display = custom ? '' : 'none';

  // Campos do RPPS só quando há vínculo QPM
  const usaQPM = escolas.some((e) => (e.regime || params.regime) === 'qpm');
  const bloco = document.getElementById('bloco-rpps');
  if (bloco) bloco.style.display = usaQPM ? '' : 'none';
}

function garantirNotaResultado() {
  let nota = document.getElementById('nota-resultado');
  if (nota) return nota;
  const linha = document.getElementById('res-total-combustivel')?.parentElement?.parentElement;
  if (!linha) return null;
  nota = document.createElement('div');
  nota.id = 'nota-resultado';
  nota.className = 'pt-4 border-t border-slate-100 text-xs text-slate-600 space-y-2';
  linha.insertAdjacentElement('afterend', nota);
  return nota;
}

function formatarDataISO(iso) {
  const [a, m, d] = String(iso).split('-');
  return a && m && d ? `${d}/${m}/${a}` : iso;
}

/* ============================================================
   Atualização da tela
   ============================================================ */
function processarSimulacao() {
  const params = getParametrosGlobais();
  atualizarVisibilidadeCampos(params);

  const placeholder = fmtCampo(params.valorHora);
  document.querySelectorAll('input[data-campo="valorHora"]').forEach((el) => { el.placeholder = placeholder; });

  const cenario = calcularCenario(escolas, params);
  const ranking = analisarRanking(escolas, params, cenario);

  cenario.vinculos.forEach((v) => {
    const el = document.querySelector(`[data-bruto="${v.id}"]`);
    if (el) el.textContent = fmtMoeda(v.bruto);
  });

  escolas.forEach((esc) => {
    const r = document.querySelector(`[data-resumo="${esc.id}"]`);
    if (r) r.textContent = textoResumoEscola(esc);
    const n = document.querySelector(`[data-nome-resumo="${esc.id}"]`);
    if (n) n.textContent = esc.nome;
  });

  const set = (id, texto) => { const el = document.getElementById(id); if (el) el.textContent = texto; };
  set('badge-total-ha', `+ ${cenario.horasAtividade}h de atividade`);
  set('res-jornada-total', `${cenario.jornadaTotalSemanal.toFixed(1)}h semanais (${cenario.totalAulasSala} sala + ${cenario.horasAtividade} ativ.)`);
  set('badge-total-aulas', `${cenario.jornadaTotalSemanal.toFixed(1)}h semanais contratadas`);
  set('res-salario-liquido', fmtMoeda(cenario.saldoLiquidoReal));
  set('res-salario-bruto', fmtMoeda(cenario.bruto));
  set('res-total-descontos', `- ${fmtMoeda(cenario.descontoPrev + cenario.irpf)}`);
  set('res-total-combustivel', `- ${fmtMoeda(cenario.gastoCombustivelTotal)}`);

  const nota = garantirNotaResultado();
  if (nota) {
    const alerta = cenario.jornadaTotalSemanal > 40
      ? `<p class="font-semibold text-amber-700">Atenção: ${cenario.jornadaTotalSemanal.toFixed(1)}h semanais. Confira se essa carga é compatível com seus contratos e com as regras de acúmulo da sua rede.</p>`
      : '';
    nota.innerHTML = `
      ${alerta}
      <p>No contracheque (antes do combustível): <strong class="text-slate-800">${fmtMoeda(cenario.liquidoContracheque)}</strong></p>
      <p class="text-slate-500">Estimativa mensal, sem 13º, férias e FGTS. O IRPF é calculado sobre a soma dos vínculos (acerto na declaração anual); a retenção mensal de cada fonte pode ser menor. Tabelas de ${TABELAS.ano}, atualizadas em ${formatarDataISO(TABELAS.atualizadoEm)}. Não substitui o contracheque.</p>`;
  }

  renderizarRanking(ranking);
  salvarEstado();
}

function renderizarRanking(ranking) {
  const container = document.getElementById('container-ranking-escolas');
  if (!container) return;

  if (!ranking.length) {
    container.innerHTML = `
      <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 text-center">
        Preencha os dados de pelo menos 2 escolas para comparar qual compensa menos.
      </div>`;
    return;
  }

  container.innerHTML = '';

  const pior = ranking[0];
  const resumo = document.createElement('p');
  resumo.className = 'text-sm font-semibold text-slate-800';
  if (pior.alerta) {
    const efeito = pior.ganhoReal >= 0
      ? `Sair dela reduziria o seu ganho real em ${fmtMoeda(pior.ganhoReal)}/mês.`
      : `Sair dela aumentaria o seu ganho real em ${fmtMoeda(-pior.ganhoReal)}/mês.`;
    resumo.textContent = `${pior.nome} é a que menos compensa: ${fmtMoeda(pior.retorno)} por hora real. ${efeito}`;
  } else {
    resumo.textContent = 'Todas as escolas têm retorno por hora saudável em relação ao valor da hora-aula.';
  }
  container.appendChild(resumo);

  ranking.forEach((item, index) => {
    const destaque = index === 0 && item.alerta;
    const card = document.createElement('div');
    card.className = `p-3.5 rounded-xl border ${destaque ? 'bg-amber-50/70 border-amber-300' : 'bg-slate-50 border-slate-200'}`;
    card.innerHTML = `
      <div class="flex items-center justify-between gap-2 mb-1">
        <span class="font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
          ${destaque
            ? '<span class="text-xs bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-black">Menos compensa</span>'
            : `<span class="text-slate-500 font-normal">#${index + 1}</span>`}
          ${escaparHTML(item.nome)}
        </span>
        <span class="font-bold whitespace-nowrap ${item.alerta ? 'text-rose-600' : 'text-slate-700'}">${fmtMoeda(item.retorno)} / h real</span>
      </div>
      <p class="text-xs text-slate-600">
        Se sair: perde ${fmtMoeda(item.ganhoContracheque)}/mês no contracheque e economiza ${fmtMoeda(item.economiaGasolina)} de gasolina.
        Ela consome ${item.horasMes.toFixed(0)} h/mês, contando o deslocamento.
      </p>`;
    container.appendChild(card);
  });
}

/* ============================================================
   Inicialização
   ============================================================ */
function iniciar() {
  prepararCamposGlobais();
  restaurarEstado();

  const radioPreset = document.querySelector('input[name="preset-ha"]:checked');
  if (radioPreset && radioPreset.value !== 'custom') {
    const inputPct = document.getElementById('input-pct-ha');
    if (inputPct) inputPct.value = fmtCampo(Number(radioPreset.value) * 100);
  }

  renderizarFormularioEscolas();

  const container = document.getElementById('container-escolas');
  container?.addEventListener('input', aoEditarEscola);
  container?.addEventListener('change', aoEditarEscola);
  container?.addEventListener('toggle', (e) => {
    const d = e.target;
    const esc = d?.dataset?.cardId ? escolas.find((x) => x.id === Number(d.dataset.cardId)) : null;
    if (esc) esc.aberta = d.open;
  }, true);
  container?.addEventListener('click', (e) => {
    const rem = e.target.closest('.btn-remover-escola');
    if (rem) { removerEscola(Number(rem.dataset.id)); return; }
  });

  document.getElementById('btn-adicionar-escola')?.addEventListener('click', adicionarEscola);

  document.querySelectorAll('input[name="preset-ha"]').forEach((radio) => {
    radio.addEventListener('change', (e) => {
      const inputPct = document.getElementById('input-pct-ha');
      if (!inputPct) return;
      if (e.target.value === 'custom') {
        atualizarVisibilidadeCampos(getParametrosGlobais());
        inputPct.focus();
      } else {
        inputPct.value = fmtCampo(Number(e.target.value) * 100);
      }
      processarSimulacao();
    });
  });

  document.getElementById('input-pct-ha')?.addEventListener('input', () => {
    const custom = document.querySelector('input[name="preset-ha"][value="custom"]');
    if (custom) custom.checked = true;
    processarSimulacao();
  });

  document.querySelectorAll('input[name="regime"]').forEach((r) => r.addEventListener('change', processarSimulacao));
  [...CAMPOS_GLOBAIS.filter((id) => id !== 'input-pct-ha')].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', processarSimulacao);
  });

  processarSimulacao();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
}