import React, { useState, useEffect, useCallback, useRef } from "react";
import { Franchise, User, DailyChecklist } from "@/entities/all";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MaterialIcon from "@/components/ui/MaterialIcon";
import ChecklistBlock from "../components/checklist/ChecklistBlock";
import ChecklistProgress from "../components/checklist/ChecklistProgress";
import ChecklistHistory from "../components/checklist/ChecklistHistory";

const DAILY_ITEMS = {
  morning: [
    { key: "m1", label: "Verificar todas as mensagens que chegaram durante a noite" },
    { key: "m2", label: "Responder TODOS os contatos novos (prioridade máxima!)" },
    { key: "m3", label: "Conferir se o robô respondeu corretamente durante a noite" },
    { key: "m4", label: "Verificar estoque no freezer — anotar produtos com pouca quantidade" },
    { key: "m5", label: "Conferir pedidos confirmados para entrega/retirada do dia" },
    { key: "m6", label: "Postar 1 story no Instagram (freezer, produto do dia, bastidores, depoimento)" },
    { key: "m7", label: "Verificar temperatura do freezer e anotar" },
  ],
  midday: [
    { key: "md1", label: "Responder clientes que estão interessados mas ainda não compraram" },
    { key: "md2", label: "Enviar mensagens para clientes antigos (5-10 contatos)" },
    { key: "md3", label: "Tentar contato com clientes que não compraram (3-5 contatos, 30+ dias)" },
    { key: "md4", label: "Responder TODOS os comentários e DMs no Instagram" },
    { key: "md5", label: "Conferir posts agendados do dia (Instagram e WhatsApp)" },
    { key: "md6", label: "Organizar conversas do WhatsApp (mover etiquetas)" },
    { key: "md7", label: "Enviar mensagem carinhosa para 2-3 clientes fiéis" },
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
    { key: "n3", label: "Organizar contatos do WhatsApp nas etiquetas certas" },
    { key: "n4", label: "Responder últimas mensagens pendentes" },
    { key: "n5", label: "Verificar se precisa fazer pedido de reposição" },
    { key: "n6", label: "Planejar ações específicas para amanhã" },
  ],
};

const WEEKLY_ITEMS = [
  { key: "s1", label: "Analisar quais produtos mais venderam na semana" },
  { key: "s2", label: "Tentar vender novamente para quem não comprou" },
  { key: "s3", label: "Montar grupo de clientes para enviar promoção da semana" },
  { key: "s4", label: "Revisar catálogo do WhatsApp (fotos, preços, disponibilidade)" },
  { key: "s5", label: "Pedir feedback a 3 clientes fiéis" },
  { key: "s6", label: "Fazer pedido de reposição à fábrica se necessário" },
  { key: "s7", label: "Ver como estão indo as redes sociais (curtidas, seguidores, alcance)" },
  { key: "s8", label: "Verificar resultado dos anúncios pagos" },
];

const MONTHLY_ITEMS = [
  { key: "me1", label: "Reunião de acompanhamento com Celso (CS)" },
  { key: "me2", label: "Analisar relatório mensal de vendas" },
  { key: "me3", label: "Ver quanto está lucrando em cada produto" },
  { key: "me4", label: "Apagar contatos que não respondem há mais de 60 dias" },
  { key: "me5", label: "Definir meta de vendas do próximo mês" },
  { key: "me6", label: "Pensar em parcerias com comércios e eventos da região" },
  { key: "me7", label: "Solicitar novos conteúdos ao franqueador" },
  { key: "me8", label: "Auto-avaliação: estou seguindo o checklist? O que melhorar?" },
];

const TOTAL_DAILY = DAILY_ITEMS.morning.length + DAILY_ITEMS.midday.length + DAILY_ITEMS.afternoon.length + DAILY_ITEMS.night.length;

const todayStr = () => format(new Date(), "yyyy-MM-dd");

export default function MyChecklist() {
  const [franchise, setFranchise] = useState(null);
  const [availableFranchises, setAvailableFranchises] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [checklist, setChecklist] = useState(null); // entity record
  const [items, setItems] = useState({});
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const saveTimerRef = useRef(null);
  const mountedRef = useRef(true);

  const loadData = useCallback(async (selectedFranchise = null) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const user = await User.me();
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

      const today = new Date();
      const sevenDaysAgo = format(subDays(today, 6), "yyyy-MM-dd");
      const allChecklists = await DailyChecklist.filter({
        franchise_id: myFranchise.evolution_instance_id,
      });

      const recentHistory = allChecklists.filter((c) => c.date >= sevenDaysAgo);
      setHistory(recentHistory);

      const todayChecklist = allChecklists.find((c) => c.date === todayStr());

      if (todayChecklist) {
        setChecklist(todayChecklist);
        setItems(todayChecklist.items || {});
      } else {
        const newChecklist = await DailyChecklist.create({
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
    } catch (error) {
      if (!mountedRef.current) return;
      console.error("Erro ao carregar checklist:", error);
      setLoadError("Erro ao carregar checklist. Tente novamente.");
    }
    if (mountedRef.current) setIsLoading(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    loadData();
    return () => { mountedRef.current = false; };
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

      await DailyChecklist.update(checklist.id, {
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

  const [confirmingReset, setConfirmingReset] = useState(false);

  const handleResetDay = async () => {
    if (!confirmingReset) {
      setConfirmingReset(true);
      setTimeout(() => setConfirmingReset(false), 3000);
      return;
    }
    setConfirmingReset(false);
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
      <div className="min-h-screen bg-[#fbf9fa] flex items-center justify-center">
        <div className="text-center">
          <MaterialIcon icon="checklist" size={48} className="text-red-500 mx-auto mb-3 animate-pulse" />
          <p className="text-slate-600 font-medium">Carregando checklist...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-[#fbf9fa] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <MaterialIcon icon="cloud_off" className="text-5xl text-[#7a6d6d]" />
          <p className="text-[#4a3d3d] text-center">{loadError}</p>
          <Button variant="outline" onClick={() => loadData()} className="mt-2">
            <MaterialIcon icon="refresh" className="mr-2 text-lg" />
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  if (!franchise) {
    return (
      <div className="min-h-screen bg-[#fbf9fa] flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <MaterialIcon icon="checklist" size={64} className="text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-700 mb-2">Nenhuma franquia vinculada</h2>
          <p className="text-slate-500">Fale com o administrador para vincular uma franquia à sua conta.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fbf9fa]">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">

        {/* HEADER */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#291715]/5 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <MaterialIcon icon="checklist" size={24} className="text-[#b91c1c] shrink-0" />
                <h1 className="text-xl sm:text-2xl font-bold text-[#1b1c1d] font-plus-jakarta">Checklist Diário</h1>
              </div>
              {availableFranchises.length > 1 ? (
                <Select value={franchise.evolution_instance_id} onValueChange={handleFranchiseChange}>
                  <SelectTrigger className="w-full sm:w-64 mt-1 border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableFranchises.map((f) => (
                      <SelectItem key={f.evolution_instance_id} value={f.evolution_instance_id}>
                        {f.owner_name} · {f.city}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-slate-600 font-medium">{franchise.owner_name} · {franchise.city}</p>
              )}
              <p className="text-slate-400 text-sm mt-0.5">{todayFormattedCapitalized}</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleResetDay} className={`border-red-200 hover:bg-red-50 shrink-0 self-start ${confirmingReset ? "text-white bg-red-600 hover:bg-red-700" : "text-red-600"}`}>
              <MaterialIcon icon="refresh" size={16} className="mr-2" />
              {confirmingReset ? "Confirmar?" : "Limpar hoje"}
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