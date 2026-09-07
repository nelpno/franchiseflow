import React from "react";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { Button } from "@/components/ui/button";

/**
 * Estado de erro padrão do app.
 *
 * Existe porque havia tela que falhava só em `toast.error` — o aviso some em 4 segundos e
 * o que fica na frente do franqueado é uma tela vazia que parece dizer "você não vendeu
 * nada". O TabResultado era o caso: três toasts de erro e ZERO estado de erro na tela.
 *
 * A mensagem nunca deve ser o erro cru do banco (ver lib/safeErrorMessage).
 */
export default function ErrorState({
  titulo = "Não deu para carregar",
  texto,
  onTentarNovamente,
  className = "",
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center py-10 px-4 ${className}`}>
      <MaterialIcon icon="cloud_off" size={48} className="text-ink-3 mb-3" aria-hidden="true" />
      <h3 className="text-base font-bold text-ink font-plus-jakarta">{titulo}</h3>
      {texto && <p className="text-sm text-ink-2 mt-1 max-w-sm">{texto}</p>}
      {onTentarNovamente && (
        <Button
          variant="outline"
          className="mt-4 h-12 min-w-[48px] px-5"
          onClick={onTentarNovamente}
        >
          <MaterialIcon icon="refresh" size={18} className="mr-1" />
          Tentar novamente
        </Button>
      )}
    </div>
  );
}
