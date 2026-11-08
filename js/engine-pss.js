// js/engine-pss.js
import { SEMANAS_PAGAMENTO } from './constantes.js';

/**
 * Remuneração bruta de professor da rede pública (PSS ou efetivo).
 * Premissa: o valor informado é o da hora-aula em sala; a hora-atividade
 * é paga por cima, pelo mesmo valor (ex.: 20 aulas + 33,3% = 26,7 h pagas).
 * Se a sua rede já embute a hora-atividade no valor da hora, use 0% no percentual.
 */
export function calcularBrutoPublico({
  aulasSemanais,
  valorHoraAula,
  proporcaoPlanejamento = 0.33,
  gratificacoesFixas = 0
}) {
  const aulas = Math.max(Number(aulasSemanais) || 0, 0);
  const valor = Math.max(Number(valorHoraAula) || 0, 0);
  const gratificacoes = Math.max(Number(gratificacoesFixas) || 0, 0);

  const horasTotais = aulas * (1 + proporcaoPlanejamento);
  const remuneracaoHoras = horasTotais * SEMANAS_PAGAMENTO * valor;
  const brutoTotal = remuneracaoHoras + gratificacoes;

  return {
    horasTotais: Number(horasTotais.toFixed(1)),
    remuneracaoHoras: Number(remuneracaoHoras.toFixed(2)),
    gratificacoesFixas: Number(gratificacoes.toFixed(2)),
    brutoTotal: Number(brutoTotal.toFixed(2))
  };
}