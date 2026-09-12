/**
 * Cartão "Entrega" do Meu Vendedor (plano de frete 12/09/2026, Fase 5b). Funções puras, sem React.
 *
 * O cartão edita um MODELO no formato do delivery_pricing, que é o que o motor do robô lê:
 *   { versao: 1, raio_km, zonas: [{ nomes, valor, nao_atende }],
 *     grupos: [{ dias, tipos: [{ nome, inicio, fim, corte, promessa: "janela"|"minutos", minutos, taxa }] }] }
 *   taxa = { modo: "fixa", valor }  (valor 0 = grátis)  |  { modo: "faixas", faixas: [{ ate, valor }] }
 *
 * Três situações (modoDoFrete):
 *   "estruturado" — a unidade já está no frete calculado (delivery_pricing preenchido). O modelo É o
 *                   delivery_pricing; os campos antigos saem dele só para o horário do robô (Customer
 *                   Context), a venda manual e o texto das janelas.
 *   "simples"     — frete por faixa de km ou valor único (51 unidades em 12/09). O modelo nasce dos campos
 *                   antigos e volta para eles ao salvar: o robô continua lendo o texto das faixas, como antes.
 *                   Um tipo por grupo de dias e sem bairro com taxa própria (o texto antigo não expressa isso).
 *   "modalidade"  — frete em texto livre ("por modalidade"). Fica no editor antigo até o suporte passar para
 *                   o formato novo com a franqueada: texto livre não vira regra sem alguém confirmar.
 */
import { rotuloDias } from "./configSave.js";

const ORDEM = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"];
const NOME_DIA = { seg: "segunda", ter: "terça", qua: "quarta", qui: "quinta", sex: "sexta", sab: "sábado", dom: "domingo" };

export const preenchido = (v) => v !== null && v !== undefined && String(v).trim() !== "";
export function numero(v) {
  if (!preenchido(v)) return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
export function minutosDe(hhmm) {
  const m = String(hhmm || "").match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
export const ordenarDias = (dias) => ORDEM.filter((d) => (dias || []).includes(d));

const ehObjetoModalidade = (feeRules) => !!feeRules && !Array.isArray(feeRules) && typeof feeRules === "object";
export const ehGratis = (taxa) => taxa?.modo === "fixa" && numero(taxa.valor) === 0;

/** "estruturado" | "simples" | "modalidade" — ver o cabeçalho. */
export function modoDoFrete(form) {
  const p = form?.delivery_pricing;
  if (p && typeof p === "object" && Array.isArray(p.grupos)) return "estruturado";
  const grupos = Array.isArray(form?.delivery_schedule) ? form.delivery_schedule : [];
  if (grupos.some((g) => g?.charges_fee !== false && ehObjetoModalidade(g?.fee_rules))) return "modalidade";
  return "simples";
}

// ---------------------------------------------------------------- campos antigos -> modelo (modo simples)

function taxaDoLegado(grupo, raio) {
  if (grupo?.charges_fee === false) return { modo: "fixa", valor: 0 };
  const linhas = Array.isArray(grupo?.fee_rules) ? grupo.fee_rules : [];
  // uma faixa só, que cobre o raio inteiro, é valor único ("Até 10km: R$ 8,00"); sem raio, a de 60 km
  // (é a que a própria tela grava para o valor único quando o raio ainda está vazio)
  const km0 = numero(linhas[0]?.max_km);
  if (linhas.length === 1 && km0 !== null && km0 >= (raio || 60)) {
    return { modo: "fixa", valor: preenchido(linhas[0].fee) ? numero(linhas[0].fee) : "" };
  }
  const faixas = linhas.map((l) => ({
    ate: preenchido(l?.max_km) ? numero(l.max_km) : "",
    valor: preenchido(l?.fee) ? numero(l.fee) : "",
  }));
  return { modo: "faixas", faixas: faixas.length ? faixas : [{ ate: "", valor: "" }] };
}

/** Monta o modelo a partir de delivery_schedule, raio e prazo (unidade no frete por texto). */
export function legadoParaModelo(form) {
  const raio = numero(form?.max_delivery_radius_km);
  const prazo = numero(form?.avg_prep_time_minutes);
  const grupos = Array.isArray(form?.delivery_schedule) ? form.delivery_schedule : [];
  return {
    versao: 1,
    raio_km: raio,
    zonas: [],
    grupos: grupos.map((g) => ({
      dias: ordenarDias(g?.days),
      tipos: [{
        nome: "Entrega",
        inicio: g?.delivery_start || "",
        fim: g?.delivery_end || "",
        corte: g?.order_cutoff || "",
        promessa: prazo > 0 ? "minutos" : "janela",
        ...(prazo > 0 ? { minutos: prazo } : {}),
        taxa: taxaDoLegado(g, raio),
      }],
    })),
  };
}

// ---------------------------------------------------------------- modelo -> campos antigos

const valorTexto = (v) => (numero(v) === null ? "" : numero(v).toFixed(2));
const kmTexto = (v) => (numero(v) === null ? "" : String(numero(v)));
const porHora = (a, b) => minutosDe(a) - minutosDe(b);
const menorHora = (hs) => hs.filter(preenchido).sort(porHora)[0] || "";
const maiorHora = (hs) => hs.filter(preenchido).sort(porHora).at(-1) || "";

export function horaCurta(hhmm) {
  const m = String(hhmm || "").match(/^(\d{1,2}):(\d{2})/);
  if (!m) return "";
  return `${Number(m[1])}h${m[2] !== "00" ? m[2] : ""}`;
}
export function dinheiro(v) {
  const n = numero(v);
  if (n === null) return "";
  return Number.isInteger(n) ? `R$ ${n}` : `R$ ${n.toFixed(2).replace(".", ",")}`;
}
const kmBR = (v) => String(numero(v)).replace(".", ",");

function faixasValidas(taxa) {
  return (taxa?.faixas || [])
    .filter((f) => numero(f.ate) !== null && numero(f.valor) !== null)
    .sort((a, b) => numero(a.ate) - numero(b.ate));
}

function linhasSimples(taxa, raio) {
  if (taxa?.modo === "faixas") return (taxa.faixas || []).map((f) => ({ max_km: kmTexto(f.ate), fee: valorTexto(f.valor) }));
  // valor único: uma faixa até o raio (é assim que o robô lê "Até 10km: R$ 8,00")
  return [{ max_km: kmTexto(raio || 60), fee: valorTexto(taxa?.valor) }];
}

// Frete calculado: a lista antiga só serve à venda manual e ao histórico; o robô recebe o frete pronto.
function rotulosDoGrupo(grupo, zonas) {
  const rules = [];
  for (const t of grupo.tipos || []) {
    const nome = String(t.nome || "Entrega").trim();
    const janela = `${horaCurta(t.inicio)} às ${horaCurta(t.fim)}`;
    if (t.taxa?.modo === "faixas") {
      for (const f of faixasValidas(t.taxa)) rules.push({ label: `${nome} ${janela} - até ${kmBR(f.ate)} km`, fee: valorTexto(f.valor) });
    } else if (t.taxa?.modo === "fixa" && numero(t.taxa.valor) !== null) {
      rules.push({ label: ehGratis(t.taxa) ? `${nome} ${janela} (sem taxa)` : `${nome} ${janela}`, fee: valorTexto(t.taxa.valor) });
    }
  }
  for (const z of zonas || []) {
    if (z.nao_atende || numero(z.valor) === null) continue;
    for (const n of z.nomes || []) rules.push({ label: `Bairro ${n} (taxa fixa em qualquer janela)`, fee: valorTexto(z.valor) });
  }
  return { mode: "modality", rules };
}

/**
 * Campos antigos que saem do modelo. No modo simples eles SÃO o frete (o robô lê o texto das faixas);
 * no estruturado servem ao horário do robô, à venda manual e ao texto das janelas.
 */
export function modeloParaLegado(modelo, { estruturado = false } = {}) {
  const raio = numero(modelo?.raio_km);
  const delivery_schedule = (modelo?.grupos || []).map((g) => {
    const tipos = g.tipos || [];
    const cobra = !tipos.every((t) => ehGratis(t.taxa));
    const semCorte = tipos.every((t) => !preenchido(t.corte));
    return {
      days: ordenarDias(g.dias),
      delivery_start: menorHora(tipos.map((t) => t.inicio)),
      delivery_end: maiorHora(tipos.map((t) => t.fim)),
      order_cutoff: semCorte ? "" : maiorHora(tipos.map((t) => t.corte || t.fim)),
      charges_fee: cobra,
      fee_rules: !cobra ? [] : estruturado ? rotulosDoGrupo(g, modelo.zonas) : linhasSimples(tipos[0]?.taxa, raio),
    };
  });

  const out = {
    delivery_schedule,
    max_delivery_radius_km: raio,
    opening_hours: delivery_schedule.map((r) => `${r.days.join(",")}: ${r.delivery_start}-${r.delivery_end}`).join(" | "),
    working_days: [...new Set(delivery_schedule.flatMap((r) => r.days))].join(","),
  };
  if (delivery_schedule.length > 0) {
    out.charges_delivery_fee = delivery_schedule.some((r) => r.charges_fee !== false);
    if (estruturado) {
      const vistos = new Set();
      const rules = [];
      for (const r of delivery_schedule) {
        for (const rule of r.fee_rules?.rules || []) {
          const k = `${rule.label}|${rule.fee}`;
          if (!vistos.has(k)) { vistos.add(k); rules.push(rule); }
        }
      }
      out.delivery_fee_rules = { mode: "modality", rules };
    } else {
      out.delivery_fee_rules = delivery_schedule[0].fee_rules ?? [{ max_km: "", fee: "" }];
    }
  }
  if (!estruturado) {
    const comPrazo = (modelo?.grupos || []).flatMap((g) => g.tipos || []).find((t) => t.promessa === "minutos");
    out.avg_prep_time_minutes = comPrazo ? numero(comPrazo.minutos) : null;
  }
  return out;
}

// ---------------------------------------------------------------- limpeza para gravar o delivery_pricing

function limparTaxa(taxa) {
  if (taxa?.modo === "fixa") return { ...taxa, valor: numero(taxa.valor) };
  if (taxa?.modo === "faixas") {
    return { ...taxa, faixas: faixasValidas(taxa).map((f) => ({ ...f, ate: numero(f.ate), valor: numero(f.valor) })) };
  }
  return taxa ? { ...taxa } : { modo: "fixa", valor: null };
}

function limparTipo(t) {
  const out = { ...t, nome: String(t.nome || "").trim() || "Entrega", inicio: t.inicio || "", fim: t.fim || "" };
  if (preenchido(t.corte)) out.corte = t.corte;
  else delete out.corte;
  if (t.promessa === "minutos") {
    out.promessa = "minutos";
    out.minutos = numero(t.minutos);
  } else {
    out.promessa = "janela";
    delete out.minutos;
  }
  out.taxa = limparTaxa(t.taxa);
  return out;
}

function limparZona(z) {
  const out = { ...z, nomes: [...new Set((z.nomes || []).map((n) => String(n).trim()).filter(Boolean))] };
  if (z.nao_atende) out.nao_atende = true;
  else delete out.nao_atende;
  if (preenchido(z.valor)) out.valor = numero(z.valor);
  else if (!z.nao_atende) out.valor = null;
  else delete out.valor;
  return out;
}

/**
 * O que vai ao banco a partir do modelo que a tela edita (tira linha em branco, "10,50" vira 10.5,
 * corte vazio some). Chaves que a tela não conhece (regra especial do suporte) passam intactas.
 * Idempotente: limpar o que veio do banco devolve o mesmo valor.
 */
export function limparPricing(p) {
  if (!p || typeof p !== "object" || !Array.isArray(p.grupos)) return p ?? null;
  return {
    ...p,
    versao: p.versao || 1,
    raio_km: numero(p.raio_km),
    grupos: p.grupos.map((g) => ({ ...g, dias: ordenarDias(g.dias), tipos: (g.tipos || []).map(limparTipo) })),
    zonas: (p.zonas || []).map(limparZona).filter((z) => z.nomes.length > 0),
  };
}

// ---------------------------------------------------------------- o que impede salvar

function rotuloTipo(grupo, tipo) {
  const dias = rotuloDias(grupo.dias);
  return (grupo.tipos || []).length > 1 ? `${dias} (${String(tipo.nome || "tipo sem nome").trim()})` : dias;
}

/**
 * Problemas do cartão, cada um com a chave do campo a marcar em vermelho.
 * @returns {{chave: string, msg: string}[]}
 */
export function problemasDoModelo(modelo, { estruturado = false } = {}) {
  const out = [];
  (modelo?.grupos || []).forEach((g, gi) => {
    if (!(g.dias || []).length) return;
    const nomes = new Set();
    (g.tipos || []).forEach((t, ti) => {
      const k = `g${gi}.t${ti}`;
      const rot = rotuloTipo(g, t);
      if (estruturado && (g.tipos || []).length > 1) {
        const nome = String(t.nome || "").trim().toLowerCase();
        if (!nome) out.push({ chave: `${k}.nome`, msg: `${rotuloDias(g.dias)}: dê um nome a cada tipo de entrega (ex.: Programada, Imediata).` });
        else if (nomes.has(nome)) out.push({ chave: `${k}.nome`, msg: `${rotuloDias(g.dias)}: dois tipos com o nome "${t.nome}".` });
        nomes.add(nome);
      }
      const ini = minutosDe(t.inicio), fim = minutosDe(t.fim), corte = minutosDe(t.corte);
      if (ini === null || fim === null) out.push({ chave: `${k}.janela`, msg: `${rot}: preencha a janela de entrega (das __ às __).` });
      else if (ini >= fim) out.push({ chave: `${k}.janela`, msg: `${rot}: a entrega termina (${t.fim}) antes de começar (${t.inicio}).` });
      if (corte !== null && fim !== null && corte > fim) {
        out.push({ chave: `${k}.corte`, msg: `${rot}: o limite de pedidos (${t.corte}) passa do fim da entrega (${t.fim}).` });
      }
      const taxa = t.taxa || {};
      if (taxa.modo === "fixa" && numero(taxa.valor) === null) out.push({ chave: `${k}.taxa`, msg: `${rot}: falta o valor da taxa.` });
      if (taxa.modo === "faixas") {
        const faixas = taxa.faixas || [];
        faixas.forEach((f, fi) => {
          const temKm = preenchido(f.ate), temValor = preenchido(f.valor);
          if (temKm !== temValor) {
            out.push({ chave: `${k}.faixa${fi}`, msg: `${rot}, faixa ${fi + 1}: falta ${temKm ? "o valor" : "o km"}.` });
          }
        });
        if (!faixasValidas(taxa).length && !faixas.some((f) => preenchido(f.ate) !== preenchido(f.valor))) {
          out.push({ chave: `${k}.taxa`, msg: `${rot}: preencha ao menos uma faixa de km com o valor.` });
        }
      }
      if (t.promessa === "minutos" && !(numero(t.minutos) > 0)) {
        out.push({ chave: `${k}.minutos`, msg: `${rot}: diga em até quantos minutos a entrega chega.` });
      }
    });
  });
  if (estruturado) {
    const vistos = new Map();
    (modelo?.zonas || []).forEach((z, zi) => {
      const nomes = (z.nomes || []).map((n) => String(n).trim()).filter(Boolean);
      if (!nomes.length) out.push({ chave: `z${zi}.nomes`, msg: `Bairros com taxa diferente, linha ${zi + 1}: falta o nome do bairro.` });
      if (!z.nao_atende && numero(z.valor) === null) out.push({ chave: `z${zi}.valor`, msg: `Bairros com taxa diferente, linha ${zi + 1}: falta o valor.` });
      for (const n of nomes) {
        const key = n.toLowerCase();
        if (vistos.has(key) && vistos.get(key) !== zi) out.push({ chave: `z${zi}.nomes`, msg: `O bairro ${n} está em duas linhas de "Bairros com taxa diferente".` });
        vistos.set(key, zi);
      }
    });
  }
  return out;
}

// ---------------------------------------------------------------- frases para a franqueada

export function diasPorExtenso(dias) {
  const d = ordenarDias(dias);
  if (d.length === 7) return "Todos os dias";
  if (d.length === 1) return `${d[0] === "sab" || d[0] === "dom" ? "No" : "Na"} ${NOME_DIA[d[0]]}`;
  const idx = d.map((x) => ORDEM.indexOf(x));
  const seguidos = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
  if (d.length >= 3 && seguidos) return `De ${NOME_DIA[d[0]]} a ${NOME_DIA[d[d.length - 1]]}`;
  const nomes = d.map((x) => NOME_DIA[x]);
  const lista = `${nomes.slice(0, -1).join(", ")} e ${nomes.at(-1)}`;
  return lista.charAt(0).toUpperCase() + lista.slice(1);
}

export function textoTaxa(taxa) {
  if (ehGratis(taxa)) return "sem taxa";
  if (taxa?.modo === "fixa") return numero(taxa.valor) === null ? "taxa a definir" : `por ${dinheiro(taxa.valor)}`;
  if (taxa?.modo === "faixas") {
    const f = faixasValidas(taxa);
    if (!f.length) return "taxa a definir";
    const partes = f.map((x) => `${dinheiro(x.valor)} até ${kmBR(x.ate)} km`);
    return `por ${partes.length > 1 ? `${partes.slice(0, -1).join(", ")} e ${partes.at(-1)}` : partes[0]}`;
  }
  return "taxa que a unidade confirma";
}

/** "O vendedor vai dizer": a regra do grupo de dias em uma frase. */
export function fraseDoGrupo(grupo) {
  const tipos = (grupo?.tipos || []).filter((t) => preenchido(t.inicio) && preenchido(t.fim));
  if (!(grupo?.dias || []).length || !tipos.length) return "";
  const prazo = (t) => (t.promessa === "minutos" && numero(t.minutos) > 0 ? `, que chega em até ${numero(t.minutos)} min` : "");
  const janela = (t) => `das ${horaCurta(t.inicio)} às ${horaCurta(t.fim)}`;
  let corpo;
  if (tipos.length === 1) {
    const t = tipos[0];
    corpo = `entregamos ${janela(t)}${t.promessa === "minutos" && numero(t.minutos) > 0 ? `, em até ${numero(t.minutos)} min depois de confirmado` : ", dentro da janela, sem hora marcada"}, ${textoTaxa(t.taxa)}`;
  } else {
    const partes = tipos.map((t) => `a ${String(t.nome || "entrega").trim().toLowerCase()}, ${janela(t)}${prazo(t)}, ${textoTaxa(t.taxa)}`);
    corpo = `tem ${partes.slice(0, -1).join("; ")} e ${partes.at(-1)}`;
  }
  const cortes = [...new Set(tipos.map((t) => t.corte).filter(preenchido))];
  const corte = cortes.length === 1 ? ` Pedidos até as ${horaCurta(cortes[0])}.` : "";
  return `${diasPorExtenso(grupo.dias)}, ${corpo}.${corte}`;
}

// ---------------------------------------------------------------- ajudas da tela

export function diasLivres(modelo) {
  const usados = new Set((modelo?.grupos || []).flatMap((g) => g.dias || []));
  return ORDEM.filter((d) => !usados.has(d));
}

/** Tipo novo (segunda opção no mesmo dia, só no frete calculado). */
export function novoTipo(base) {
  return { nome: "", inicio: base?.inicio || "10:00", fim: base?.fim || "18:00", corte: "", promessa: "janela", taxa: { modo: "fixa", valor: "" } };
}

/** Grupo novo com os dias livres que sobraram, copiando a taxa do primeiro grupo. */
export function novoGrupo(modelo) {
  const livres = diasLivres(modelo);
  if (!livres.length) return null;
  const t0 = modelo?.grupos?.[0]?.tipos?.[0];
  return {
    dias: [livres[0]],
    tipos: [{
      nome: "Entrega", inicio: "09:00", fim: "14:00", corte: "",
      promessa: t0?.promessa === "minutos" ? "minutos" : "janela",
      ...(t0?.promessa === "minutos" ? { minutos: t0.minutos } : {}),
      taxa: t0?.taxa ? JSON.parse(JSON.stringify(t0.taxa)) : { modo: "faixas", faixas: [{ ate: "", valor: "" }] },
    }],
  };
}

/** Modelo inicial de quem ainda não tem horário de entrega salvo. */
export function modeloInicial(raio) {
  return {
    versao: 1, raio_km: numero(raio), zonas: [],
    grupos: [{ dias: ["seg", "ter", "qua", "qui", "sex", "sab"], tipos: [{ nome: "Entrega", inicio: "09:00", fim: "18:00", corte: "", promessa: "janela", taxa: { modo: "faixas", faixas: [{ ate: "", valor: "" }] } }] }],
  };
}
