// js/deslocamento.js

/**
 * Avalia se o ganho líquido marginal obtido no Colégio B compensa o custo logístico de deslocamento.
 */
export function analisarViabilidadeColegioB({
    salarioLiquidoSemB,
    salarioLiquidoComB,
    diasSemanaDeslocamento,
    distanciaKmIdaVolta,
    consumoKmLitro = 10,
    precoCombustivel = 5.90,
    estacionamentoPedagioMensal = 0
  }) {
    // Estimativa de 4.2 semanas úteis de deslocamento no mês
    const viagensMes = diasSemanaDeslocamento * 4.2;
    const kmMensal = viagensMes * distanciaKmIdaVolta;
    const litrosCombustivel = consumoKmLitro > 0 ? (kmMensal / consumoKmLitro) : 0;
    const custoCombustivel = litrosCombustivel * precoCombustivel;
    const custoTotalDeslocamento = custoCombustivel + estacionamentoPedagioMensal;
  
    // Acréscimo real no contracheque vs custo de transporte
    const acrescimoSalarioLiquido = salarioLiquidoComB - salarioLiquidoSemB;
    const saldoFinalReal = acrescimoSalarioLiquido - custoTotalDeslocamento;
  
    return {
      acrescimoSalarioLiquido: Number(acrescimoSalarioLiquido.toFixed(2)),
      custoTotalDeslocamento: Number(custoTotalDeslocamento.toFixed(2)),
      saldoFinalReal: Number(saldoFinalReal.toFixed(2)),
      viavel: saldoFinalReal > 0
    };
  }