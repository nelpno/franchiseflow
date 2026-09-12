/**
 * Etapa 5 "Como o robô vai responder" (plano de frete 12/09/2026, Fase 5c). Funções puras.
 *
 * As respostas de frete saem do mesmo motor do robô (cotaFrete.gen.js) aplicado ao cadastro da tela:
 *   - unidade no frete calculado: é exatamente a conta que o robô faz;
 *   - unidade no frete por texto: é o que o robô deve responder lendo a tabela dela (lá ele faz a conta a
 *     partir do texto das faixas; aqui ela sai pronta).
 * Os cenários usam datas reais a partir de hoje (o próximo dia de cada grupo), para a franqueada reconhecer
 * a semana dela. Unidade com frete em texto livre ("por modalidade") não tem simulação de frete: não dá para
 * saber como o robô vai ler cada linha — é justamente o problema daquele formato.
 */
import { cotarFrete } from "./cotaFrete.gen.js";
import {
  modoDoFrete, legadoParaModelo, limparPricing, horaCurta, dinheiro, diasPorExtenso, minutosDe, numero, preenchido,
} from "./freteModelo.js";
import { LEGACY_PAYMENT_MAP } from "./franchiseUtils.js";

const DOW = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];
const NOME = { seg: "segunda", ter: "terça", qua: "quarta", qui: "quinta", sex: "sexta", sab: "sábado", dom: "domingo" };
const PAGAMENTO = { pix: "Pix", credit: "crédito", debit: "débito", nfc: "aproximação (NFC)", payment_link: "link de pagamento",
  meal_voucher: "vale-refeição", cash: "dinheiro" };

const ABREV = { seg: "Seg", ter: "Ter", qua: "Qua", qui: "Qui", sex: "Sex", sab: "Sáb", dom: "Dom" };

/** Data e hora de agora em São Paulo, qualquer que seja o fuso do aparelho. */
export function agoraSaoPaulo() {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { data: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}` };
}

/** "Seg 14/09" */
export function rotuloCurto(iso) {
  return `${ABREV[diaDaSemana(iso)]} ${iso.slice(8)}/${iso.slice(5, 7)}`;
}

export function somaDias(iso, n) {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}
function diaDaSemana(iso) {
  const [a, m, d] = iso.split("-").map(Number);
  return DOW[new Date(Date.UTC(a, m - 1, d)).getUTCDay()];
}
function proximaData(desde, dia) {
  for (let i = 0; i < 7; i++) {
    const d = somaDias(desde, i);
    if (diaDaSemana(d) === dia) return d;
  }
  return desde;
}
function rotuloData(iso) {
  const [, m, d] = iso.split("-");
  const n = NOME[diaDaSemana(iso)];
  return `${n.charAt(0).toUpperCase()}${n.slice(1)}, ${d}/${m}`;
}
const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const kmTexto = (km) => String(km).replace(".", ",");

// "na Vila Nova", "no Jardim Acapulco", "na Maré Mansa": o artigo sai da primeira palavra do bairro
const FEMININOS = new Set(["vila", "praia", "prainha", "chacara", "ilha", "fazenda", "estancia", "colonia", "cidade", "enseada",
  "pedreira", "baixada", "lagoa", "ponta", "barra", "serra", "varzea", "mare", "rua", "avenida", "aldeia", "granja", "quinta",
  "represa", "ribeira", "comunidade", "regiao", "zona", "area", "estrada", "rodovia", "capela"]);
export function preposicaoBairro(nome) {
  const primeira = String(nome || "").trim().split(/\s+/)[0].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return FEMININOS.has(primeira) ? "na" : "no";
}
const juntar = (xs) => (xs.length <= 1 ? xs[0] || "" : `${xs.slice(0, -1).join(", ")} e ${xs.at(-1)}`);

/** O modelo que a simulação usa, ou null quando o frete está em texto livre. */
export function modeloDaSimulacao(form) {
  const modo = modoDoFrete(form);
  if (modo === "estruturado") return limparPricing(form.delivery_pricing);
  if (modo === "simples") return limparPricing(legadoParaModelo(form));
  return null;
}

function amostraKm(modelo) {
  const t = modelo.grupos[0]?.tipos?.[0];
  const faixas = t?.taxa?.modo === "faixas" ? t.taxa.faixas : [];
  if (faixas.length) return Math.max(1, faixas[0].ate > 1 ? faixas[0].ate - 0.5 : faixas[0].ate);
  const raio = numero(modelo.raio_km);
  return raio ? Math.min(3, raio) : 3;
}

function falaOpcao(o, comNome) {
  const preco = o.taxa === 0 ? "sem taxa" : `por ${dinheiro(o.taxa)}`;
  const chega = /^em até/.test(o.prazo) ? `, que chega ${o.prazo.replace(/ depois de confirmado$/, "")}` : "";
  return `${comNome ? `na ${String(o.tipo).toLowerCase()}, ` : ""}das ${o.janela}${chega}, ${preco}`;
}
function falaOpcoes(opcoes) {
  if (opcoes.length <= 1) return opcoes[0] ? falaOpcao(opcoes[0], false) : "";
  return opcoes.map((o) => falaOpcao(o, true)).join(", ou ");
}
function janelasTexto(grupo) {
  const partes = (grupo.tipos || []).filter((t) => preenchido(t.inicio) && preenchido(t.fim))
    .map((t) => `${(grupo.tipos || []).length > 1 ? `${String(t.nome).toLowerCase()} ` : ""}das ${horaCurta(t.inicio)} às ${horaCurta(t.fim)}`);
  return juntar(partes);
}

function nomesPagamento(lista) {
  const valores = [...new Set((lista || []).flatMap((v) => LEGACY_PAYMENT_MAP[v] || [v]))];
  return juntar(valores.map((v) => PAGAMENTO[v] || v));
}

/**
 * @param {object} form cadastro da tela (formData)
 * @param {string} hoje 'AAAA-MM-DD' (hora de São Paulo)
 * @returns {{rotulo: string, tag?: string, pergunta: string, resposta: string}[]}
 */
export function montarSimulacoes(form, hoje) {
  const itens = [];
  const temEntrega = form?.has_delivery !== false;
  const temRetirada = !!form?.has_pickup;
  const ofereceRetirada = temRetirada ? " Se quiser, você pode retirar aqui com a gente." : "";
  const modelo = temEntrega ? modeloDaSimulacao(form) : null;
  const grupos = (modelo?.grupos || []).filter((g) => (g.dias || []).length &&
    (g.tipos || []).some((t) => preenchido(t.inicio) && preenchido(t.fim)));

  if (modelo && grupos.length) {
    const pricing = { ...modelo, grupos };
    const raio = numero(pricing.raio_km);
    const km = amostraKm(pricing);

    itens.push({
      rotulo: "Pergunta geral",
      pergunta: "Vocês entregam?",
      resposta: `Entregamos sim! ${grupos.map((g) => `${diasPorExtenso(g.dias)}, ${janelasTexto(g)}`).join(". ")}.${raio ? ` Atendemos até ${kmTexto(raio)} km daqui.` : ""}`,
    });

    // mesmo dia, antes do limite de pedidos
    const g0 = grupos[0];
    const d0 = proximaData(hoje, g0.dias[0]);
    const limite0 = Math.min(...g0.tipos.map((t) => minutosDe(t.corte) ?? minutosDe(t.fim)).filter((x) => x !== null));
    const hora0 = hhmm(Math.max(8 * 60, limite0 - 120));
    const r0 = cotarFrete(pricing, { bairro_cliente: "Centro", km }, { data: d0, hora: hora0 }, { dataEntrega: d0 });
    if (r0?.estado === "ok" && r0.data_pedida?.opcoes?.length) {
      itens.push({
        rotulo: `${rotuloData(d0)}, ${horaCurta(hora0)} · entrega no mesmo dia`,
        tag: `cliente a ${kmTexto(km)} km`,
        pergunta: "Quanto fica o frete? Quero receber hoje.",
        resposta: `Hoje dá para receber ${falaOpcoes(r0.data_pedida.opcoes)}.`,
      });
    }

    // os outros grupos de dias: o cliente pede na véspera, à noite
    for (const g of grupos.slice(1, 3)) {
      const d = proximaData(somaDias(hoje, 1), g.dias[0]);
      const vespera = somaDias(d, -1);
      const r = cotarFrete(pricing, { bairro_cliente: "Centro", km }, { data: vespera, hora: "18:30" }, { dataEntrega: d });
      if (r?.estado !== "ok" || !r.data_pedida?.opcoes?.length) continue;
      const nomeDia = NOME[diaDaSemana(d)];
      itens.push({
        rotulo: `${rotuloData(vespera)}, 18h30 · pede para amanhã`,
        tag: `Tabela de ${nomeDia}`,
        pergunta: `Vocês entregam amanhã, ${nomeDia}?`,
        resposta: `Entregamos sim! Amanhã, ${nomeDia}, a entrega fica ${falaOpcoes(r.data_pedida.opcoes)}.`,
      });
    }

    // bairros com taxa própria (frete calculado)
    for (const z of (pricing.zonas || []).slice(0, 2)) {
      const nome = z.nomes?.[0];
      if (!nome) continue;
      const prep = preposicaoBairro(nome);
      const Prep = prep === "na" ? "Na" : "No";
      const r = cotarFrete(pricing, { bairro_cliente: nome, km }, { data: d0, hora: hora0 }, { dataEntrega: d0 });
      if (r?.estado === "fora_da_area") {
        itens.push({ rotulo: "Bairro onde não entrega", pergunta: `Vocês entregam ${prep} ${nome}?`, resposta: `${Prep} ${nome} a gente não entrega.${ofereceRetirada}` });
      } else if (r?.estado === "ok") {
        const ops = r.data_pedida?.opcoes?.length ? r.data_pedida.opcoes : r.grupos[0]?.opcoes || [];
        const janelas = ops.map((o) => `das ${o.janela}${/^em até/.test(o.prazo) ? ` (${o.prazo.replace(/ depois de confirmado$/, "")})` : ""}`);
        itens.push({
          rotulo: "Bairro com taxa própria",
          tag: "Mesmo valor em qualquer horário",
          pergunta: `Vocês entregam ${prep} ${nome}?`,
          resposta: `Entregamos! ${Prep} ${nome} a entrega é ${dinheiro(z.valor)} em qualquer horário${janelas.length ? `: ${janelas.join(" ou ")}` : ""}.`,
        });
      }
    }

    // depois do limite de pedidos: vai para o próximo dia de entrega
    const gc = grupos.find((g) => g.tipos.some((t) => preenchido(t.corte)));
    if (gc) {
      const corte = Math.max(...gc.tipos.map((t) => minutosDe(t.corte) ?? minutosDe(t.fim)).filter((x) => x !== null));
      if (corte + 20 < 24 * 60) {
        const dc = proximaData(hoje, gc.dias[0]);
        const hora = hhmm(corte + 20);
        let dn = null;
        for (let i = 1; i <= 7 && !dn; i++) {
          const d = somaDias(dc, i);
          if (grupos.some((g) => g.dias.includes(diaDaSemana(d)))) dn = d;
        }
        const r = dn && cotarFrete(pricing, { bairro_cliente: "Centro", km }, { data: dc, hora }, { dataEntrega: dn });
        if (r?.estado === "ok" && !r.hoje?.ainda_da_para?.length && r.data_pedida?.opcoes?.length) {
          const quando = dn === somaDias(dc, 1) ? `amanhã, ${NOME[diaDaSemana(dn)]}` : `na ${NOME[diaDaSemana(dn)]} (${dn.slice(8)}/${dn.slice(5, 7)})`;
          itens.push({
            rotulo: `${rotuloData(dc)}, ${horaCurta(hora)} · depois do horário de pedidos`,
            tag: "Vai para o próximo dia",
            pergunta: "Consigo receber ainda hoje?",
            resposta: `Hoje os pedidos fecharam às ${horaCurta(hhmm(corte))}. Já anoto para você receber ${quando}, ${falaOpcoes(r.data_pedida.opcoes)}.`,
          });
        }
      }
    }

    // fora do raio
    if (raio) {
      const kmFora = raio + 3;
      const r = cotarFrete(pricing, { bairro_cliente: "", km: kmFora }, { data: d0, hora: hora0 }, { dataEntrega: d0 });
      if (r?.estado === "fora_da_area") {
        itens.push({
          rotulo: "Fora da área",
          tag: `${kmTexto(kmFora)} km`,
          pergunta: `Vocês entregam num endereço a ${kmTexto(kmFora)} km daqui?`,
          resposta: `Esse endereço fica fora da nossa área de entrega: atendemos até ${kmTexto(raio)} km.${ofereceRetirada}`,
        });
      }
    }
  }

  // pagamento e retirada
  const endereco = form?.pickup_address || [form?.street_address, form?.neighborhood].filter(preenchido).join(", ");
  const partes = [];
  if (temEntrega && (form?.payment_delivery || []).length) partes.push(`Na entrega aceitamos ${nomesPagamento(form.payment_delivery)}.`);
  if (temRetirada && (form?.payment_pickup || []).length) partes.push(`Na retirada, ${nomesPagamento(form.payment_pickup)}.`);
  if (temRetirada) {
    const onde = endereco ? (form?.pickup_is_store ? ` na nossa loja, ${endereco}` : `, na ${endereco}`) : "";
    partes.push(form?.pickup_requires_scheduling !== false
      ? `Pode buscar sim, com horário combinado aqui pelo WhatsApp${onde}.`
      : `Pode buscar sim, é só vir no horário${onde}.`);
  } else if (temEntrega) {
    partes.push("Por enquanto a gente só faz entrega.");
  }
  if (partes.length) {
    itens.push({
      rotulo: "Pagamento e retirada",
      pergunta: temRetirada ? "Aceita cartão? Posso buscar aí?" : "Quais formas de pagamento vocês aceitam? Dá para buscar?",
      resposta: partes.join(" "),
    });
  }
  return itens;
}

/**
 * "Antes de ligar, confira": o que a tela sabe sobre como o robô vai se comportar + o que falta.
 * @returns {{tipo: "erro"|"aviso"|"ok"|"info", texto: string}[]}
 */
export function montarConferencias(form, { erros = [], avisos = [] } = {}) {
  const out = [];
  for (const e of erros) out.push({ tipo: "erro", texto: e });
  for (const a of avisos) out.push({ tipo: "aviso", texto: a });
  const temEntrega = form?.has_delivery !== false;
  const modo = modoDoFrete(form);
  if (temEntrega && modo === "modalidade") {
    out.push({ tipo: "aviso", texto: 'Seu frete está em texto livre ("por modalidade"): o robô interpreta cada linha e pode misturar. Peça ao suporte o frete novo, em que ele calcula sozinho.' });
  }
  const modelo = temEntrega ? modeloDaSimulacao(form) : null;
  if (modelo) {
    for (const g of modelo.grupos) {
      const tipos = g.tipos || [];
      const comMin = tipos.filter((t) => t.promessa === "minutos" && numero(t.minutos) > 0);
      if (tipos.length > 1 && comMin.length && comMin.length < tipos.length) {
        const semMin = tipos.filter((t) => !comMin.includes(t)).map((t) => `a ${String(t.nome).toLowerCase()}`);
        out.push({ tipo: "ok", texto: `${diasPorExtenso(g.dias)}: o prazo em minutos aparece só na ${comMin.map((t) => String(t.nome).toLowerCase()).join(" e na ")}; ${juntar(semMin)} fala só da janela.` });
      }
    }
    if (modo === "simples") {
      const t = modelo.grupos.flatMap((g) => g.tipos || []).find((x) => x.promessa === "minutos" && numero(x.minutos) > 0);
      out.push({ tipo: "ok", texto: t ? `O robô promete a entrega "em até ${numero(t.minutos)} min" depois de confirmado.` : "O robô fala só da janela de entrega, sem prometer hora marcada." });
    }
    if ((modelo.zonas || []).length) out.push({ tipo: "ok", texto: "Os bairros com taxa própria valem em qualquer dia e em qualquer tipo de entrega." });
    for (const g of modelo.grupos) {
      const cortes = [...new Set((g.tipos || []).map((t) => t.corte).filter(preenchido))];
      if (cortes.length) out.push({ tipo: "info", texto: `${diasPorExtenso(g.dias)}: pedidos até as ${cortes.map(horaCurta).join(" / ")}. Depois disso, fica para o próximo dia de entrega.` });
    }
  }
  if (!form?.catalog_image_url) out.push({ tipo: "aviso", texto: "Sem catálogo: o robô não tem o cardápio para mandar ao cliente (etapa 4)." });
  return out;
}
