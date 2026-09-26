// Folha "Registrar" — compartilhada pelo Mural (cartão) e pela Ficha ("Registrar a
// conversa"). Onda 2: antes cada tela tinha o próprio diálogo e a Ficha gravava o
// evento SEM texto (achado R10 do estudo de 26/09) — agora as duas chamam a MESMA RPC
// `registrar_cs_conversa`, com resultado + combinado + data de volta.
// Sheet bottom no celular / dialog centrado no desktop (padrão CustomDateRangeSheet.jsx).
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { safeErrorMessage } from "@/lib/safeErrorMessage";
import { registrarCsConversa } from "@/entities/csMural";
import {
  CANAL_LABEL,
  RESULTADO_LABEL,
  VOLTAR_EM_OPCOES,
  VOLTAR_EM_PADRAO,
  calcularNextAt,
  validarRegistro,
} from "@/lib/csMural";

const CANAIS = ["mensagem", "ligacao", "reuniao"];
const RESULTADOS = ["vai_fazer", "recusou", "nao_respondeu", "resolvido"];

function Chip({ ativo, onClick, children, ariaLabel }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={ativo}
      aria-label={ariaLabel}
      onClick={onClick}
      className={`min-h-10 rounded-full border px-3.5 text-sm ${
        ativo ? "border-brand-dark bg-brand-dark font-semibold text-white" : "border-surface-line bg-white font-medium text-ink-2 hover:bg-surface"
      }`}
    >
      {children}
    </button>
  );
}

/**
 *   <RegistrarSheet open={open} onOpenChange={setOpen}
 *     franchiseId={evo} taskId={task?.id} nomeUnidade={nome}
 *     notaInicial="Mandei: oi, tudo bem?"
 *     onSalvo={(resultado) => { toast.success(...); reload(); }} />
 */
export default function RegistrarSheet({ open, onOpenChange, franchiseId, taskId, nomeUnidade, notaInicial = "", onSalvo }) {
  const [channel, setChannel] = useState("mensagem");
  const [outcome, setOutcome] = useState(null);
  const [commitment, setCommitment] = useState("");
  const [nextAtChave, setNextAtChave] = useState(VOLTAR_EM_PADRAO);
  const [nextAtData, setNextAtData] = useState("");
  const [driveUrl, setDriveUrl] = useState("");
  const [note, setNote] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setChannel("mensagem");
    setOutcome(null);
    setCommitment("");
    setNextAtChave(VOLTAR_EM_PADRAO);
    setNextAtData("");
    setDriveUrl("");
    setNote(notaInicial || "");
  }, [open, notaInicial]);

  const salvar = async () => {
    const erro = validarRegistro({ channel, outcome, nextAtChave, nextAtData, note });
    if (erro) { toast.error(erro); return; }
    setSalvando(true);
    try {
      const nextAt = outcome === "resolvido" ? null : calcularNextAt(nextAtChave, nextAtData);
      const resultado = await registrarCsConversa(
        franchiseId,
        taskId || null,
        channel,
        outcome,
        commitment.trim() || null,
        nextAt,
        note.trim() || null,
        channel === "reuniao" ? driveUrl.trim() || null : null
      );
      onOpenChange(false);
      onSalvo?.(resultado, { channel, outcome, nextAt, commitment: commitment.trim() });
    } catch (e) {
      toast.error(safeErrorMessage(e, "Não foi possível registrar a conversa."));
    } finally {
      setSalvando(false);
    }
  };

  const rotuloBotao = salvando
    ? "Salvando…"
    : outcome === "resolvido"
      ? "Salvar e marcar como resolvido"
      : "Salvar";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[92vh] overflow-y-auto sm:max-w-lg sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:bottom-8 sm:rounded-2xl"
      >
        <SheetHeader className="mb-4">
          <SheetTitle className="font-plus-jakarta text-lg font-bold text-ink">
            Registrar{nomeUnidade ? ` — ${nomeUnidade}` : ""}
          </SheetTitle>
          <SheetDescription className="text-sm text-ink-2">
            O que você conversou e quando volta a olhar isto.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-5">
          <div role="radiogroup" aria-label="Como falou">
            <div className="mb-1.5 text-sm font-semibold text-ink-2">Como falou</div>
            <div className="flex flex-wrap gap-2">
              {CANAIS.map((c) => (
                <Chip key={c} ativo={channel === c} onClick={() => setChannel(c)}>
                  {CANAL_LABEL[c]}
                </Chip>
              ))}
            </div>
            {channel === "reuniao" && (
              <label className="mt-2 flex flex-col gap-1.5 text-sm font-semibold text-ink-2">
                Link da gravação no Drive (opcional)
                <input
                  type="url"
                  value={driveUrl}
                  onChange={(e) => setDriveUrl(e.target.value)}
                  placeholder="https://drive.google.com/…"
                  className="h-11 rounded-xl border border-surface-line bg-white px-3 text-sm font-normal text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none"
                />
              </label>
            )}
          </div>

          <div role="radiogroup" aria-label="Resultado">
            <div className="mb-1.5 text-sm font-semibold text-ink-2">Resultado</div>
            <div className="flex flex-wrap gap-2">
              {RESULTADOS.map((r) => (
                <Chip key={r} ativo={outcome === r} onClick={() => setOutcome(r)}>
                  {RESULTADO_LABEL[r]}
                </Chip>
              ))}
            </div>
          </div>

          <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink-2">
            Combinado (opcional)
            <input
              type="text"
              value={commitment}
              onChange={(e) => setCommitment(e.target.value)}
              maxLength={300}
              placeholder="Ex.: vai pagar a verba até sexta"
              className="h-11 rounded-xl border border-surface-line bg-white px-3 text-sm font-normal text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none"
            />
          </label>

          {outcome !== "resolvido" && (
            <div role="radiogroup" aria-label="Voltar em">
              <div className="mb-1.5 text-sm font-semibold text-ink-2">Voltar em</div>
              <div className="flex flex-wrap gap-2">
                {VOLTAR_EM_OPCOES.map((o) => (
                  <Chip key={o.key} ativo={nextAtChave === o.key} onClick={() => setNextAtChave(o.key)}>
                    {o.label}
                  </Chip>
                ))}
              </div>
              {nextAtChave === "data" && (
                <input
                  type="date"
                  value={nextAtData}
                  onChange={(e) => setNextAtData(e.target.value)}
                  className="mt-2 h-11 rounded-xl border border-surface-line bg-white px-3 text-sm text-ink focus:border-brand focus:outline-none"
                />
              )}
            </div>
          )}

          <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink-2">
            Nota (opcional)
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="O que mais vale registrar…"
              className="font-normal"
            />
          </label>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={salvar}
              disabled={salvando}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {rotuloBotao}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
