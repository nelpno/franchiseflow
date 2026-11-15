// Bloco "Promoções" do Cardápio digital (até 3 ativas, 12/11/2026) (ESPEC § 4.5–4.6; junção Meu robô × Cardápio 10/11/2026: a promoção inteira mora aqui).
// "Kit com preço fechado" ou "Leve N e ganhe %": o banco valida e gera o texto que o robô lê (promotions_combo), com a
// mesma regra e o mesmo texto em lib/promocaoRegras.js para a prévia. "Escrever do meu jeito": frase do cliente + detalhes.
import { useEffect, useMemo, useState } from "react";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BTN_PRIMARIO, BTN_SECUNDARIO, CARTAO, CHIP, CHIP_ATIVO, CHIP_INATIVO, H2, H3_CARTAO } from "@/components/shared/adminUi";
import { TIPOS, erroDaRegra, limparRegra, precoNormal, regraVazia, reais, textoDaRegra, trocaRegra, tiraRegra, regrasAtivas, produtosDivididos, MAX_ITENS, MAX_PROMOS, NOME_MAX } from "@/lib/promocaoRegras";
import { PROMO_CLIENTE_MAX, avisoTextoPromocao, detalhesDoRobo, nomeCurtoProduto, sugestaoPromocaoCliente, textoPromocaoRobo, vencimentoPromocao } from "@/lib/cardapioDigital";

const CAMPO = "h-11 w-full rounded-xl border border-surface-line bg-white px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30";
const ROTULO_CAMPO = "mb-1 block text-sm font-semibold text-ink";

function brl(v) {
  return `R$ ${reais(v)}`;
}

function EscolherProduto({ aberto, onFechar, produtos, jaEscolhidos, onEscolher }) {
  const [busca, setBusca] = useState("");
  useEffect(() => { if (!aberto) setBusca(""); }, [aberto]);
  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
    return (produtos || [])
      .filter((p) => !jaEscolhidos.includes(p.produto))
      .filter((p) => !q || p.produto.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").includes(q));
  }, [produtos, jaEscolhidos, busca]);
  return (
    <Dialog open={aberto} onOpenChange={(v) => { if (!v) onFechar(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Escolher produto</DialogTitle>
          <DialogDescription>Os produtos do seu Estoque, com o preço de agora.</DialogDescription>
        </DialogHeader>
        <label className="sr-only" htmlFor="busca-produto-promo">Buscar produto</label>
        <input id="busca-produto-promo" className={CAMPO} placeholder="Buscar produto" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <ul className="max-h-[50vh] divide-y divide-surface-line overflow-y-auto">
          {lista.map((p) => (
            <li key={p.id}>
              <button type="button" className="flex min-h-11 w-full items-center gap-3 px-1 py-2 text-left text-sm hover:bg-surface" onClick={() => { onEscolher(p.produto); onFechar(); }}>
                <span className="min-w-0 flex-1 text-ink">{p.produto}</span>
                {p.zerado && <span className="shrink-0 text-xs font-semibold text-warn-ink">Em falta</span>}
                <span className="shrink-0 tabular-nums text-ink-2">{brl(p.preco)}</span>
              </button>
            </li>
          ))}
          {!lista.length && <li className="py-4 text-sm text-ink-3">Nenhum produto com esse nome.</li>}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

function PreviaCliente({ regra, produtos, texto, kitNoCardapio }) {
  const normal = precoNormal(regra, produtos);
  if (regra.tipo === "kit" && kitNoCardapio) {
    return (
      <div className="rounded-2xl border border-surface-line bg-white p-3">
        <span className="inline-block rounded-full bg-brand px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
          Promoção{regra.vale_ate ? ` até ${regra.vale_ate.slice(8, 10)}/${regra.vale_ate.slice(5, 7)}` : ""}
        </span>
        <p className="mt-1 font-plus-jakarta text-base font-bold text-ink">{regra.nome || "Nome do kit"}</p>
        <p className="text-sm text-ink-2">{regra.itens.map((i) => `${i.qtd} ${nomeCurtoProduto(i.product_name)}`).join(" + ") || "Escolha os produtos"}</p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-sm">
            {normal != null && <s className="text-ink-3">{brl(normal)}</s>}{" "}
            <b className="font-plus-jakarta text-xl font-extrabold text-brand-dark">{regra.preco ? brl(regra.preco) : "R$ —"}</b>
          </p>
          <span className="inline-flex min-h-11 items-center rounded-xl bg-brand px-3 text-sm font-semibold text-white">Pôr o kit no pedido</span>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-surface-line bg-white p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-ink-3">Promoção da unidade</p>
      <p className="mt-1 line-clamp-2 text-sm text-ink">{texto || "O texto aparece aqui."}</p>
    </div>
  );
}

const TIPO_LIVRE = { id: "livre", rotulo: "Escrever do meu jeito" };
const ROBO_MAX = 1500;

function ddmm(iso) {
  return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "";
}

// Resumo de uma linha do que a promoção é (o cartão da lista)
function resumoDaRegra(r, produtos) {
  if (r.tipo === "kit") {
    const normal = precoNormal(r, produtos);
    return (
      <>
        {r.itens.map((i) => `${i.qtd} ${nomeCurtoProduto(i.product_name)}`).join(" + ")}
        {" · "}
        {normal != null && normal > Number(r.preco) && <s className="text-ink-3">{brl(normal)}</s>}{" "}
        <b className="text-brand-dark">{brl(r.preco)}</b>
      </>
    );
  }
  const nomes = r.itens.map((i) => nomeCurtoProduto(i.product_name)).join(" e ");
  return `Leve ${r.min_qtd} ou mais${nomes ? ` (${nomes})` : ""} e ganhe ${r.pct}% de desconto`;
}

// Junção Meu robô × Cardápio (10/11/2026) + várias promoções (12/11/2026): até 3 promoções ativas, cada uma no seu cartão.
// Kit / leve N = regra estruturada (o banco valida, gera o texto do robô e soma as promoções no pedido). "Escrever do meu jeito" =
// a frase que o cliente lê (promocao_cliente, ≤ 160) + detalhes para o robô: só existe SEM kit/leve N ativo (o banco recusa os dois juntos).
// Nada é preenchido sozinho: a sugestão da frase aparece no campo, mas só vale depois de "Salvar promoção".
export default function PromocaoForm({ painel, hojeISO, salvando, onSalvar, onSalvarLivre, onEncerrar, secaoRef }) {
  const lista = useMemo(() => regrasAtivas(painel?.promocao_regras), [painel?.promocao_regras]);
  const textoRobo = painel?.promocao_texto || "";
  const clienteSalvo = painel?.promocao_cliente || "";
  const exibida = painel?.promocao_cliente_exibida || "";
  const temLivre = lista.length === 0 && !!(textoRobo || clienteSalvo);
  // Base do "Escrever do meu jeito": o texto LIVRE de agora. Com kit/leve N ativo o texto do robô é GERADO pelo trigger e
  // nunca vira texto livre (salvá-lo como livre deixava o robô oferecendo o kit sem a regra: code review 10/11): começa vazio.
  const textoLivre = lista.length ? "" : textoRobo;
  const clienteLivre = lista.length ? "" : clienteSalvo;
  const produtos = useMemo(() => (painel?.produtos || []).map((p) => ({ ...p, ativo: true })), [painel?.produtos]);
  const paraEscolher = useMemo(() => produtos.filter((p) => p.visivel !== false), [produtos]); // escondido não entra
  const venceLivre = temLivre ? vencimentoPromocao(null, textoRobo, hojeISO) : null;
  // editando: null = só a lista; -1 = promoção nova; 0..2 = a promoção da lista; "livre" = o texto escrito do meu jeito
  const [editando, setEditando] = useState(null);
  const [tipo, setTipo] = useState("kit");
  const [regra, setRegra] = useState(() => regraVazia("kit"));
  const clienteInicial = () => clienteLivre || sugestaoPromocaoCliente(textoLivre);
  const [cliente, setCliente] = useState(clienteInicial);
  const [detalhes, setDetalhes] = useState(() => detalhesDoRobo(textoLivre, clienteInicial()));
  const [escolhendo, setEscolhendo] = useState(false);
  const [tentou, setTentou] = useState(false);
  const [confirmarFim, setConfirmarFim] = useState(null); // índice da promoção a encerrar

  // a promoção salva mudou no banco (salvou, encerrou, venceu): a tela volta para a lista
  // (o mesmo ao tocar em Cancelar: nada do que foi mexido fica)
  const chaveAtiva = JSON.stringify([lista, textoRobo, clienteSalvo]);
  const voltarAoSalvo = () => {
    setEditando(null);
    setTipo("kit");
    setRegra(regraVazia("kit"));
    const c = clienteInicial();
    setCliente(c);
    setDetalhes(detalhesDoRobo(textoLivre, c));
    setTentou(false);
  };
  useEffect(voltarAoSalvo, [chaveAtiva]); // eslint-disable-line react-hooks/exhaustive-deps

  const abrirEdicao = (i) => {
    const r = lista[i];
    setRegra({ ...regraVazia(r.tipo), ...r });
    setTipo(r.tipo);
    setTentou(false);
    setEditando(i);
  };
  const abrirNova = () => {
    setRegra(regraVazia("kit"));
    setTipo("kit");
    setTentou(false);
    setEditando(-1);
  };
  const abrirLivre = () => {
    setTipo("livre");
    const c = clienteInicial();
    setCliente(c);
    setDetalhes(detalhesDoRobo(textoLivre, c));
    setTentou(false);
    setEditando("livre");
  };

  const emEdicao = editando !== null;
  const livre = tipo === "livre";
  const outras = typeof editando === "number" && editando >= 0 ? lista.filter((_, i) => i !== editando) : lista;
  // "Escrever do meu jeito" só aparece quando não sobraria nenhuma promoção estruturada (o banco não deixa as duas convivendo)
  const podeLivre = lista.length === 0 || (lista.length === 1 && editando === 0);
  const clienteLimpo = cliente.replace(/\s+/g, " ").trim();
  // texto do robô: o antigo intacto (já tem a oferta) quando ela não mexeu nos detalhes e a frase é a 1ª vez; senão frase + detalhes
  const textoRoboNovo = livre
    ? (!clienteLivre && textoLivre && detalhes.trim() === textoLivre.trim() ? textoLivre.trim() : textoPromocaoRobo(clienteLimpo, detalhes))
    : null;
  const erroLivre = !clienteLimpo ? "Escreva o que o cliente lê no cardápio."
    : (textoRoboNovo || "").length > ROBO_MAX ? `A frase e os detalhes para o robô passaram de ${ROBO_MAX} letras: encurte os detalhes.` : "";
  const erro = livre ? erroLivre : erroDaRegra(regra, produtos, hojeISO, outras);
  const semPreco = regra.tipo === "kit" && !(Number(regra.preco) > 0);
  const texto = !livre && regra.itens.length && !semPreco ? textoDaRegra(limparRegra(regra), produtos) : null;
  const normal = precoNormal(regra, produtos);
  const desconto = regra.tipo === "kit" && normal && Number(regra.preco) > 0 ? Math.round((1 - Number(regra.preco) / normal) * 100) : null;
  const avisoRobo = livre ? avisoTextoPromocao(detalhes) : "";
  // aviso (não bloqueia): esta promoção usa produto que outra também usa
  const divide = !livre && regra.itens.length
    ? [...new Set(outras.flatMap((o) => (o.itens || []).filter((x) => regra.itens.some((i) => i.product_name === x.product_name)).map(() => String(o.nome || "").trim())))]
    : [];
  const mudarTipo = (t) => {
    if (t === "livre") { abrirLivre(); return; }
    setTipo(t);
    setRegra((r) => ({ ...regraVazia(t), nome: r.nome, itens: r.itens.map((i) => ({ ...i, qtd: t === "percentual" ? 1 : i.qtd })), vale_ate: r.vale_ate }));
  };
  const setQtd = (nome, d) => setRegra((r) => ({ ...r, itens: r.itens.map((i) => (i.product_name === nome ? { ...i, qtd: Math.min(20, Math.max(1, (Number(i.qtd) || 1) + d)) } : i)) }));
  const tirar = (nome) => setRegra((r) => ({ ...r, itens: r.itens.filter((i) => i.product_name !== nome) }));
  const salvar = () => {
    setTentou(true);
    if (erro) return;
    if (livre) onSalvarLivre({ cliente: clienteLimpo, robo: textoRoboNovo });
    else onSalvar(trocaRegra(lista, typeof editando === "number" ? editando : -1, limparRegra(regra)));
  };

  return (
    <section ref={secaoRef} id="bloco-promocao" className="scroll-mt-20 space-y-3" aria-labelledby="cardapio-promocao">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="cardapio-promocao" className={H2}>Promoções</h2>
        <p className="text-sm text-ink-3">Até {MAX_PROMOS} kits ou leve N ao mesmo tempo, ou um texto do seu jeito com quantas promoções quiser. Valem para o cardápio e para o robô.</p>
      </div>

      {!emEdicao && lista.length > 0 && (
        <div className="space-y-3" data-promo-lista>
          {lista.map((r, i) => {
            const divididos = produtosDivididos(lista, i);
            const outrosNomes = [...new Set(divididos.flatMap((d) => d.com))];
            const sumiu = (r.itens || []).some((it) => { const p = produtos.find((x) => x.produto === it.product_name); return !p || p.visivel === false; });
            const v = r.vale_ate ? vencimentoPromocao(r, null, hojeISO) : null;
            return (
              <div key={`${i}-${r.nome}`} className={`${CARTAO} space-y-2`} data-promo-cartao>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className={H3_CARTAO}>{r.nome}</h3>
                  <span className="rounded-full bg-ok-soft px-2.5 py-0.5 text-xs font-semibold text-ok-ink">
                    {r.tipo === "kit" ? "Kit" : "Leve N"} · ativa{r.vale_ate ? ` até ${ddmm(r.vale_ate)}` : ""}
                  </span>
                  {v && v.dias >= 0 && v.dias <= 3 && (
                    <span className="rounded-full bg-warn-soft px-2.5 py-0.5 text-xs font-semibold text-warn-ink">
                      vence {v.dias === 0 ? "hoje" : v.dias === 1 ? "amanhã" : `em ${v.dias} dias`}
                    </span>
                  )}
                </div>
                <p className="text-sm text-ink">{resumoDaRegra(r, produtos)}</p>
                {sumiu && (
                  <p className="rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn-ink">
                    Um produto desta promoção saiu do Estoque ou foi escondido do cardápio: o robô parou de oferecer só esta. Mostre o produto de novo, edite ou encerre.
                  </p>
                )}
                {!sumiu && outrosNomes.length > 0 && (
                  <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm text-ink-2" data-promo-divide>
                    Divide produtos com {outrosNomes.map((n) => `“${n}”`).join(" e ")}. Se o cliente pedir os dois, o sistema escolhe a combinação que dá mais desconto.
                  </p>
                )}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button type="button" className={`${BTN_SECUNDARIO} min-h-11`} onClick={() => abrirEdicao(i)} disabled={salvando}>
                    <MaterialIcon icon="edit" size={18} aria-hidden="true" /> Editar
                  </button>
                  <button type="button" className={`${BTN_SECUNDARIO} min-h-11`} onClick={() => setConfirmarFim(i)} disabled={salvando}>
                    Encerrar
                  </button>
                </div>
              </div>
            );
          })}
          {!painel?.kit_no_cardapio && lista.some((r) => r.tipo === "kit") && (
            <p className="text-sm text-ink-3">No cardápio, por enquanto, elas aparecem como texto no topo.</p>
          )}
          {lista.length > 1 && (
            <p className="text-sm text-ink-3" data-promo-regra>
              O cliente pode levar mais de uma no mesmo pedido. Cada produto entra em uma promoção só; se dois kits servem para o mesmo pedido, vale a combinação de maior desconto. Se o cupom der mais desconto que as promoções somadas, vale o cupom (nunca os dois).
            </p>
          )}
          {lista.length < MAX_PROMOS ? (
            <button type="button" className={`${BTN_SECUNDARIO} min-h-11 w-full sm:w-auto`} onClick={abrirNova} disabled={salvando} data-promo-adicionar>
              <MaterialIcon icon="add" size={18} aria-hidden="true" /> Adicionar promoção ({lista.length} de {MAX_PROMOS})
            </button>
          ) : (
            <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm text-ink-2" data-promo-cheio>
              Você já tem {MAX_PROMOS} promoções ativas. Encerre uma para criar outra.
            </p>
          )}
        </div>
      )}

      {!emEdicao && lista.length === 0 && temLivre && (
        <div className={`${CARTAO} space-y-3`}>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={H3_CARTAO}>Promoção de agora</h3>
            {venceLivre && venceLivre.dias >= 0 && (
              <span className="rounded-full bg-warn-soft px-2.5 py-0.5 text-xs font-semibold text-warn-ink">vence {venceLivre.ddmm}</span>
            )}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-ink-3">O cliente lê no cardápio</p>
            {exibida
              ? <p className="mt-1 rounded-xl bg-brand-soft px-3 py-2 text-sm font-semibold text-brand-dark" data-promo-previa>{exibida}</p>
              : <p className="mt-1 rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn-ink" data-promo-sem-frase>Nada ainda: falta a frase para o cliente. Toque em Editar promoção.</p>}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-ink-3">O robô oferece</p>
            <p className="mt-1 whitespace-pre-line text-sm text-ink">{textoRobo || "Nada: o robô não está oferecendo promoção."}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" className={`${BTN_SECUNDARIO} min-h-11`} onClick={abrirLivre}>
              <MaterialIcon icon="edit" size={18} aria-hidden="true" /> Editar promoção
            </button>
            <button type="button" className={`${BTN_SECUNDARIO} min-h-11`} onClick={() => setConfirmarFim(-1)} disabled={salvando}>
              Encerrar promoção
            </button>
            <button type="button" className={`${BTN_SECUNDARIO} min-h-11`} onClick={abrirNova} disabled={salvando}>
              <MaterialIcon icon="add" size={18} aria-hidden="true" /> Criar kit ou leve N
            </button>
          </div>
        </div>
      )}

      {!emEdicao && lista.length === 0 && !temLivre && (
        <div className={`${CARTAO} space-y-3`}>
          <p className="text-sm text-ink-2">Sem promoção agora.</p>
          <button type="button" className={`${BTN_SECUNDARIO} min-h-11 w-full sm:w-auto`} onClick={abrirNova}>
            <MaterialIcon icon="add" size={18} aria-hidden="true" /> Criar promoção
          </button>
        </div>
      )}

      {emEdicao && (
        <div className={`${CARTAO} space-y-4`}>
          <p className="text-sm font-semibold text-ink-2" data-promo-titulo-edicao>
            {editando === -1 ? `Nova promoção (${lista.length + 1} de ${MAX_PROMOS})` : editando === "livre" ? "Promoção do meu jeito" : `Editando “${lista[editando]?.nome || ""}”`}
          </p>
          <div>
            <p className={ROTULO_CAMPO}>Tipo</p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tipo da promoção">
              {[...TIPOS, ...(podeLivre ? [TIPO_LIVRE] : [])].map((t) => (
                <button key={t.id} type="button" role="radio" aria-checked={tipo === t.id} onClick={() => mudarTipo(t.id)}
                  className={`${CHIP} ${tipo === t.id ? CHIP_ATIVO : CHIP_INATIVO}`}>{t.rotulo}</button>
              ))}
            </div>
            {!livre && temLivre && (
              <p className="mt-2 rounded-xl bg-surface-2 px-3 py-2 text-sm text-ink-2">Ao salvar, o seu texto de agora sai. Para ter mais de uma promoção escrita do seu jeito (ex.: kit em que o cliente escolhe as massas), volte em Escrever do meu jeito e escreva todas no mesmo texto.</p>
            )}
            {livre && lista.length === 1 && (
              <p className="mt-2 rounded-xl bg-surface-2 px-3 py-2 text-sm text-ink-2">Ao salvar, “{lista[0].nome}” é encerrada e o seu texto fica no lugar.</p>
            )}
          </div>

          {livre ? (
            <>
              <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm text-ink-2">
                É um texto só: tem mais de uma promoção? Escreva todas aqui, uma embaixo da outra (ex.: Kit Natal 1 e Kit Natal 2). Kit em que o cliente escolhe as massas fica aqui; kit com produtos fixos pode ir em Kit com preço fechado.
              </p>
              <div>
                <label htmlFor="promo-cliente" className={ROTULO_CAMPO}>O que o cliente lê no cardápio (até {PROMO_CLIENTE_MAX} letras)</label>
                <textarea id="promo-cliente" rows={2} maxLength={PROMO_CLIENTE_MAX} value={cliente} onChange={(e) => setCliente(e.target.value)}
                  placeholder="Ex.: Leve 2 kg de nhoque e ganhe 5% de desconto."
                  className="w-full resize-y rounded-xl border border-surface-line bg-white px-3 py-2 text-base text-ink focus:border-brand focus:outline-none" />
                <p className="mt-1 text-xs text-ink-3">
                  {clienteLimpo.length}/{PROMO_CLIENTE_MAX}{!clienteLivre && clienteLimpo && clienteLimpo === sugestaoPromocaoCliente(textoLivre) ? " · sugestão tirada do texto do robô: confira antes de salvar" : ""}
                </p>
              </div>
              <div>
                <label htmlFor="promo-robo" className={ROTULO_CAMPO}>Detalhes para o robô (opcional)</label>
                <textarea id="promo-robo" rows={4} maxLength={ROBO_MAX} value={detalhes} onChange={(e) => setDetalhes(e.target.value)}
                  placeholder="Ex.: Vale até sábado, só para retirada."
                  className="w-full resize-y rounded-xl border border-surface-line bg-white px-3 py-2 text-base text-ink focus:border-brand focus:outline-none" />
                <p className="mt-1 text-xs text-ink-3">Regras que o cliente não precisa ler: até quando vale, para quem, como combinar. O robô oferece uma vez por conversa.</p>
                {avisoRobo && <p className="mt-1 text-xs text-warn-ink" role="note">{avisoRobo}</p>}
              </div>
              {clienteLimpo && (
                <div>
                  <p className={ROTULO_CAMPO}>Como o cliente vê</p>
                  <p className="rounded-xl bg-brand-soft px-3 py-2 text-sm font-semibold text-brand-dark">{clienteLimpo}</p>
                  <p className="mt-1 text-xs text-ink-3">O desconto é confirmado no WhatsApp.</p>
                </div>
              )}
            </>
          ) : (
            <>
              <div>
                <label className={ROTULO_CAMPO} htmlFor="promo-nome">Nome</label>
                <input id="promo-nome" className={CAMPO} maxLength={NOME_MAX} value={regra.nome}
                  placeholder={regra.tipo === "kit" ? "Ex.: Kit Nhoque com molho" : "Ex.: Leve 2 kg de nhoque"}
                  onChange={(e) => setRegra((r) => ({ ...r, nome: e.target.value }))} />
                <p className="mt-1 text-xs text-ink-3">É o que o cliente e o robô leem ({regra.nome.length}/{NOME_MAX}). Cada promoção tem um nome diferente.</p>
              </div>

              <div>
                <p className={ROTULO_CAMPO}>{regra.tipo === "kit" ? "O que vem no kit" : "Produto(s) da promoção"}</p>
                <ul className="flex flex-wrap gap-2">
                  {regra.itens.map((i) => (
                    <li key={i.product_name} className="inline-flex min-h-11 items-center gap-1 rounded-full border border-surface-line bg-white pl-3 text-sm text-ink">
                      {regra.tipo === "kit" && (
                        <>
                          <button type="button" className="flex h-10 w-10 items-center justify-center rounded-full text-ink-2 hover:bg-surface disabled:opacity-40"
                            aria-label={`Menos ${i.product_name}`} disabled={Number(i.qtd) <= 1} onClick={() => setQtd(i.product_name, -1)}>
                            <MaterialIcon icon="remove" size={16} aria-hidden="true" />
                          </button>
                          <span className="tabular-nums font-semibold">{i.qtd} ×</span>
                          <button type="button" className="flex h-10 w-10 items-center justify-center rounded-full text-ink-2 hover:bg-surface"
                            aria-label={`Mais ${i.product_name}`} onClick={() => setQtd(i.product_name, 1)}>
                            <MaterialIcon icon="add" size={16} aria-hidden="true" />
                          </button>
                        </>
                      )}
                      <span className="max-w-[16rem] truncate">{i.product_name}</span>
                      <button type="button" className="flex h-10 w-10 items-center justify-center rounded-full text-ink-3 hover:bg-surface"
                        aria-label={`Tirar ${i.product_name}`} onClick={() => tirar(i.product_name)}>
                        <MaterialIcon icon="close" size={16} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                  {regra.itens.length < MAX_ITENS && (
                    <li>
                      <button type="button" className={`${BTN_SECUNDARIO} min-h-11 rounded-full`} onClick={() => setEscolhendo(true)}>
                        <MaterialIcon icon="add" size={18} aria-hidden="true" /> produto
                      </button>
                    </li>
                  )}
                </ul>
                {divide.length > 0 && (
                  <p className="mt-2 rounded-xl bg-surface-2 px-3 py-2 text-sm text-ink-2" data-promo-divide-form>
                    Esta promoção divide produtos com {divide.map((n) => `“${n}”`).join(" e ")}. Pode: se o cliente pedir as duas, o sistema escolhe a combinação que dá mais desconto.
                  </p>
                )}
              </div>

              {regra.tipo === "kit" && regra.itens.some((i) => produtos.find((p) => p.produto === i.product_name)?.zerado) && (
                <p className="rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn-ink">
                  Um produto do kit está zerado: o kit só aparece no cardápio depois que você repor. O robô continua oferecendo pelo texto.
                </p>
              )}

              {regra.tipo === "kit" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className={ROTULO_CAMPO}>Preço normal</p>
                    <p className="flex h-11 items-center rounded-xl bg-surface-2 px-3 text-sm tabular-nums text-ink-2">
                      {normal != null ? `${brl(normal)} (soma sozinho)` : "Escolha os produtos"}
                    </p>
                  </div>
                  <div>
                    <label className={ROTULO_CAMPO} htmlFor="promo-preco">Preço do kit</label>
                    <input id="promo-preco" className={CAMPO} type="number" inputMode="decimal" min="0" step="0.01" value={regra.preco ?? ""}
                      onChange={(e) => setRegra((r) => ({ ...r, preco: e.target.value === "" ? null : e.target.value }))} />
                    {desconto != null && desconto > 0 && <p className="mt-1 text-xs text-ink-3">{desconto}% de desconto (máximo 35%).</p>}
                  </div>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={ROTULO_CAMPO} htmlFor="promo-min">Quantas (somando os produtos)</label>
                    <select id="promo-min" className={CAMPO} value={regra.min_qtd} onChange={(e) => setRegra((r) => ({ ...r, min_qtd: Number(e.target.value) }))}>
                      {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={ROTULO_CAMPO} htmlFor="promo-pct">Desconto (%)</label>
                    <input id="promo-pct" className={CAMPO} type="number" inputMode="numeric" min="1" max="35" step="1" value={regra.pct ?? ""}
                      onChange={(e) => setRegra((r) => ({ ...r, pct: e.target.value === "" ? null : Number(e.target.value) }))} />
                  </div>
                </div>
              )}

              <div className="sm:max-w-xs">
                <label className={ROTULO_CAMPO} htmlFor="promo-ate">Vale até</label>
                <input id="promo-ate" className={CAMPO} type="date" min={hojeISO} value={regra.vale_ate || ""}
                  onChange={(e) => setRegra((r) => ({ ...r, vale_ate: e.target.value || null }))} />
                <p className="mt-1 text-xs text-ink-3">Sem data, vale até você encerrar. No dia seguinte à data, sai sozinha do cardápio e do robô.</p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <p className={ROTULO_CAMPO}>Como o cliente vê</p>
                  <PreviaCliente regra={regra} produtos={produtos} texto={texto} kitNoCardapio={!!painel?.kit_no_cardapio} />
                </div>
                <div>
                  <p className={ROTULO_CAMPO}>Como o robô vai dizer</p>
                  <p className="rounded-2xl bg-surface-2 p-3 text-sm text-ink">{texto || (regra.itens.length ? "Digite o preço do kit para ver a frase." : "Escolha os produtos para ver a frase.")}</p>
                </div>
              </div>

              <p className="text-sm text-ink-3">Um item do kit ficou em falta? O kit some do cardápio e volta quando repor.</p>
            </>
          )}

          {tentou && erro && <p className="text-sm font-semibold text-err" role="alert">{erro}</p>}

          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" className={`${BTN_PRIMARIO} min-h-11`} onClick={salvar} disabled={salvando}>
              {salvando ? "Salvando…" : "Salvar promoção"}
            </button>
            <button type="button" className={`${BTN_SECUNDARIO} min-h-11`} onClick={voltarAoSalvo} disabled={salvando}>Cancelar</button>
          </div>
        </div>
      )}

      <EscolherProduto aberto={escolhendo} onFechar={() => setEscolhendo(false)} produtos={paraEscolher}
        jaEscolhidos={regra.itens.map((i) => i.product_name)}
        onEscolher={(nome) => setRegra((r) => ({ ...r, itens: [...r.itens, { product_name: nome, qtd: 1 }] }))} />

      <AlertDialog open={confirmarFim !== null} onOpenChange={(v) => { if (!v) setConfirmarFim(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar a promoção?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmarFim !== null && confirmarFim >= 0 && lista[confirmarFim] ? `“${lista[confirmarFim].nome}”` : "A promoção"} sai do cardápio e o robô para de oferecer agora.
              {confirmarFim !== null && confirmarFim >= 0 && lista.length > 1 ? " As outras continuam." : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">Voltar</AlertDialogCancel>
            <AlertDialogAction className="min-h-11" onClick={() => { const i = confirmarFim; setConfirmarFim(null); onEncerrar(i !== null && i >= 0 ? tiraRegra(lista, i) : []); }}>Encerrar promoção</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
