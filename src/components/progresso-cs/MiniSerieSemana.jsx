// Mini-série semanal em barra CSS simples (sem recharts — pedido explícito do escopo).
// Usa serieSemanal() de src/lib/csProgresso.js para normalizar a altura.
//
//   <MiniSerieSemana titulo="Conversas por semana" pontos={serieSemanal(atividade.por_semana, "conversas")} />
export default function MiniSerieSemana({ titulo, pontos = [], className = "" }) {
  const semDado = !pontos.length || pontos.every((p) => p.valor === 0);
  return (
    <div className={className}>
      <p className="text-xs font-bold uppercase tracking-wide text-ink-3">{titulo}</p>
      {semDado ? (
        <p className="mt-2 text-sm text-ink-3">Sem registro nas semanas do período.</p>
      ) : (
        <div className="mt-2 flex items-end gap-1.5" role="img" aria-label={`${titulo}: ${pontos.map((p) => `${p.rotulo} ${p.valor}`).join(", ")}`}>
          {pontos.map((p, i) => (
            <div key={p.semanaIni || i} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-16 w-full items-end">
                <div
                  className="w-full rounded-t-sm bg-brand"
                  style={{ height: `${Math.max(p.alturaPct, p.valor > 0 ? 6 : 0)}%` }}
                  title={`${p.rotulo}: ${p.valor}`}
                />
              </div>
              <span className="text-xs leading-none text-ink-4">{p.rotulo}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
