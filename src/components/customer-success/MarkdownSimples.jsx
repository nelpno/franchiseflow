// Markdown mínimo e seguro para a resposta do Assessor do CS: títulos (#), listas (-, *, 1.),
// **negrito**, *itálico*, `código`, parágrafos e tabela simples (| a | b |, desde 22/11/2026, para
// os "meses lado a lado" do relatório completo). Só monta elementos React (nunca HTML cru).
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
  let tabela = null; // linhas de células

  const fechaTabela = () => {
    if (tabela && tabela.length) blocos.push({ tipo: "tabela", linhas: tabela });
    tabela = null;
  };

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
    if (/^\s*\|.*\|\s*$/.test(l)) {
      fechaParagrafo(); fechaLista();
      const celulas = l.trim().slice(1, -1).split("|").map((c) => c.trim());
      if (celulas.every((c) => /^:?-{2,}:?$/.test(c))) continue; // linha |---|---|
      (tabela ??= []).push(celulas);
      continue;
    }
    fechaTabela();
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
  fechaTabela();

  return (
    <div className="space-y-2 text-sm leading-relaxed text-ink">
      {blocos.map((b, i) => {
        if (b.tipo === "h") return <h4 key={i} className="pt-1 font-plus-jakarta text-sm font-bold text-ink">{inline(b.texto, `h${i}`)}</h4>;
        if (b.tipo === "tabela") {
          const [cab, ...corpo] = b.linhas;
          return (
            <div key={i} className="max-w-full overflow-x-auto">
              <table className="min-w-full border-collapse text-xs tabular-nums">
                <thead>
                  <tr>{cab.map((c, k) => <th key={k} className="border-b border-surface-line px-2 py-1 text-left font-semibold text-ink-2">{inline(c, `t${i}h${k}`)}</th>)}</tr>
                </thead>
                <tbody>
                  {corpo.map((ln, r) => (
                    <tr key={r} className="border-b border-surface-line/60">
                      {ln.map((c, k) => <td key={k} className={`px-2 py-1 ${k === 0 ? "text-left" : "text-right"}`}>{inline(c, `t${i}r${r}c${k}`)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
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
