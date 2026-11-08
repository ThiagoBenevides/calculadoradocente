// js/tabelas.js
// ÚNICA fonte dos valores de INSS e IRRF. Nenhum outro arquivo deve ter esses números.
// A aba "Tabelas utilizadas" e o aviso de tabela vencida são montados a partir daqui.
//
// CHECKLIST DE ATUALIZAÇÃO (todo início de ano):
//  1. Trocar os valores abaixo e as datas (ano, vigenciaInicio, vigenciaFim, atualizadoEm).
//  2. Atualizar as fontes (nome e url) com os links exatos das normas do ano.
//  3. Rodar o teste: node teste-tabelas.mjs (confere consistência e exemplos).
//  4. index.html: revisar a resposta do FAQ "Quanto desconta de INSS e de imposto de
//     renda" (texto visível E o JSON-LD, que precisam ser idênticos) e a descrição da seção
//     "Tabelas utilizadas".
//  5. Revisar o texto do aviso legal, se a regra do imposto de renda mudar.
//
// Convenção: "ate: null" significa "sem limite superior".

export const TABELAS = {
  ano: 2026,
  vigenciaInicio: '2026-01-01',
  vigenciaFim: '2026-12-31',
  atualizadoEm: '2026-01-09',

  salarioMinimo: 1621.00,

  inss: {
    titulo: 'INSS: empregados (PSS e CLT)',
    fonte: {
      nome: 'Portaria Interministerial MPS/MF nº 13/2026',
      url: 'https://www.gov.br/previdencia'
    },
    // Alíquotas progressivas: cada percentual incide só sobre a parcela dentro da faixa.
    faixas: [
      { ate: 1621.00, aliquota: 0.075 },
      { ate: 2902.84, aliquota: 0.09 },
      { ate: 4354.27, aliquota: 0.12 },
      { ate: 8475.55, aliquota: 0.14 }
    ],
    teto: 8475.55,
    contribuicaoMaximaConferencia: 988.09 // usado só para conferir os testes
  },

  irrf: {
    titulo: 'Imposto de renda retido na fonte (IRRF) mensal',
    fonte: {
      nome: 'Receita Federal e Lei 15.270/2025',
      url: 'https://www.gov.br/receitafederal'
    },
    faixas: [
      { ate: 2428.80, aliquota: 0,     deduzir: 0 },
      { ate: 2826.65, aliquota: 0.075, deduzir: 182.16 },
      { ate: 3751.05, aliquota: 0.15,  deduzir: 394.16 },
      { ate: 4664.68, aliquota: 0.225, deduzir: 675.49 },
      { ate: null,    aliquota: 0.275, deduzir: 908.73 }
    ],
    descontoSimplificado: 607.20,
    deducaoDependente: 189.59,
    // Redução da Lei 15.270/2025, aplicada sobre o imposto, usando o rendimento BRUTO mensal:
    //  - até isencaoAte: reduz até "maximo" (zera o imposto)
    //  - de isencaoAte até fimFaixa: reduz constante - coeficiente x rendimento
    //  - acima de fimFaixa: sem redução
    redutor: {
      isencaoAte: 5000.00,
      maximo: 312.89,
      fimFaixa: 7350.00,
      constante: 978.62,
      coeficiente: 0.133145
    }
  }
};

/**
 * Confere a consistência interna das tabelas. Retorna uma lista de problemas (vazia = ok).
 */
export function validarTabelas(t = TABELAS) {
  const erros = [];
  const crescente = (lista, rotulo) => {
    let anterior = 0;
    lista.forEach((f, i) => {
      if (f.ate == null) {
        if (i !== lista.length - 1) erros.push(`${rotulo}: "ate: null" só pode ser a última faixa`);
      } else if (f.ate <= anterior) {
        erros.push(`${rotulo}: faixas fora de ordem em ${f.ate}`);
      } else {
        anterior = f.ate;
      }
    });
  };

  crescente(t.inss.faixas, 'INSS');
  crescente(t.irrf.faixas, 'IRRF');

  const ultimaInss = t.inss.faixas[t.inss.faixas.length - 1];
  if (ultimaInss.ate !== t.inss.teto) erros.push('INSS: a última faixa deve ser igual ao teto');
  if (t.irrf.faixas[t.irrf.faixas.length - 1].ate !== null) erros.push('IRRF: a última faixa deve ter "ate: null"');
  if (t.vigenciaInicio > t.vigenciaFim) erros.push('Vigência: início depois do fim');
  if (t.irrf.redutor.isencaoAte >= t.irrf.redutor.fimFaixa) erros.push('Redutor: faixa inválida');

  // A fórmula do redutor deve ser contínua no início da faixa gradual
  const r = t.irrf.redutor;
  const noInicio = r.constante - r.coeficiente * r.isencaoAte;
  if (Math.abs(noInicio - r.maximo) > 0.02) erros.push('Redutor: fórmula não bate com o valor máximo');
  const noFim = r.constante - r.coeficiente * r.fimFaixa;
  if (Math.abs(noFim) > 0.02) erros.push('Redutor: fórmula não zera no fim da faixa');

  return erros;
}

/**
 * true quando a data informada é posterior ao fim da vigência das tabelas.
 */
export function tabelaVencida(hoje = new Date(), t = TABELAS) {
  const fim = new Date(`${t.vigenciaFim}T23:59:59`);
  return hoje.getTime() > fim.getTime();
}