// js/irpf-marginal.js

export function calcularINSS(salarioBruto) {
    // Faixas oficiais de recolhimento progressivo (atualizáveis anualmente)
    const faixas = [
      { limite: 1412.00, aliq: 0.075 },
      { limite: 2666.68, aliq: 0.09 },
      { limite: 4000.03, aliq: 0.12 },
      { limite: 7786.02, aliq: 0.14 }
    ];
  
    let inss = 0;
    let baseAnterior = 0;
  
    for (const faixa of faixas) {
      if (salarioBruto > faixa.limite) {
        inss += (faixa.limite - baseAnterior) * faixa.aliq;
        baseAnterior = faixa.limite;
      } else {
        inss += (salarioBruto - baseAnterior) * faixa.aliq;
        baseAnterior = salarioBruto;
        break;
      }
    }
  
    // Teto máximo do INSS
    const tetoINSS = 908.85; 
    return Math.min(inss, tetoINSS);
  }