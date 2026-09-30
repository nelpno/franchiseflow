// Vendas por produto num período de data a data (Gestão › Resultado › Ver todos os produtos).
// Pedido de Bragança (30/09/2026): "incluir a opção de gerar a saída da consulta por período x
// data" — até então a lista era só do mês do Resultado. Aqui ficam as regras puras do período;
// a busca fica em TabResultado (mesma régua do mês: vendas por sale_date, itens pelo sale_id).

export const PERIODO_MAX_DIAS = 366;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const DIA_MS = 86400000;
const utc = (iso) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));

/** Primeiro e último dia ('yyyy-MM-dd') do mês 'yyyy-MM'. */
export function limitesDoMes(chave) {
  if (!/^\d{4}-\d{2}$/.test(String(chave ?? ""))) return { de: "", ate: "" };
  const ano = Number(chave.slice(0, 4));
  const mes = Number(chave.slice(5, 7));
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return { de: `${chave}-01`, ate: `${chave}-${String(ultimo).padStart(2, "0")}` };
}

/** Mensagem para a tela quando o período não serve; null quando está certo. */
export function validarPeriodo(de, ate) {
  if (!ISO.test(String(de ?? "")) || !ISO.test(String(ate ?? ""))) return "Escolha as duas datas.";
  if (de > ate) return "A data inicial vem antes da final.";
  if ((utc(ate) - utc(de)) / DIA_MS + 1 > PERIODO_MAX_DIAS) return "Escolha um período de até 1 ano.";
  return null;
}

const br = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

/** "01/09/2026 a 15/09/2026" (um dia só: "15/09/2026"). */
export function rotuloPeriodo(de, ate) {
  if (!ISO.test(String(de ?? "")) || !ISO.test(String(ate ?? ""))) return "";
  return de === ate ? br(de) : `${br(de)} a ${br(ate)}`;
}
