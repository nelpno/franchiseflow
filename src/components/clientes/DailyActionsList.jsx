// "Quem chamar hoje" — lista diária de clientes para o franqueado chamar no WhatsApp.
// variant="compact": cartão da tela Início (3 primeiros). variant="full": aba Hoje de Meus Clientes.
// A lista vem pronta da RPC get_daily_customer_actions; cada toque grava em contact_actions.
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Contact, getDailyCustomerActions, registrarAcaoCliente } from "@/entities/all";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { safeErrorMessage } from "@/lib/safeErrorMessage";
import { ACTION_ORDER, ACTION_TYPES, montarMensagem, nomeExibicao } from "@/lib/customerActions";
import { createPageUrl } from "@/utils";
import { ActionCard, CompactRow, DayProgress, HandledRow, MonthSummary } from "./ActionCards";

const DICA_KEY = "qch_dica_whatsapp_v1";
const RECARGA_MIN_MS = 60000;

// Gravações em fila por cliente, no nível do módulo: o "Desfazer" do toast e a
// troca Início → Meus Clientes não podem inverter a ordem (chamar → desfazer → chamar).
const filas = new Map(); // contact_id -> promessa da última gravação

function enfileirar(contactId, tarefa) {
  const anterior = filas.get(contactId) || Promise.resolve();
  const atual = anterior.catch(() => {}).then(tarefa);
  const fim = atual.catch(() => {}).finally(() => {
    if (filas.get(contactId) === fim) filas.delete(contactId);
  });
  filas.set(contactId, fim);
  return atual;
}

async function esperarFilas() {
  while (filas.size) await Promise.allSettled([...filas.values()]);
}

function lerDica() {
  try {
    return localStorage.getItem(DICA_KEY) !== "1";
  } catch {
    return true;
  }
}

function fecharDica() {
  try {
    localStorage.setItem(DICA_KEY, "1");
  } catch {
    // armazenamento é opcional
  }
}

// A key zera tudo (carga, fila, toasts) quando a unidade ativa muda.
export default function DailyActionsList(props) {
  return <DailyActionsContent key={props.franchiseId || "sem-unidade"} {...props} />;
}

function DailyActionsContent({ franchiseId, cidade = "", variant = "full", onVerSemTelefone, onContactChanged }) {
  const compact = variant === "compact";
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [skipItem, setSkipItem] = useState(null);
  const [animar, setAnimar] = useState(true);
  const [mostrarDica, setMostrarDica] = useState(lerDica);

  const mounted = useRef(false);
  const loaded = useRef(false);
  const lastLoad = useRef(0);
  const requestId = useRef(0);
  const ordem = useRef(new Map()); // contact_id -> posição original (a lista não se reembaralha)
  const versoes = useRef(new Map()); // contact_id -> última mudança pedida
  const confirmados = useRef(new Map()); // contact_id -> último estado salvo no banco
  const onContactChangedRef = useRef(onContactChanged);
  onContactChangedRef.current = onContactChanged;

  const load = useCallback(async () => {
    if (!franchiseId) {
      setData(null);
      setLoading(false);
      return;
    }
    const id = ++requestId.current;
    lastLoad.current = Date.now();
    setError(null);
    if (!loaded.current) setLoading(true);
    try {
      await esperarFilas(); // o banco precisa refletir o último toque
      if (!mounted.current || id !== requestId.current) return;
      const result = await getDailyCustomerActions(franchiseId);
      if (!mounted.current || id !== requestId.current) return;
      if (result === null) throw new Error("Lista indisponível para esta unidade");
      const itens = result.itens || [];
      ordem.current = new Map(itens.map((item, i) => [item.contact_id, i]));
      confirmados.current = new Map(itens.map((item) => [item.contact_id, item]));
      if (loaded.current) setAnimar(false);
      loaded.current = true;
      setData(result);
    } catch (err) {
      if (mounted.current && id === requestId.current) {
        setError(safeErrorMessage(err, "Não deu para carregar a lista."));
      }
    } finally {
      if (mounted.current && id === requestId.current) setLoading(false);
    }
  }, [franchiseId]);

  useEffect(() => {
    mounted.current = true;
    load();
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastLoad.current >= RECARGA_MIN_MS) load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      mounted.current = false;
      // eslint-disable-next-line react-hooks/exhaustive-deps -- contador de cargas, não é nó do DOM
      requestId.current++;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  // Troca (ou tira) um item mantendo a ordem original.
  const trocarItem = useCallback((contactId, novo) => {
    if (!mounted.current) return;
    setData((prev) => {
      if (!prev) return prev;
      const outros = prev.itens.filter((i) => i.contact_id !== contactId);
      const itens = novo ? [...outros, novo] : outros;
      itens.sort((a, b) => (ordem.current.get(a.contact_id) ?? 0) - (ordem.current.get(b.contact_id) ?? 0));
      return { ...prev, itens };
    });
  }, []);

  // Muda a tela na hora e grava em seguida. Gravações do mesmo cliente entram em
  // fila: "Desfazer" pode ser tocado antes da primeira terminar.
  // modo: "acao" (sent/skipped/null) | "nao_chamar" | "voltar_a_chamar"
  // Grava mesmo se a tela já foi fechada (ex.: "Desfazer" do toast depois de navegar).
  const gravar = useCallback((item, status, modo = "acao") => {
    if (!item) return;
    const id = item.contact_id;
    const versao = (versoes.current.get(id) || 0) + 1;
    versoes.current.set(id, versao);
    const novo = modo === "nao_chamar" ? null : { ...item, status_hoje: status };

    if (mounted.current) {
      setAnimar(false);
      requestId.current++; // descarta carga em andamento (ela veria o estado antigo)
      trocarItem(id, novo);
    }

    const patchContato =
      modo === "acao" ? null : { do_not_contact_at: modo === "nao_chamar" ? new Date().toISOString() : null };

    enfileirar(id, () =>
      patchContato ? Contact.update(id, patchContato) : registrarAcaoCliente(id, item.tipo, status)
    )
      .then(() => {
        confirmados.current.set(id, novo);
        if (patchContato) onContactChangedRef.current?.(id, patchContato);
      })
      .catch((err) => {
        if (versoes.current.get(id) === versao) trocarItem(id, confirmados.current.get(id));
        toast.error(safeErrorMessage(err, "Não deu para salvar. Tente de novo."));
      })
      .finally(() => {
        if (mounted.current) load();
      });
  }, [load, trocarItem]);

  const chamar = useCallback((item) => {
    gravar(item, "sent");
    toast.success(`${nomeExibicao(item)} marcado como chamado`, {
      action: { label: "Desfazer", onClick: () => gravar(item, null) },
    });
  }, [gravar]);

  const pularHoje = (item) => {
    setSkipItem(null);
    gravar(item, "skipped");
    toast.success("Pulado por hoje", {
      action: { label: "Desfazer", onClick: () => gravar(item, null) },
    });
  };

  const naoChamarMais = (item) => {
    setSkipItem(null);
    gravar(item, null, "nao_chamar");
    toast.success(`${nomeExibicao(item)} não aparece mais nas listas`, {
      action: { label: "Desfazer", onClick: () => gravar({ ...item, status_hoje: null }, null, "voltar_a_chamar") },
    });
  };

  const desfazer = (item) => gravar(item, null);

  const itens = data?.itens || [];
  const pendentes = itens.filter((i) => !i.status_hoje);
  const mensagem = (item) => montarMensagem(item, { cidade });

  if (loading) {
    return <Skeleton className={`${compact ? "h-44" : "h-72"} rounded-xl motion-reduce:animate-none`} />;
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-surface-line bg-white p-4">
        <MaterialIcon icon="cloud_off" size={22} className="text-ink-3" />
        <p className="min-w-0 flex-1 text-sm text-ink-2">Não deu para carregar a lista de hoje.</p>
        <button type="button" onClick={load} className="min-h-11 shrink-0 px-2 text-sm font-semibold text-brand">
          Tentar de novo
        </button>
      </div>
    );
  }

  // Início: sem ninguém, o cartão nem aparece
  if (compact && itens.length === 0) return null;

  const dica = mostrarDica && pendentes.length > 0 && (
    <div className="flex items-start gap-2 rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn-ink">
      <MaterialIcon icon="lightbulb" size={18} className="mt-0.5 shrink-0" />
      <p className="min-w-0 flex-1">
        Mande pelo <strong>WhatsApp da unidade</strong> (o mesmo número do robô). Quando você escreve, o robô
        pausa e deixa a conversa com você.
      </p>
      <button
        type="button"
        onClick={() => {
          setMostrarDica(false);
          fecharDica();
        }}
        className="min-h-11 shrink-0 px-1 font-semibold"
      >
        Entendi
      </button>
    </div>
  );

  if (compact) {
    return (
      <section className="min-w-0 space-y-3 rounded-xl border border-ink-4/10 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <h2 className="flex items-center gap-2 font-plus-jakarta text-base font-bold text-ink">
              <MaterialIcon icon="campaign" size={20} className="text-brand" />
              Quem chamar hoje
            </h2>
            <DayProgress items={itens} />
          </div>
        </div>

        {dica}

        {pendentes.length > 0 ? (
          <div className="space-y-3">
            {pendentes.slice(0, 3).map((item) => (
              <CompactRow key={item.contact_id} item={item} message={mensagem(item)} onCall={chamar} />
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl bg-ok-soft px-3 py-2.5">
            <MaterialIcon icon="check_circle" size={22} filled className="text-ok" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ok-ink">Tudo em dia por hoje 🎉</p>
              <MonthSummary summary={data?.resumo_mes} className="text-xs" />
            </div>
          </div>
        )}

        <Link
          to={`${createPageUrl("MyContacts")}?aba=hoje`}
          className="flex min-h-11 items-center justify-center gap-1 rounded-xl border border-surface-line text-sm font-semibold text-brand transition-colors hover:bg-surface"
        >
          {pendentes.length > 3 ? `Ver os outros ${pendentes.length - 3}` : "Ver lista completa"}
          <MaterialIcon icon="chevron_right" size={18} />
        </Link>
      </section>
    );
  }

  return (
    <section className="min-w-0 space-y-4">
      <div className="space-y-3 rounded-xl border border-ink-4/10 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-1.5">
            <h2 className="font-plus-jakarta text-lg font-bold text-ink">Quem chamar hoje</h2>
            {itens.length > 0 && <DayProgress items={itens} />}
          </div>
          <Link
            to={`${createPageUrl("Tutoriais")}?abrir=clientes`}
            className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-brand"
          >
            <MaterialIcon icon="help" size={18} />
            Como funciona?
          </Link>
        </div>
        <MonthSummary summary={data?.resumo_mes} />
        {data?.sem_telefone_90d > 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink-2">
            <MaterialIcon icon="phone_disabled" size={18} className="text-ink-3" />
            <span className="min-w-0 flex-1">
              <strong className="font-semibold text-ink">
                <span className="font-mono-numbers">{data.sem_telefone_90d}</span>{" "}
                {data.sem_telefone_90d === 1 ? "cliente sem telefone" : "clientes sem telefone"}
              </strong>{" "}
              {data.sem_telefone_90d === 1 ? "ficou" : "ficaram"} fora da lista (compraram nos últimos 90 dias).
            </span>
            {onVerSemTelefone && (
              <button type="button" onClick={onVerSemTelefone} className="min-h-11 font-semibold text-brand">
                Completar
              </button>
            )}
          </div>
        )}
      </div>

      {dica}

      {itens.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-ok-soft">
            <MaterialIcon icon="check_circle" size={32} className="text-ok" />
          </div>
          <h3 className="font-plus-jakarta text-lg font-semibold text-ink">Ninguém para chamar hoje</h3>
          <p className="max-w-sm text-sm text-ink-2">Quando algum cliente precisar de um oi, ele aparece aqui.</p>
        </div>
      ) : (
        ACTION_ORDER.map((tipo) => {
          const grupo = itens.filter((i) => i.tipo === tipo);
          if (!grupo.length) return null;
          const config = ACTION_TYPES[tipo];
          return (
            <div key={tipo} className="space-y-2">
              <h3 className="flex items-center gap-2 px-1 text-xs font-bold uppercase tracking-wide text-ink-3">
                <MaterialIcon icon={config.icone} size={16} className={config.tom === "quente" ? "text-brand" : ""} />
                {config.titulo}
                <span className="font-mono-numbers">({grupo.length})</span>
              </h3>
              {/* pendentes em cartão; quem já foi tratado hoje vira linha, embaixo */}
              <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2">
                {grupo
                  .filter((item) => !item.status_hoje)
                  .map((item) => (
                    <ActionCard
                      key={item.contact_id}
                      item={item}
                      message={mensagem(item)}
                      onCall={chamar}
                      onSkip={setSkipItem}
                      animationDelay={animar ? (ordem.current.get(item.contact_id) || 0) * 40 : null}
                    />
                  ))}
              </div>
              <div className="grid grid-cols-1 items-start gap-2 md:grid-cols-2">
                {grupo
                  .filter((item) => item.status_hoje)
                  .map((item) => (
                    <HandledRow key={item.contact_id} item={item} onUndo={desfazer} />
                  ))}
              </div>
            </div>
          );
        })
      )}

      <Sheet open={!!skipItem} onOpenChange={(open) => !open && setSkipItem(null)}>
        <SheetContent
          side="bottom"
          className="max-h-[90vh] overflow-y-auto sm:left-1/2 sm:right-auto sm:bottom-8 sm:max-w-lg sm:-translate-x-1/2 sm:rounded-2xl"
        >
          <SheetHeader>
            <SheetTitle className="font-plus-jakarta">Pular {skipItem ? nomeExibicao(skipItem) : "cliente"}</SheetTitle>
            <SheetDescription>Até quando deixar de chamar?</SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            <button
              type="button"
              onClick={() => pularHoje(skipItem)}
              className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-surface-line p-3 text-left transition-colors hover:bg-surface"
            >
              <MaterialIcon icon="event_repeat" size={22} className="text-ink-2" />
              <span>
                <span className="block font-semibold text-ink">Só hoje</span>
                <span className="block text-sm text-ink-2">Se ainda fizer sentido, volta outro dia.</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => naoChamarMais(skipItem)}
              className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-surface-line p-3 text-left transition-colors hover:bg-surface"
            >
              <MaterialIcon icon="block" size={22} className="text-brand" />
              <span>
                <span className="block font-semibold text-ink">Não chamar mais</span>
                <span className="block text-sm text-ink-2">
                  Para quem pediu para não receber mensagem. Dá para desfazer no cadastro do cliente, na aba Todos.
                </span>
              </span>
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
}
