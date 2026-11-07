// js/engine-pss.js

/**
 * Calcula a remuneração bruta para professores da rede pública (PSS ou concursados).
 */
export function calcularBrutoPublico({ 
    aulasSemanais, 
    valorHoraAula, 
    proporcaoPlanejamento = 0.33, 
    gratificacoesFixas = 0 
  }) {
    // Horas em sala somadas às horas proporcionais de planejamento
    const horasTotais = aulasSemanais * (1 + proporcaoPlanejamento);
    
    // Base mensal estimada em 4,5 semanas
    const remuneracaoHoras = horasTotais * 4.5 * valorHoraAula;
    const brutoTotal = remuneracaoHoras + gratificacoesFixas;
  
    return {
      horasTotais: Number(horasTotais.toFixed(1)),
      remuneracaoHoras: Number(remuneracaoHoras.toFixed(2)),
      gratificacoesFixas: Number(gratificacoesFixas.toFixed(2)),
      brutoTotal: Number(brutoTotal.toFixed(2))
    };
  }