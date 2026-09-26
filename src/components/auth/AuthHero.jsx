import MaterialIcon from "@/components/ui/MaterialIcon";
import logoMaxiMassas from "@/assets/logo-maxi-massas-optimized.png";

/**
 * Hero lateral compartilhado das telas de autenticação (Login, SetPassword).
 * Fonte única do padrão visual: logo + headline + preview do dashboard.
 * `headline`/`subtitle` são nodes (permitem destaque em cor). Oculto no mobile.
 */
export default function AuthHero({ headline, subtitle }) {
  return (
    /* Fundo vermelho da marca + textura de farinha (igual à faixa do celular). Antes era rosa-claro
       quase branco e a tela parecia apagada no desktop (Fase 4, 26/09/2026). Texto branco sobre
       #b91c1c = 6,4:1 (AA). O destaque da headline (span .text-err) vira branco sublinhado de
       dourado: vermelho sobre vermelho sumiria. */
    <section className="hidden lg:flex lg:w-3/5 relative bg-brand bg-farinha p-16 flex-col justify-between overflow-hidden">
      {/* Keyframes for the staggered entrance */}
      <style>{`
        @keyframes maxiRise { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes maxiGrow { from { transform: scaleY(0.12); } to { transform: scaleY(1); } }
      `}</style>

      {/* Soft glow blobs for depth */}
      <div className="absolute -bottom-28 -right-16 w-[26rem] h-[26rem] rounded-full bg-brand-dark/60 blur-3xl pointer-events-none" />

      {/* Logo + brand */}
      <div className="relative z-10 flex items-center gap-4" style={{ animation: "maxiRise .6s ease both" }}>
        <div className="bg-white rounded-2xl px-3 py-2">
          <img src={logoMaxiMassas} alt="Maxi Massas" className="h-10 w-auto object-contain block" />
        </div>
      </div>

      {/* Headline */}
      <div className="relative z-10 max-w-md" style={{ animation: "maxiRise .6s ease both", animationDelay: ".08s" }}>
        <h1
          className="text-4xl xl:text-[2.85rem] font-extrabold text-white tracking-tight leading-[1.12] [&_.text-err]:text-white [&_.text-err]:underline [&_.text-err]:decoration-brand-gold [&_.text-err]:decoration-4 [&_.text-err]:underline-offset-8"
          style={{ fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }}
        >
          {headline}
        </h1>
        {subtitle && (
          <p className="mt-4 text-white text-lg leading-relaxed max-w-sm">{subtitle}</p>
        )}
      </div>

      {/* Dashboard preview (product mockup) */}
      <div aria-hidden="true" className="relative z-10 w-[400px] max-w-full" style={{ animation: "maxiRise .7s ease both", animationDelay: ".16s" }}>
        {/* App window frame */}
        <div className="rounded-2xl bg-white shadow-[0_28px_60px_-18px_rgba(220, 38, 38,0.22)] border border-black/5 overflow-hidden">
          {/* chrome bar */}
          <div className="flex items-center gap-1.5 px-4 py-3 border-b border-black/5 bg-surface">
            <span className="w-2.5 h-2.5 rounded-full bg-err/40" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#B8860B]/40" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#bccac0]/60" />
            <span className="ml-3 text-[11px] font-semibold text-[#6d7a72]">Início · Imirim</span>
            <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-brand-gold-ink">
              <MaterialIcon icon="emoji_events" size={13} /> #3 na rede
            </span>
          </div>
          {/* body */}
          <div className="p-4 space-y-3">
            {/* KPI row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-err/[0.04] border border-err/10 p-3">
                <p className="text-[9px] uppercase tracking-widest text-[#3d4a42] font-semibold">Faturamento hoje</p>
                <p className="text-xl font-bold text-ink mt-0.5 leading-none">R$ 4.850</p>
                <p className="text-[10px] font-semibold text-ok-ink flex items-center gap-0.5 mt-1">
                  <MaterialIcon icon="trending_up" size={12} /> +12% vs ontem
                </p>
              </div>
              <div className="rounded-xl bg-[#B8860B]/[0.05] border border-[#B8860B]/10 p-3">
                <p className="text-[9px] uppercase tracking-widest text-[#3d4a42] font-semibold">Pedidos hoje</p>
                <p className="text-xl font-bold text-ink mt-0.5 leading-none">32</p>
                <p className="text-[10px] font-semibold text-[#6d7a72] mt-1">valor médio R$ 152</p>
              </div>
            </div>
            {/* mini bar chart */}
            <div className="rounded-xl border border-black/5 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold text-[#3d4a42]">Vendas · últimos 7 dias</p>
                <p className="text-[10px] font-bold text-err">R$ 28,4k</p>
              </div>
              <div className="flex items-end gap-1.5 h-16">
                {[42, 58, 36, 72, 52, 84, 100].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t-md origin-bottom"
                    style={{
                      height: h + "%",
                      background: i === 6 ? "#dc2626" : "rgba(220, 38, 38,0.16)",
                      animation: "maxiGrow .55s ease both",
                      animationDelay: 0.32 + i * 0.05 + "s",
                    }}
                  />
                ))}
              </div>
            </div>
            {/* bottom row: meta + robô (inline, sem sobreposição) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-black/5 p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] font-semibold text-[#3d4a42]">Meta diária</p>
                  <p className="text-[10px] font-bold text-ok-ink">96%</p>
                </div>
                <div className="h-2 rounded-full bg-surface-line overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-err to-[#B8860B]" style={{ width: "96%" }} />
                </div>
              </div>
              <div className="rounded-xl bg-[#6b38d4]/[0.05] border border-[#6b38d4]/10 p-3 flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#6b38d4]/10 flex items-center justify-center text-[#6b38d4] shrink-0">
                  <MaterialIcon icon="smart_toy" size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] uppercase tracking-widest text-[#3d4a42] font-semibold leading-tight">Robô vendedor</p>
                  <p className="text-xs font-bold text-ink">no ar · 24h</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
