// Aba "Encomendas" dentro de Vendas (17/11/2026, pedido do Renato/Ribeirão).
// Registra a encomenda com data de entrega; NÃO mexe em estoque nem faturamento. No dia, "Virou venda"
// abre o formulário de venda normal já preenchido; só aí o estoque baixa (trigger de sale_items).
// Regras puras: lib/encomendas.js · SQL: supabase/2026-11-17-encomendas.sql
import React, { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Encomenda } from "@/entities/all";
import { useEncomendas } from "@/hooks/useEncomendas";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MaterialIcon from "@/components/ui/MaterialIcon";
import SaleForm from "./SaleForm";
import { formatDateOnly } from "@/lib/dateOnly";
import { formatPhone, getWhatsAppLink, normalizePhone } from "@/lib/whatsappUtils";
import { safeErrorMessage } from "@/lib/safeErrorMessage";
import {
  ROTULO_STATUS, STATUS_ATIVOS, abertasParaPedido, ativasOrdenadas, diasAte, itensValidos,
  prefillDaVenda, rotuloPrazo, somaPorProduto, totalUnidades, validarEncomenda,
} from "@/lib/encomendas";
import { toast } from "sonner";
import { format } from "date-fns";

const FILTROS = [
  { value: "ativas", label: "A entregar" },
  { value: "entregue", label: "Entregues" },
  { value: "cancelada", label: "Canceladas" },
];

const COR_STATUS = {
  aberta: "border-l-[#f59e0b]",
  pedida: "border-l-brand-gold",
  entregue: "border-l-ok",
  cancelada: "border-l-ink-4",
};

const ITEM_VAZIO = { inventory_item_id: "", nome: "", qtd: "" };
const hojeStr = () => format(new Date(), "yyyy-MM-dd");

export default function TabEncomendas({
  franchiseId,
  currentUser,
  contacts = [],
  inventoryItems = [],
  onRefreshSales,
}) {
  const { encomendas, isLoading, isError, refetch, invalidar } = useEncomendas(franchiseId, { escopo: "historico" });
  const [filtro, setFiltro] = useState("ativas");
  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [vendaDe, setVendaDe] = useState(null); // encomenda que virou venda (formulário de venda aberto)
  const [cancelando, setCancelando] = useState(null);
  const [entregando, setEntregando] = useState(null); // "Já entreguei" (sem criar venda)
  const [entregandoEmCurso, setEntregandoEmCurso] = useState(false);
  const [cancelandoEmCurso, setCancelandoEmCurso] = useState(false);
  const [resumoAberto, setResumoAberto] = useState(true);
  const vendaEnviandoRef = useRef(false);
  const vendaKeyRef = useRef(0);
  const formKeyRef = useRef(0);
  const prefillVenda = useMemo(() => (vendaDe ? prefillDaVenda(vendaDe) : null), [vendaDe]);

  const ativas = useMemo(() => ativasOrdenadas(encomendas), [encomendas]);
  const abertas = useMemo(() => abertasParaPedido(encomendas), [encomendas]);
  const resumo = useMemo(() => somaPorProduto(abertas), [abertas]);
  const visiveis = useMemo(() => {
    if (filtro === "ativas") return ativas;
    return encomendas
      .filter((e) => e.status === filtro)
      .sort((a, b) => String(b.entregar_em).localeCompare(String(a.entregar_em)));
  }, [encomendas, ativas, filtro]);

  const abrirNova = () => { formKeyRef.current += 1; setEditando(null); setFormAberto(true); };
  const abrirEdicao = (enc) => { formKeyRef.current += 1; setEditando(enc); setFormAberto(true); };
  const abrirVenda = (enc) => { vendaKeyRef.current += 1; setVendaDe(enc); };

  const fecharVenda = () => {
    if (vendaEnviandoRef.current) {
      toast.info("Aguarde: a venda está sendo salva.");
      return;
    }
    setVendaDe(null);
  };

  // Marca como entregue (e guarda o sale_id da venda, quando há). Uma nova tentativa automática: a venda
  // já está gravada, e encomenda sem sale_id nem status voltaria a oferecer "Virou venda" (venda em dobro).
  const marcarEntregue = async (enc, saleId) => {
    const patch = { status: "entregue", entregue_em: new Date().toISOString(), ...(saleId ? { sale_id: saleId } : {}) };
    try {
      return await Encomenda.update(enc.id, patch);
    } catch (primeiroErro) {
      console.warn("Marcar entregue falhou, tentando de novo:", primeiroErro?.message);
      return Encomenda.update(enc.id, patch);
    }
  };

  const aoSalvarVenda = async (saleId) => {
    const enc = vendaDe;
    vendaEnviandoRef.current = false;
    setVendaDe(null);
    try {
      await marcarEntregue(enc, saleId);
      toast.success("Encomenda entregue e lançada como venda.");
    } catch (err) {
      console.error("Erro ao marcar encomenda como entregue:", err);
      // Última chance: grava só o vínculo com a venda (some o "Virou venda") e deixa o botão de tentar de novo.
      Encomenda.update(enc.id, { sale_id: saleId || null }).catch(() => {});
      toast.error("A venda foi registrada, mas não consegui marcar a encomenda como entregue.", {
        duration: 15000,
        action: {
          label: "Tentar de novo",
          onClick: () => {
            marcarEntregue(enc, saleId)
              .then(() => { toast.success("Encomenda entregue."); invalidar(); })
              .catch(() => toast.error("Ainda não deu. Use o botão Já entreguei na encomenda."));
          },
        },
      });
    }
    invalidar();
    onRefreshSales?.();
  };

  const confirmarEntregue = async () => {
    if (!entregando || entregandoEmCurso) return;
    setEntregandoEmCurso(true);
    try {
      await marcarEntregue(entregando, null);
      toast.success("Encomenda marcada como entregue.");
      setEntregando(null);
      invalidar();
    } catch (err) {
      console.error("Erro ao marcar encomenda como entregue:", err);
      toast.error(safeErrorMessage(err, "Não foi possível marcar como entregue."));
    } finally {
      setEntregandoEmCurso(false);
    }
  };

  const confirmarCancelar = async () => {
    if (!cancelando || cancelandoEmCurso) return;
    setCancelandoEmCurso(true);
    try {
      await Encomenda.update(cancelando.id, { status: "cancelada" });
      toast.success("Encomenda cancelada.");
      setCancelando(null);
      invalidar();
    } catch (err) {
      console.error("Erro ao cancelar encomenda:", err);
      toast.error(safeErrorMessage(err, "Não foi possível cancelar a encomenda."));
    } finally {
      setCancelandoEmCurso(false);
    }
  };

  const hoje = hojeStr();

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <Button onClick={abrirNova} className="bg-brand hover:bg-brand-dark text-white gap-1.5 shrink-0">
          <MaterialIcon icon="add_circle" size={18} />
          Nova encomenda
        </Button>
        <div className="flex gap-1 bg-white rounded-xl border border-ink-shadow/5 p-1 overflow-x-auto [scrollbar-width:none]">
          {FILTROS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFiltro(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors min-h-[40px] ${
                filtro === f.value ? "bg-brand text-white" : "text-ink-2 hover:bg-surface"
              }`}
            >
              {f.label}
              {f.value === "ativas" && ativas.length > 0 && (
                <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold ${filtro === "ativas" ? "bg-white/25" : "bg-[#f59e0b]/20 text-[#92400e]"}`}>
                  {ativas.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-ink-2">
        A encomenda guarda o pedido do cliente para a data combinada. Ela não baixa o estoque nem entra no
        faturamento: isso só acontece quando você toca em <strong>Virou venda</strong>.
      </p>

      {/* Resumo para montar o pedido à fábrica */}
      {filtro === "ativas" && resumo.length > 0 && (
        <div className="bg-white rounded-2xl border border-brand-gold/40 overflow-hidden">
          <button
            type="button"
            onClick={() => setResumoAberto((v) => !v)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 bg-[#fffbeb] text-left min-h-[44px]"
            aria-expanded={resumoAberto}
          >
            <span className="font-plus-jakarta font-bold text-ink">
              Para montar o pedido · <span className="font-mono-numbers">{abertas.length}</span> encomenda{abertas.length !== 1 ? "s" : ""} aberta{abertas.length !== 1 ? "s" : ""}
            </span>
            <MaterialIcon icon={resumoAberto ? "expand_less" : "expand_more"} size={20} className="text-ink-2 shrink-0" />
          </button>
          {resumoAberto && (
            <div className="px-4 py-3 space-y-2">
              <ul className="space-y-1">
                {resumo.map((r) => (
                  <li key={r.inventory_item_id || r.nome} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-ink truncate">{r.nome}</span>
                    <span className="font-bold text-ink font-mono-numbers shrink-0">{r.qtd}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-ink-2">
                Soma das encomendas ainda não pedidas à fábrica. Na hora de pedir, o bloco de encomendas na{" "}
                <Link to="/Gestao?tab=reposicao" className="font-semibold text-brand-dark underline underline-offset-2">Reposição</Link>{" "}
                soma isso ao pedido para você.
              </p>
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
          <MaterialIcon icon="cloud_off" size={40} className="text-ink-3" />
          <p className="text-sm text-ink-2">Não consegui carregar as encomendas.</p>
          <Button variant="outline" onClick={() => refetch()}>
            <MaterialIcon icon="refresh" size={16} className="mr-2" />
            Tentar de novo
          </Button>
        </div>
      ) : visiveis.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 px-4 text-center">
          <MaterialIcon icon="event_available" size={64} className="text-ink-4 mb-4" />
          <h3 className="text-lg font-medium text-ink mb-1 font-plus-jakarta">
            {filtro === "ativas" ? "Nenhuma encomenda para entregar" : filtro === "entregue" ? "Nenhuma encomenda entregue ainda" : "Nenhuma encomenda cancelada"}
          </h3>
          {filtro === "ativas" && (
            <>
              <p className="text-sm text-ink-2 max-w-sm">
                Cliente pediu para uma data combinada? Registre aqui e o app lembra você na hora de pedir à fábrica.
              </p>
              <Button onClick={abrirNova} className="mt-4 bg-brand hover:bg-brand-dark text-white gap-1.5">
                <MaterialIcon icon="add_circle" size={18} />
                Nova encomenda
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {visiveis.map((enc) => {
            const dias = diasAte(enc.entregar_em, hoje);
            const ativa = STATUS_ATIVOS.includes(enc.status);
            const atrasada = ativa && dias !== null && dias < 0;
            const tel = enc.telefone || null;
            return (
              <Card key={enc.id} className={`bg-white rounded-2xl shadow-sm border border-ink-shadow/5 overflow-hidden border-l-[3px] ${COR_STATUS[enc.status] || ""}`}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="font-semibold text-ink truncate">{enc.cliente_nome}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          enc.status === "entregue" ? "bg-ok/10 text-ok-ink"
                            : enc.status === "cancelada" ? "bg-surface-2 text-ink-2"
                            : enc.status === "pedida" ? "bg-brand-gold-ink/10 text-brand-gold-ink"
                            : "bg-[#fef3c7] text-[#92400e]"
                        }`}>
                          {ROTULO_STATUS[enc.status] || enc.status}
                        </span>
                      </div>
                      <p className={`mt-0.5 text-sm ${atrasada ? "text-err font-semibold" : "text-ink-2"}`}>
                        <MaterialIcon icon="event" size={14} className="mr-1 align-[-2px]" />
                        Entrega {formatDateOnly(enc.entregar_em, "EEEE, dd/MM")}
                        {ativa && dias !== null ? ` · ${rotuloPrazo(dias)}` : ""}
                      </p>
                    </div>
                    {tel && (
                      <a
                        href={getWhatsAppLink(tel)}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`WhatsApp de ${enc.cliente_nome}`}
                        className="flex items-center justify-center w-10 h-10 rounded-xl bg-ok/10 text-ok-ink hover:bg-ok/20 transition-colors shrink-0"
                      >
                        <MaterialIcon icon="chat" size={20} />
                      </a>
                    )}
                  </div>

                  <ul className="space-y-0.5">
                    {itensValidos(enc.itens).map((it, i) => (
                      <li key={`${it.inventory_item_id || it.nome}-${i}`} className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-ink truncate">{it.nome || "Produto"}</span>
                        <span className="font-mono-numbers text-ink-2 shrink-0">× {it.qtd}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-ink-2">
                    {totalUnidades(enc)} unidade{totalUnidades(enc) !== 1 ? "s" : ""}
                    {tel ? ` · ${formatPhone(tel)}` : ""}
                  </p>
                  {enc.obs?.trim() && (
                    <p className="w-fit max-w-full text-xs text-[#92400e] bg-[#fef3c7]/50 rounded-md px-2 py-1 whitespace-pre-wrap break-words">
                      {enc.obs.trim()}
                    </p>
                  )}

                  {ativa && (
                    <div className="flex flex-wrap items-center gap-2 border-t border-ink-shadow/5 pt-3">
                      {enc.sale_id ? (
                        <span className="flex items-center gap-1 text-xs text-ok-ink">
                          <MaterialIcon icon="check_circle" size={16} />
                          Venda já registrada
                        </span>
                      ) : (
                        <Button size="sm" onClick={() => abrirVenda(enc)} className="gap-1.5 h-10 bg-brand hover:bg-brand-dark text-white">
                          <MaterialIcon icon="point_of_sale" size={16} />
                          Virou venda
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => setEntregando(enc)} className="gap-1.5 h-10 text-ink-2">
                        <MaterialIcon icon="check_circle" size={16} />
                        Já entreguei
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => abrirEdicao(enc)} className="gap-1.5 h-10 text-ink-2">
                        <MaterialIcon icon="edit" size={16} />
                        Editar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setCancelando(enc)} className="gap-1.5 h-10 ml-auto text-brand hover:bg-brand/5">
                        <MaterialIcon icon="close" size={16} />
                        Cancelar
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Montado só enquanto aberto: cada abertura começa do zero (ou da encomenda editada) */}
      {formAberto && (
        <FormEncomenda
          key={formKeyRef.current}
          onFechar={() => setFormAberto(false)}
          encomenda={editando}
          franchiseId={franchiseId}
          currentUser={currentUser}
          contacts={contacts}
          inventoryItems={inventoryItems}
          onSalvou={() => { setFormAberto(false); invalidar(); }}
        />
      )}

      {/* Virou venda: o formulário de venda de sempre, pré-preenchido */}
      <Dialog open={!!vendaDe} onOpenChange={(open) => { if (!open) fecharVenda(); }}>
        <DialogContent onInteractOutside={(e) => e.preventDefault()} className="sm:max-w-2xl w-[95vw] max-h-[85dvh] overflow-y-auto overscroll-contain">
          <DialogHeader>
            <DialogTitle className="font-plus-jakarta">Virou venda</DialogTitle>
            <DialogDescription className="text-ink-2">
              Confira os produtos e o pagamento. Ao registrar, o estoque baixa e a encomenda fica como entregue.
            </DialogDescription>
          </DialogHeader>
          {vendaDe && (
            <SaleForm
              key={vendaKeyRef.current}
              sale={null}
              franchiseId={franchiseId}
              contacts={contacts}
              inventoryItems={inventoryItems}
              currentUser={currentUser}
              onSave={aoSalvarVenda}
              onCancel={fecharVenda}
              onEnviandoChange={(enviando) => { vendaEnviandoRef.current = enviando; }}
              initialContactId={vendaDe.contact_id || null}
              initialPhone={vendaDe.contact_id ? null : vendaDe.telefone || null}
              prefill={prefillVenda}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!entregando} onOpenChange={(open) => { if (!open && !entregandoEmCurso) setEntregando(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-plus-jakarta">Marcar como entregue?</AlertDialogTitle>
            <AlertDialogDescription className="text-ink-2">
              {entregando?.sale_id
                ? "A venda desta encomenda já está registrada. Só o status muda para entregue."
                : "Isto NÃO cria venda: não baixa o estoque nem entra no faturamento. Use quando a entrega já foi lançada por fora. Para lançar a venda agora, toque em Virou venda."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={entregandoEmCurso}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmarEntregue(); }}
              disabled={entregandoEmCurso}
              className="bg-brand hover:bg-brand-dark text-white"
            >
              {entregandoEmCurso ? "Salvando..." : "Marcar como entregue"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!cancelando} onOpenChange={(open) => { if (!open && !cancelandoEmCurso) setCancelando(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-plus-jakarta">Cancelar esta encomenda?</AlertDialogTitle>
            <AlertDialogDescription className="text-ink-2">
              {cancelando ? `A encomenda de ${cancelando.cliente_nome} para ${formatDateOnly(cancelando.entregar_em)} sai da lista de entrega. ` : ""}
              Se ela já foi somada a um pedido à fábrica, o pedido não muda.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelandoEmCurso}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmarCancelar(); }}
              disabled={cancelandoEmCurso}
              className="bg-brand hover:bg-brand-dark text-white"
            >
              {cancelandoEmCurso ? "Cancelando..." : "Cancelar encomenda"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Formulário (nova / editar)
// ---------------------------------------------------------------------------
function FormEncomenda({ onFechar, encomenda, franchiseId, currentUser, contacts, inventoryItems, onSalvou }) {
  const editando = !!encomenda;
  const [nome, setNome] = useState(encomenda?.cliente_nome || "");
  const [telefone, setTelefone] = useState(encomenda?.telefone ? formatPhone(encomenda.telefone) : "");
  const [contactId, setContactId] = useState(encomenda?.contact_id || null);
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [entregarEm, setEntregarEm] = useState(encomenda?.entregar_em || "");
  const [obs, setObs] = useState(encomenda?.obs || "");
  const [itens, setItens] = useState(() => {
    const v = itensValidos(encomenda?.itens);
    return v.length ? v.map((i) => ({ ...i, qtd: String(i.qtd) })) : [{ ...ITEM_VAZIO }];
  });
  const [salvando, setSalvando] = useState(false);
  const salvandoRef = useRef(false);

  const produtos = useMemo(
    () => [...inventoryItems].sort((a, b) => String(a.product_name).localeCompare(String(b.product_name), "pt-BR")),
    [inventoryItems]
  );

  const sugestoes = useMemo(() => {
    const q = nome.trim().toLowerCase();
    const qDig = q.replace(/\D/g, "");
    if (contactId || q.length < 2) return [];
    return contacts
      .filter((c) => (c.nome || "").toLowerCase().includes(q) || (qDig.length >= 4 && (c.telefone || "").includes(qDig)))
      .slice(0, 6);
  }, [contacts, nome, contactId]);

  const escolherContato = (c) => {
    setContactId(c.id);
    setNome(c.nome || formatPhone(c.telefone));
    setTelefone(c.telefone ? formatPhone(c.telefone) : "");
    setBuscaAberta(false);
  };

  const mudarItem = (i, campo, valor) =>
    setItens((prev) => prev.map((it, idx) => {
      if (idx !== i) return it;
      if (campo === "produto") {
        const p = produtos.find((x) => x.id === valor);
        return { ...it, inventory_item_id: valor, nome: p?.product_name || "" };
      }
      return { ...it, [campo]: valor };
    }));

  const salvar = async () => {
    if (salvandoRef.current) return;
    // Produto escolhido com quantidade vazia, zero ou fracionada: avisa em vez de a linha sumir calada.
    const ruim = itens.find((it) => it.inventory_item_id && (!/^\d+$/.test(String(it.qtd).trim()) || parseInt(it.qtd, 10) <= 0));
    if (ruim) {
      toast.error(`Informe a quantidade de ${ruim.nome || "cada produto"} (número inteiro maior que zero) ou remova a linha.`);
      return;
    }
    const dados = {
      cliente_nome: nome,
      entregar_em: entregarEm,
      itens: itens.filter((it) => it.inventory_item_id).map((it) => ({ inventory_item_id: it.inventory_item_id, nome: it.nome, qtd: it.qtd })),
    };
    // Edição que não mexeu na data não é barrada por "data passada" (encomenda atrasada ainda precisa de ajuste).
    const mudouData = !editando || entregarEm !== encomenda.entregar_em;
    const erro = validarEncomenda(dados, mudouData ? hojeStr() : null);
    if (erro) { toast.error(erro); return; }
    if (itens.some((it) => !it.inventory_item_id && (parseInt(it.qtd, 10) || 0) > 0)) {
      toast.error("Escolha o produto em todas as linhas com quantidade.");
      return;
    }

    const tel = normalizePhone(telefone) || null;
    // Telefone igual ao de um cliente cadastrado: liga a encomenda a ele (o "Virou venda" já vem com o cliente).
    let contato = contactId;
    if (!contato && tel) {
      const achado = contacts.find((c) => normalizePhone(c.telefone) === tel);
      if (achado) contato = achado.id;
    }
    const payload = {
      contact_id: contato || null,
      cliente_nome: nome.trim(),
      telefone: tel,
      entregar_em: entregarEm,
      itens: itensValidos(dados.itens),
      obs: obs.trim() || null,
    };

    salvandoRef.current = true;
    setSalvando(true);
    try {
      if (editando) {
        await Encomenda.update(encomenda.id, payload);
        toast.success("Encomenda atualizada.");
      } else {
        await Encomenda.create({ ...payload, franchise_id: franchiseId, status: "aberta", created_by: currentUser?.id || null });
        toast.success("Encomenda registrada.");
      }
      onSalvou();
    } catch (err) {
      console.error("Erro ao salvar encomenda:", err);
      toast.error(safeErrorMessage(err, "Não foi possível salvar a encomenda. Tente de novo."));
    } finally {
      salvandoRef.current = false;
      setSalvando(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !salvandoRef.current) onFechar(); }}>
      <DialogContent onInteractOutside={(e) => e.preventDefault()} className="sm:max-w-lg w-[95vw] max-h-[85dvh] overflow-y-auto overscroll-contain">
        <DialogHeader>
          <DialogTitle className="font-plus-jakarta">{editando ? "Editar encomenda" : "Nova encomenda"}</DialogTitle>
          <DialogDescription className="text-ink-2">
            Não baixa o estoque nem entra no faturamento até virar venda.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {encomenda?.status === "pedida" && (
            <p role="status" className="flex items-start gap-2 rounded-xl border border-warn/40 bg-warn-soft px-3 py-2 text-sm text-ink">
              <MaterialIcon icon="local_shipping" size={18} className="mt-0.5 shrink-0 text-brand-gold-ink" />
              <span>Já foi pedida à fábrica: mudar aqui não muda o pedido.</span>
            </p>
          )}
          <div className="space-y-1.5 relative">
            <Label htmlFor="enc-cliente">Cliente</Label>
            <Input
              id="enc-cliente"
              value={nome}
              onChange={(e) => { setNome(e.target.value); setContactId(null); setBuscaAberta(true); }}
              onFocus={() => setBuscaAberta(true)}
              placeholder="Nome ou telefone do cliente"
              maxLength={120}
              autoComplete="off"
              className="bg-white"
            />
            {buscaAberta && sugestoes.length > 0 && (
              <ul className="absolute z-20 left-0 right-0 top-full mt-1 max-h-56 overflow-y-auto rounded-xl border border-surface-line bg-white shadow-lg">
                {sugestoes.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => escolherContato(c)}
                      className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-surface min-h-[44px]"
                    >
                      <span className="text-sm font-medium text-ink">{c.nome || "Sem nome"}</span>
                      <span className="text-xs text-ink-2">{c.telefone ? formatPhone(c.telefone) : "sem telefone"}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {contactId && <p className="text-xs text-ok-ink">Cliente da sua lista.</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="enc-tel">Telefone</Label>
              <Input id="enc-tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="DDD + número" inputMode="tel" className="bg-white" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="enc-data">Entregar em</Label>
              <Input id="enc-data" type="date" value={entregarEm} min={editando && encomenda.entregar_em < hojeStr() ? undefined : hojeStr()} onChange={(e) => setEntregarEm(e.target.value)} className="bg-white" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Produtos</Label>
            {itens.map((it, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <Select value={it.inventory_item_id || ""} onValueChange={(v) => mudarItem(i, "produto", v)}>
                    <SelectTrigger aria-label={`Produto ${i + 1}`} className="bg-white h-11">
                      <SelectValue placeholder="Escolha o produto" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {produtos.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.product_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  value={it.qtd}
                  onChange={(e) => mudarItem(i, "qtd", e.target.value)}
                  onFocus={(e) => e.target.select()}
                  aria-label={`Quantidade do produto ${i + 1}`}
                  placeholder="Qtd"
                  className="bg-white w-20 text-center shrink-0"
                />
                <button
                  type="button"
                  onClick={() => setItens((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : [{ ...ITEM_VAZIO }]))}
                  aria-label={`Remover produto ${i + 1}`}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-ink-2 hover:bg-surface"
                >
                  <MaterialIcon icon="close" size={20} />
                </button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setItens((prev) => [...prev, { ...ITEM_VAZIO }])} className="gap-1.5 h-10 text-ink-2">
              <MaterialIcon icon="add" size={16} />
              Outro produto
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="enc-obs">Observação (opcional)</Label>
            <Textarea id="enc-obs" value={obs} onChange={(e) => setObs(e.target.value)} maxLength={500} placeholder="Ex.: entregar à tarde, sem alho" className="bg-white" />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={onFechar} disabled={salvando}>Voltar</Button>
          <Button type="button" onClick={salvar} disabled={salvando} className="bg-brand hover:bg-brand-dark text-white">
            {salvando ? "Salvando..." : editando ? "Salvar" : "Registrar encomenda"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
