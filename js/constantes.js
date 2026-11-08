// js/constantes.js
// Constantes compartilhadas. Um único lugar para ajustar premissas.

// Semanas usadas para converter "aulas por semana" em remuneração mensal.
// Na CLT, 4,5 é o divisor da Súmula 351 do TST (mês de 4,5 semanas + 1/6 de DSR).
export const SEMANAS_PAGAMENTO = 4.5;

// Semanas efetivamente trabalhadas no mês (descontando feriados/recessos).
// Usada para deslocamento (combustível) e para horas reais trabalhadas.
export const SEMANAS_TRABALHADAS = 4.2;