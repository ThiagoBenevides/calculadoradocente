// js/engine-clt.js

/**
 * Calcula a remuneração bruta total para docentes sob regime CLT.
 */
export function calcularBrutoCLT({ aulasSemanais, valorHoraAula, pctHoraAtividade = 0.05 }) {
    // Salário-base: aulas semanais x 4,5 semanas médias por mês
    const salarioBase = aulasSemanais * 4.5 * valorHoraAula;
    
    // DSR (Descanso Semanal Remunerado): correspondente a 1/6 da remuneração base
    const dsr = salarioBase / 6;
    
    // Hora-atividade: calculada sobre a soma de salário base e DSR
    const horaAtividade = (salarioBase + dsr) * pctHoraAtividade;
    
    const brutoTotal = salarioBase + dsr + horaAtividade;
  
    return {
      salarioBase: Number(salarioBase.toFixed(2)),
      dsr: Number(dsr.toFixed(2)),
      horaAtividade: Number(horaAtividade.toFixed(2)),
      brutoTotal: Number(brutoTotal.toFixed(2))
    };
  }