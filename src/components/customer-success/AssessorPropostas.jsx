// Cartões "Registrar no Mural?" do Assessor do CS. O assessor só PROPÕE; quem grava é o botão Confirmar,
// direto nas RPCs do Mural com o JWT do usuário (registrar_cs_conversa, concluir_cs_cartao, estacionar_cs_cartao)
// ou na criação de cartão manual (mesmo caminho do "Novo cartão"). Cada cartão é editável e pode ser descartado.
import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { BTN_PRIMARIO, BTN_SECUNDARIO } from "@/components/shared/adminUi";
import { createCsTask } from "@/entities/all";
import { concluirCsCartao, estacionarCsCartao, registrarCsConversa } from "@/entities/csMural";
import { CANAL_LABEL, DESFECHO_LABEL, RESULTADO_LABEL } from "@/lib/csMural";
import { atualizarProposta, avisarConfirmada, camposEditaveis } from "@/lib/assessorStore";
import { registrarEvento } from "@/lib/telemetria";
import { safeErrorMessage } from "@/lib/safeErrorMessage";
import { useAuth } from "@/lib/AuthContext";

const CAMPO = "h-11 w-full rounded-xl border border-surface-line bg-white px-3 text-sm font-normal text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none";
const AREA = "w-full rounded-xl border border-surface-line bg-white p-3 text-sm font-normal text-ink focus:border-brand focus:outline-none";
const ROTULO_TIPO = { registrar: "Registrar conversa", abrir_cartao: "Abrir cartão", estacionar: "Estacionar cartão", concluir: "Concluir cartão" };
const DESFECHOS = ["resolvido", "combinado_feito", "recusou", "nao_responde", "vai_para_nelson"];

const somaDias = (n) => format(new Date(Date.now() + n * 86400000), "yyyy-MM-dd");

function validar(p) {
  const hoje = format(new Date(), "yyyy-MM-dd");
  if (p.tipo === "registrar") {
    if (p.resultado === "causa_conhecida" && (p.combinado || "").trim().length < 3) return "Escreva a causa. Ela aparece no cartão.";
    if (p.resultado !== "resolvido" && p.proxima_data && p.proxima_data < hoje) return "A data de voltar não pode ser no passado.";
    if (p.resultado === "causa_conhecida" && p.proxima_data && p.proxima_data > somaDias(183)) return "Rever em no máximo 6 meses.";
  } else if (p.tipo === "abrir_cartao") {
    if ((p.titulo || "").trim().length < 3) return "Dê um título ao cartão.";
  } else if (p.tipo === "estacionar") {
    if ((p.motivo || "").trim().length < 3) return "Escreva o motivo de estacionar.";
    if (!p.ate || p.ate <= hoje) return "A data de voltar precisa ser depois de hoje.";
    if (p.ate > somaDias(180)) return "Estacione por no máximo 6 meses.";
  } else if (p.desfecho === "vai_para_nelson" && (p.nota || "").trim().length < 3) {
    return "Escreva o que o Nelson precisa decidir.";
  }
  return null;
}

async function gravarProposta(p, userId) {
  switch (p.tipo) {
    case "registrar":
      return registrarCsConversa(p.franchise_id, null, p.canal, p.resultado, (p.combinado || "").trim() || null,
        p.resultado === "resolvido" ? null : p.proxima_data || null, (p.nota || "").trim() || null, null);
    case "abrir_cartao":
      return createCsTask({ title: p.titulo.trim(), description: (p.descricao || "").trim() || null, franchise_id: p.franchise_id, column_status: "a_fazer", source: "manual" }, userId);
    case "estacionar":
      return estacionarCsCartao(p.task_id, p.ate, p.motivo.trim());
    default:
      return concluirCsCartao(p.task_id, p.desfecho, (p.nota || "").trim() || null);
  }
}

function Campo({ rotulo, children }) {
  return (
    <label className="block text-xs font-semibold text-ink-2">
      {rotulo}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Cartao({ p, chave, msgId, logId, onFeito, desabilitado }) {
  const { user } = useAuth();
  const [salvando, setSalvando] = useState(false);
  const hoje = format(new Date(), "yyyy-MM-dd");
  const muda = (patch) => atualizarProposta(chave, msgId, p.id, { ...patch, erroMsg: "" });

  if (p.status === "ok") {
    return (
      <div className="rounded-2xl border border-surface-line bg-brand-soft p-3 text-sm text-ink">
        <MaterialIcon icon="check" size={18} className="mr-1 align-text-bottom text-brand-dark" aria-hidden="true" />
        {ROTULO_TIPO[p.tipo]} feito: {p.unidade}.
      </div>
    );
  }
  if (p.status === "descartado") {
    return <div className="rounded-2xl border border-surface-line bg-surface p-3 text-sm text-ink-3">Descartado: {ROTULO_TIPO[p.tipo].toLowerCase()} de {p.unidade}.</div>;
  }

  const confirmar = async () => {
    const erro = validar(p);
    if (erro) { muda({ erroMsg: erro }); toast.error(erro); return false; }
    setSalvando(true);
    try {
      await gravarProposta(p, user?.id);
      const editado = JSON.stringify(camposEditaveis(p)) !== p.orig;
      atualizarProposta(chave, msgId, p.id, { status: "ok", erroMsg: "" });
      avisarConfirmada(logId, p, editado);
      registrarEvento("assessor_proposta_confirmada", { detalhe: p.tipo });
      onFeito?.(p);
      return true;
    } catch (e) {
      const m = safeErrorMessage(e, "Não foi possível gravar no Mural.");
      muda({ erroMsg: m });
      toast.error(m);
      return false;
    } finally {
      setSalvando(false);
    }
  };
  // exposto para o "Confirmar todos"
  Cartao.confirmadores[p.id] = confirmar;

  return (
    <div className="space-y-3 rounded-2xl border border-brand-gold-line bg-brand-gold-soft p-3 sm:p-4">
      <div>
        <div className="text-xs font-bold uppercase tracking-wide text-ink-3">{ROTULO_TIPO[p.tipo]} no Mural?</div>
        <div className="font-plus-jakarta text-base font-bold text-ink">{p.unidade}</div>
        {p.cartao_titulo && <p className="text-xs text-ink-2">Cartão: {p.cartao_titulo}</p>}
        <p className="text-xs text-ink-2">Nada foi gravado ainda. Confira, edite se precisar e confirme.</p>
      </div>

      {p.tipo === "registrar" && (
        <>
          <Campo rotulo="Como falou">
            <select value={p.canal} onChange={(e) => muda({ canal: e.target.value })} className={CAMPO}>
              {Object.keys(CANAL_LABEL).map((c) => <option key={c} value={c}>{CANAL_LABEL[c]}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Resultado">
            <select value={p.resultado} onChange={(e) => muda({ resultado: e.target.value })} className={CAMPO}>
              {Object.keys(RESULTADO_LABEL).map((r) => <option key={r} value={r}>{RESULTADO_LABEL[r]}</option>)}
            </select>
          </Campo>
          <Campo rotulo={p.resultado === "causa_conhecida" ? "Causa (aparece no cartão)" : "Combinado"}>
            <input value={p.combinado || ""} maxLength={300} onChange={(e) => muda({ combinado: e.target.value })} placeholder="O que ficou combinado" className={CAMPO} />
          </Campo>
          {p.resultado !== "resolvido" && (
            <Campo rotulo="Voltar a olhar em">
              <input type="date" value={p.proxima_data || ""} min={hoje} onChange={(e) => muda({ proxima_data: e.target.value })} className={CAMPO} />
              {!p.proxima_data && <span className="mt-1 block text-xs font-normal text-ink-3">Sem data, o Mural usa o prazo padrão do resultado.</span>}
            </Campo>
          )}
          <Campo rotulo="Nota (opcional)">
            <textarea value={p.nota || ""} maxLength={1000} rows={2} onChange={(e) => muda({ nota: e.target.value })} className={AREA} />
          </Campo>
        </>
      )}

      {p.tipo === "abrir_cartao" && (
        <>
          <Campo rotulo="Título do cartão">
            <input value={p.titulo || ""} maxLength={120} onChange={(e) => muda({ titulo: e.target.value })} className={CAMPO} />
          </Campo>
          <Campo rotulo="Descrição (opcional)">
            <textarea value={p.descricao || ""} maxLength={500} rows={2} onChange={(e) => muda({ descricao: e.target.value })} className={AREA} />
          </Campo>
        </>
      )}

      {p.tipo === "estacionar" && (
        <>
          <Campo rotulo="Motivo">
            <input value={p.motivo || ""} maxLength={300} onChange={(e) => muda({ motivo: e.target.value })} className={CAMPO} />
          </Campo>
          <Campo rotulo="Voltar a olhar em">
            <input type="date" value={p.ate || ""} min={somaDias(1)} max={somaDias(180)} onChange={(e) => muda({ ate: e.target.value })} className={CAMPO} />
          </Campo>
        </>
      )}

      {p.tipo === "concluir" && (
        <>
          <Campo rotulo="Desfecho">
            <select value={p.desfecho} onChange={(e) => muda({ desfecho: e.target.value })} className={CAMPO}>
              {DESFECHOS.map((d) => <option key={d} value={d}>{DESFECHO_LABEL[d]}</option>)}
            </select>
          </Campo>
          <Campo rotulo={p.desfecho === "vai_para_nelson" ? "O que o Nelson precisa decidir" : "Nota (opcional)"}>
            <textarea value={p.nota || ""} maxLength={1000} rows={2} onChange={(e) => muda({ nota: e.target.value })} className={AREA} />
          </Campo>
        </>
      )}

      {p.erroMsg && <p className="text-sm text-err" role="alert">{p.erroMsg}</p>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={confirmar} disabled={salvando || desabilitado} className={`${BTN_PRIMARIO} min-h-11 flex-1`}>
          {salvando ? "Gravando…" : "Confirmar"}
        </button>
        <button type="button" onClick={() => muda({ status: "descartado" })} disabled={salvando} className={`${BTN_SECUNDARIO} min-h-11`}>
          Descartar
        </button>
      </div>
    </div>
  );
}
Cartao.confirmadores = {};

export default function AssessorPropostas({ chave, msgId, logId, propostas, onFeito }) {
  const [todos, setTodos] = useState(false);
  const pendentes = propostas.filter((p) => p.status === "pendente");

  const confirmarTodos = async () => {
    setTodos(true);
    let ok = 0;
    let falhou = 0;
    for (const p of pendentes) {
      const f = Cartao.confirmadores[p.id];
      if (!f) continue;
      // cada confirmador lê a proposta do momento da renderização; se faltar campo, ele avisa no próprio cartão
      // eslint-disable-next-line no-await-in-loop
      if (await f()) ok += 1; else falhou += 1;
    }
    setTodos(false);
    if (ok) toast.success(`${ok} ${ok === 1 ? "registro feito" : "registros feitos"} no Mural.`);
    if (falhou) toast.error(`${falhou} ${falhou === 1 ? "cartão precisa" : "cartões precisam"} de ajuste.`);
  };

  return (
    <div className="space-y-3">
      {propostas.map((p) => (
        <Cartao key={p.id} p={p} chave={chave} msgId={msgId} logId={logId} onFeito={onFeito} desabilitado={todos} />
      ))}
      {pendentes.length > 1 && (
        <button type="button" onClick={confirmarTodos} disabled={todos} className={`${BTN_PRIMARIO} min-h-11 w-full`}>
          {todos ? "Gravando…" : `Confirmar todos (${pendentes.length})`}
        </button>
      )}
    </div>
  );
}
