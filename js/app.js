// js/app.js
import { calcularBrutoCLT } from './engine-clt.js';
import { calcularBrutoPublico } from './engine-pss.js';
import { calcularINSS, calcularRPPS, calcularIRPF } from './irpf-marginal.js';

let escolas = [
  { id: 1, nome: 'Colégio Principal (Sede)', aulas: 20, diasSemana: 5, kmIdaVolta: 10 },
  { id: 2, nome: 'Colégio B', aulas: 6, diasSemana: 2, kmIdaVolta: 25 }
];

let nextId = 3;

function getParametrosGlobais() {
  const pctInput = Number(document.getElementById('input-pct-ha')?.value || 33.33);
  return {
    regime: document.querySelector('input[name="regime"]:checked')?.value || 'pss',
    pctHoraAtividade: pctInput / 100,
    valorHora: Number(document.getElementById('input-valor-hora')?.value || 25),
    gratificacoes: Number(document.getElementById('input-gratificacoes')?.value || 0),
    consumoKm: Number(document.getElementById('input-consumo')?.value || 10),
    precoGasolina: Number(document.getElementById('input-gasolina')?.value || 5.90)
  };
}

function renderizarFormularioEscolas() {
  const container = document.getElementById('container-escolas');
  if (!container) return;

  container.innerHTML = '';

  escolas.forEach((esc, index) => {
    const card = document.createElement('div');
    card.className = 'bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4 transition-all';
    card.innerHTML = `
      <div class="flex items-center justify-between border-b border-slate-100 pb-3">
        <div class="flex items-center gap-2 flex-grow">
          <span class="text-xs font-black bg-slate-100 text-slate-700 w-6 h-6 rounded-full flex items-center justify-center">${index + 1}</span>
          <input type="text" data-id="${esc.id}" class="input-nome-escola text-sm font-bold text-slate-900 border-none bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded px-1.5 py-0.5 w-full sm:w-auto" value="${esc.nome}">
        </div>
        ${escolas.length > 1 ? `
          <button type="button" data-id="${esc.id}" class="btn-remover-escola text-xs font-semibold text-rose-500 hover:text-rose-700 p-1 rounded transition" title="Remover este colégio">
            Excluir
          </button>
        ` : ''}
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label class="block text-[11px] font-semibold text-slate-600 mb-1">Aulas em Sala</label>
          <input type="number" data-id="${esc.id}" data-campo="aulas" value="${esc.aulas}" min="1" max="40" class="input-escola w-full rounded-lg border-slate-300 border px-3 py-1.5 text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none">
        </div>
        <div>
          <label class="block text-[11px] font-semibold text-slate-600 mb-1">Dias de Deslocamento/Sem</label>
          <input type="number" data-id="${esc.id}" data-campo="diasSemana" value="${esc.diasSemana}" min="1" max="6" class="input-escola w-full rounded-lg border-slate-300 border px-3 py-1.5 text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none">
        </div>
        <div>
          <label class="block text-[11px] font-semibold text-slate-600 mb-1">Km Total Ida e Volta</label>
          <input type="number" data-id="${esc.id}" data-campo="kmIdaVolta" value="${esc.kmIdaVolta}" min="0" class="input-escola w-full rounded-lg border-slate-300 border px-3 py-1.5 text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none">
        </div>
      </div>
    `;
    container.appendChild(card);
  });

  vincularEventosCards();
}

function vincularEventosCards() {
  document.querySelectorAll('.input-escola').forEach(input => {
    input.addEventListener('input', (e) => {
      const id = Number(e.target.dataset.id);
      const campo = e.target.dataset.campo;
      const escola = escolas.find(item => item.id === id);
      if (escola) {
        escola[campo] = Number(e.target.value) || 0;
        processarSimulacao();
      }
    });
  });

  document.querySelectorAll('.input-nome-escola').forEach(input => {
    input.addEventListener('change', (e) => {
      const id = Number(e.target.dataset.id);
      const escola = escolas.find(item => item.id === id);
      if (escola) {
        escola.nome = e.target.value.trim() || `Colégio ${id}`;
        processarSimulacao();
      }
    });
  });

  document.querySelectorAll('.btn-remover-escola').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = Number(e.currentTarget.dataset.id);
      escolas = escolas.filter(esc => esc.id !== id);
      renderizarFormularioEscolas();
      processarSimulacao();
    });
  });
}

function calcularCenario(listaEscolas, params) {
  const totalAulasSala = listaEscolas.reduce((acc, cur) => acc + cur.aulas, 0);
  
  // Cálculo exato das horas-atividade
  const horasAtividade = Number((totalAulasSala * params.pctHoraAtividade).toFixed(1));
  const jornadaTotalSemanal = totalAulasSala + horasAtividade;

  let bruto = 0;
  let descontoPrev = 0;

  if (params.regime === 'clt') {
    const clt = calcularBrutoCLT({
      aulasSemanais: totalAulasSala,
      valorHoraAula: params.valorHora,
      pctHoraAtividade: params.pctHoraAtividade
    });
    bruto = clt.brutoTotal + params.gratificacoes;
    descontoPrev = calcularINSS(bruto);
  } else if (params.regime === 'pss') {
    const pss = calcularBrutoPublico({
      aulasSemanais: totalAulasSala,
      valorHoraAula: params.valorHora,
      proporcaoPlanejamento: params.pctHoraAtividade,
      gratificacoesFixas: params.gratificacoes
    });
    bruto = pss.brutoTotal;
    descontoPrev = calcularINSS(bruto);
  } else if (params.regime === 'qpm') {
    const qpm = calcularBrutoPublico({
      aulasSemanais: totalAulasSala,
      valorHoraAula: params.valorHora,
      proporcaoPlanejamento: params.pctHoraAtividade,
      gratificacoesFixas: params.gratificacoes
    });
    bruto = qpm.brutoTotal;
    const rpps = calcularRPPS(bruto, 0.14, 0.039);
    descontoPrev = rpps.totalDeducoes;
  }

  const baseIR = Math.max(0, bruto - descontoPrev);
  const irpf = calcularIRPF(baseIR);
  const salarioLiquidoContracheque = bruto - descontoPrev - irpf.irpf;

  let gastoCombustivelTotal = 0;
  listaEscolas.forEach(esc => {
    const kmMes = esc.diasSemana * 4.2 * esc.kmIdaVolta;
    const litros = params.consumoKm > 0 ? (kmMes / params.consumoKm) : 0;
    gastoCombustivelTotal += litros * params.precoGasolina;
  });

  const saldoLiquidoReal = salarioLiquidoContracheque - gastoCombustivelTotal;

  return {
    totalAulasSala,
    horasAtividade,
    jornadaTotalSemanal,
    bruto,
    descontoPrev,
    irpf: irpf.irpf,
    gastoCombustivelTotal,
    salarioLiquidoContracheque,
    saldoLiquidoReal
  };
}

function analisarMelhorAbandono(listaEscolas, params, cenarioAtual) {
  if (listaEscolas.length <= 1) return [];

  return listaEscolas.map(escolaAlvo => {
    const listaRestante = listaEscolas.filter(e => e.id !== escolaAlvo.id);
    const cenarioSem = calcularCenario(listaRestante, params);

    const perdaLiquidaContracheque = cenarioAtual.salarioLiquidoContracheque - cenarioSem.salarioLiquidoContracheque;
    const kmMes = escolaAlvo.diasSemana * 4.2 * escolaAlvo.kmIdaVolta;
    const economiaGasolina = (kmMes / params.consumoKm) * params.precoGasolina;
    const diferencaRealNoBolso = perdaLiquidaContracheque - economiaGasolina;
    
    // Considera o total de horas reais (aulas em sala + horas de atividade correspondentes)
    const horasEscolaSemana = escolaAlvo.aulas * (1 + params.pctHoraAtividade);
    const horasEscolaMes = horasEscolaSemana * 4.2;
    const retornoRealPorHoraTotal = horasEscolaMes > 0 ? (diferencaRealNoBolso / horasEscolaMes) : 0;

    return {
      id: escolaAlvo.id,
      nome: escolaAlvo.nome,
      aulas: escolaAlvo.aulas,
      horasComAtividade: Number(horasEscolaSemana.toFixed(1)),
      economiaGasolina,
      perdaLiquidaContracheque,
      diferencaRealNoBolso,
      retornoRealPorHoraTotal
    };
  }).sort((a, b) => a.retornoRealPorHoraTotal - b.retornoRealPorHoraTotal);
}

function processarSimulacao() {
  const params = getParametrosGlobais();
  const cenarioGeral = calcularCenario(escolas, params);
  const ranking = analisarMelhorAbandono(escolas, params, cenarioGeral);

  // Atualiza indicadores de hora-atividade no formulário
  document.getElementById('badge-total-ha').textContent = `+ ${cenarioGeral.horasAtividade}h de atividade`;
  document.getElementById('res-jornada-total').textContent = `${cenarioGeral.jornadaTotalSemanal.toFixed(1)}h semanais (${cenarioGeral.totalAulasSala} sala + ${cenarioGeral.horasAtividade} ativ.)`;

  // Atualiza cards consolidados
  document.getElementById('badge-total-aulas').textContent = `${cenarioGeral.jornadaTotalSemanal.toFixed(1)}h semanais contratadas`;
  document.getElementById('res-salario-liquido').textContent = `R$ ${cenarioGeral.saldoLiquidoReal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  document.getElementById('res-salario-bruto').textContent = `R$ ${cenarioGeral.bruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  
  const totalDesc = cenarioGeral.descontoPrev + cenarioGeral.irpf;
  document.getElementById('res-total-descontos').textContent = `- R$ ${totalDesc.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  document.getElementById('res-total-combustivel').textContent = `- R$ ${cenarioGeral.gastoCombustivelTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  // Atualiza ranking
  const rankingContainer = document.getElementById('container-ranking-escolas');
  if (!rankingContainer) return;

  if (escolas.length <= 1) {
    rankingContainer.innerHTML = `
      <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 text-center">
        Adicione pelo menos 2 colégios para calcular qual é mais viável abandonar.
      </div>
    `;
    return;
  }

  rankingContainer.innerHTML = '';

  ranking.forEach((item, index) => {
    const isPior = index === 0;
    const itemCard = document.createElement('div');
    itemCard.className = `p-3.5 rounded-xl border transition-all ${
      isPior ? 'bg-amber-50/70 border-amber-300' : 'bg-slate-50 border-slate-200'
    }`;

    itemCard.innerHTML = `
      <div class="flex items-center justify-between mb-1">
        <span class="font-bold text-slate-800 flex items-center gap-1.5">
          ${isPior ? '<span class="text-xs bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-black">1ª a Abandonar</span>' : `<span class="text-slate-400 font-normal">#${index + 1}</span>`}
          ${item.nome} (${item.aulas} aulas sala / ${item.horasComAtividade}h totais)
        </span>
        <span class="font-bold ${item.retornoRealPorHoraTotal < 12 ? 'text-rose-600' : 'text-slate-700'}">
          R$ ${item.retornoRealPorHoraTotal.toFixed(2)} / h real
        </span>
      </div>
      <p class="text-[11px] text-slate-500">
        Se largar: perda no contracheque de R$ ${item.perdaLiquidaContracheque.toFixed(2)}, mas <strong>economiza R$ ${item.economiaGasolina.toFixed(2)} de gasolina</strong>. Perda real líquida: <strong>R$ ${item.diferencaRealNoBolso.toFixed(2)}/mês</strong>.
      </p>
    `;
    rankingContainer.appendChild(itemCard);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  renderizarFormularioEscolas();

  const btnAdd = document.getElementById('btn-adicionar-escola');
  if (btnAdd) {
    btnAdd.addEventListener('click', () => {
      escolas.push({
        id: nextId++,
        nome: `Colégio ${String.fromCharCode(64 + escolas.length + 1)}`,
        aulas: 4,
        diasSemana: 2,
        kmIdaVolta: 20
      });
      renderizarFormularioEscolas();
      processarSimulacao();
    });
  }

  // Presets de hora-atividade (33%, 20%, 5%, custom)
  document.querySelectorAll('input[name="preset-ha"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const inputPct = document.getElementById('input-pct-ha');
      if (!inputPct) return;

      if (e.target.value === 'custom') {
        inputPct.focus();
      } else {
        inputPct.value = (Number(e.target.value) * 100).toFixed(2);
      }
      processarSimulacao();
    });
  });

  document.getElementById('input-pct-ha')?.addEventListener('input', () => {
    // Ao digitar manualmente, marca a opção "Outro %"
    const radioCustom = document.querySelector('input[name="preset-ha"][value="custom"]');
    if (radioCustom) radioCustom.checked = true;
    processarSimulacao();
  });

  document.querySelectorAll('input[name="regime"]').forEach(r => r.addEventListener('change', processarSimulacao));
  ['input-valor-hora', 'input-gratificacoes', 'input-consumo', 'input-gasolina'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', processarSimulacao);
  });

  processarSimulacao();
});