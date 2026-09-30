import React, { useCallback, useEffect, useState } from "react";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { toast } from "sonner";
import { safeErrorMessage } from "@/lib/safeErrorMessage";
import { formatPhone } from "@/lib/whatsappUtils";
import { chaveTelefone, listarBloqueios, bloquearNumero, desbloquearNumero } from "@/lib/roboBloqueios";

const inputClass = "w-full bg-surface-line border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand/20 text-sm outline-none";

/**
 * Números que o robô não responde nesta unidade (fornecedor, maquininha, banco, família).
 * Grava na hora, fora do "Salvar" do assistente: o robô passa a ignorar o número na próxima mensagem.
 */
export default function NumerosBloqueados({ franchiseId }) {
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [telefone, setTelefone] = useState("");
  const [nome, setNome] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [removendo, setRemovendo] = useState(null);

  const carregar = useCallback(async () => {
    if (!franchiseId || franchiseId === "default") return;
    setCarregando(true);
    try {
      setItens(await listarBloqueios(franchiseId));
    } catch (error) {
      toast.error(safeErrorMessage(error, "Não consegui carregar os números bloqueados."));
    } finally {
      setCarregando(false);
    }
  }, [franchiseId]);

  useEffect(() => { carregar(); }, [carregar]);

  const adicionar = async () => {
    if (!chaveTelefone(telefone)) {
      toast.error("Número inválido: coloque o DDD e o número (ex.: 11 98765-4321).");
      return;
    }
    setSalvando(true);
    try {
      await bloquearNumero(franchiseId, telefone, nome.trim());
      toast.success("Pronto: o robô não responde mais esse número.");
      setTelefone("");
      setNome("");
      carregar();
    } catch (error) {
      toast.error(safeErrorMessage(error, "Não consegui bloquear o número."));
    } finally {
      setSalvando(false);
    }
  };

  const remover = async (item) => {
    setRemovendo(item.id);
    try {
      await desbloquearNumero(item.id);
      toast.success("O robô volta a responder esse número.");
      setItens((atual) => atual.filter((i) => i.id !== item.id));
    } catch (error) {
      toast.error(safeErrorMessage(error, "Não consegui desbloquear o número."));
    } finally {
      setRemovendo(null);
    }
  };

  if (!franchiseId || franchiseId === "default") return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input className={inputClass} type="tel" inputMode="tel" value={telefone}
          onChange={(e) => setTelefone(e.target.value)} placeholder="(11) 98765-4321" aria-label="Telefone" />
        <input className={inputClass} type="text" value={nome} maxLength={80}
          onChange={(e) => setNome(e.target.value)} placeholder="Quem é (ex.: fornecedor)" aria-label="Quem é" />
        <button type="button" onClick={adicionar} disabled={salvando || !telefone.trim()}
          className="min-h-11 shrink-0 rounded-xl bg-brand px-4 text-sm font-bold text-white disabled:opacity-50">
          {salvando ? "Salvando..." : "Bloquear"}
        </button>
      </div>

      {carregando ? (
        <p className="text-xs text-ink-2/60">Carregando...</p>
      ) : itens.length === 0 ? (
        <p className="text-xs text-ink-2/60">Nenhum número bloqueado. O robô responde todo mundo.</p>
      ) : (
        <ul className="divide-y divide-surface-line rounded-xl border border-surface-line">
          {itens.map((item) => (
            <li key={item.id} className="flex items-center gap-3 px-4 py-2.5">
              <MaterialIcon icon="block" size={18} className="shrink-0 text-ink-2/50" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{formatPhone(item.phone_raw) || item.phone_raw}</p>
                {item.label && <p className="truncate text-xs text-ink-2/60">{item.label}</p>}
              </div>
              <button type="button" onClick={() => remover(item)} disabled={removendo === item.id}
                className="min-h-11 shrink-0 rounded-lg px-3 text-xs font-bold text-brand disabled:opacity-50">
                {removendo === item.id ? "..." : "Desbloquear"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
