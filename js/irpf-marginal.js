// js/irpf-marginal.js
// Funções de cálculo. NENHUM valor de tabela fica aqui: tudo vem de tabelas.js.
import { TABELAS } from './tabelas.js';

export { TABELAS };

const arredondar = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

// ---------- INSS (empregado / PSS / CLT) ----------
export function calcularINSS(salarioBruto, tabela = TABELAS.inss) {
  const faixas = tabela.faixas;
  const base = Math.min(Math.max(Number(salarioBruto) || 0, 0), tabela.teto);

  let inss = 0;
  let anterior = 0;
  for (const faixa of faixas) {
    if (base <= anterior) break;
    inss += (Math.min(base, faixa.ate) - anterior) * faixa.aliquota;
    anterior = faixa.ate;
  }
  return arredondar(inss);
}

// ---------- RPPS (servidor efetivo / QPM) ----------
// As alíquotas variam por ente (estado/município), por isso são parâmetros.
export function calcularRPPS(salarioBruto, aliquota = 0.14, aliquotaAdicional = 0) {
  const base = Math.max(Number(salarioBruto) || 0, 0);
  const previdencia = arredondar(base * aliquota);
  const adicional = arredondar(base * aliquotaAdicional);
  return { previdencia, adicional, totalDeducoes: arredondar(previdencia + adicional) };
}

// ---------- IRRF mensal ----------
/**
 * @param {number} rendimentoBruto  rendimento tributável mensal bruto
 * @param {number} deducoesPrevidenciarias  INSS ou contribuição ao RPPS
 * @param {number} dependentes  número de dependentes (opcional)
 */
export function calcularIRPF(rendimentoBruto, deducoesPrevidenciarias = 0, dependentes = 0, tabela = TABELAS.irrf) {
  const bruto = Math.max(Number(rendimentoBruto) || 0, 0);

  // Usa o desconto simplificado quando ele for mais vantajoso que as deduções legais
  const deducaoLegal = (Number(deducoesPrevidenciarias) || 0) + dependentes * tabela.deducaoDependente;
  const usouSimplificado = tabela.descontoSimplificado > deducaoLegal;
  const base = Math.max(0, bruto - Math.max(deducaoLegal, tabela.descontoSimplificado));

  const faixa = tabela.faixas.find((f) => f.ate === null || base <= f.ate);
  const impostoTabela = Math.max(0, base * faixa.aliquota - faixa.deduzir);

  const r = tabela.redutor;
  let redutor = 0;
  if (bruto <= r.isencaoAte) {
    redutor = Math.min(impostoTabela, r.maximo);
  } else if (bruto <= r.fimFaixa) {
    redutor = Math.max(0, r.constante - r.coeficiente * bruto);
  }

  const irpf = Math.max(0, impostoTabela - redutor);

  return {
    irpf: arredondar(irpf),
    base: arredondar(base),
    impostoTabela: arredondar(impostoTabela),
    redutor: arredondar(Math.min(redutor, impostoTabela)),
    aliquotaMarginal: faixa.aliquota,
    usouSimplificado
  };
}