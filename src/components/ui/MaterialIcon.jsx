/**
 * Material Symbols Outlined icon component.
 * Uses Google's Material Symbols font (same as Stitch designs).
 *
 * @param {string} icon - Material Symbol name (e.g., "dashboard", "shopping_cart")
 * @param {boolean} filled - Whether to use filled variant
 * @param {string} className - Additional CSS classes
 * @param {number} size - Font size in px (default: 20)
 */
export default function MaterialIcon({ icon, filled = false, className = "", size, style = {} }) {
  const variationSettings = filled
    ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24"
    : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24";

  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={{
        fontVariationSettings: variationSettings,
        // O nome do ícone é o CONTEÚDO do span: a fonte desenha por LIGADURA do texto
        // "payments". Qualquer propriedade de texto herdada do container mexe nesse texto
        // e a ligadura deixa de casar — aí o navegador desenha a PALAVRA.
        //
        // Medido em 08/09/2026, no raio-x do mural do CS: 11 ícones viraram palavra porque
        // o container tem `uppercase`. A prova é a largura — `campaign` mede 20px no menu
        // lateral e 76px dentro daquele diálogo. Mesmo ícone, mesma fonte.
        //
        // É o mesmo sintoma de ícone fora do subset, e por isso engana: o
        // `npm run icons:check` passa (o ícone ESTÁ no subset) e a tela quebra do mesmo
        // jeito. Havia 15 pontos com `uppercase` sobre ícone em 10 arquivos.
        //
        // Vai INLINE, não no CSS da classe: `.uppercase` do Tailwind tem a mesma
        // especificidade de `.material-symbols-outlined` e vence por vir depois na folha.
        textTransform: "none",
        letterSpacing: "normal",
        ...(size ? { fontSize: `${size}px` } : {}),
        ...style,
      }}
    >
      {icon}
    </span>
  );
}
