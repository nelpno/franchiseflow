import React, { useState, useEffect, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Franchise } from "@/entities/all";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { RefreshCw, ClipboardList } from "lucide-react";
import ChecklistBlock from "../components/checklist/ChecklistBlock";
import ChecklistProgress from "../components/checklist/ChecklistProgress";
import ChecklistHistory from "../components/checklist/ChecklistHistory";

const DAILY_ITEMS = {
  morning: [
    { key: "m1", label: "Verificar todas as mensagens que chegaram durante a noite" },
    { key: "m2", label: "Responder TODOS os contatos \"Novo Lead\" (prioridade máxima!)" },
    { key: "m3", label: "Conferir se o robô respondeu corretamente durante a noite" },
    { key: "m4", label: "Verificar estoque no freezer — anotar produtos com pouca quantidade" },
    { key: "m5", label: "Conferir pedidos confirmados para entrega/retirada do dia" },
    { key: "m6", label: "Postar 1 story no Instagram (freezer, produto do dia, bastidores, depoimento)" },
    { key: "m7", label: "Verificar temperatura do freezer e anotar" },
  ],
  midday: [
    { key: "md1", label: "Enviar follow-up para TODOS os leads \"Em Negociação\"" },
    { key: "md2", label: "Selecionar 5-10 contatos \"Remarketing\" e enviar mensagem personalizada" },
    { key: "md3", label: "Selecionar 3-5 contatos \"Não Fechou\" (30+ dias) e tentar novamente" },
    { key: "md4", label: "Responder TODOS os comentários e DMs no Instagram" },
    { key: "md5", label: "Verificar agendamento das postagens do dia (Instagram e WhatsApp)" },
    { key: "md6", label: "Atualizar etiquetas conforme evolução das conversas" },
    { key: "md7", label: "Enviar mensagem para 2-3 \"Clientes Recorrentes\" (relacionamento)" },
  ],
  afternoon: [
    { key: "t1", label: "Fechar todos os pedidos em aberto (cobrar pagamento, confirmar dados)" },
    { key: "t2", label: "Organizar e separar entregas do dia" },
    { key: "t3", label: "Solicitar entregadores (Uber/99) ou preparar para retirada" },
    { key: "t4", label: "Embalar produtos adequadamente (manter congelados)" },
    { key: "t5", label: "Enviar mensagem pós-venda para quem recebeu hoje" },
    { key: "t6", label: "Pedir avaliação/foto ao cliente satisfeito" },
    { key: "t7", label: "Se elogiou → pedir indicação" },
  ],
  night: [
    { key: "n1", label: "Registrar TODAS as vendas do dia no Dashboard" },
    { key: "n2", label: "Atualizar controle de estoque" },
    { key: "n3", label: "Mover contatos entre etiquetas" },
    { key: "n4", label: "Responder últimas mensagens pendentes" },
    { key: "n5", label: "Verificar se precisa fazer pedido de reposição" },
    { key: "n6", label: "Planejar ações específicas para amanhã" },
  ],
};

const WEEKLY_ITEMS = [
  { key: "s1", label: "Analisar quais produtos mais venderam na semana" },
  { key: "s2", label: "Revisar lista \"Não Fechou\" — tentar reconversão" },
  { key: "s3", label: "Criar lista de transmissão para promoção semanal" },
  { key: "s4", label: "Revisar catálogo do WhatsApp (fotos, preços, disponibilidade)" },
  { key: "s5", label: "Pedir feedback a 3 clientes recorrentes" },
  { key: "s6", label: "Fazer pedido de reposição à fábrica se necessário" },
  { key: "s7", label: "Analisar métricas do Instagram e Facebook" },
  { key: "s8", label: "Revisar desempenho do tráfego pago" },
];

const MONTHLY_ITEMS = [
  { key: "me1", label: "Reunião de acompanhamento com Celso (CS)" },
  { key: "me2", label: "Analisar relatório mensal de vendas" },
  { key: "me3", label: "Calcular margem de lucro real por produto" },
  { key: "me4", label: "Revisar e limpar base de contatos (60+ dias sem resposta)" },
  { key: "me5", label: "Definir meta de vendas do próximo mês" },
  { key: "me6", label: "Avaliar parcerias locais, eventos, B2B" },
  { key: "me7", label: "Solicitar novos conteúdos ao franqueador" },
  { key: "me8", label: "Auto-avaliação: estou seguindo o checklist? O que melhorar?" },
];

const TOTAL_DAILY = 27;

const todayStr = () => format(new Date(), "yyyy-MM-dd");

export default function MyChecklist() {
  const [franchise, setFranchise] = useState(null);
  const [availableFranchises, setAvailableFranchises] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [checklist, setChecklist] = useState(null); // entity record
  const [items, setItems] = useState({});
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const saveTimerRef = useRef(null);

  const loadData = useCallback(async (selectedFranchise = null) => {
    setIsLoading(true);
    const user = await base44.auth.me();
    setCurrentUser(user);

    const allFranchises = await Franchise.list();
    let myFranchises;
    if (user.role === "admin") {
      myFranchises = allFranchises;
    } else {
      const ids = user.managed_franchise_ids || [];
      myFranchises = allFranchises.filter((f) => ids.includes(f.evolution_instance_id));
    }

    setAvailableFranchises(myFranchises);

    const myFranchise = selectedFranchise || myFranchises[0];

    if (!myFranchise) {
      setIsLoading(false);
      return;
    }
    setFranchise(myFranchise);

    // Buscar histórico (últimos 7 dias)
    const today = new Date();
    const sevenDaysAgo = format(subDays(today, 6), "yyyy-MM-dd");
    const allChecklists = await base44.entities.DailyChecklist.filter({
      franchise_id: myFranchise.evolution_instance_id,
    });

    const recentHistory = allChecklists.filter((c) => c.date >= sevenDaysAgo);
    setHistory(recentHistory);

    // Buscar checklist de hoje
    const todayChecklist = allChecklists.find((c) => c.date === todayStr());

    if (todayChecklist) {
      setChecklist(todayChecklist);
      setItems(todayChecklist.items || {});
    } else {
      // Criar novo
      const newChecklist = await base44.entities.DailyChecklist.create({
        franchise_id: myFranchise.evolution_instance_id,
        date: todayStr(),
        items: {},
        completed_count: 0,
        total_items: TOTAL_DAILY,
        completion_percentage: 0,
      });
      setChecklist(newChecklist);
      setItems({});
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  const handleFranchiseChange = (franchiseId) => {
    const selected = availableFranchises.find((f) => f.evolution_instance_id === franchiseId);
    if (selected) loadData(selected);
  };

  const saveChecklist = useCallback(
    async (newItems) => {
      if (!checklist) return;
      const allDailyKeys = [
        ...DAILY_ITEMS.morning,
        ...DAILY_ITEMS.midday,
        ...DAILY_ITEMS.afternoon,
        ...DAILY_ITEMS.night,
      ].map((i) => i.key);

      const completed_count = allDailyKeys.filter((k) => newItems[k]).length;
      const completion_percentage = Math.round((completed_count / TOTAL_DAILY) * 100);

      await base44.entities.DailyChecklist.update(checklist.id, {
        items: newItems,
        completed_count,
        total_items: TOTAL_DAILY,
        completion_percentage,
      });

      // Atualizar histórico local
      setHistory((prev) =>
        prev.map((h) =>
          h.id === checklist.id
            ? { ...h, items: newItems, completed_count, completion_percentage }
            : h
        )
      );
    },
    [checklist]
  );

  const handleToggle = (key) => {
    const newItems = { ...items, [key]: !items[key] };
    setItems(newItems);

    // Debounce save
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveChecklist(newItems);
    }, 600);
  };

  const handleResetDay = async () => {
    if (!window.confirm("Tem certeza que deseja limpar todos os itens marcados hoje?")) return;
    const emptyItems = {};
    setItems(emptyItems);
    await saveChecklist(emptyItems);
  };

  const completedCount = [
    ...DAILY_ITEMS.morning,
    ...DAILY_ITEMS.midday,
    ...DAILY_ITEMS.afternoon,
    ...DAILY_ITEMS.night,
  ].filter((i) => items[i.key]).length;

  const todayFormatted = format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
  const todayFormattedCapitalized =
    todayFormatted.charAt(0).toUpperCase() + todayFormatted.slice(1);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center">
        <div className="text-center">
          <ClipboardList className="w-12 h-12 text-red-500 mx-auto mb-3 animate-pulse" />
          <p className="text-slate-600 font-medium">Carregando checklist...</p>
        </div>
      </div>
    );
  }

  if (!franchise) {
    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <ClipboardList className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-700 mb-2">Nenhuma franquia vinculada</h2>
          <p className="text-slate-500">Fale com o administrador para vincular uma franquia à sua conta.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-amber-50">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">

        {/* HEADER */}
        <div className="bg-white rounded-2xl shadow-md p-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <ClipboardList className="w-6 h-6 text-red-600" />
                <h1 className="text-2xl font-bold text-slate-900">Checklist Diário de Vendas</h1>
              </div>
              <p className="text-slate-600 font-medium">{franchise.owner_name} · {franchise.city}</p>
              <p className="text-slate-400 text-sm mt-0.5">{todayFormattedCapitalized}</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleResetDay} className="text-red-600 border-red-200 hover:bg-red-50">
              <RefreshCw className="w-4 h-4 mr-2" />
              Iniciar novo dia
            </Button>
          </div>
          <div className="mt-5">
            <ChecklistProgress completed={completedCount} total={TOTAL_DAILY} />
          </div>
        </div>

        {/* MANHÃ */}
        <ChecklistBlock
          title="🌅 Manhã — Abertura"
          badge="~30 min · 8h–8h30"
          color="#F57C00"
          items={DAILY_ITEMS.morning}
          checkedItems={items}
          onToggle={handleToggle}
        />

        {/* MEIO-DIA */}
        <ChecklistBlock
          title="⭐ Meio-Dia — Vendas Ativas"
          badge="~45 min · 11h30–12h15"
          badgeExtra="⭐ BLOCO MAIS IMPORTANTE"
          color="#D32F2F"
          items={DAILY_ITEMS.midday}
          checkedItems={items}
          onToggle={handleToggle}
          highlight={true}
        />

        {/* TARDE */}
        <ChecklistBlock
          title="🌿 Tarde — Conversão e Entrega"
          badge="~45 min · 15h–15h45"
          color="#43A047"
          items={DAILY_ITEMS.afternoon}
          checkedItems={items}
          onToggle={handleToggle}
        />

        {/* NOITE */}
        <ChecklistBlock
          title="🌙 Noite — Fechamento"
          badge="~30 min · 20h–20h30"
          color="#7B1FA2"
          items={DAILY_ITEMS.night}
          checkedItems={items}
          onToggle={handleToggle}
        />

        {/* SEMANAL (colapsável) */}
        <ChecklistBlock
          title="📅 Ações Semanais"
          badge="1x por semana · Segunda-feira"
          color="#1565C0"
          items={WEEKLY_ITEMS}
          checkedItems={items}
          onToggle={handleToggle}
          collapsible={true}
          defaultCollapsed={true}
        />

        {/* MENSAL (colapsável) */}
        <ChecklistBlock
          title="📆 Ações Mensais"
          badge="1x por mês"
          color="#00796B"
          items={MONTHLY_ITEMS}
          checkedItems={items}
          onToggle={handleToggle}
          collapsible={true}
          defaultCollapsed={true}
        />

        {/* HISTÓRICO */}
        <ChecklistHistory history={history} />
      </div>
    </div>
  );
}