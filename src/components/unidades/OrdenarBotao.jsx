// Cabeçalho clicável da tela Unidades (desktop): botão real (não só texto), aria-sort no
// invólucro (role="columnheader"), seta indicando a coluna e a direção ativas. Clicar de
// novo na mesma coluna inverte — quem decide isso é `onClick` (Unidades.jsx/irParaOrdem).
// `pequeno` = 2ª linha empilhada dentro da coluna Faturamento (a Variação não tem coluna
// própria; herda o tamanho/caixa-alta do CABECALHO_LISTA do pai, T11 proíbe ir menor).
import MaterialIcon from "@/components/ui/MaterialIcon";

export default function OrdenarBotao({ chave, rotulo, ativo, direcao, onClick, pequeno = false, className = "" }) {
  const ariaSort = ativo ? (direcao === "asc" ? "ascending" : "descending") : "none";
  return (
    <div role="columnheader" aria-sort={ariaSort} className={className}>
      <button
        type="button"
        onClick={() => onClick(chave)}
        className={`inline-flex items-center gap-0.5 whitespace-nowrap hover:text-ink ${
          ativo ? "text-ink" : ""
        } ${pequeno ? "font-semibold" : ""}`}
      >
        {rotulo}
        {ativo && (
          <MaterialIcon
            icon={direcao === "asc" ? "arrow_upward" : "arrow_downward"}
            size={pequeno ? 12 : 14}
            aria-hidden="true"
          />
        )}
      </button>
    </div>
  );
}
