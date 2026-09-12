import { useMemo, useRef, useState } from "react";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { WEEKDAYS } from "@/lib/franchiseUtils";
import { rotuloDias } from "@/lib/configSave";
import { diasLivres, novoGrupo, novoTipo, fraseDoGrupo, ehGratis, numero, preenchido, limparPricing, dinheiro } from "@/lib/freteModelo";
import { agoraSaoPaulo, somaDias, rotuloCurto } from "@/lib/simulacoesRobo";
import { cotarFrete } from "@/lib/cotaFrete.gen";

// Cartão "Entrega" do Meu Vendedor (plano de frete 12/09/2026, Fase 5b). Edita o modelo de lib/freteModelo.js;
// quem converte para o banco é a página. `estruturado` = unidade no frete calculado (tipos e bairros liberados).

const campo = "bg-surface-line border-none rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/20";
const erroRing = " ring-2 ring-red-400";
const rotulo = "block text-xs font-semibold text-[#3d4a42] mb-1.5";
const dica = "text-[11px] text-[#3d4a42]/60 mt-1";

const HORAS = Array.from({ length: 38 }, (_, i) => {
  const m = 5 * 60 + i * 30;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${m % 60 === 0 ? "00" : "30"}`;
});
const opcoesHora = (valor) => (valor && !HORAS.includes(valor) ? [...HORAS, valor].sort() : HORAS);
const pill = (ativo) =>
  `px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${ativo ? "bg-brand text-white" : "bg-surface-line text-[#3d4a42]/70 hover:bg-[#ddd]"}`;

function SelectHora({ value, onChange, invalido, ariaLabel }) {
  return (
    <select aria-label={ariaLabel} className={`${campo} w-[5.75rem] text-center font-mono${invalido ? erroRing : ""}`}
      value={value || ""} onChange={(e) => onChange(e.target.value)}>
      <option value="">--:--</option>
      {opcoesHora(value).map((h) => <option key={h} value={h}>{h}</option>)}
    </select>
  );
}

function Dinheiro({ value, onChange, invalido, placeholder = "0,00", ariaLabel }) {
  return (
    <div className={`flex items-center gap-1.5 ${campo} w-28 shrink-0${invalido ? erroRing : ""}`}>
      <span className="text-xs text-[#3d4a42]/60">R$</span>
      <input aria-label={ariaLabel} type="number" inputMode="decimal" step="0.5" min="0" value={value ?? ""}
        onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full min-w-0 bg-transparent outline-none font-mono" />
    </div>
  );
}

function Taxa({ taxa, onChange, marcas, prefixo }) {
  const modo = ehGratis(taxa) ? "gratis" : taxa?.modo === "faixas" ? "faixas" : taxa?.modo === "fixa" ? "fixa" : "outro";
  // "outro" = regra especial cadastrada pelo suporte (R$/km com valor do pedido, bairro fora da lista...): a tela mostra
  // o texto e deixa trocar por uma das três opções.
  const faixas = taxa?.faixas?.length ? taxa.faixas : [{ ate: "", valor: "" }];
  const semNenhuma = marcas.has(`${prefixo}.taxa`);
  const setFaixa = (i, k, v) => onChange({ modo: "faixas", faixas: faixas.map((f, j) => (j === i ? { ...f, [k]: v } : f)) });
  // O que estava em cada opção antes da troca: voltar para ela devolve as faixas ou o valor. Antes voltava em
  // branco, e só olhar "Grátis" apagava a tabela inteira (Tatuapé, 7 faixas, 12/09). Vale enquanto a tela está
  // aberta; o que vai para o banco continua sendo só a opção escolhida na hora de salvar.
  const antes = useRef({});
  const trocar = (novo, emBranco) => {
    if (modo === novo) return;
    antes.current[modo] = taxa;
    onChange(antes.current[novo] || emBranco);
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        <button type="button" className={pill(modo === "fixa")} onClick={() => trocar("fixa", { modo: "fixa", valor: "" })}>Valor único</button>
        <button type="button" className={pill(modo === "faixas")} onClick={() => trocar("faixas", { modo: "faixas", faixas: [{ ate: "", valor: "" }] })}>Por distância</button>
        <button type="button" className={pill(modo === "gratis")} onClick={() => trocar("gratis", { modo: "fixa", valor: 0 })}>Grátis</button>
      </div>
      {modo === "outro" && (
        <p className="text-[11px] text-[#3d4a42]/80">
          Regra especial{taxa?.texto ? `: ${taxa.texto}` : ""}. O robô diz ao cliente que a unidade confirma a taxa e avisa você. Para trocar, escolha uma das opções acima.
        </p>
      )}
      {modo === "fixa" && (
        <Dinheiro value={taxa.valor} onChange={(v) => onChange({ ...taxa, modo: "fixa", valor: v })} invalido={semNenhuma} ariaLabel="Valor da taxa" />
      )}
      {modo === "gratis" && <p className="text-[11px] text-emerald-700">O robô diz que a entrega é sem taxa.</p>}
      {modo === "faixas" && (
        <div className="space-y-2">
          {faixas.map((f, i) => {
            const marcada = marcas.has(`${prefixo}.faixa${i}`) || (semNenhuma && i === 0);
            return (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-[#3d4a42]/60">Até</span>
                <input type="number" inputMode="decimal" min="0" step="0.5" aria-label={`Faixa ${i + 1}: até quantos km`}
                  className={`${campo} w-16 text-center font-mono${marcada && !preenchido(f.ate) ? erroRing : ""}`}
                  value={f.ate ?? ""} onChange={(e) => setFaixa(i, "ate", e.target.value)} placeholder="5" />
                <span className="text-xs text-[#3d4a42]/60">km:</span>
                <Dinheiro value={f.valor} onChange={(v) => setFaixa(i, "valor", v)} invalido={marcada && !preenchido(f.valor)}
                  placeholder="8,00" ariaLabel={`Faixa ${i + 1}: valor`} />
                {faixas.length > 1 && (
                  <button type="button" aria-label="Apagar faixa" onClick={() => onChange({ modo: "faixas", faixas: faixas.filter((_, j) => j !== i) })}
                    className="text-[#3d4a42]/40 hover:text-red-500 transition-colors">
                    <MaterialIcon icon="close" size={18} />
                  </button>
                )}
              </div>
            );
          })}
          <button type="button" onClick={() => onChange({ modo: "faixas", faixas: [...faixas, { ate: "", valor: "" }] })}
            className="flex items-center gap-1 text-xs font-semibold text-brand hover:text-brand-dark">
            <MaterialIcon icon="add" size={16} />Adicionar faixa de km
          </button>
        </div>
      )}
    </div>
  );
}

function ComoChega({ promessa, minutos, onChange, invalido }) {
  const emMin = promessa === "minutos";
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {/* os minutos ficam guardados: voltar para "Em até X min" devolve o número (só essa opção grava prazo) */}
        <button type="button" className={pill(!emMin)} onClick={() => emMin && onChange({ promessa: "janela" })}>Dentro da janela</button>
        <button type="button" className={pill(emMin)} onClick={() => !emMin && onChange({ promessa: "minutos", minutos: numero(minutos) || 60 })}>Em até X min</button>
        {emMin && (
          <span className="flex items-center gap-1.5">
            <input type="number" min="1" inputMode="numeric" aria-label="Em até quantos minutos"
              className={`${campo} w-16 text-center font-mono${invalido ? erroRing : ""}`}
              value={minutos ?? ""} onChange={(e) => onChange({ promessa: "minutos", minutos: e.target.value })} />
            <span className="text-xs text-[#3d4a42]/60">min</span>
          </span>
        )}
      </div>
      <p className={dica}>
        {emMin ? "O robô promete a entrega em até esse tempo, contado do pedido confirmado." : "Sem hora marcada: o robô diz que a entrega passa dentro da janela."}
      </p>
    </div>
  );
}

function Tipo({ tipo, prefixo, estruturado, podeRemover, onChange, onRemove, marcas, erroMsg }) {
  const set = (patch) => onChange({ ...tipo, ...patch });
  return (
    <div className="rounded-xl bg-surface p-3 space-y-3">
      {estruturado && (
        <div className="flex items-center gap-2">
          <input aria-label="Nome do tipo de entrega" className={`${campo} flex-1 min-w-0 font-semibold${marcas.has(`${prefixo}.nome`) ? erroRing : ""}`}
            value={tipo.nome ?? ""} onChange={(e) => set({ nome: e.target.value })} placeholder="Tipo (ex.: Programada)" />
          {podeRemover && (
            <button type="button" onClick={onRemove} className="text-xs text-brand hover:underline flex items-center gap-1 shrink-0">
              <MaterialIcon icon="close" size={14} />Remover
            </button>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <span className={rotulo}>Janela de entrega</span>
          <div className="flex items-center gap-2">
            <SelectHora value={tipo.inicio} onChange={(v) => set({ inicio: v })} invalido={marcas.has(`${prefixo}.janela`)} ariaLabel="Início da entrega" />
            <span className="text-xs text-[#3d4a42]/60">às</span>
            <SelectHora value={tipo.fim} onChange={(v) => set({ fim: v })} invalido={marcas.has(`${prefixo}.janela`)} ariaLabel="Fim da entrega" />
          </div>
        </div>
        <div>
          <span className={rotulo}>Pedidos até</span>
          <select aria-label="Limite de pedidos" className={`${campo}${marcas.has(`${prefixo}.corte`) ? erroRing : ""}`}
            value={tipo.corte || ""} onChange={(e) => set({ corte: e.target.value })}>
            <option value="">o fim da janela</option>
            {opcoesHora(tipo.corte).map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
          <p className={dica}>
            {tipo.corte ? `Pedido depois das ${tipo.corte} fica para o próximo dia de entrega.` : "Pedido que chega dentro da janela sai no mesmo dia."}
          </p>
        </div>
      </div>
      <div>
        <span className={rotulo}>Taxa</span>
        <Taxa taxa={tipo.taxa} onChange={(taxa) => set({ taxa })} marcas={marcas} prefixo={prefixo} />
      </div>
      {estruturado && (
        <div>
          <span className={rotulo}>Como chega ao cliente</span>
          <ComoChega promessa={tipo.promessa} minutos={tipo.minutos} onChange={set} invalido={marcas.has(`${prefixo}.minutos`)} />
        </div>
      )}
      {erroMsg && <p className="text-[11px] text-red-600">{erroMsg}</p>}
    </div>
  );
}

function Grupo({ grupo, gi, modelo, estruturado, onChange, onRemove, podeRemover, marcas, problemas }) {
  const usadosFora = new Set(modelo.grupos.filter((_, j) => j !== gi).flatMap((g) => g.dias || []));
  const toggleDia = (d) => {
    const dias = grupo.dias.includes(d) ? grupo.dias.filter((x) => x !== d) : [...grupo.dias, d];
    if (!dias.length) return onRemove();
    onChange({ ...grupo, dias });
  };
  const setTipo = (ti, t) => onChange({ ...grupo, tipos: grupo.tipos.map((x, j) => (j === ti ? t : x)) });
  const frase = fraseDoGrupo(grupo);
  return (
    <div className="rounded-xl border border-[#bccac0]/30 bg-white p-3 sm:p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold text-[#3d4a42]">{rotuloDias(grupo.dias)}</span>
        {podeRemover && (
          <button type="button" onClick={onRemove} className="text-xs text-brand hover:underline flex items-center gap-1">
            <MaterialIcon icon="close" size={14} />Remover estes dias
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {WEEKDAYS.map((day) => {
          const marcado = grupo.dias.includes(day.value);
          const emOutro = !marcado && usadosFora.has(day.value);
          return (
            <button key={day.value} type="button" disabled={emOutro} onClick={() => toggleDia(day.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                marcado ? "bg-brand text-white" : emOutro ? "bg-surface-line text-[#3d4a42]/30 cursor-not-allowed" : "bg-surface-line text-[#3d4a42] hover:bg-[#e3e2e3]"}`}>
              {day.label}
            </button>
          );
        })}
      </div>
      {grupo.tipos.map((t, ti) => (
        <Tipo key={ti} tipo={t} prefixo={`g${gi}.t${ti}`} estruturado={estruturado} podeRemover={grupo.tipos.length > 1}
          onChange={(nt) => setTipo(ti, nt)} onRemove={() => onChange({ ...grupo, tipos: grupo.tipos.filter((_, j) => j !== ti) })}
          marcas={marcas} erroMsg={problemas.find((p) => p.chave.startsWith(`g${gi}.t${ti}.`))?.msg} />
      ))}
      {estruturado && (
        <button type="button" onClick={() => onChange({ ...grupo, tipos: [...grupo.tipos, novoTipo(grupo.tipos[0])] })}
          className="flex items-center gap-1 text-xs font-semibold text-brand hover:text-brand-dark">
          <MaterialIcon icon="add" size={16} />Outro tipo de entrega nesses dias
        </button>
      )}
      {frase && (
        <div className="bg-surface rounded-xl p-3">
          <p className="text-[10px] uppercase tracking-widest font-bold text-[#3d4a42]/50 mb-1">O vendedor vai dizer</p>
          <p className="text-xs text-[#3d4a42] italic">"{frase}"</p>
        </div>
      )}
    </div>
  );
}

function NomesBairro({ nomes, onChange, invalido }) {
  const [texto, setTexto] = useState("");
  const incluir = (lista) => {
    const novos = [...nomes];
    for (const n of lista.map((s) => s.trim()).filter(Boolean)) {
      if (!novos.some((x) => x.toLowerCase() === n.toLowerCase())) novos.push(n);
    }
    if (novos.length !== nomes.length) onChange(novos);
  };
  return (
    <div className={`min-h-[44px] rounded-xl bg-surface-line px-2 py-1.5 flex flex-wrap gap-1.5 items-center min-w-0${invalido ? erroRing : ""}`}>
      {nomes.map((n) => (
        <span key={n} className="flex items-center gap-0.5 pl-2.5 pr-1 py-1 rounded-full bg-white text-xs font-semibold">
          {n}
          <button type="button" aria-label={`Tirar ${n}`} onClick={() => onChange(nomes.filter((x) => x !== n))} className="text-[#3d4a42]/50 hover:text-red-500">
            <MaterialIcon icon="close" size={14} />
          </button>
        </span>
      ))}
      <input aria-label="Nome do bairro" value={texto} placeholder={nomes.length ? "+ bairro" : "Nome do bairro e Enter"}
        className="flex-1 min-w-[7rem] bg-transparent outline-none text-sm px-1"
        onChange={(e) => {
          const partes = e.target.value.split(",");
          if (partes.length > 1) { incluir(partes.slice(0, -1)); setTexto(partes.at(-1)); } else setTexto(e.target.value);
        }}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); incluir([texto]); setTexto(""); } }}
        onBlur={() => { incluir([texto]); setTexto(""); }} />
    </div>
  );
}

// o que o suporte cadastrou e a tela ainda não edita (dias, valor num dia, regra especial): aparece escrito
const DIA_CURTO = { seg: "Seg", ter: "Ter", qua: "Qua", qui: "Qui", sex: "Sex", sab: "Sáb", dom: "Dom" };
function detalheDaZona(z) {
  const partes = [];
  if (z.fora_da_cidade) partes.push("vale para endereço fora da cidade");
  if (z.dias?.length) partes.push(`entrega só ${rotuloDias(z.dias)}`);
  for (const [d, v] of Object.entries(z.por_dia || {})) partes.push(`${DIA_CURTO[d] || d}: ${dinheiro(v)}`);
  if (z.especial) partes.push(`o robô diz que a unidade confirma a taxa (${z.especial})`);
  return partes.length ? `${partes.join(" · ")}. Para mudar isso, fale com o suporte.` : "";
}

function Bairros({ zonas, onChange, marcas, problemas }) {
  const set = (i, z) => onChange(zonas.map((x, j) => (j === i ? z : x)));
  const erros = problemas.filter((p) => p.chave.startsWith("z"));
  return (
    <div className="space-y-3 border-t border-[#bccac0]/20 pt-4">
      <div>
        <p className="text-sm font-bold text-[#3d4a42] flex items-center gap-1.5"><MaterialIcon icon="location_on" size={16} />Bairros com taxa diferente</p>
        <p className={dica}>Vale em qualquer tipo e em qualquer dia, e substitui a taxa normal. O robô usa o bairro que o cliente escreve e o que o mapa encontra.</p>
      </div>
      {zonas.map((z, i) => (
        <div key={i} className="rounded-xl bg-surface p-2.5 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3">
          <div className="flex-1 min-w-0">
            <NomesBairro nomes={z.nomes || []} onChange={(nomes) => set(i, { ...z, nomes })} invalido={marcas.has(`z${i}.nomes`)} />
          </div>
          <div className="flex items-center gap-3">
            {z.nao_atende ? <span className="text-xs text-[#3d4a42]/60 w-28 px-1">sem entrega</span> : z.especial ? <span className="text-xs text-[#3d4a42]/60 w-28 px-1">regra especial</span> : (
              <Dinheiro value={z.valor} onChange={(v) => set(i, { ...z, valor: v })} invalido={marcas.has(`z${i}.valor`)} ariaLabel="Taxa do bairro" />
            )}
            <label className="flex items-center gap-2 text-xs text-[#3d4a42] cursor-pointer whitespace-nowrap">
              <input type="checkbox" className="accent-brand" checked={!!z.nao_atende} onChange={(e) => set(i, { ...z, nao_atende: e.target.checked })} />
              Não entregamos
            </label>
            <button type="button" aria-label="Apagar linha" onClick={() => onChange(zonas.filter((_, j) => j !== i))}
              className="ml-auto text-[#3d4a42]/40 hover:text-red-500">
              <MaterialIcon icon="close" size={18} />
            </button>
          </div>
          {detalheDaZona(z) && <p className="text-[11px] text-[#3d4a42]/70 sm:basis-full">{detalheDaZona(z)}</p>}
        </div>
      ))}
      {erros.length > 0 && <p className="text-[11px] text-red-600">{erros[0].msg}</p>}
      <button type="button" onClick={() => onChange([...zonas, { nomes: [], valor: "" }])}
        className="flex items-center gap-1 text-xs font-semibold text-brand hover:text-brand-dark">
        <MaterialIcon icon="add" size={16} />Adicionar bairros com outra taxa
      </button>
    </div>
  );
}

const primeiraMaiuscula = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

// O teste abre no primeiro dia que tem entrega a partir de agora (mostra preço logo, e não "já fechou").
function primeiroDiaComEntrega(pricing, dias, agora) {
  for (const d of dias) {
    try {
      const r = cotarFrete(pricing, { bairro_cliente: "", km: 3 }, agora, { dataEntrega: d });
      if (r?.estado === "ok" && r.data_pedida?.opcoes?.length) return d;
    } catch { /* cadastro pela metade: fica no dia de hoje */ }
  }
  return agora.data;
}

function Resultado({ r, km, raio }) {
  if (!r) return null;
  const caixa = "rounded-xl border border-[#bccac0]/35 bg-white p-3 space-y-1.5";
  if (r.estado === "ok") {
    const dp = r.data_pedida;
    if (!dp) return null;
    return (
      <div className={caixa}>
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <span className="text-[10px] uppercase tracking-widest font-bold text-[#3d4a42]/50">{dp.dia}</span>
          {r.bairro_com_taxa && <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[11px] font-semibold">Bairro com taxa própria</span>}
        </div>
        {dp.opcoes.length ? dp.opcoes.map((o) => (
          <div key={o.tipo} className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-xl font-bold font-mono">{o.taxa === 0 ? "Grátis" : dinheiro(o.taxa)}</span>
            <span className="text-xs text-[#3d4a42]">{o.tipo} · das {o.janela} · {o.prazo}</span>
          </div>
        )) : (
          <p className="text-sm text-[#3d4a42]">{primeiraMaiuscula(dp.observacao)}.{r.proximo_dia_com_entrega ? ` Próximo dia com entrega: ${r.proximo_dia_com_entrega}.` : ""}</p>
        )}
        {r.aviso && <p className="text-[11px] text-amber-700">{r.aviso}</p>}
      </div>
    );
  }
  const texto = {
    fora_da_area: r.bairro ? `Não entrega no ${r.bairro}. O robô oferece a retirada, se houver.` : `Fora da área: ${String(km).replace(".", ",")} km, e o raio é ${raio} km. O robô recusa e oferece a retirada, se houver.`,
    sem_preco: "Não há valor para essa distância: o robô diz que a unidade confirma a taxa e avisa você.",
    regra_especial: "Regra especial: o robô diz que a unidade confirma a taxa e avisa você.",
    confirmar_bairro: "O robô confirma o bairro com o cliente antes de dizer o valor.",
    precisa_km: "Informe a distância.",
  }[r.estado] || "A unidade confirma a taxa.";
  return <div className={`${caixa} text-sm text-[#3d4a42]`}>{texto}</div>;
}

function TesteRapido({ modelo, estruturado }) {
  const agora = useMemo(agoraSaoPaulo, []);
  const dias = useMemo(() => Array.from({ length: 8 }, (_, i) => somaDias(agora.data, i)), [agora.data]);
  const [bairro, setBairro] = useState("");
  const [km, setKm] = useState("");
  const [pedeData, setPedeData] = useState(agora.data);
  const horaInicial = useMemo(() => {
    const [h, m] = agora.hora.split(":").map(Number);
    return `${String(h).padStart(2, "0")}:${m < 30 ? "00" : "30"}`;
  }, [agora.hora]);
  const [pedeHora, setPedeHora] = useState(horaInicial);
  const [entregaData, setEntregaData] = useState(() => primeiroDiaComEntrega(limparPricing(modelo), dias, { data: agora.data, hora: horaInicial }));
  const pricing = useMemo(() => limparPricing(modelo), [modelo]);
  const kmNum = numero(km) ?? 3;
  const entrega = entregaData < pedeData ? pedeData : entregaData;
  const cotar = (dataEntrega) => {
    try {
      return cotarFrete(pricing, { bairro_cliente: bairro, km: kmNum }, { data: pedeData, hora: pedeHora }, { dataEntrega });
    } catch {
      return null;
    }
  };
  const r = cotar(entrega);
  const outrosDias = dias.filter((d) => d >= pedeData).slice(0, 5).map((d) => ({ d, r: cotar(d) }));
  if (!pricing?.grupos?.length) return null;

  return (
    <section className="rounded-2xl border border-[#d4af37]/40 bg-[#d4af37]/[0.06] p-4 space-y-3">
      <div className="flex items-start gap-2">
        <MaterialIcon icon="calculate" size={20} className="text-[#775a19] mt-0.5" />
        <div>
          <p className="text-sm font-bold text-ink">Teste rápido</p>
          <p className="text-[11px] text-[#3d4a42]/70">
            {estruturado ? "O que o robô cobra, pelo mesmo cálculo dele. Dá para testar antes de salvar." : "O que o robô deve cobrar com a sua tabela. Dá para testar antes de salvar."}
          </p>
        </div>
      </div>
      <div className={`grid grid-cols-2 ${estruturado ? "sm:grid-cols-3" : ""} gap-2`}>
        {estruturado && (
          <label className="col-span-2 sm:col-span-1">
            <span className={rotulo}>Bairro do cliente</span>
            <input className={`${campo} w-full`} value={bairro} onChange={(e) => setBairro(e.target.value)} placeholder="Ex.: Centro" />
          </label>
        )}
        <label>
          <span className={rotulo}>Distância (km)</span>
          <input className={`${campo} w-full font-mono`} type="number" min="0" step="0.5" inputMode="decimal" value={km} onChange={(e) => setKm(e.target.value)} placeholder="3" />
        </label>
        <label className="col-span-2 order-last">
          <span className={rotulo}>Cliente pede</span>
          <div className="flex gap-1.5">
            <select className={`${campo} min-w-0 flex-1`} value={pedeData} onChange={(e) => setPedeData(e.target.value)}>
              {dias.map((d) => <option key={d} value={d}>{rotuloCurto(d)}</option>)}
            </select>
            <SelectHora value={pedeHora} onChange={(v) => v && setPedeHora(v)} ariaLabel="Hora do pedido" />
          </div>
        </label>
        <label>
          <span className={rotulo}>Para entregar</span>
          <select className={`${campo} w-full`} value={entrega} onChange={(e) => setEntregaData(e.target.value)}>
            {dias.filter((d) => d >= pedeData).map((d) => <option key={d} value={d}>{rotuloCurto(d)}</option>)}
          </select>
        </label>
      </div>
      <Resultado r={r} km={kmNum} raio={pricing.raio_km} />
      {r?.estado === "ok" && (
        <div>
          <p className={rotulo}>Se o cliente pedir para outro dia</p>
          <div className="rounded-xl border border-[#bccac0]/35 overflow-hidden bg-white">
            {outrosDias.map(({ d, r: rd }, i) => {
              const ops = rd?.data_pedida?.opcoes || [];
              return (
                <div key={d} className={`grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2 px-3 py-2 text-xs ${i ? "border-t border-[#bccac0]/20" : ""} ${d === entrega ? "bg-brand/5" : ""}`}>
                  <span className={`font-semibold font-mono ${d === entrega ? "text-brand" : ""}`}>{rotuloCurto(d)}</span>
                  <span className="text-[#3d4a42]">
                    {rd?.estado !== "ok" ? "—" : ops.length
                      ? ops.map((o) => `${o.taxa === 0 ? "grátis" : dinheiro(o.taxa)} ${o.tipo.toLowerCase()} ${o.janela.replace(" às ", "–")}`).join(" · ")
                      : primeiraMaiuscula(rd.data_pedida?.observacao || "")}
                  </span>
                </div>
              );
            })}
          </div>
          <p className={`${dica} flex items-start gap-1`}>
            <MaterialIcon icon="info" size={12} className="mt-0.5 shrink-0" />
            Vale sempre a tabela do dia da entrega, não a do dia em que o cliente pede.
          </p>
        </div>
      )}
    </section>
  );
}

export default function EntregaCard({ modelo, onChange, estruturado, minOrder, onMinOrderChange, problemas = [], semHorarioSalvo, onUsarSugestao }) {
  const marcas = useMemo(() => new Set(problemas.map((p) => p.chave)), [problemas]);
  const setGrupo = (gi, g) => onChange({ ...modelo, grupos: modelo.grupos.map((x, j) => (j === gi ? g : x)) });
  const removerGrupo = (gi) => onChange({ ...modelo, grupos: modelo.grupos.filter((_, j) => j !== gi) });
  const livres = diasLivres(modelo);
  const t0 = modelo.grupos[0]?.tipos?.[0];
  const comoChegaTodos = (p) =>
    onChange({ ...modelo, grupos: modelo.grupos.map((g) => ({ ...g, tipos: g.tipos.map((t) => ({ ...t, ...p })) })) });

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-bold text-[#3d4a42]">Dias, horários e taxas</p>
        <p className={dica}>
          Em cada grupo de dias: a janela de entrega, até que horas aceita pedido e a taxa.
          {estruturado ? " Pode ter mais de um tipo de entrega no mesmo dia (ex.: programada e imediata)." : ""}
        </p>
      </div>
      {semHorarioSalvo && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
          <p className="text-xs text-amber-800 flex-1">Ainda não há horário de entrega salvo. O de baixo é só uma sugestão: ajuste ou use como está.</p>
          <button type="button" onClick={onUsarSugestao} className="px-3 py-2 rounded-lg bg-brand text-white text-xs font-bold hover:bg-brand-dark whitespace-nowrap">
            Usar este horário
          </button>
        </div>
      )}
      {modelo.grupos.map((g, gi) => (
        <Grupo key={gi} grupo={g} gi={gi} modelo={modelo} estruturado={estruturado} podeRemover={modelo.grupos.length > 1}
          onChange={(ng) => setGrupo(gi, ng)} onRemove={() => removerGrupo(gi)} marcas={marcas} problemas={problemas} />
      ))}
      {livres.length > 0 && (
        <button type="button" onClick={() => onChange({ ...modelo, grupos: [...modelo.grupos, novoGrupo(modelo)] })}
          className="w-full py-3 rounded-xl border-2 border-dashed border-[#bccac0]/40 text-sm font-medium text-[#3d4a42] hover:border-brand/30 hover:text-brand transition-colors flex items-center justify-center gap-2">
          <MaterialIcon icon="add" size={18} />Adicionar dias com horário diferente
        </button>
      )}
      {!estruturado && t0 && (
        <div className="rounded-xl bg-surface p-3">
          <span className={rotulo}>Como chega ao cliente (vale para todos os dias)</span>
          <ComoChega promessa={t0.promessa} minutos={t0.minutos} onChange={comoChegaTodos} invalido={[...marcas].some((k) => k.endsWith(".minutos"))} />
        </div>
      )}
      {estruturado ? (
        <Bairros zonas={modelo.zonas || []} onChange={(zonas) => onChange({ ...modelo, zonas })} marcas={marcas} problemas={problemas} />
      ) : (
        <p className="text-[11px] text-[#3d4a42]/70 flex items-start gap-1.5">
          <MaterialIcon icon="lightbulb" size={14} className="mt-0.5 shrink-0 text-[#775a19]" />
          Cobra valor diferente por bairro, ou tem mais de um tipo de entrega no mesmo dia (ex.: programada e imediata)? Fale com o suporte para ligar o frete calculado na sua unidade.
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={rotulo}>Raio máximo de entrega (km)</label>
          <input className={`${campo} w-full font-mono`} type="number" min="1" max="60" inputMode="decimal"
            value={modelo.raio_km ?? ""} onChange={(e) => onChange({ ...modelo, raio_km: e.target.value === "" ? null : Number(e.target.value) })} placeholder="7" />
          <p className={dica}>{estruturado ? "O robô recusa endereço além do raio. Os bairros listados acima valem mesmo além dele." : "O robô recusa endereço além do raio."}</p>
        </div>
        <div>
          <label className={rotulo}>Pedido mínimo para entrega (R$)</label>
          <input className={`${campo} w-full font-mono`} type="number" min="0" inputMode="decimal"
            value={minOrder ?? ""} onChange={(e) => onMinOrderChange(e.target.value ? Number(e.target.value) : null)} placeholder="Sem mínimo" />
          <p className={dica}>Abaixo desse valor o robô não fecha a entrega: pede para completar o pedido ou retirar.</p>
        </div>
      </div>
      <TesteRapido modelo={modelo} estruturado={estruturado} />
    </div>
  );
}
