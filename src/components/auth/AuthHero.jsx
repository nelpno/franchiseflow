import MaterialIcon from "@/components/ui/MaterialIcon";
import logoMaxiMassas from "@/assets/logo-maxi-massas-optimized.png";

/**
 * Hero lateral compartilhado das telas de autenticação (Login, SetPassword).
 * Fonte única do padrão visual: logo + headline + preview do dashboard.
 * `headline`/`subtitle` são nodes (permitem destaque em cor). Oculto no mobile.
 */
export default function AuthHero({ headline, subtitle }) {
  return (
    <section className="hidden lg:flex lg:w-3/5 relative bg-gradient-to-br from-[#fff5f5] to-white p-16 flex-col justify-between overflow-hidden">
      {/* Background dotted pattern */}
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage: "radial-gradient(circle at 2px 2px, rgba(227, 24, 24, 0.05) 1px, transparent 0)",
          backgroundSize: "24px 24px",
        }}
      />
      {/* Keyframes for the staggered entrance */}
      <style>{`
        @keyframes maxiRise { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes maxiGrow { from { transform: scaleY(0.12); } to { transform: scaleY(1); } }
      `}</style>

      {/* Soft glow blobs for depth */}
      <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-[#e31818]/[0.06] blur-3xl pointer-events-none" />
      <div className="absolute -bottom-28 -right-16 w-[26rem] h-[26rem] rounded-full bg-[#B8860B]/[0.06] blur-3xl pointer-events-none" />

      {/* Logo + brand */}
      <div className="relative z-10 flex items-center gap-4" style={{ animation: "maxiRise .6s ease both" }}>
        <img
          src={logoMaxiMassas}
          alt="Maxi Massas Logo"
          className="h-16 w-auto object-contain drop-shadow-sm"
        />
        <span className="text-2xl font-extrabold tracking-tighter text-[#1b1c1d]">Maxi Massas</span>
      </div>

      {/* Headline */}
      <div className="relative z-10 max-w-md" style={{ animation: "maxiRise .6s ease both", animationDelay: ".08s" }}>
        <h1
          className="text-4xl xl:text-[2.85rem] font-bold text-[#1b1c1d] tracking-tight leading-[1.12]"
          style={{ fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }}
        >
          {headline}
        </h1>
        {subtitle && (
          <p className="mt-4 text-[#3d4a42] text-base leading-relaxed max-w-sm">{subtitle}</p>
        )}
      </div>

      {/* Dashboard preview (product mockup) */}
      <div className="relative z-10 w-[400px] max-w-full" style={{ animation: "maxiRise .7s ease both", animationDelay: ".16s" }}>
        {/* App window frame */}
        <div className="rounded-2xl bg-white shadow-[0_28px_60px_-18px_rgba(227,24,24,0.22)] border border-black/5 overflow-hidden">
          {/* chrome bar */}
          <div className="flex items-center gap-1.5 px-4 py-3 border-b border-black/5 bg-[#fbf9fa]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#e31818]/40" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#B8860B]/40" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#bccac0]/60" />
            <span className="ml-3 text-[11px] font-semibold text-[#6d7a72]">Início · Imirim</span>
            <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-[#775a19]">
              <MaterialIcon icon="emoji_events" size={13} /> #3 na rede
            </span>
          </div>
          {/* body */}
          <div className="p-4 space-y-3">
            {/* KPI row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-[#e31818]/[0.04] border border-[#e31818]/10 p-3">
                <p className="text-[9px] uppercase tracking-widest text-[#3d4a42] font-semibold">Faturamento hoje</p>
                <p className="text-xl font-bold text-[#1b1c1d] mt-0.5 leading-none">R$ 4.850</p>
                <p className="text-[10px] font-semibold text-[#16a34a] flex items-center gap-0.5 mt-1">
                  <MaterialIcon icon="trending_up" size={12} /> +12% vs ontem
                </p>
              </div>
              <div className="rounded-xl bg-[#B8860B]/[0.05] border border-[#B8860B]/10 p-3">
                <p className="text-[9px] uppercase tracking-widest text-[#3d4a42] font-semibold">Pedidos hoje</p>
                <p className="text-xl font-bold text-[#1b1c1d] mt-0.5 leading-none">32</p>
                <p className="text-[10px] font-semibold text-[#6d7a72] mt-1">valor médio R$ 152</p>
              </div>
            </div>
            {/* mini bar chart */}
            <div className="rounded-xl border border-black/5 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold text-[#3d4a42]">Vendas · últimos 7 dias</p>
                <p className="text-[10px] font-bold text-[#e31818]">R$ 28,4k</p>
              </div>
              <div className="flex items-end gap-1.5 h-16">
                {[42, 58, 36, 72, 52, 84, 100].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t-md origin-bottom"
                    style={{
                      height: h + "%",
                      background: i === 6 ? "#e31818" : "rgba(227,24,24,0.16)",
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
                  <p className="text-[10px] font-bold text-[#16a34a]">96%</p>
                </div>
                <div className="h-2 rounded-full bg-[#e9e8e9] overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#e31818] to-[#B8860B]" style={{ width: "96%" }} />
                </div>
              </div>
              <div className="rounded-xl bg-[#6b38d4]/[0.05] border border-[#6b38d4]/10 p-3 flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#6b38d4]/10 flex items-center justify-center text-[#6b38d4] shrink-0">
                  <MaterialIcon icon="smart_toy" size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] uppercase tracking-widest text-[#3d4a42] font-semibold leading-tight">Robô vendedor</p>
                  <p className="text-xs font-bold text-[#1b1c1d]">no ar · 24h</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
