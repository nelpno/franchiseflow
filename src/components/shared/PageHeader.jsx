// Cabeçalho de página do admin (regras C1..C10 do padrão). Um só para todas as telas.
//
//   <PageHeader
//     voltar={{ to: "/Dashboard", label: "Hoje" }}      // opcional: "← Voltar para Hoje" (C4)
//                                                      //   aceita { to, state, label } ou { onClick, label }
//                                                      //   ou o retorno de voltarDaFicha(location) ({ to, label })
//     acima="Sábado, 26 de setembro"                   // opcional: linha acima do h1 (só a saudação do Hoje, C10)
//     titulo="Financeiro"                              // h1 sem ícone (C2)
//     subtitulo="Quanto a rede vendeu no mês."         // uma frase, sem dica de teclado (C3)
//     mes={<MonthStepper … />}                         // slot do seletor de mês (C8)
//     situacao="Situação de hoje, 26/09"               // no lugar do mês, em tela do agora (C9); ignorado se houver `mes`
//     acao={<AcaoPrincipal … />}                       // slot da ação principal / busca / Mais ações (C5, C6, C11)
//   />
//
// Os slots `mes` e `acao` vão à direita no desktop e descem para baixo do título no
// celular, ocupando a linha inteira (a busca estica com `flex-1`, C6).
//
// Peças para o slot `acao`:
//   <BuscaCabecalho id="busca-unidades" value={q} onChange={setQ}
//     placeholder="Buscar unidade ou pessoa" rotulo="Buscar por unidade, franqueado ou cidade" />
//   <AcaoPrincipal icone="add" rotulo="Nova unidade" onClick={…} />   // vira ícone de 44 px no celular
//   <AcaoPrincipal icone="add" rotulo="Novo cartão" onClick={…} sempreComTexto />
import { Link } from "react-router-dom";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { BTN_PRIMARIO, H1, LINK_VOLTAR, SUBTITULO } from "./adminUi";

function Voltar({ voltar }) {
  const texto = `← Voltar para ${voltar.label || "a tela anterior"}`;
  if (voltar.to) {
    return (
      <Link to={voltar.to} state={voltar.state} className={LINK_VOLTAR}>
        {texto}
      </Link>
    );
  }
  return (
    <button type="button" onClick={voltar.onClick} className={LINK_VOLTAR}>
      {texto}
    </button>
  );
}

export default function PageHeader({ voltar, acima, titulo, subtitulo, mes, situacao, acao, className = "" }) {
  const direita = mes || situacao || acao;
  return (
    <header className={`space-y-1 ${className}`}>
      {voltar && <Voltar voltar={voltar} />}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {acima && <p className="text-sm text-ink-3">{acima}</p>}
          <h1 className={H1}>{titulo}</h1>
          {subtitulo && <p className={SUBTITULO}>{subtitulo}</p>}
        </div>
        {direita && (
          <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:shrink-0 sm:flex-nowrap sm:justify-end">
            {mes || (situacao && <p className="text-sm text-ink-3">{situacao}</p>)}
            {acao && <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">{acao}</div>}
          </div>
        )}
      </div>
    </header>
  );
}

// Busca do cabeçalho (C5, C6, C7): h-11, estica no celular, 288 px no desktop.
// `placeholder` curto (até ~24 caracteres); a frase completa vai em `rotulo` (sr-only).
export function BuscaCabecalho({ id, value, onChange, placeholder = "Buscar", rotulo, className = "" }) {
  return (
    <div className={`relative min-w-0 flex-1 sm:w-72 sm:flex-none ${className}`}>
      <label htmlFor={id} className="sr-only">
        {rotulo || placeholder}
      </label>
      <MaterialIcon
        icon="search"
        size={18}
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"
      />
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className="h-11 w-full min-w-0 rounded-xl border border-surface-line bg-white pl-9 pr-3 text-sm text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none"
      />
    </div>
  );
}

// Ação principal do cabeçalho (B1 com a altura de C5). Sem `sempreComTexto`, no celular
// vira só o ícone num quadrado de 44 px (C6), com o rótulo no aria-label.
export function AcaoPrincipal({ icone, rotulo, onClick, to, state, sempreComTexto = false, disabled, className = "" }) {
  const compacta = icone && !sempreComTexto;
  const classe = `${BTN_PRIMARIO} h-11 shrink-0 ${compacta ? "w-11 px-0 sm:w-auto sm:px-4" : ""} ${className}`;
  const conteudo = (
    <>
      {icone && <MaterialIcon icon={icone} size={18} aria-hidden="true" />}
      <span className={compacta ? "sr-only sm:not-sr-only" : ""}>{rotulo}</span>
    </>
  );
  if (to) {
    return (
      <Link to={to} state={state} className={classe} aria-label={rotulo}>
        {conteudo}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={classe} aria-label={rotulo}>
      {conteudo}
    </button>
  );
}
