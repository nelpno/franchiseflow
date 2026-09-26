// "Registrar a conversa" da Ficha. Antes gravava o evento SEM texto — e o texto é o que o
// CS escreve (180 de 183 contatos no Mural têm nota) e o que o acompanhamento mede depois.
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

const TIPOS = [
  { value: "contact", label: "Mensagem ou ligação" },
  { value: "meeting", label: "Reunião" },
];

// "E agora?" (item 29, 26/09): por padrão o cartão vai para "Esperando resposta" — mas
// nem toda conversa precisa de acompanhamento (ex.: unidade saudável, só um "oi"), e até
// então o diálogo criava cartão aberto para qualquer registro, sujando o Mural.
const DESFECHOS = [
  { value: "aguardando_retorno", label: "Esperar resposta" },
  { value: "resolvido", label: "Resolvido, não precisa acompanhar" },
];

// `cartaoAberto` (achado do orquestrador, 26/09): se já existe um cartão aberto no Mural
// (pode ter sido criado pelo reconcile por um alerta real, ou estar com outra pessoa),
// escolher "Resolvido" AQUI fecha esse cartão — antes o diálogo dizia "não abre cartão"
// mesmo fechando um que já existia, sem avisar ninguém.
export default function RegistrarConversaDialog({ open, onOpenChange, nomeUnidade, salvando, onSalvar, notaInicial = "", cartaoAberto = null }) {
  const [tipo, setTipo] = useState("contact");
  const [nota, setNota] = useState("");
  const [desfecho, setDesfecho] = useState("aguardando_retorno");

  useEffect(() => {
    if (open) { setTipo("contact"); setNota(notaInicial || ""); setDesfecho("aguardando_retorno"); }
  }, [open, notaInicial]);

  const salvar = () => {
    if (nota.trim().length < 5) {
      toast.error("Escreva em poucas palavras o que foi conversado ou combinado.");
      return;
    }
    onSalvar({ tipo, nota: nota.trim(), resolvido: desfecho === "resolvido" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar a conversa com {nomeUnidade}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div role="radiogroup" aria-label="Como foi a conversa" className="flex flex-wrap gap-2">
            {TIPOS.map((t) => (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={tipo === t.value}
                onClick={() => setTipo(t.value)}
                className={`min-h-10 rounded-full border px-4 text-sm font-semibold ${
                  tipo === t.value ? "border-brand-dark bg-brand-dark text-white" : "border-ink-shadow/20 bg-white text-ink-2"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink-2">
            O que foi conversado ou combinado
            <Textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Ex.: vai pagar a verba até sexta; pediu ajuda para religar o robô."
              className="font-normal"
            />
          </label>
          <div role="radiogroup" aria-label="E agora?" className="flex flex-col gap-1.5 text-sm font-semibold text-ink-2">
            E agora?
            <div className="flex flex-wrap gap-2">
              {DESFECHOS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  role="radio"
                  aria-checked={desfecho === d.value}
                  onClick={() => setDesfecho(d.value)}
                  className={`min-h-10 rounded-full border px-4 text-sm font-medium ${
                    desfecho === d.value ? "border-brand-dark bg-brand-dark text-white" : "border-ink-shadow/20 bg-white text-ink-2"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="min-h-11 rounded-lg bg-brand px-5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {salvando
              ? "Salvando…"
              : desfecho === "resolvido"
                ? cartaoAberto
                  ? `Salvar e fechar o cartão "${cartaoAberto.title || nomeUnidade}"`
                  : "Salvar como resolvido (não abre cartão)"
                : "Salvar no Mural (vai para Esperando resposta)"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
