// js/engine-clt.js
import { SEMANAS_PAGAMENTO } from './constantes.js';

/**
 * Remuneração bruta de professor CLT (horista, rede privada).
 * Premissas (validar com a convenção coletiva do sindicato):
 *  - Mensal = aulas semanais x 4,5 semanas x valor da hora-aula (Súmula 351 TST)
 *  - DSR = 1/6 sobre o salário-aula
 *  - Hora-atividade = % sobre (salário-aula + DSR)
 */
export function calcularBrutoCLT({ aulasSemanais, valorHoraAula, pctHoraAtividade = 0.05 }) {
  const aulas = Math.max(Number(aulasSemanais) || 0, 0);
  const valor = Math.max(Number(valorHoraAula) || 0, 0);

  const salarioBase = aulas * SEMANAS_PAGAMENTO * valor;
  const dsr = salarioBase / 6;
  const horaAtividade = (salarioBase + dsr) * pctHoraAtividade;
  const brutoTotal = salarioBase + dsr + horaAtividade;

  return {
    salarioBase: Number(salarioBase.toFixed(2)),
    dsr: Number(dsr.toFixed(2)),
    horaAtividade: Number(horaAtividade.toFixed(2)),
    brutoTotal: Number(brutoTotal.toFixed(2))
  };
}