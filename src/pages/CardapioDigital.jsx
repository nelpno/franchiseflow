// "Cardápio digital" (10/11/2026, ESPEC do cardápio § 4; piloto Imirim). Área da franqueada, fora do Meu robô.
// Ordem dos blocos = o trabalho dela: 1) ligar e divulgar · 2) o que trava a venda · 3) resultado · 4) promoção ·
// 5) produtos · rodapé. Junção com o Meu robô (10/11/2026, docs/2026-11-10-juncao-meu-robo-cardapio.md): aqui é "vender pelo
// link hoje" (ligar, divulgar, pausar a entrega hoje, promoção inteira, produtos, resultado); como a unidade funciona
// (horários, prazo, frete, pagamento) só no Meu robô, com atalho para o cartão exato. Pausa e promoção aparecem antes de ligar. Menu: chave cardapio_digital (desde 10/11/2026 ligada para a REDE; desligada por unidade = freio de
// emergência, o menu some e a página volta para a Início). Admin vê sempre, escolhe a unidade e vê a adesão da rede.
// Ligar = checklist do banco em dia (cardapio_checklist, SQL 2026-11-10f); o link nasce do nome da unidade.
// Dados: RPCs cardapio_painel / cardapio_resultado / cardapio_configurar / cardapio_produtos_visiveis
// (site/pedido/supabase/2026-11-10-cardapio-painel.sql). Nada aqui cita o pacote mensal.
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import PageHeader from "@/components/shared/PageHeader";
import ErrorState from "@/components/shared/ErrorState";
import FranchisePicker from "@/components/shared/FranchisePicker";
import { LINK_ACAO, PAGINA } from "@/components/shared/adminUi";
import LinkCard, { PrimeiroUsoCard } from "@/components/cardapio/LinkCard";
import PendenciasCard from "@/components/cardapio/PendenciasCard";
import EntregaHojeCard from "@/components/cardapio/EntregaHojeCard";
import ResultadoCards, { PERIODOS } from "@/components/cardapio/ResultadoCards";
import PromocaoForm from "@/components/cardapio/PromocaoForm";
import CupomForm from "@/components/cardapio/CupomForm";
import ProdutosLista from "@/components/cardapio/ProdutosLista";
import AdesaoRede from "@/components/cardapio/AdesaoRede";
import FreteConsumoCard from "@/components/cardapio/FreteConsumoCard";
import { useAuth } from "@/lib/AuthContext";
import { useFeatureFlagState } from "@/hooks/useFeatureFlag";
import { FEATURE_KEYS } from "@/lib/featureFlags";
import { getAvailableFranchises, resolveActiveFranchise } from "@/lib/franchiseUtils";
import { listarFranquias } from "@/lib/franchisesCache";
import { getCardapioPainel, getCardapioResultado, cardapioConfigurar, cardapioProdutosVisiveis } from "@/entities/all";
import { comPendentes, itensDoChecklist, linkMeuRobo, mensagemErroCardapio, pendencias } from "@/lib/cardapioDigital";
import { hojeBRT } from "@/lib/horarioEspecial";
import { registrarEvento } from "@/lib/telemetria";

const TITULO = "Cardápio digital";
const SUBTITULO = "Seu cliente monta o pedido sozinho e ele chega pronto no seu WhatsApp.";

function Esqueleto() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-40 rounded-2xl motion-reduce:animate-none" />
      <Skeleton className="h-24 rounded-2xl motion-reduce:animate-none" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-2xl motion-reduce:animate-none" />)}
      </div>
    </div>
  );
}

export default function CardapioDigital() {
  const { user, selectedFranchise, setSelectedFranchise } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "manager";
  const isFranqueado = user?.role === "franchisee";
  const [searchParams, setSearchParams] = useSearchParams();
  const dias = PERIODOS.some((p) => String(p.dias) === searchParams.get("periodo")) ? Number(searchParams.get("periodo")) : 7;
  const queryClient = useQueryClient();
  const promoRef = useRef(null);
  const [franquias, setFranquias] = useState(null);
  const [salvando, setSalvando] = useState(null); // "ativo" | "bio" | "promocao" | "cupom" | "pausa" | "whatsapp"
  const [salvandoIds, setSalvandoIds] = useState(() => new Set());
  // "Mostrar" em voo ({id: visivel}): todo dado que chega do servidor (refetch de foco, resposta de outra gravação) passa
  // por comPendentes, então nunca desfaz um toque que ainda não voltou (code review 10/11/2026)
  const pendentesRef = useRef(new Map());

  useEffect(() => {
    let vivo = true;
    listarFranquias().then((l) => vivo && setFranquias(l || []), () => vivo && setFranquias([]));
    return () => { vivo = false; };
  }, []);

  const unidade = useMemo(() => (franquias ? resolveActiveFranchise(franquias, user, selectedFranchise) : null), [franquias, user, selectedFranchise]);
  const evo = unidade?.evolution_instance_id || null;
  const { value: chaveLigada, resolved: chaveResolvida } = useFeatureFlagState(FEATURE_KEYS.CARDAPIO_DIGITAL, evo || undefined);
  const pode = !!evo && (isAdmin || chaveLigada);

  const painelQ = useQuery({
    queryKey: ["cardapio-painel", evo],
    queryFn: ({ signal }) => getCardapioPainel(evo, { signal }).then((p) => comPendentes(p, pendentesRef.current)),
    enabled: pode,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: "always",
  });
  const painel = painelQ.data;
  const primeiroUso = !!painel && !painel.ativo && !painel.ja_usou;
  const resultadoQ = useQuery({
    queryKey: ["cardapio-resultado", evo, dias],
    queryFn: ({ signal }) => getCardapioResultado(evo, dias, { signal }),
    enabled: pode && !!painel && !primeiroUso,
    staleTime: 5 * 60 * 1000,
  });

  const hoje = hojeBRT();
  const itensPendentes = useMemo(() => pendencias(painel, { hojeISO: hoje }), [painel, hoje]);

  useEffect(() => {
    if (painel?.evo) registrarEvento("cardapio_tela_aberta");
  }, [painel?.evo]);
  // ?bloco=promocao (atalho "Mudar em Cardápio digital › Promoção" do Meu robô): rola até o bloco quando ele existir
  // (uma vez só: o painel muda a cada gravação e refetch, e a página não pode pular de volta para a promoção)
  const blocoPedido = searchParams.get("bloco");
  const rolouRef = useRef(false);
  const temPainel = !!painel;
  useEffect(() => {
    if (blocoPedido !== "promocao" || !temPainel || rolouRef.current) return undefined;
    const t = setTimeout(() => {
      if (!promoRef.current) return;
      rolouRef.current = true;
      promoRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 300);
    return () => clearTimeout(t);
  }, [blocoPedido, temPainel]);
  // telemetria da adesão: viu o checklist (desligado), com o que faltava; uma vez por unidade aberta
  const checklistVisto = useRef(null);
  useEffect(() => {
    if (!painel?.evo || painel.ativo || checklistVisto.current === painel.evo) return;
    checklistVisto.current = painel.evo;
    const falta = itensDoChecklist(painel).filter((i) => i.estado === "trava").map((i) => i.id);
    registrarEvento("cardapio_checklist_visto", { detalhe: falta.length ? falta.join(",") : "pronto", semClarity: true });
  }, [painel]);

  // ---------- quem pode ver ----------
  if (user && !isAdmin && !isFranqueado) return <Navigate to="/Dashboard" replace />;
  if (isFranqueado && evo && chaveResolvida && !chaveLigada) return <Navigate to="/Dashboard" replace />;

  const cabecalho = (
    <PageHeader titulo={TITULO} subtitulo={SUBTITULO}
      situacao={isAdmin && unidade && searchParams.get("visao") !== "rede" ? `Unidade: ${String(unidade.name || unidade.city || "").replace(/^Maxi Massas\s+/i, "")}` : undefined} />
  );

  if (!franquias || (evo && !chaveResolvida && !isAdmin)) {
    return <div className={PAGINA}>{cabecalho}<Esqueleto /></div>;
  }
  const verRede = isAdmin && (searchParams.get("visao") === "rede" || !unidade);
  const abrirUnidade = (f) => {
    setSelectedFranchise?.(f);
    const q = new URLSearchParams(searchParams);
    q.delete("visao");
    setSearchParams(q, { replace: true });
  };
  if (verRede) {
    return (
      <div className={PAGINA}>
        {cabecalho}
        <AdesaoRede franquias={franquias} onAbrir={abrirUnidade} />
        <FreteConsumoCard modo="rede" franchiseId={(franquias || [])[0]?.evolution_instance_id} />
      </div>
    );
  }
  if (!unidade) {
    return (
      <div className={PAGINA}>
        {cabecalho}
        <FranchisePicker franchises={getAvailableFranchises(franquias, user)} title="Cardápio de qual unidade?" />
      </div>
    );
  }

  // ---------- ações ----------
  const chavePainel = ["cardapio-painel", evo];
  const gravarPainel = (novo) => queryClient.setQueryData(chavePainel, comPendentes(novo, pendentesRef.current));
  const configurar = async (qual, campos, ok) => {
    setSalvando(qual);
    try {
      const novo = await cardapioConfigurar(evo, campos);
      gravarPainel(novo);
      ok?.(novo);
      return true;
    } catch (e) {
      const msg = mensagemErroCardapio(e, "Não deu para salvar. Tente de novo.");
      toast.error(msg);
      if (qual === "ativo" && campos.ativo === true) registrarEvento("cardapio_ligar_recusado", { detalhe: `servidor: ${msg}`, semClarity: true });
      return false;
    } finally {
      setSalvando(null);
    }
  };
  // 10i: sem WhatsApp público, com o robô conectado: usa o número do robô (a franqueada confirmou no checklist)
  const usarRobo = () => configurar("whatsapp", { whatsapp_do_robo: true }, () => {
    toast.success("Pronto. Os pedidos do cardápio vão chegar no WhatsApp do robô.");
    registrarEvento("cardapio_whatsapp_do_robo", { semClarity: true });
  });
  // junção 10/11: promoção "do meu jeito" = frase do cliente (promocao_cliente) + texto do robô (promotions_combo, SQL 10n);
  // encerra a estruturada no mesmo toque (o banco grava a regra antes do texto)
  const salvarPromoLivre = ({ cliente, robo }) => configurar("promocao", { promocao_regras: [], promocao_cliente: cliente, promocao_robo: robo }, () => {
    toast.success("Promoção salva. O cardápio e o robô já mostram.");
    registrarEvento("cardapio_promo_livre_salva", { semClarity: true });
  });
  // tocou em ligar com item vermelho (não foi ao servidor): conta o que faltava
  const recusado = (ids) => registrarEvento("cardapio_ligar_recusado", { detalhe: ids.join(",") || "?", semClarity: true });
  const ligar = (v) => configurar("ativo", { ativo: v }, () => {
    toast.success(v ? "Cardápio ligado." : "Cardápio em pausa. O robô para de mandar o link.");
    registrarEvento(v ? "cardapio_ligado" : "cardapio_desligado");
  });
  const marcarBio = () => configurar("bio", { link_bio: true }, () => {
    toast.success("Anotado. Obrigado!");
    registrarEvento("cardapio_bio_marcada");
  });
  // kit / leve N: a frase escrita à mão sai (senão ela ficaria no cardápio no lugar do texto da regra)
  const salvarPromocao = (regra) => configurar("promocao", { promocao_regras: [regra], promocao_cliente: null }, () => {
    toast.success("Promoção salva. O robô já oferece.");
    registrarEvento("cardapio_promocao_salva");
  });
  const encerrarPromocao = () => configurar("promocao", { promocao_regras: [], promocao_cliente: null, promocao_robo: null }, () => {
    toast.success("Promoção encerrada.");
    registrarEvento("cardapio_promocao_encerrada");
  });
  // v8: entrega de hoje (pausa volta sozinha; vale para o cardápio e o robô)
  const pausarEntrega = (quando) => configurar("pausa", { entrega_pausa: quando }, () => {
    toast.success(quando === null ? "Entrega de volta no cardápio." : quando === "hoje" ? "Entrega pausada hoje. Volta sozinha amanhã." : `Entrega pausada até as ${quando}.`);
    registrarEvento(quando === null ? "cardapio_entrega_voltou" : "cardapio_entrega_pausada");
  });
  // 11/11: cupom de desconto (cartão abaixo da Promoção; vale para o cardápio e para o robô). Desligado por padrão em toda unidade.
  const salvarCupom = (cupom, como) => configurar("cupom", { cupom }, () => {
    toast.success(como === "ligado" ? "Cupom ligado. O cardápio e o robô já aceitam o código."
      : como === "desligado" ? "Cupom desligado." : "Cupom salvo.");
    registrarEvento(como === "ligado" ? "cardapio_cupom_ligado" : como === "desligado" ? "cardapio_cupom_desligado" : "cardapio_cupom_salvo", { semClarity: true });
  });
  const mostrar = async (ids, visivel) => {
    // só os itens DESTE toque voltam se falhar (os outros toques em voo ficam como estão)
    const antes = new Map((painel?.produtos || []).filter((p) => ids.includes(p.id)).map((p) => [p.id, p.visivel !== false]));
    await queryClient.cancelQueries({ queryKey: chavePainel }); // refetch em voo não sobrescreve o toque
    ids.forEach((i) => pendentesRef.current.set(i, visivel));
    setSalvandoIds((s) => new Set([...s, ...ids]));
    queryClient.setQueryData(chavePainel, (p) => comPendentes(p, pendentesRef.current));
    try {
      await cardapioProdutosVisiveis(evo, ids, visivel);
      ids.forEach((i) => { if (pendentesRef.current.get(i) === visivel) pendentesRef.current.delete(i); });
      toast.success(visivel ? "Volta a aparecer no cardápio." : ids.length > 1 ? `${ids.length} produtos escondidos do cardápio.` : "Escondido do cardápio.");
      registrarEvento(visivel ? "cardapio_produto_mostrar" : "cardapio_produto_esconder");
    } catch (e) {
      ids.forEach((i) => { if (pendentesRef.current.get(i) === visivel) pendentesRef.current.delete(i); });
      queryClient.setQueryData(chavePainel, (p) => p && comPendentes(
        { ...p, produtos: p.produtos.map((x) => (antes.has(x.id) && !pendentesRef.current.has(x.id) ? { ...x, visivel: antes.get(x.id) } : x)) },
        pendentesRef.current));
      toast.error(mensagemErroCardapio(e, "Não deu para salvar. Tente de novo."));
    } finally {
      setSalvandoIds((s) => { const n = new Set(s); ids.forEach((i) => n.delete(i)); return n; });
    }
  };
  const mudarDias = (d) => {
    const q = new URLSearchParams(searchParams);
    if (d === 7) q.delete("periodo"); else q.set("periodo", String(d));
    setSearchParams(q, { replace: true });
  };

  return (
    <div className={`${PAGINA} pb-24 md:pb-6`}>
      {cabecalho}

      {painelQ.isLoading ? (
        <Esqueleto />
      ) : painelQ.isError || !painel ? (
        <ErrorState cartao texto="Confira a internet e tente de novo." onTentarNovamente={() => painelQ.refetch()} />
      ) : primeiroUso ? (
        <>
          <PrimeiroUsoCard painel={painel} ligando={salvando === "ativo"} onLigar={ligar} onRecusado={recusado}
            onUsarRobo={usarRobo} salvandoRobo={salvando === "whatsapp"} />
          {/* junção 10/11: pausa e promoção valem também para o robô, então aparecem antes de ligar */}
          <EntregaHojeCard painel={painel} hojeISO={hoje} salvando={salvando === "pausa"} onPausar={pausarEntrega} />
          <PromocaoForm painel={painel} hojeISO={hoje} salvando={salvando === "promocao"} onSalvar={salvarPromocao}
            onSalvarLivre={salvarPromoLivre} onEncerrar={encerrarPromocao} secaoRef={promoRef} />
          <CupomForm painel={painel} hojeISO={hoje} salvando={salvando === "cupom"} onSalvar={salvarCupom} />
        </>
      ) : (
        <>
          <LinkCard painel={painel} ligando={salvando === "ativo"} onLigar={ligar} onRecusado={recusado}
            onUsarRobo={usarRobo} salvandoRobo={salvando === "whatsapp"} />
          <EntregaHojeCard painel={painel} hojeISO={hoje} salvando={salvando === "pausa"} onPausar={pausarEntrega} />
          <PendenciasCard itens={itensPendentes} nomeUnidade={painel.nome} onBio={marcarBio} marcandoBio={salvando === "bio"}
            onIrPromocao={() => promoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} />
          <ResultadoCards dias={dias} onDias={mudarDias} resultado={resultadoQ.data} carregando={resultadoQ.isLoading}
            erro={resultadoQ.isError} onTentar={() => resultadoQ.refetch()} />
          <FreteConsumoCard franchiseId={evo} />
          <PromocaoForm painel={painel} hojeISO={hoje} salvando={salvando === "promocao"} onSalvar={salvarPromocao}
            onSalvarLivre={salvarPromoLivre} onEncerrar={encerrarPromocao} secaoRef={promoRef} />
          <CupomForm painel={painel} hojeISO={hoje} salvando={salvando === "cupom"} onSalvar={salvarCupom} />
          <ProdutosLista produtos={painel.produtos} salvandoIds={salvandoIds} onMostrar={mostrar} />
        </>
      )}

      {isAdmin && (
        <p className="text-sm">
          <Link to="/CardapioDigital?visao=rede" className={LINK_ACAO}>Ver a adesão da rede →</Link>
        </p>
      )}
      <p className="border-t border-surface-line pt-4 text-sm text-ink-3">
        Horários, entrega, prazo, frete e pagamento ficam no Meu robô e valem para o robô e para o cardápio.{" "}
        <Link to={linkMeuRobo()} className={LINK_ACAO}>Abrir o Meu robô →</Link>
      </p>
    </div>
  );
}
