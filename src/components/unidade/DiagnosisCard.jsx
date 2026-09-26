// "O que está acontecendo" + roteiro da conversa. Ficha da unidade (/Unidade?id=<evo>).
export default function DiagnosisCard({ diagnostico, roteiro }) {
  return (
    <div className="bg-white rounded-2xl p-5 md:p-6 border border-surface-line flex flex-col gap-3">
      <div className="text-xs font-bold text-ink-3 tracking-wide uppercase">O que está acontecendo</div>
      <div className="text-lg md:text-xl font-semibold leading-snug text-ink">{diagnostico.frase}</div>
      {diagnostico.detalhe && <div className="text-sm text-ink-2">{diagnostico.detalhe}</div>}
      {roteiro?.length > 0 && (
        <>
          <div className="text-xs font-bold text-ink-3 tracking-wide uppercase mt-1.5">Roteiro da conversa</div>
          <ol className="list-decimal pl-5 text-sm md:text-base text-ink-2 space-y-1.5 leading-relaxed">
            {roteiro.map((linha, i) => <li key={i}>{linha}</li>)}
          </ol>
        </>
      )}
    </div>
  );
}
