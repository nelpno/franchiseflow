// Markdown mínimo e seguro para a resposta do Assessor do CS: títulos (#), listas (-, *, 1.),
// **negrito**, *itálico*, `código` e parágrafos. Só monta elementos React (nunca HTML cru).
import { Fragment } from "react";

function inline(texto, chave) {
  // **negrito**, `código`, *itálico*
  const partes = [];
  let ultimo = 0;
  let i = 0;
  for (const m of String(texto).matchAll(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g)) {
    if (m.index > ultimo) partes.push(texto.slice(ultimo, m.index));
    const t = m[0];
    if (t.startsWith("**")) partes.push(<strong key={`${chave}-${i++}`} className="font-semibold text-ink">{t.slice(2, -2)}</strong>);
    else if (t.startsWith("`")) partes.push(<code key={`${chave}-${i++}`} className="rounded bg-surface px-1 text-[0.85em]">{t.slice(1, -1)}</code>);
    else partes.push(<em key={`${chave}-${i++}`}>{t.slice(1, -1)}</em>);
    ultimo = m.index + t.length;
  }
  if (ultimo < texto.length) partes.push(texto.slice(ultimo));
  return partes.map((p, k) => <Fragment key={`${chave}-f${k}`}>{p}</Fragment>);
}

export default function MarkdownSimples({ texto }) {
  const linhas = String(texto || "").replace(/\r\n/g, "\n").split("\n");
  const blocos = [];
  let lista = null; // { ordenada, itens }
  let paragrafo = [];

  const fechaParagrafo = () => {
    if (paragrafo.length) blocos.push({ tipo: "p", linhas: paragrafo });
    paragrafo = [];
  };
  const fechaLista = () => {
    if (lista) blocos.push({ tipo: "lista", ...lista });
    lista = null;
  };

  for (const bruta of linhas) {
    const l = bruta.trimEnd();
    const h = l.match(/^(#{1,4})\s+(.*)$/);
    const ul = l.match(/^\s*[-*•]\s+(.*)$/);
    const ol = l.match(/^\s*(\d+)[.)]\s+(.*)$/);
    if (!l.trim()) { fechaParagrafo(); fechaLista(); continue; }
    if (h) { fechaParagrafo(); fechaLista(); blocos.push({ tipo: "h", texto: h[2] }); continue; }
    if (ul || ol) {
      fechaParagrafo();
      const ordenada = !!ol;
      if (lista && lista.ordenada !== ordenada) fechaLista();
      // O modelo costuma separar itens numerados com linha em branco: cada item vira uma <ol> nova,
      // então a lista começa no número que veio no texto (senão tudo aparece como "1.").
      lista ??= { ordenada, itens: [], inicio: ol ? Number(ol[1]) : 1 };
      lista.itens.push(ul ? ul[1] : ol[2]);
      continue;
    }
    // continuação indentada de item de lista
    if (lista && /^\s{2,}\S/.test(bruta)) { lista.itens[lista.itens.length - 1] += ` ${l.trim()}`; continue; }
    fechaLista();
    paragrafo.push(l);
  }
  fechaParagrafo();
  fechaLista();

  return (
    <div className="space-y-2 text-sm leading-relaxed text-ink">
      {blocos.map((b, i) => {
        if (b.tipo === "h") return <h4 key={i} className="pt-1 font-plus-jakarta text-sm font-bold text-ink">{inline(b.texto, `h${i}`)}</h4>;
        if (b.tipo === "lista") {
          const Tag = b.ordenada ? "ol" : "ul";
          return (
            <Tag key={i} start={b.ordenada && b.inicio !== 1 ? b.inicio : undefined} className={`${b.ordenada ? "list-decimal" : "list-disc"} space-y-1 pl-5`}>
              {b.itens.map((it, k) => <li key={k}>{inline(it, `l${i}-${k}`)}</li>)}
            </Tag>
          );
        }
        return (
          <p key={i}>
            {b.linhas.map((ln, k) => (
              <Fragment key={k}>{k > 0 && <br />}{inline(ln, `p${i}-${k}`)}</Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
