import React, { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format, subDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

const DAILY_KEYS = [
  "m1","m2","m3","m4","m5","m6","m7",
  "md1","md2","md3","md4","md5","md6","md7",
  "t1","t2","t3","t4","t5","t6","t7",
  "n1","n2","n3","n4","n5","n6",
];

const ITEM_LABELS = {
  m1: "Verificar todas as mensagens da noite",
  m2: "Responder todos os contatos Novo Lead",
  m3: "Conferir se o robô respondeu corretamente",
  m4: "Verificar estoque no freezer",
  m5: "Conferir pedidos confirmados para o dia",
  m6: "Postar 1 story no Instagram",
  m7: "Verificar temperatura do freezer",
  md1: "Follow-up para leads Em Negociação",
  md2: "Selecionar 5-10 contatos Remarketing",
  md3: "Selecionar 3-5 contatos Não Fechou",
  md4: "Responder comentários e DMs no Instagram",
  md5: "Verificar agendamento de postagens",
  md6: "Atualizar etiquetas",
  md7: "Enviar mensagem para Clientes Recorrentes",
  t1: "Fechar todos os pedidos em aberto",
  t2: "Organizar e separar entregas",
  t3: "Solicitar entregadores",
  t4: "Embalar produtos adequadamente",
  t5: "Enviar mensagem pós-venda",
  t6: "Pedir avaliação/foto ao cliente",
  t7: "Se elogiou → pedir indicação",
  n1: "Registrar todas as vendas no Dashboard",
  n2: "Atualizar controle de estoque",
  n3: "Mover contatos entre etiquetas",
  n4: "Responder últimas mensagens pendentes",
  n5: "Verificar pedido de reposição",
  n6: "Planejar ações para amanhã",
};

export default function FranchiseeDetailModal({ data, onClose }) {
  const { franchise, allChecklists, checklists30days } = data;

  // Last 30 days calendar
  const calendarDays = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => {
      const date = subDays(new Date(), 29 - i);
      const dateStr = format(date, "yyyy-MM-dd");
      const record = allChecklists.find(c => c.date === dateStr);
      let status = "none";
      if (record) {
        if (record.completion_percentage >= 100) status = "complete";
        else if (record.completion_percentage > 0) status = "partial";
        else status = "none";
      }
      return { date, dateStr, status, label: format(date, "dd/MM"), dayLabel: format(date, "EEE", { locale: ptBR }) };
    });
  }, [allChecklists]);

  // Weekly adherence (last 4 weeks)
  const weeklyAdherence = useMemo(() => {
    return Array.from({ length: 4 }, (_, weekIdx) => {
      const weekStart = 21 - weekIdx * 7;
      const days = Array.from({ length: 7 }, (_, d) => {
        const dayOffset = weekStart + d;
        const dateStr = format(subDays(new Date(), dayOffset), "yyyy-MM-dd");
        return allChecklists.find(c => c.date === dateStr);
      });
      const completeDays = days.filter(d => d && d.completion_percentage >= 100).length;
      const adherencia = Math.round((completeDays / 7) * 100);
      return {
        label: `Sem ${4 - weekIdx}`,
        completeDays,
        adherencia,
      };
    }).reverse();
  }, [allChecklists]);

  // Today's checklist items
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const todayRecord = allChecklists.find(c => c.date === todayStr);
  const todayItems = todayRecord?.items || {};

  const dayColors = {
    complete: "bg-green-500 text-white",
    partial: "bg-amber-400 text-white",
    none: "bg-slate-200 text-slate-400",
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {franchise.owner_name}
            <span className="text-slate-500 font-normal text-base ml-2">· {franchise.city}</span>
          </DialogTitle>
        </DialogHeader>

        {/* Calendar 30 days */}
        <div>
          <h3 className="font-semibold text-slate-700 mb-3">Calendário dos últimos 30 dias</h3>
          <div className="grid grid-cols-10 gap-1">
            {calendarDays.map(({ dateStr, status, label }) => (
              <div key={dateStr} className="flex flex-col items-center gap-1">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium ${dayColors[status]}`}
                  title={dateStr}
                >
                  {label.split("/")[0]}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-4 mt-2 text-xs text-slate-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500 inline-block"></span> Completo</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-400 inline-block"></span> Parcial</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-200 inline-block"></span> Sem registro</span>
          </div>
        </div>

        {/* Weekly bars */}
        <div>
          <h3 className="font-semibold text-slate-700 mb-3">Aderência semanal (últimas 4 semanas)</h3>
          <div className="flex gap-3 items-end h-24">
            {weeklyAdherence.map(week => (
              <div key={week.label} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs font-semibold text-slate-700">{week.adherencia}%</span>
                <div className="w-full bg-slate-100 rounded-t-md" style={{ height: "60px", display: "flex", alignItems: "flex-end" }}>
                  <div
                    className={`w-full rounded-t-md transition-all ${week.adherencia >= 70 ? "bg-green-500" : week.adherencia >= 40 ? "bg-amber-400" : "bg-red-400"}`}
                    style={{ height: `${Math.max(4, week.adherencia * 0.6)}px` }}
                  />
                </div>
                <span className="text-xs text-slate-400">{week.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Today's items */}
        <div>
          <h3 className="font-semibold text-slate-700 mb-3">
            Itens do checklist de hoje
            {todayRecord && (
              <Badge className="ml-2" variant={todayRecord.completion_percentage >= 100 ? "default" : "outline"}>
                {todayRecord.completed_count || 0}/{todayRecord.total_items || 27}
              </Badge>
            )}
          </h3>
          {!todayRecord ? (
            <p className="text-slate-400 text-sm">Nenhum checklist registrado hoje.</p>
          ) : (
            <div className="grid grid-cols-1 gap-1 max-h-48 overflow-y-auto">
              {DAILY_KEYS.map(key => (
                <div key={key} className="flex items-center gap-2 text-sm py-1 border-b border-slate-50">
                  <span className={todayItems[key] ? "text-green-500" : "text-slate-300"}>
                    {todayItems[key] ? "✅" : "⬜"}
                  </span>
                  <span className={todayItems[key] ? "text-slate-700" : "text-slate-400"}>
                    {ITEM_LABELS[key] || key}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}