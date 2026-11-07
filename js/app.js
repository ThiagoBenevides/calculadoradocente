// js/app.js
import { calcularBrutoCLT } from './engine-clt.js';
import { calcularBrutoPublico } from './engine-pss.js';
import { calcularINSS, calcularRPPS, calcularIRPF } from './irpf-marginal.js';
import { analisarViabilidadeColegioB } from './deslocamento.js';

const state = {
  regime: 'pss', // 'pss', 'qpm' ou 'clt'
  colegioA: { aulas: 20, valorHora: 25.00, gratificacoes: 0 },
  colegioB: { ativo: false, aulas: 6, dias: 2, kmIdaVolta: 25, consumoKm: 10, precoGasolina: 5.90 },
  dependentes: 0
};

export function processarCalculos() {
  // 1. Cenário Base: apenas Colégio A
  const baseA = calcularCenario(state.colegioA.aulas, state.colegioA.gratificacoes);

  let resultadoLogistica = null;
  let baseTotal = baseA;

  // 2. Cenário Total: Colégio A + Colégio B (se ativo)
  if (state.colegioB.ativo && state.colegioB.aulas > 0) {
    const totalAulas = state.colegioA.aulas + state.colegioB.aulas;
    baseTotal = calcularCenario(totalAulas, state.colegioA.gratificacoes);

    resultadoLogistica = analisarViabilidadeColegioB({
      salarioLiquidoSemB: baseA.salarioLiquido,
      salarioLiquidoComB: baseTotal.salarioLiquido,
      diasSemanaDeslocamento: state.colegioB.dias,
      distanciaKmIdaVolta: state.colegioB.kmIdaVolta,
      consumoKmLitro: state.colegioB.consumoKm,
      precoCombustivel: state.colegioB.precoGasolina
    });
  }

  // 3. Atualiza os elementos na tela
  renderizarResultados(baseA, baseTotal, resultadoLogistica);
}

function calcularCenario(aulas, gratificacoes) {
  let bruto = 0;
  let descontoPrev = 0;

  if (state.regime === 'clt') {
    const dadosCLT = calcularBrutoCLT({
      aulasSemanais: aulas,
      valorHoraAula: state.colegioA.valorHora,
      pctHoraAtividade: 0.05
    });
    bruto = dadosCLT.brutoTotal + gratificacoes;
    descontoPrev = calcularINSS(bruto);
  } else if (state.regime === 'pss') {
    const dadosPSS = calcularBrutoPublico({
      aulasSemanais: aulas,
      valorHoraAula: state.colegioA.valorHora,
      proporcaoPlanejamento: 0.33,
      gratificacoesFixas: gratificacoes
    });
    bruto = dadosPSS.brutoTotal;
    descontoPrev = calcularINSS(bruto);
  } else if (state.regime === 'qpm') {
    const dadosQPM = calcularBrutoPublico({
      aulasSemanais: aulas,
      valorHoraAula: state.colegioA.valorHora,
      proporcaoPlanejamento: 0.33,
      gratificacoesFixas: gratificacoes
    });
    bruto = dadosQPM.brutoTotal;
    const rpps = calcularRPPS(bruto, 0.14, 0.039); // 14% Previdência + 3.9% Fundo de Saúde
    descontoPrev = rpps.totalDeducoes;
  }

  const deducaoDependentes = state.dependentes * 189.59;
  const baseIR = Math.max(0, bruto - descontoPrev - deducaoDependentes);
  const impostoRenda = calcularIRPF(baseIR);
  const salarioLiquido = bruto - descontoPrev - impostoRenda.irpf;

  return {
    aulas,
    bruto: Number(bruto.toFixed(2)),
    descontoPrev: Number(descontoPrev.toFixed(2)),
    irpf: impostoRenda.irpf,
    aliquotaIR: impostoRenda.faixa,
    salarioLiquido: Number(salarioLiquido.toFixed(2))
  };
}

function renderizarResultados(cenarioA, cenarioTotal, logistica) {
  const elLiquido = document.getElementById('res-salario-liquido');
  const elBruto = document.getElementById('res-salario-bruto');
  const elDescontos = document.getElementById('res-total-descontos');
  const elAlertaB = document.getElementById('res-alerta-colegio-b');

  if (elLiquido) {
    elLiquido.textContent = `R$ ${cenarioTotal.salarioLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  }

  if (elBruto) {
    elBruto.textContent = `R$ ${cenarioTotal.bruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  }

  if (elDescontos) {
    const totalDesc = cenarioTotal.descontoPrev + cenarioTotal.irpf;
    elDescontos.textContent = `- R$ ${totalDesc.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (Prev: R$ ${cenarioTotal.descontoPrev.toFixed(2)} | IR: R$ ${cenarioTotal.irpf.toFixed(2)})`;
  }

  if (elAlertaB) {
    if (logistica) {
      elAlertaB.classList.remove('hidden');
      if (logistica.viavel) {
        elAlertaB.className = 'text-xs rounded-lg p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 space-y-1 block';
        elAlertaB.innerHTML = `
          <div class="font-bold">✓ Vale a pena pegar as aulas no Colégio B</div>
          <div>Aumento líquido bruto: <strong>+ R$ ${logistica.acrescimoSalarioLiquido.toFixed(2)}</strong></div>
          <div>Custo de combustível: <strong>- R$ ${logistica.custoTotalDeslocamento.toFixed(2)}</strong></div>
          <div class="pt-1 border-t border-emerald-200 text-emerald-950 font-semibold">Ganho real que sobra: + R$ ${logistica.saldoFinalReal.toFixed(2)}/mês</div>
        `;
      } else {
        elAlertaB.className = 'text-xs rounded-lg p-3.5 bg-rose-50 border border-rose-200 text-rose-800 space-y-1 block';
        elAlertaB.innerHTML = `
          <div class="font-bold">⚠ Atenção: Custo de deslocamento desfavorável</div>
          <div>O combustível mensal (<strong>R$ ${logistica.custoTotalDeslocamento.toFixed(2)}</strong>) consome ou supera o ganho líquido extra (<strong>R$ ${logistica.acrescimoSalarioLiquido.toFixed(2)}</strong>).</div>
        `;
      }
    } else {
      elAlertaB.classList.add('hidden');
    }
  }
}

// Configuração dos ouvintes de eventos
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('form-calculadora');
  
  if (form) {
    form.addEventListener('input', () => {
      state.regime = document.querySelector('input[name="regime"]:checked')?.value || 'pss';
      state.colegioA.aulas = Number(document.getElementById('input-aulas-a')?.value || 0);
      state.colegioA.valorHora = Number(document.getElementById('input-valor-hora')?.value || 0);
      state.colegioA.gratificacoes = Number(document.getElementById('input-gratificacoes')?.value || 0);
      
      const checkB = document.getElementById('check-colegio-b');
      state.colegioB.ativo = checkB ? checkB.checked : false;
      
      if (state.colegioB.ativo) {
        state.colegioB.aulas = Number(document.getElementById('input-aulas-b')?.value || 0);
        state.colegioB.dias = Number(document.getElementById('input-dias-b')?.value || 1);
        state.colegioB.kmIdaVolta = Number(document.getElementById('input-km-b')?.value || 0);
        state.colegioB.consumoKm = Number(document.getElementById('input-consumo-b')?.value || 10);
        state.colegioB.precoGasolina = Number(document.getElementById('input-gasolina-b')?.value || 5.90);
      }
      
      processarCalculos();
    });
  }

  // Execução inicial ao abrir a página
  processarCalculos();
});