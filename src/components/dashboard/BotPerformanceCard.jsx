import React, { useState, useEffect, useRef, useCallback } from "react";
import { BotConversation, ConversationMessage, Sale } from "@/entities/all";
import { useAuth } from "@/lib/AuthContext";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatBRL } from "@/lib/formatBRL";

const MIN_CONVERSATIONS = 5;

const ABANDON_TIPS = {
  frete: "clientes desistiram por frete alto. Que tal revisar sua tabela de frete?",
  preco: "clientes acharam os preços altos. Verifique se estão atualizados.",
  indisponivel: "clientes pediram produtos fora de estoque. Reponha seu estoque!",
  demora: "clientes desistiram por demora na resposta.",
  confuso: "o bot não conseguiu responder algumas perguntas. Revise as configurações.",
  sem_resposta: "algumas conversas ficaram sem resposta.",
  preferiu_humano: "clientes preferiram falar com você diretamente.",
};

function cap(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function topNFromMap(map, n) {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key]) => key);
}

export default function BotPerformanceCard() {
  const { selectedFranchise: ctxFranchise } = useAuth();
  const mountedRef = useRef(true);
  const evoId = ctxFranchise?.evolution_instance_id;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!evoId) {
      setLoading(false);
      return;
    }
    try {
      const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");

      // Fetch conversations, messages, and bot sales in parallel
      const [convsRes, msgsRes, salesRes] = await Promise.allSettled([
        BotConversation.filter({ franchise_id: evoId }, "-started_at", 500),
        ConversationMessage.filter({ franchise_id: evoId }, "-created_at", 2000, { columns: "id,conversation_id,direction" }),
        Sale.filter({ franchise_id: evoId, source: "bot" }, "-sale_date", 200, { columns: "id,value,delivery_fee,sale_date" }),
      ]);

      if (!mountedRef.current) return;

      const conversations = convsRes.status === "fulfilled" ? convsRes.value : [];
      const msgs = msgsRes.status === "fulfilled" ? msgsRes.value : [];
      const botSales = salesRes.status === "fulfilled" ? salesRes.value : [];

      // Filter to current month
      const monthly = conversations.filter(
        (c) => c.started_at && c.started_at >= monthStart
      );

      const total = monthly.length;

      // Bot sales this month (real data, not LLM outcome)
      const monthlySales = botSales.filter((s) => s.sale_date >= monthStart);
      const botSalesCount = monthlySales.length;
      const botRevenue = monthlySales.reduce(
        (acc, s) => acc + parseFloat(s.value || 0) + parseFloat(s.delivery_fee || 0), 0
      );

      const escalated = monthly.filter((c) => c.outcome === "escalated").length;

      // Autonomy: conversations without any human message
      const humanConvIds = new Set();
      for (const m of msgs) {
        if (m.direction === "human" && m.conversation_id) {
          humanConvIds.add(m.conversation_id);
        }
      }
      let autonomous = 0;
      for (const c of monthly) {
        if (!humanConvIds.has(c.id)) autonomous++;
      }
      const autonomyRate = total ? Math.round((autonomous / total) * 100) : 0;

      // Average autonomy benchmark (~40% from network data)
      const networkAvg = 40;

      // Aggregate topics
      const topicMap = {};
      for (const c of monthly) {
        if (Array.isArray(c.topics)) {
          for (const t of c.topics) {
            if (t) topicMap[t] = (topicMap[t] || 0) + 1;
          }
        }
      }
      const topTopics = topNFromMap(topicMap, 3);

      // Most frequent abandon reason
      const abandonMap = {};
      for (const c of monthly) {
        if (c.llm_abandon_reason) {
          abandonMap[c.llm_abandon_reason] =
            (abandonMap[c.llm_abandon_reason] || 0) + 1;
        }
      }
      const topAbandon = topNFromMap(abandonMap, 1)[0] || null;

      // Smart tip based on autonomy + abandon reason
      let tip = null;
      if (autonomyRate < networkAvg) {
        tip = "franquias que deixam o bot atender primeiro vendem mais. Tente não responder nos primeiros segundos!";
      } else if (topAbandon) {
        tip = ABANDON_TIPS[topAbandon];
      }

      setData({ total, botSalesCount, botRevenue, escalated, autonomyRate, networkAvg, topTopics, tip });
    } catch (err) {
      console.warn("BotPerformanceCard: erro ao carregar dados:", err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [evoId]);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => {
      mountedRef.current = false;
    };
  }, [load]);

  const monthLabel = cap(format(new Date(), "MMMM", { locale: ptBR }));

  if (loading) {
    return (
      <Card className="mb-4 border-0 shadow-sm">
        <CardContent className="p-4 space-y-3">
          <Skeleton className="h-4 w-40" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-12 rounded-xl" />
            <Skeleton className="h-12 rounded-xl" />
          </div>
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.total < MIN_CONVERSATIONS) return null;

  const { total, botSalesCount, botRevenue, escalated, autonomyRate, networkAvg, topTopics, tip } = data;

  const autonomyColor = autonomyRate >= 60 ? "#16a34a" : autonomyRate >= 30 ? "#d4af37" : "#dc2626";
  const autonomyVsAvg = autonomyRate >= networkAvg ? "acima" : "abaixo";

  return (
    <Card className="mb-4 border-0 shadow-sm">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg bg-[#b91c1c]/10">
            <MaterialIcon icon="smart_toy" size={18} className="text-[#b91c1c]" />
          </div>
          <span className="font-plus-jakarta font-semibold text-sm text-[#1b1c1d]">
            Seu Vendedor Digital — {monthLabel}
          </span>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div className="bg-[#fbf9fa] rounded-xl p-3 text-center">
            <p className="text-2xl font-plus-jakarta font-bold text-[#1b1c1d]">
              {total}
            </p>
            <p className="text-xs text-[#7a6d6d] mt-0.5">Atendimentos</p>
          </div>
          <div className="bg-[#16a34a]/10 rounded-xl p-3 text-center">
            <p className="text-2xl font-plus-jakarta font-bold text-[#16a34a]">
              {botSalesCount}
            </p>
            <p className="text-xs text-[#7a6d6d] mt-0.5">Vendas bot</p>
            {botRevenue > 0 && (
              <p className="text-[10px] text-[#16a34a] mt-0.5">{formatBRL(botRevenue)}</p>
            )}
          </div>
          <div className="rounded-xl p-3 text-center" style={{ backgroundColor: `${autonomyColor}10` }}>
            <p className="text-2xl font-plus-jakarta font-bold" style={{ color: autonomyColor }}>
              {autonomyRate}%
            </p>
            <p className="text-xs text-[#7a6d6d] mt-0.5">Autonomia</p>
          </div>
        </div>

        {/* Autonomy benchmark */}
        <p className="text-xs text-[#4a3d3d] mb-3 flex items-center gap-1">
          <MaterialIcon icon="leaderboard" size={14} className="text-[#7a6d6d]" />
          Autonomia {autonomyVsAvg} da média da rede ({networkAvg}%)
        </p>

        {/* Top topics */}
        {topTopics.length > 0 && (
          <div className="mb-3">
            <p className="text-xs text-[#7a6d6d] mb-1.5">
              Seus clientes mais perguntam sobre:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {topTopics.map((topic) => (
                <span
                  key={topic}
                  className="text-xs px-2 py-0.5 rounded-full bg-[#e9e8e9] text-[#4a3d3d] font-medium"
                >
                  {cap(topic)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Actionable tip */}
        {tip && (
          <div className="bg-[#d4af37]/10 rounded-xl p-3 flex items-start gap-2">
            <MaterialIcon
              icon="lightbulb"
              size={16}
              className="text-[#775a19] flex-shrink-0 mt-0.5"
            />
            <p className="text-xs text-[#775a19] leading-relaxed">
              <span className="font-semibold">Dica: </span>
              {cap(tip)}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
