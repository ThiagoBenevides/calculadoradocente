// js/ui-tabelas.js
// Monta a aba "Tabelas utilizadas", o aviso de tabela vencida e o selo do cabeçalho,
// sempre a partir de tabelas.js (a mesma fonte usada nos cálculos).
import { TABELAS, validarTabelas, tabelaVencida } from './tabelas.js';
import { calcularINSS } from './irpf-marginal.js';

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (v) => `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
const dataBR = (iso) => {
  const [a, m, d] = String(iso).split('-');
  return a && m && d ? `${d}/${m}/${a}` : iso;
};

function el(tag, classe, texto) {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texto != null) e.textContent = texto;
  return e;
}

function tabela(legenda, colunas, linhas) {
  const wrap = el('div', 'overflow-x-auto');
  const t = el('table', 'w-full text-sm text-left border border-slate-200 rounded-lg');
  t.appendChild(el('caption', 'text-left font-semibold text-slate-900 pb-2', legenda));

  const cabeca = el('thead', 'bg-slate-50 text-slate-700');
  const trh = el('tr');
  colunas.forEach((c) => {
    const th = el('th', 'px-3 py-2 font-semibold border-b border-slate-200', c);
    th.scope = 'col';
    trh.appendChild(th);
  });
  cabeca.appendChild(trh);
  t.appendChild(cabeca);

  const corpo = el('tbody');
  linhas.forEach((cels) => {
    const tr = el('tr', 'border-b border-slate-100 last:border-0');
    cels.forEach((c) => tr.appendChild(el('td', 'px-3 py-2 whitespace-nowrap', c)));
    corpo.appendChild(tr);
  });
  t.appendChild(corpo);
  wrap.appendChild(t);
  return wrap;
}

function descricaoFaixas(faixas) {
  let anterior = null;
  return faixas.map((f) => {
    const de = anterior == null ? null : anterior + 0.01;
    const texto = de == null
      ? `Até ${moeda.format(f.ate)}`
      : f.ate == null
        ? `Acima de ${moeda.format(anterior)}`
        : `${moeda.format(de)} a ${moeda.format(f.ate)}`;
    anterior = f.ate;
    return texto;
  });
}

function nota(texto) {
  return el('p', 'text-sm text-slate-600', texto);
}

function fonteLink(fonte) {
  const p = el('p', 'text-sm text-slate-600');
  p.append('Fonte: ');
  const a = el('a', 'text-indigo-700 underline hover:text-indigo-900', fonte.nome);
  a.href = fonte.url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  p.appendChild(a);
  return p;
}

function renderizarTabelas() {
  const alvo = document.getElementById('tabelas-conteudo');
  if (!alvo) return;
  alvo.textContent = '';
  alvo.className = 'space-y-6';

  const { inss, irrf } = TABELAS;
  const faixasInss = descricaoFaixas(inss.faixas);
  const faixasIrrf = descricaoFaixas(irrf.faixas);

  alvo.appendChild(el('p', 'text-sm text-slate-700',
    `Vigência: ${dataBR(TABELAS.vigenciaInicio)} a ${dataBR(TABELAS.vigenciaFim)}. Valores atualizados em ${dataBR(TABELAS.atualizadoEm)}.`));

  // INSS
  const blocoInss = el('div', 'space-y-2');
  blocoInss.appendChild(tabela(
    inss.titulo,
    ['Salário de contribuição', 'Alíquota'],
    inss.faixas.map((f, i) => [faixasInss[i], pct(f.aliquota)])
  ));
  blocoInss.appendChild(nota(
    `Teto do salário de contribuição: ${moeda.format(inss.teto)}. Contribuição máxima: ${moeda.format(calcularINSS(inss.teto))}. Cada alíquota incide só sobre a parcela dentro da faixa.`));
  blocoInss.appendChild(fonteLink(inss.fonte));
  alvo.appendChild(blocoInss);

  // IRRF
  const blocoIrrf = el('div', 'space-y-2');
  blocoIrrf.appendChild(tabela(
    irrf.titulo,
    ['Base de cálculo', 'Alíquota', 'Parcela a deduzir'],
    irrf.faixas.map((f, i) => [faixasIrrf[i], pct(f.aliquota), moeda.format(f.deduzir)])
  ));
  const r = irrf.redutor;
  blocoIrrf.appendChild(nota(
    `Base de cálculo = rendimento bruto menos a previdência (ou o desconto simplificado de ${moeda.format(irrf.descontoSimplificado)}, o que for mais vantajoso). Dedução por dependente: ${moeda.format(irrf.deducaoDependente)}.`));
  blocoIrrf.appendChild(nota(
    `Redução da Lei 15.270/2025, sobre o imposto calculado: para rendimento bruto até ${moeda.format(r.isencaoAte)}, reduz até ${moeda.format(r.maximo)} (zerando o imposto); de ${moeda.format(r.isencaoAte + 0.01)} a ${moeda.format(r.fimFaixa)}, reduz ${moeda.format(r.constante)} menos ${r.coeficiente.toLocaleString('pt-BR', { maximumFractionDigits: 6 })} vezes o rendimento; acima disso, não há redução.`));
  blocoIrrf.appendChild(fonteLink(irrf.fonte));
  alvo.appendChild(blocoIrrf);
}

function atualizarAvisosDeVigencia() {
  const vencida = tabelaVencida();

  // Selo do cabeçalho
  const selo = document.getElementById('selo-tabelas');
  if (selo) {
    selo.textContent = vencida
      ? `Tabelas de ${TABELAS.ano} · podem estar desatualizadas`
      : `Tabelas de ${TABELAS.ano} · ver fontes`;
    if (vencida) {
      selo.classList.remove('bg-emerald-950', 'text-emerald-300', 'border-emerald-700', 'hover:bg-emerald-900');
      selo.classList.add('bg-amber-950', 'text-amber-200', 'border-amber-600', 'hover:bg-amber-900');
    }
  }

  // Título da seção
  const titulo = document.getElementById('titulo-tabelas');
  if (titulo) titulo.textContent = `Tabelas utilizadas (INSS e IRRF de ${TABELAS.ano})`;

  // Banner de tabela vencida
  const aviso = document.getElementById('aviso-tabelas');
  if (aviso) {
    if (vencida) {
      aviso.textContent = '';
      aviso.append(`As tabelas usadas nos cálculos são de ${TABELAS.ano} e podem estar desatualizadas. Confira os valores nas `);
      const a = el('a', 'font-semibold underline', 'fontes oficiais');
      a.href = '#tabelas-referencia';
      aviso.appendChild(a);
      aviso.append(' antes de tomar uma decisão.');
      aviso.hidden = false;
    } else {
      aviso.hidden = true;
    }
  }
}

function iniciar() {
  const problemas = validarTabelas();
  if (problemas.length) console.warn('[tabelas] inconsistências:', problemas);
  renderizarTabelas();
  atualizarAvisosDeVigencia();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
}