// Cotações de frete do cardápio no mês (Edge cardapio-frete v8, 10/11/2026; RPCs da sessão do frete, SQL site/pedido/supabase/
// 2026-11-10k-cardapio-frete-reserva.sql). Acima da cota o frete continua aparecendo (valor aproximado, o robô confere).
//   modo "unidade" (página da unidade): só as cotações da unidade no mês e hoje, em linguagem simples, sem nome de API.
//   modo "rede" (admin, visão da rede): total da rede no mês, hoje × teto do dia e o teto do mês do Google por tipo, com
//   alerta a partir de 70%. O bloco da rede vem de cardapio_frete_uso(qualquer unidade) + cardapio_frete_uso_rede.
// Revisado e ligado na página em 10/11/2026 (sessão do autoatendimento): dados pela camada entities/all, cores do tema.
import { useQuery } from "@tanstack/react-query";
import { CARTAO, H3_CARTAO } from "@/components/shared/adminUi";
import { getCardapioFreteUso, getCardapioFreteUsoRede } from "@/entities/all";

const NOME_SKU = { geocode: "Endereços", routes: "Rotas", rota: "Rotas (reserva)" };
const n = (v) => Number(v) || 0;
const fmt = (v) => n(v).toLocaleString("pt-BR");

function Barra({ usado, teto, alerta, rotulo }) {
  const pct = teto > 0 ? Math.min(100, Math.round((usado / teto) * 100)) : 0;
  return (
    <div className="mt-1 h-2 w-full rounded-full bg-surface-line" role="progressbar" aria-label={rotulo}
      aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-2 rounded-full ${alerta ? "bg-warn" : "bg-ok"}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function Unidade({ franchiseId }) {
  const q = useQuery({
    queryKey: ["cardapio-frete-uso", franchiseId],
    enabled: !!franchiseId,
    staleTime: 60_000,
    queryFn: ({ signal }) => getCardapioFreteUso(franchiseId, { signal }),
  });
  const u = q.data?.unidade;
  if (!u) return null;
  const mes = n(u.google_mes) + n(u.reserva_mes);
  const hoje = n(u.google_hoje) + n(u.reserva_hoje);
  return (
    <section className={`${CARTAO} space-y-1`} aria-labelledby="cardapio-frete-uso">
      <h2 id="cardapio-frete-uso" className={H3_CARTAO}>Cotações de frete este mês</h2>
      <p className="text-sm text-ink-2" data-frete-uso>
        Quando o cliente digita o CEP, o cardápio calcula o frete. Este mês foram <strong className="font-semibold text-ink">{fmt(mes)}</strong>{" "}
        {mes === 1 ? "cotação" : "cotações"} ({fmt(hoje)} hoje).
      </p>
      {n(u.reserva_mes) > 0 && (
        <p className="text-xs text-ink-3">{fmt(u.reserva_mes)} com valor aproximado: o robô confere o frete no WhatsApp.</p>
      )}
    </section>
  );
}

function Rede({ evoQualquer }) {
  const usoQ = useQuery({
    queryKey: ["cardapio-frete-uso", evoQualquer],
    enabled: !!evoQualquer,
    staleTime: 60_000,
    queryFn: ({ signal }) => getCardapioFreteUso(evoQualquer, { signal }),
  });
  const redeQ = useQuery({
    queryKey: ["cardapio-frete-uso-rede"],
    staleTime: 60_000,
    queryFn: ({ signal }) => getCardapioFreteUsoRede({ signal }),
  });
  const rede = usoQ.data?.rede;
  const linhas = redeQ.data || [];
  if (!rede && !linhas.length) return null;
  const mes = linhas.reduce((s, l) => s + n(l.google_mes) + n(l.reserva_mes), 0);
  const aprox = linhas.reduce((s, l) => s + n(l.reserva_mes), 0);
  const unidades = linhas.filter((l) => n(l.google_mes) + n(l.reserva_mes) > 0).length;
  const skus = Array.isArray(rede?.skus) ? rede.skus : [];
  const alerta = !!rede?.alerta_dia || skus.some((s) => s.alerta);
  return (
    <section className={`${CARTAO} space-y-3`} aria-labelledby="cardapio-frete-rede">
      <div className="space-y-1">
        <h2 id="cardapio-frete-rede" className={H3_CARTAO}>Cotações de frete da rede este mês</h2>
        <p className="text-sm text-ink-2" data-frete-rede>
          {fmt(mes)} {mes === 1 ? "cotação" : "cotações"} em {unidades} {unidades === 1 ? "unidade" : "unidades"}
          {aprox ? ` (${fmt(aprox)} com valor aproximado)` : ""}. Passou do teto, o frete continua aparecendo, aproximado, e o robô confere.
        </p>
        {alerta && <p className="rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn-ink">Atenção: algum teto passou de 70%.</p>}
      </div>
      {rede && (
        <div>
          <p className="text-sm text-ink">Hoje: {fmt(rede.google_hoje)} de {fmt(rede.teto_dia)} com valor exato</p>
          <Barra usado={n(rede.google_hoje)} teto={n(rede.teto_dia)} alerta={!!rede.alerta_dia} rotulo="Cotações exatas hoje" />
        </div>
      )}
      {skus.map((s) => (
        <div key={s.sku}>
          <p className="text-xs text-ink-3">Teto do mês, {NOME_SKU[s.sku] || s.sku}: {fmt(s.usado)} de {fmt(s.teto)}{s.alerta ? " (acima de 70%)" : ""}</p>
          <Barra usado={n(s.usado)} teto={n(s.teto)} alerta={!!s.alerta} rotulo={`Teto do mês: ${NOME_SKU[s.sku] || s.sku}`} />
        </div>
      ))}
    </section>
  );
}

export default function FreteConsumoCard({ franchiseId, modo = "unidade" }) {
  return modo === "rede" ? <Rede evoQualquer={franchiseId} /> : <Unidade franchiseId={franchiseId} />;
}
