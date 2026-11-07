// js/app.js
import { calcularBrutoCLT } from './engine-clt.js';
import { calcularBrutoPublico } from './engine-pss.js';
import { calcularINSS, calcularRPPS, calcularIRPF } from './irpf-marginal.js';

// Estado global dinâmico
let escolas = [
  { id: 1, nome: 'Colégio Principal (Sede)', aulas: 20, diasSemana: 5, kmIdaVolta: 10 },
  { id: 2, nome: 'Colégio B', aulas: 6, diasSemana: 2, kmIdaVolta: 25 }
];

let nextId = 3;

function getParametrosGlobais() {
  return {
    regime: document.querySelector('input[name="regime"]:checked')?.value || 'pss',
    valorHora: Number(document.getElementById('input-valor-hora')?.value || 25),
    gratificacoes: Number(document.getElementById('input-gratificacoes')?.value || 0),
    consumoKm: Number(document.getElementById('input-consumo')?.value || 10),
    precoGasolina: Number(document.getElementById('input-gasolina')?.value || 5.90)
  };
}

// 1. Renderiza os cartões dinâmicos de escolas
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
          <label class="block text-[11px] font-semibold text-slate-600 mb-1">Aulas Semanais</label>
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

// 2. Associa listeners para inputs e remoção
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

// 3. Motor de cálculo para um conjunto arbitrário de escolas
function calcularCenario(listaEscolas, params) {
  const totalAulas = listaEscolas.reduce((acc, cur) => acc + cur.aulas, 0);
  let bruto = 0;
  let descontoPrev = 0;

  if (params.regime === 'clt') {
    const clt = calcularBrutoCLT({
      aulasSemanais: totalAulas,
      valorHoraAula: params.valorHora,
      pctHoraAtividade: 0.05
    });
    bruto = clt.brutoTotal + params.gratificacoes;
    descontoPrev = calcularINSS(bruto);
  } else if (params.regime === 'pss') {
    const pss = calcularBrutoPublico({
      aulasSemanais: totalAulas,
      valorHoraAula: params.valorHora,
      proporcaoPlanejamento: 0.33,
      gratificacoesFixas: params.gratificacoes
    });
    bruto = pss.brutoTotal;
    descontoPrev = calcularINSS(bruto);
  } else if (params.regime === 'qpm') {
    const qpm = calcularBrutoPublico({
      aulasSemanais: totalAulas,
      valorHoraAula: params.valorHora,
      proporcaoPlanejamento: 0.33,
      gratificacoesFixas: params.gratificacoes
    });
    bruto = qpm.brutoTotal;
    const rpps = calcularRPPS(bruto, 0.14, 0.039);
    descontoPrev = rpps.totalDeducoes;
  }

  const baseIR = Math.max(0, bruto - descontoPrev);
  const irpf = calcularIRPF(baseIR);
  const salarioLiquidoContracheque = bruto - descontoPrev - irpf.irpf;

  // Custo somado de transporte mensal (4.2 semanas médias por mês)
  let gastoCombustivelTotal = 0;
  listaEscolas.forEach(esc => {
    const kmMes = esc.diasSemana * 4.2 * esc.kmIdaVolta;
    const litros = params.consumoKm > 0 ? (kmMes / params.consumoKm) : 0;
    gastoCombustivelTotal += litros * params.precoGasolina;
  });

  const saldoLiquidoReal = salarioLiquidoContracheque - gastoCombustivelTotal;

  return {
    totalAulas,
    bruto,
    descontoPrev,
    irpf: irpf.irpf,
    gastoCombustivelTotal,
    salarioLiquidoContracheque,
    saldoLiquidoReal
  };
}

// 4. Algoritmo de Otimização Marginal (Qual escola abandonar?)
function analisarMelhorAbandono(listaEscolas, params, cenarioAtual) {
  if (listaEscolas.length <= 1) return [];

  return listaEscolas.map(escolaAlvo => {
    // Simula a rotina sem esta escola
    const listaRestante = listaEscolas.filter(e => e.id !== escolaAlvo.id);
    const cenarioSem = calcularCenario(listaRestante, params);

    // Queda no salário líquido do contracheque ao abrir mão das aulas
    const perdaLiquidaContracheque = cenarioAtual.salarioLiquidoContracheque - cenarioSem.salarioLiquidoContracheque;

    // Economia de combustível que deixará de gastar
    const kmMes = escolaAlvo.diasSemana * 4.2 * escolaAlvo.kmIdaVolta;
    const economiaGasolina = (kmMes / params.consumoKm) * params.precoGasolina;

    // Diferença real no bolso
    const diferencaRealNoBolso = perdaLiquidaContracheque - economiaGasolina;
    
    // Retorno líquido real por cada aula mensal dessa escola
    const aulasMes = escolaAlvo.aulas * 4.2;
    const retornoRealPorAula = aulasMes > 0 ? (diferencaRealNoBolso / aulasMes) : 0;

    return {
      id: escolaAlvo.id,
      nome: escolaAlvo.nome,
      aulas: escolaAlvo.aulas,
      economiaGasolina,
      perdaLiquidaContracheque,
      diferencaRealNoBolso,
      retornoRealPorAula
    };
  }).sort((a, b) => a.retornoRealPorAula - b.retornoRealPorAula); // A pior escola fica no topo (menor retorno)
}

// 5. Execução e Atualização da Interface
function processarSimulacao() {
  const params = getParametrosGlobais();
  const cenarioGeral = calcularCenario(escolas, params);
  const ranking = analisarMelhorAbandono(escolas, params, cenarioGeral);

  // Atualiza cards consolidados
  document.getElementById('badge-total-aulas').textContent = `${cenarioGeral.totalAulas} aulas semanais`;
  document.getElementById('res-salario-liquido').textContent = `R$ ${cenarioGeral.saldoLiquidoReal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  document.getElementById('res-salario-bruto').textContent = `R$ ${cenarioGeral.bruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  
  const totalDesc = cenarioGeral.descontoPrev + cenarioGeral.irpf;
  document.getElementById('res-total-descontos').textContent = `- R$ ${totalDesc.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  document.getElementById('res-total-combustivel').textContent = `- R$ ${cenarioGeral.gastoCombustivelTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  // Atualiza painel de recomendação de abandono
  const rankingContainer = document.getElementById('container-ranking-escolas');
  if (!rankingContainer) return;

  if (escolas.length <= 1) {
    rankingContainer.innerHTML = `
      <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 text-center">
        Adicione pelo menos 2 colégios para comparar a viabilidade de abandono.
      </div>
    `;
    return;
  }

  rankingContainer.innerHTML = '';

  ranking.forEach((item, index) => {
    const isPior = index === 0; // A candidata nº 1 a ser cortada
    const itemCard = document.createElement('div');
    itemCard.className = `p-3.5 rounded-xl border transition-all ${
      isPior ? 'bg-amber-50/70 border-amber-300' : 'bg-slate-50 border-slate-200'
    }`;

    itemCard.innerHTML = `
      <div class="flex items-center justify-between mb-1">
        <span class="font-bold text-slate-800 flex items-center gap-1.5">
          ${isPior ? '<span class="text-xs bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-black">1ª a Abandonar</span>' : `<span class="text-slate-400 font-normal">#${index + 1}</span>`}
          ${item.nome} (${item.aulas} aulas)
        </span>
        <span class="font-bold ${item.retornoRealPorAula < 10 ? 'text-rose-600' : 'text-slate-700'}">
          R$ ${item.retornoRealPorAula.toFixed(2)} / aula real
        </span>
      </div>
      <p class="text-[11px] text-slate-500">
        Se largar: você perde R$ ${item.perdaLiquidaContracheque.toFixed(2)} no contracheque, mas <strong>economiza R$ ${item.economiaGasolina.toFixed(2)} de combustível</strong>. Perda real líquida: <strong>R$ ${item.diferencaRealNoBolso.toFixed(2)}/mês</strong>.
      </p>
    `;
    rankingContainer.appendChild(itemCard);
  });
}

// 6. Inicialização
document.addEventListener('DOMContentLoaded', () => {
  renderizarFormularioEscolas();

  // Botão Adicionar Escola
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

  // Inputs globais
  document.querySelectorAll('input[name="regime"]').forEach(r => r.addEventListener('change', processarSimulacao));
  ['input-valor-hora', 'input-gratificacoes', 'input-consumo', 'input-gasolina'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', processarSimulacao);
  });

  processarSimulacao();
});