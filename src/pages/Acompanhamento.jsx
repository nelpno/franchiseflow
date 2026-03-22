import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Franchise, User, DailyChecklist } from "@/entities/all";
import { format, subDays, parseISO, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createPageUrl } from "@/utils";
import MaterialIcon from "@/components/ui/MaterialIcon";
import FranchiseeDetailModal from "@/components/acompanhamento/FranchiseeDetailModal";

const today = () => format(new Date(), "yyyy-MM-dd");
const daysAgo = (n) => format(subDays(new Date(), n), "yyyy-MM-dd");

function getSemaforo(checklists7days) {
  if (!checklists7days || checklists7days.length === 0) return "red";
  const completeDays = checklists7days.filter(c => c.completion_percentage >= 100).length;
  if (completeDays >= 5) return "green";
  if (completeDays >= 3) return "yellow";
  return "red";
}

function getAdherencia7days(checklists7days) {
  if (!checklists7days || checklists7days.length === 0) return 0;
  const completeDays = checklists7days.filter(c => c.completion_percentage >= 100).length;
  return Math.round((completeDays / 7) * 100);
}

function getStreak(allChecklists) {
  let streak = 0;
  let d = new Date();
  // if today not complete, start from yesterday
  const todayStr = format(d, "yyyy-MM-dd");
  const todayRecord = allChecklists.find(c => c.date === todayStr);
  if (!todayRecord || todayRecord.completion_percentage < 100) {
    d = subDays(d, 1);
  }
  for (let i = 0; i < 60; i++) {
    const dateStr = format(d, "yyyy-MM-dd");
    const record = allChecklists.find(c => c.date === dateStr);
    if (record && record.completion_percentage >= 100) {
      streak++;
      d = subDays(d, 1);
    } else {
      break;
    }
  }
  return streak;
}

function getLastActivity(allChecklists) {
  const withActivity = allChecklists.filter(c => c.completed_count > 0);
  if (withActivity.length === 0) return null;
  const sorted = [...withActivity].sort((a, b) => b.date.localeCompare(a.date));
  return sorted[0].date;
}

function getDaysSinceActivity(lastActivityDate) {
  if (!lastActivityDate) return null;
  return differenceInDays(new Date(), parseISO(lastActivityDate));
}

const SEMAFORO_ORDER = { red: 0, yellow: 1, green: 2 };

const SemaforoCircle = ({ color }) => {
  const styles = {
    green: "bg-[#16a34a] shadow-[0_0_8px_2px_rgba(22,163,74,0.5)]",
    yellow: "bg-[#d4af37] shadow-[0_0_8px_2px_rgba(212,175,55,0.5)]",
    red: "bg-[#b91c1c] shadow-[0_0_8px_2px_rgba(185,28,28,0.5)]",
  };
  return <div className={`w-4 h-4 rounded-full ${styles[color]}`} />;
};

const TodayStatus = ({ checklists }) => {
  const todayRecord = checklists.find(c => c.date === today());
  if (!todayRecord || todayRecord.completed_count === 0) return <span className="text-xl">❌</span>;
  if (todayRecord.completion_percentage >= 100) return <span className="text-xl">✅</span>;
  return <span className="text-xl">🟡</span>;
};

export default function Acompanhamento() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [franchises, setFranchises] = useState([]);
  const [franchiseData, setFranchiseData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterSemaforo, setFilterSemaforo] = useState("all");
  const [filterCidade, setFilterCidade] = useState("all");
  const [searchName, setSearchName] = useState("");
  const [dismissedAlerts, setDismissedAlerts] = useState([]);
  const [selectedFranchise, setSelectedFranchise] = useState(null);
  const [rankingCopied, setRankingCopied] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const user = await User.me();
      setCurrentUser(user);

      if (user.role !== "admin") {
        setIsLoading(false);
        return;
      }

      const allFranchises = await Franchise.filter({ status: "active" });
      setFranchises(allFranchises);

      const sevenDaysAgoStr = daysAgo(6);
      const thirtyDaysAgoStr = daysAgo(29);

      const allChecklistsRaw = await DailyChecklist.list("-date", 500);

      const enriched = allFranchises.map(franchise => {
        const fid = franchise.evolution_instance_id;
        const franchiseChecklists = allChecklistsRaw.filter(c => c.franchise_id === fid);
        const checklists7days = franchiseChecklists.filter(c => c.date >= sevenDaysAgoStr);
        const checklists30days = franchiseChecklists.filter(c => c.date >= thirtyDaysAgoStr);
        const semaforo = getSemaforo(checklists7days);
        const adherencia = getAdherencia7days(checklists7days);
        const streak = getStreak(franchiseChecklists);
        const lastActivity = getLastActivity(franchiseChecklists);
        const daysSince = getDaysSinceActivity(lastActivity);

        return {
          franchise,
          semaforo,
          adherencia,
          streak,
          lastActivity,
          daysSince,
          checklists7days,
          checklists30days,
          allChecklists: franchiseChecklists,
        };
      });

      enriched.sort((a, b) => {
        const colorDiff = SEMAFORO_ORDER[a.semaforo] - SEMAFORO_ORDER[b.semaforo];
        if (colorDiff !== 0) return colorDiff;
        return a.adherencia - b.adherencia;
      });

      setFranchiseData(enriched);
      setLastRefresh(new Date());
    } catch (error) {
      console.error("Erro ao carregar dados de acompanhamento:", error);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Metrics
  const avgAdherencia = franchiseData.length
    ? Math.round(franchiseData.reduce((sum, f) => sum + f.adherencia, 0) / franchiseData.length)
    : 0;
  const greenCount = franchiseData.filter(f => f.semaforo === "green").length;
  const alertCount = franchiseData.filter(f => f.semaforo !== "green").length;
  const totalActive = franchises.length;

  // Alerts: franchises with 3+ days without activity
  const alerts = franchiseData.filter(f => {
    const noActivity = f.daysSince === null || f.daysSince >= 3;
    return noActivity && !dismissedAlerts.includes(f.franchise.id);
  });

  // Filtered table
  const filtered = franchiseData.filter(f => {
    if (filterSemaforo !== "all" && f.semaforo !== filterSemaforo) return false;
    if (filterCidade !== "all" && f.franchise.city !== filterCidade) return false;
    if (searchName && !f.franchise.owner_name?.toLowerCase().includes(searchName.toLowerCase())) return false;
    return true;
  });

  // Ranking top 5
  const ranking = [...franchiseData]
    .sort((a, b) => b.adherencia - a.adherencia || b.streak - a.streak)
    .slice(0, 5);

  const medals = ["🥇", "🥈", "🥉", "4º", "5º"];

  const copyRanking = () => {
    const lines = ranking.map((f, i) => {
      const medal = medals[i];
      return `${medal} ${i + 1}º ${f.franchise.owner_name} — ${f.franchise.city} — ${f.streak} dias seguidos!`;
    }).join("\n");
    const text = `🏆 RANKING DA SEMANA — Maxi Massas\n\n${lines}\n\nParabéns aos TOP 5! Consistência gera resultado! 💪\n#MaxiMassas #FranqueadoDeExcelência`;
    navigator.clipboard.writeText(text);
    setRankingCopied(true);
    setTimeout(() => setRankingCopied(false), 2000);
  };

  const cities = [...new Set(franchises.map(f => f.city).filter(Boolean))];

  const adherenciaCardBg = avgAdherencia >= 70
    ? "bg-[#16a34a]/5 border-[#16a34a]/20"
    : avgAdherencia >= 40
      ? "bg-[#d4af37]/5 border-[#d4af37]/20"
      : "bg-red-50 border-red-200";

  const adherenciaTextColor = avgAdherencia >= 70
    ? "text-[#15803d]"
    : avgAdherencia >= 40
      ? "text-[#775a19]"
      : "text-red-700";

  if (currentUser && currentUser.role !== "admin") {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-red-600">Acesso Negado</h1>
        <p className="text-[#534343] mt-2">Apenas administradores podem acessar esta página.</p>
        <Button className="mt-4" onClick={() => navigate(createPageUrl("Dashboard"))}>
          Ir para o Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 bg-[#fbf9fa] min-h-screen">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold font-plus-jakarta text-[#1b1c1d] flex items-center gap-3">
              <MaterialIcon icon="trending_up" size={32} className="text-[#b91c1c]" />
              Acompanhamento
            </h1>
            <p className="text-[#534343] text-sm mt-1">
              Monitoramento de checklists dos franqueados · Atualizado às {format(lastRefresh, "HH:mm")}
            </p>
          </div>
          <Button variant="outline" onClick={loadData} disabled={isLoading} className="gap-2">
            <MaterialIcon icon="refresh" size={16} className={isLoading ? "animate-spin" : ""} />
            Atualizar
          </Button>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className={`border ${adherenciaCardBg}`}>
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-1">
                <MaterialIcon icon="trending_up" size={20} className={adherenciaTextColor} />
                <span className="text-sm font-medium text-[#534343]">Aderência Geral</span>
              </div>
              <div className={`text-4xl font-bold ${adherenciaTextColor}`}>{avgAdherencia}%</div>
              <div className="text-xs text-[#534343] mt-1">Média últimos 7 dias</div>
            </CardContent>
          </Card>

          <Card className="bg-[#16a34a]/5 border-[#16a34a]/20 border">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-1">
                <MaterialIcon icon="check_circle" size={20} className="text-[#16a34a]" />
                <span className="text-sm font-medium text-[#534343]">Franqueados Verdes</span>
              </div>
              <div className="text-4xl font-bold text-[#15803d]">{greenCount}</div>
              <div className="text-xs text-[#534343] mt-1">5+ dias completos/semana</div>
            </CardContent>
          </Card>

          <Card className="bg-red-50 border-red-200 border">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-1">
                <MaterialIcon icon="warning" size={20} className="text-red-600" />
                <span className="text-sm font-medium text-[#534343]">Em Alerta</span>
              </div>
              <div className="text-4xl font-bold text-red-700">{alertCount}</div>
              <div className="text-xs text-[#534343] mt-1">Amarelos + Vermelhos</div>
            </CardContent>
          </Card>

          <Card className="bg-[#f5f3f4] border-[#291715]/5 border">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-1">
                <MaterialIcon icon="group" size={20} className="text-[#b91c1c]" />
                <span className="text-sm font-medium text-[#534343]">Total Ativos</span>
              </div>
              <div className="text-4xl font-bold text-[#b91c1c]">{totalActive}</div>
              <div className="text-xs text-[#534343] mt-1">Franquias ativas</div>
            </CardContent>
          </Card>
        </div>

        {/* Alerts */}
        {alerts.length > 0 && (
          <Card className="mb-6 border-red-300 bg-red-50/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-red-700 flex items-center gap-2">
                <MaterialIcon icon="warning" size={20} /> Franqueados sem atividade recente
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {alerts.map(({ franchise, daysSince }) => (
                <div key={franchise.id} className="flex items-center justify-between bg-white rounded-lg p-3 border border-red-200">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-[#b91c1c] animate-pulse" />
                    <div>
                      <span className="font-semibold text-[#1b1c1d]">{franchise.owner_name}</span>
                      <span className="text-[#534343] text-sm ml-2">· {franchise.city}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-red-600 text-sm font-medium">
                      {daysSince === null ? "Nunca completou" : `Último checklist há ${daysSince} dia${daysSince !== 1 ? "s" : ""}`}
                    </span>
                    <Button size="sm" variant="outline" className="text-xs h-7"
                      onClick={() => setDismissedAlerts(prev => [...prev, franchise.id])}>
                      <MaterialIcon icon="close" size={12} className="mr-1" /> Contactado
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card className="mb-4 bg-white rounded-2xl shadow-sm border border-[#291715]/5">
          <CardContent className="p-4 flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[180px]">
              <MaterialIcon icon="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#857372]" />
              <Input
                placeholder="Buscar por nome..."
                value={searchName}
                onChange={e => setSearchName(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterSemaforo} onValueChange={setFilterSemaforo}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Semáforo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="green">🟢 Verde</SelectItem>
                <SelectItem value="yellow">🟡 Amarelo</SelectItem>
                <SelectItem value="red">🔴 Vermelho</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterCidade} onValueChange={setFilterCidade}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Cidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as cidades</SelectItem>
                {cities.map(city => (
                  <SelectItem key={city} value={city}>{city}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Main Table */}
        <Card className="mb-6 bg-white rounded-2xl shadow-sm border border-[#291715]/5 overflow-hidden">
          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="p-12 text-center text-[#534343]">
                <MaterialIcon icon="refresh" size={32} className="animate-spin mx-auto mb-3 text-[#b91c1c]" />
                Carregando dados...
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-[#f5f3f4] text-left text-xs font-semibold text-[#534343] uppercase tracking-wider">
                    <th className="px-4 py-3 w-10">Status</th>
                    <th className="px-4 py-3">Franqueado</th>
                    <th className="px-4 py-3">Cidade</th>
                    <th className="px-4 py-3 text-center">Hoje</th>
                    <th className="px-4 py-3">Aderência 7d</th>
                    <th className="px-4 py-3 text-center">Streak</th>
                    <th className="px-4 py-3">Última Atividade</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item, idx) => (
                    <tr
                      key={item.franchise.id}
                      className={`border-t border-[#f5f3f4] cursor-pointer hover:bg-[#f5f3f4] transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-[#fbf9fa]/50"}`}
                      onClick={() => setSelectedFranchise(item)}
                    >
                      <td className="px-4 py-3">
                        <SemaforoCircle color={item.semaforo} />
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#1b1c1d]">{item.franchise.owner_name}</td>
                      <td className="px-4 py-3 text-[#534343]">{item.franchise.city}</td>
                      <td className="px-4 py-3 text-center">
                        <TodayStatus checklists={item.checklists7days} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-[#e9e8e9] rounded-full h-2 min-w-[60px]">
                            <div
                              className={`h-2 rounded-full ${item.adherencia >= 70 ? "bg-[#16a34a]" : item.adherencia >= 40 ? "bg-[#d4af37]" : "bg-[#b91c1c]"}`}
                              style={{ width: `${item.adherencia}%` }}
                            />
                          </div>
                          <span className="text-sm font-semibold text-[#291715] w-10 text-right">{item.adherencia}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-bold ${item.streak >= 7 ? "text-[#16a34a]" : item.streak >= 3 ? "text-[#d4af37]" : "text-[#534343]"}`}>
                          {item.streak > 0 ? `${item.streak}d` : "-"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#534343] text-sm">
                        {item.lastActivity
                          ? format(parseISO(item.lastActivity), "dd/MM/yyyy", { locale: ptBR })
                          : <span className="text-red-400">Sem registro</span>}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-[#857372]">
                        Nenhum franqueado encontrado com os filtros selecionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        {/* Ranking */}
        {ranking.length > 0 && (
          <Card className="bg-white rounded-2xl shadow-sm border border-[#291715]/5">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <MaterialIcon icon="emoji_events" size={20} className="text-[#d4af37]" />
                Ranking da Semana
              </CardTitle>
              <Button variant="outline" size="sm" onClick={copyRanking} className="gap-2">
                <MaterialIcon icon="content_copy" size={16} />
                {rankingCopied ? "Copiado! ✓" : "Copiar para WhatsApp"}
              </Button>
            </CardHeader>
            <CardContent className="grid gap-3">
              {ranking.map((item, idx) => (
                <div
                  key={item.franchise.id}
                  className={`flex items-center gap-4 rounded-xl p-4 ${idx < 3 ? "bg-[#d4af37]/5 border border-[#d4af37]/20" : "bg-[#fbf9fa] border border-[#e9e8e9]"}`}
                >
                  <span className="text-2xl w-8 text-center">{medals[idx]}</span>
                  <div className="flex-1">
                    <div className="font-semibold text-[#1b1c1d]">{item.franchise.owner_name}</div>
                    <div className="text-sm text-[#534343]">{item.franchise.city}</div>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold text-lg ${item.adherencia >= 70 ? "text-[#16a34a]" : "text-[#d4af37]"}`}>{item.adherencia}%</div>
                    <div className="text-xs text-[#534343]">{item.streak} dias seguidos</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Detail Modal */}
      {selectedFranchise && (
        <FranchiseeDetailModal
          data={selectedFranchise}
          onClose={() => setSelectedFranchise(null)}
        />
      )}
    </div>
  );
}