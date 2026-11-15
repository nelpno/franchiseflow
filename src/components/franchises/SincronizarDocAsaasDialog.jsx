import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { toast } from "sonner";
import { supabase } from "@/api/supabaseClient";
import { safeErrorMessage } from "@/lib/safeErrorMessage";
import { descreverTrocaDocumento } from "@/lib/fiscalSync";

/**
 * Aparece depois de salvar um CPF/CNPJ diferente numa franquia que JÁ tem cliente no ASAAS.
 *
 * Existe porque o mesmo gesto tem dois significados opostos e só quem está salvando sabe
 * qual é: mesma empresa virou PJ (atualiza o cliente, assinatura intacta) ou trocou de dono
 * (cliente novo, senão a cobrança sai no nome do anterior). Adivinhar erra metade das vezes.
 *
 * Só o primeiro caminho executa daqui. Troca de dono passa por cancelar/criar assinatura em
 * Financeiro → Mensalidades — cancelar cobrança não é coisa para um botão de atalho.
 */
export default function SincronizarDocAsaasDialog({ franquia, docAntigo, docNovo, onClose }) {
  const [enviando, setEnviando] = useState(false);
  if (!franquia) return null;

  const troca = descreverTrocaDocumento(docAntigo, docNovo);

  const atualizarCadastro = async () => {
    setEnviando(true);
    try {
      const { data, error } = await supabase.functions.invoke("asaas-billing", {
        body: { action: "sync-customer-document", franchise_id: franquia.evolution_instance_id },
      });
      // invoke esconde a mensagem da função em error.context (padrão do invokeAsaas)
      if (error) {
        let detalhe = error.message;
        try {
          detalhe = (await error.context?.json())?.error || detalhe;
        } catch {
          /* sem corpo legível */
        }
        throw new Error(detalhe);
      }
      if (data?.changed === false) {
        toast.info("O ASAAS já estava com esse documento.");
      } else {
        toast.success(`Cadastro atualizado no ASAAS — ${troca.novo}.`, {
          description: "A assinatura e as faturas continuam as mesmas. A próxima NFe sai no documento novo.",
          duration: 8000,
        });
      }
      onClose();
    } catch (e) {
      console.error("Falha ao sincronizar documento no ASAAS:", e);
      toast.error(safeErrorMessage(e, "Não consegui atualizar o cadastro no ASAAS."), {
        description: "O painel já está com o documento novo; o ASAAS continua com o antigo.",
        duration: 10000,
      });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && !enviando && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-plus-jakarta text-brand">
            <MaterialIcon icon="sync_problem" size={20} />
            E no ASAAS, o que faço?
          </DialogTitle>
        </DialogHeader>

        <div className="py-2 space-y-4">
          <p className="text-sm text-ink-2">
            O documento de <strong>{franquia.name}</strong> mudou {troca.resumo}. No ASAAS ainda está o
            antigo — e é de lá que sai a nota fiscal.
          </p>

          <div className="rounded-xl bg-surface-2 p-3 space-y-1">
            <div className="flex justify-between gap-3 text-sm">
              <span className="text-ink-3">No ASAAS hoje</span>
              <span className="font-bold text-ink tabular-nums">{troca.antigo}</span>
            </div>
            <div className="flex justify-between gap-3 text-sm">
              <span className="text-ink-3">Você acabou de salvar</span>
              <span className="font-bold text-ink tabular-nums">{troca.novo}</span>
            </div>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={atualizarCadastro}
              disabled={enviando}
              className="w-full text-left rounded-xl border-2 border-brand/30 bg-brand/5 p-3 hover:border-brand/60 transition-colors disabled:opacity-60"
            >
              <p className="text-sm font-bold text-ink">É a mesma pessoa/empresa</p>
              <p className="text-sm text-ink-2 mt-0.5">
                {enviando ? "Atualizando no ASAAS..." : "Atualizo o cadastro. A assinatura e o histórico de faturas continuam os mesmos."}
              </p>
            </button>

            <div className="rounded-xl border border-surface-line p-3">
              <p className="text-sm font-bold text-ink">A franquia trocou de dono</p>
              <p className="text-sm text-ink-2 mt-0.5">
                Aí o cliente do ASAAS tem de ser outro, senão a cobrança sai no nome do dono anterior.
                Vá em <strong>Financeiro → Mensalidades</strong>, cancele a assinatura e crie de novo.
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button variant="outline" onClick={onClose} disabled={enviando} className="rounded-xl">
              Depois eu resolvo
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
