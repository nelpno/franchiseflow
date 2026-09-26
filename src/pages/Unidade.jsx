// Ficha da unidade — /Unidade?id=<evolution_instance_id>. Fase 2 do redesenho do
// admin (~/.claude/plans/admin-redesign-2026-09-26.md). Reaproveita o raio-x do
// FranchiseDrawer (RaioXPanel) e a régua/dados de get_unit_360 (getUnitDetail em src/entities/all.js).
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/AuthContext";
import { safeErrorMessage } from "@/lib/safeErrorMessage";
import { dataCurta } from "@/lib/adminFormat";
import { LINK_ACAO, LINK_VOLTAR, PAGINA, TOM_MAXI } from "@/components/shared/adminUi";
import { getUnitDetail } from "@/entities/all";
import { createCsTask, addCsTaskEvent, updateCsTask, moveCsTask } from "@/entities/all";
import { diagnosticar, roteiroPara, montarMensagemUnidade, guiaPara } from "@/lib/fichaUnidade";
import { linhaDaFicha, nomeCurto, rotuloMesVerba, voltarDaFicha } from "@/lib/networkOverview";
import RaioXPanel from "@/components/unidade/RaioXPanel";
import UnidadeHeader, { UnidadeNav } from "@/components/unidade/UnidadeHeader";
import DiagnosisCard from "@/components/unidade/DiagnosisCard";
import MessageCard from "@/components/unidade/MessageCard";
import MetricsGrid from "@/components/unidade/MetricsGrid";
import RoutineGrid from "@/components/unidade/RoutineGrid";
import ConversasCard, { notasRelevantes } from "@/components/unidade/ConversasCard";
import MobileActionBar from "@/components/unidade/MobileActionBar";
import RegistrarConversaDialog from "@/components/unidade/RegistrarConversaDialog";

const CS_ROLES = ["admin", "manager", "customer_success"];

export default function Unidade() {
  const { user } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const evo = searchParams.get("id");

  const [unit, setUnit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mensagem, setMensagem] = useState("");
  const [mensagemEditada, setMensagemEditada] = useState(false);
  const [registrando, setRegistrando] = useState(false);
  const [showRaioX, setShowRaioX] = useState(false);
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  // Troca de ?id= no meio de uma carga: a resposta antiga (da unidade anterior) não
  // pode sobrescrever o estado depois que uma mais nova já chegou (race) — e a
  // mensagem editada de uma unidade não pode "vazar" pra outra quando o id muda.
  // mensagemEditadaRef espelha o state: `load` lê pelo ref (não pelo state, que
  // ficaria preso ao valor de quando o callback foi criado) sem precisar recriar
  // `load`/o effect a cada tecla digitada no textarea.
  const seqRef = useRef(0);
  const mensagemEditadaRef = useRef(false);
  useEffect(() => { mensagemEditadaRef.current = mensagemEditada; }, [mensagemEditada]);

  const load = useCallback(async () => {
    const minhaSeq = ++seqRef.current;
    if (!evo) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const data = await getUnitDetail(evo);
      if (!mountedRef.current || seqRef.current !== minhaSeq) return;
      setUnit(data);
      if (!mensagemEditadaRef.current) setMensagem(data ? montarMensagemUnidade(data) : "");
    } catch (e) {
      if (mountedRef.current && seqRef.current === minhaSeq) {
        setError(safeErrorMessage(e, "Não foi possível carregar a ficha desta unidade."));
      }
    } finally {
      if (mountedRef.current && seqRef.current === minhaSeq) setLoading(false);
    }
  }, [evo]);

  useEffect(() => {
    // Muda a unidade (?id=): a mensagem editada era da unidade anterior, não desta.
    setMensagemEditada(false);
    mensagemEditadaRef.current = false;
    load();
  }, [evo, load]);

  const [dialogConversa, setDialogConversa] = useState(false);
  const [notaInicial, setNotaInicial] = useState("");
  const registrarConversa = () => { if (unit) { setNotaInicial(""); setDialogConversa(true); } };

  // Item 29, 26/09: ao voltar do WhatsApp (a aba volta a ficar visível), abre o diálogo
  // já com "Mandei: <mensagem>" — antes eram 4 passos (WhatsApp, voltar, clicar
  // Registrar, digitar do zero) pra registrar uma conversa que o admin acabou de mandar.
  const mensagemEnviadaRef = useRef(null);
  const marcarMensagemEnviada = (texto) => { mensagemEnviadaRef.current = texto; };
  useEffect(() => {
    const aoVoltar = () => {
      if (document.visibilityState !== "visible") return;
      const texto = mensagemEnviadaRef.current;
      if (!texto) return;
      mensagemEnviadaRef.current = null;
      setNotaInicial(`Mandei: ${texto}`);
      setDialogConversa(true);
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => document.removeEventListener("visibilitychange", aoVoltar);
  }, []);

  const salvarConversa = async ({ tipo, nota, resolvido }) => {
    if (!unit || registrando) return;
    setRegistrando(true);
    try {
      const nowIso = new Date().toISOString();
      const aberto = unit.cs?.open_tasks?.[0];
      let taskId = aberto?.id;
      if (aberto) {
        if (resolvido) {
          await moveCsTask(aberto.id, "feito", user?.id, unit.franchise_id);
        } else {
          await updateCsTask(aberto.id, { column_status: "aguardando_retorno", moved_to_column_at: nowIso });
        }
      } else {
        const novo = await createCsTask(
          {
            franchise_id: unit.franchise_id,
            title: `Cuidar de ${nomeCurto(unit.franchise_name)}`,
            column_status: resolvido ? "feito" : "aguardando_retorno",
            moved_to_column_at: nowIso,
            ...(resolvido ? { resolved_at: nowIso } : {}),
          },
          user?.id
        );
        taskId = novo.id;
      }
      await addCsTaskEvent(taskId, tipo, nota, user?.id, unit.franchise_id);
      setDialogConversa(false);
      toast.success(
        resolvido
          ? aberto
            ? `Conversa registrada. O cartão "${aberto.title || nomeCurto(unit.franchise_name)}" foi fechado no Mural.`
            : `Conversa registrada. Não fica esperando resposta no Mural.`
          : `Conversa registrada. ${nomeCurto(unit.franchise_name)} foi para “Esperando resposta” no Mural.`
      );
      await load();
    } catch (e) {
      toast.error(safeErrorMessage(e, "Não foi possível registrar a conversa."));
    } finally {
      setRegistrando(false);
    }
  };

  const [assumindo, setAssumindo] = useState(false);
  // "Assumir" (UnidadeHeader): atribui de fato o cartão aberto a quem clicou — antes
  // era só um Link pro Mural genérico que não assumia nada (achado ALTO, 26/09).
  const assumirCartao = async () => {
    if (!unit || assumindo || !user?.id) return;
    setAssumindo(true);
    try {
      const aberto = unit.cs?.open_tasks?.[0];
      if (aberto) {
        await updateCsTask(aberto.id, { assignee: user.id });
      } else {
        const nowIso = new Date().toISOString();
        const novo = await createCsTask(
          { franchise_id: unit.franchise_id, title: `Cuidar de ${nomeCurto(unit.franchise_name)}`, column_status: "a_fazer", moved_to_column_at: nowIso },
          user.id
        );
        await updateCsTask(novo.id, { assignee: user.id });
      }
      toast.success(`Agora você cuida de ${nomeCurto(unit.franchise_name)}`);
      await load();
    } catch (e) {
      toast.error(safeErrorMessage(e, "Não foi possível assumir o cartão."));
    } finally {
      setAssumindo(false);
    }
  };

  const semAcesso = user && !CS_ROLES.includes(user.role);
  const voltar = voltarDaFicha(location);

  if (semAcesso) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-center space-y-2">
        <MaterialIcon icon="lock" size={32} className="text-ink-3 mx-auto" aria-hidden="true" />
        <p className="text-base font-semibold text-ink">Você não tem acesso a esta tela.</p>
      </div>
    );
  }

  if (!evo) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-center space-y-2">
        <MaterialIcon icon="error_outline" size={32} className="text-ink-3 mx-auto" aria-hidden="true" />
        <p className="text-base font-semibold text-ink">Nenhuma unidade indicada.</p>
        <Link to="/Unidades" className="text-sm font-semibold text-brand-dark hover:underline">← Voltar para Unidades</Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 space-y-4">
        <Skeleton className="h-5 w-40 motion-reduce:animate-none" />
        <Skeleton className="h-10 w-72 motion-reduce:animate-none" />
        <Skeleton className="h-48 rounded-2xl motion-reduce:animate-none" />
        <Skeleton className="h-48 rounded-2xl motion-reduce:animate-none" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-center space-y-3">
        <MaterialIcon icon="cloud_off" size={32} className="text-ink-3 mx-auto" aria-hidden="true" />
        <p className="text-base font-semibold text-ink">{error}</p>
        <button type="button" onClick={load} className="text-sm font-semibold text-brand-dark">Tentar de novo</button>
      </div>
    );
  }

  if (!unit) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-center space-y-2">
        <MaterialIcon icon="search_off" size={32} className="text-ink-3 mx-auto" aria-hidden="true" />
        <p className="text-base font-semibold text-ink">Não encontramos essa unidade (ou você não tem acesso a ela).</p>
        <Link to="/Unidades" className="text-sm font-semibold text-brand-dark hover:underline">← Voltar para Unidades</Link>
      </div>
    );
  }

  const diagnostico = diagnosticar(unit);
  const roteiro = roteiroPara(diagnostico.motivo, { mes: rotuloMesVerba(linhaDaFicha(unit)) });
  const guia = guiaPara(diagnostico.motivo);
  // Cadastro, robô, pedidos e cobrança vivem em telas admin-only (App.jsx ADMIN_ONLY_PAGES);
  // o CS enxerga a Ficha mas seria redirecionado ao clicar nelas — esconder em vez de linkar pro nada.
  const podeVerFinanceiro = user?.role === "admin" || user?.role === "manager";
  const stateFicha = { from: location.pathname + location.search, label: `a ficha de ${nomeCurto(unit.franchise_name)}` };
  // Item 2, 26/09: o combinado mais recente com a unidade (notas do Mural com texto,
  // ignorando auto_open/auto_resolve/resolve sem nota) fica ACIMA do diagnóstico — sem
  // isso o admin manda a mensagem pronta contradizendo o que já foi combinado (Itatiba:
  // prazo até 02/10; Uberlândia: "não pressionar, você assume").
  const ultimoCombinado = notasRelevantes(unit.cs, 1)[0] || null;

  return (
    <div className={`${PAGINA} pb-36 md:pb-6`}>
      <Link to={voltar.to} className={LINK_VOLTAR}>
        {voltar.texto}
      </Link>

      <UnidadeHeader
        unit={unit}
        diagnostico={diagnostico}
        podeVerFinanceiro={podeVerFinanceiro}
        onAssumir={assumirCartao}
        assumindo={assumindo}
        userId={user?.id}
      />

      {ultimoCombinado && (
        <div className={TOM_MAXI}>
          <div className="text-xs font-bold uppercase tracking-wide text-ink-3">Último combinado</div>
          <p className="text-sm text-ink mt-1">
            {dataCurta(ultimoCombinado.created_at)}
            {ultimoCombinado.created_by_name ? ` · ${ultimoCombinado.created_by_name}` : ""}: {ultimoCombinado.note}
          </p>
          <a href="#conversas-com-a-unidade" className={`${LINK_ACAO} mt-1`}>Ver tudo →</a>
        </div>
      )}

      <section aria-label="Diagnóstico e ação" className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-4">
        <DiagnosisCard diagnostico={diagnostico} roteiro={roteiro} />
        <MessageCard
          mensagem={mensagem}
          onChangeMensagem={(v) => { setMensagem(v); setMensagemEditada(true); }}
          phone={unit.phone}
          onRegistrar={registrarConversa}
          registrando={registrando}
          guia={guia}
          onEnviar={marcarMensagemEnviada}
        />
      </section>

      <MetricsGrid unit={unit} />

      <RoutineGrid unit={unit} podeVerFinanceiro={podeVerFinanceiro} />

      <div id="conversas-com-a-unidade">
        <ConversasCard cs={unit.cs} franchiseId={unit.franchise_id} />
      </div>

      {/* Item 30, 26/09: cópia dos 3 links de navegação só para celular, no fim da página
          (no cabeçalho eles empurravam o diagnóstico para baixo). */}
      {podeVerFinanceiro && <UnidadeNav unit={unit} stateFicha={stateFicha} className="md:hidden flex flex-wrap gap-2" />}

      <div className="bg-white rounded-2xl border border-surface-line p-5 md:p-6">
        <button
          type="button"
          onClick={() => setShowRaioX((v) => !v)}
          className="w-full flex items-center justify-between text-xs font-bold text-ink-3 uppercase tracking-wide"
        >
          <span>Raio-x completo da unidade</span>
          <MaterialIcon icon={showRaioX ? "expand_less" : "expand_more"} size={18} />
        </button>
        {/* compacto: mensalidade, verba e último pedido já aparecem em cima (Rotina/Métricas)
            — repeti-los aqui com outra régua é o que causava a Uberlândia contradizer a si mesma. */}
        {showRaioX && <div className="mt-3"><RaioXPanel signals={unit.health?.signals} compacto /></div>}
      </div>

      <RegistrarConversaDialog
        open={dialogConversa}
        onOpenChange={setDialogConversa}
        nomeUnidade={nomeCurto(unit.franchise_name)}
        salvando={registrando}
        onSalvar={salvarConversa}
        notaInicial={notaInicial}
        cartaoAberto={unit.cs?.open_tasks?.[0] || null}
      />
      <MobileActionBar mensagem={mensagem} phone={unit.phone} onRegistrar={registrarConversa} registrando={registrando} onEnviar={marcarMensagemEnviada} />
    </div>
  );
}
