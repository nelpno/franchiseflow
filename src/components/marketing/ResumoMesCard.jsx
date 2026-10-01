import React, { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { useAuth } from "@/lib/AuthContext";
import { getMarketingAttribution, getFranchiseFunnelStats } from "@/entities/all";
import { resumoEquipeDigital, mesBRT } from "@/lib/pagamentos";
import { safeErrorMessage } from "@/lib/safeErrorMessage";

// Setas: até 12 meses para trás.
const MESES_ATRAS = 11;

// "Resumo do mês" em Marketing (01/10/2026). Morava em Mais › Pagamentos ("O que sua Equipe
// Digital fez"), mas Suzano e Itápolis procuraram em Marketing, ao lado da verba — veio para cá
// e saiu de lá. Abre no mês que já fechou (a pergunta é sempre "como foi o mês passado?").
// Sem recomendação de subir/manter verba: a régua do relatório mensal usa custo da conversa no
// Meta e a mediana da rede, que o app não tem (decisão do Nelson, 01/10/2026).
export default function ResumoMesCard() {
  const { selectedFranchise } = useAuth();
  const evoId = selectedFranchise?.evolution_instance_id;
  const [deslocamento, setDeslocamento] = useState(-1); // 0 = mês atual, -1 = anterior...
  const [resumo, setResumo] = useState(null); // null = carregando; [] = sem números
  const [gerando, setGerando] = useState(false);
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const mes = mesBRT({ deslocamento });
  const outroAno = mes.chave.slice(0, 4) !== mesBRT().chave.slice(0, 4);
  const mesNome = format(new Date(`${mes.inicio}T12:00:00`), outroAno ? "MMMM 'de' yyyy" : "MMMM", { locale: ptBR });

  useEffect(() => {
    if (!evoId) return undefined;
    const controller = new AbortController();
    setResumo(null);
    Promise.allSettled([
      getMarketingAttribution(mes.chave, evoId, { signal: controller.signal }),
      getFranchiseFunnelStats(evoId, mes.inicio, mes.ate, { signal: controller.signal }),
    ]).then(([attr, funil]) => {
      if (!mountedRef.current || controller.signal.aborted) return;
      setResumo(resumoEquipeDigital({
        atribuicao: attr.status === "fulfilled" ? attr.value?.[0] || null : null,
        funil: funil.status === "fulfilled" ? funil.value : null,
      }));
    });
    return () => controller.abort();
  }, [evoId, mes.chave, mes.inicio, mes.ate]);

  if (!evoId) return null;

  const baixarPdf = async () => {
    if (!resumo?.length || gerando) return;
    setGerando(true);
    try {
      const { gerarResumoMesPdf } = await import("@/lib/resumoMesPdf");
      await gerarResumoMesPdf({
        linhas: resumo,
        nomeUnidade: selectedFranchise?.name || "Maxi Massas",
        mesNome: outroAno ? mesNome : `${mesNome} de ${mes.chave.slice(0, 4)}`,
        chave: mes.chave,
        emAndamento: deslocamento === 0,
      });
      toast.success("Resumo baixado!");
    } catch (err) {
      toast.error(safeErrorMessage(err, "Não foi possível gerar o PDF. Tente de novo."));
    } finally {
      if (mountedRef.current) setGerando(false);
    }
  };

  return (
    <Card className="bg-white rounded-2xl shadow-sm border border-ink-shadow/5">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="p-1.5 bg-brand/10 rounded-lg shrink-0">
              <MaterialIcon icon="trending_up" className="text-brand" size={20} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h3 className="font-plus-jakarta font-bold text-sm text-ink first-letter:uppercase">
                Resumo de {mesNome}
              </h3>
              <p className="text-xs text-ink-3">O que o anúncio e o robô trouxeram</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setDeslocamento((d) => Math.max(-MESES_ATRAS, d - 1))}
              disabled={deslocamento <= -MESES_ATRAS}
              aria-label="Mês anterior"
              className="flex h-11 w-11 items-center justify-center rounded-xl text-ink-2 hover:bg-surface disabled:opacity-30"
            >
              <MaterialIcon icon="chevron_left" size={22} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setDeslocamento((d) => Math.min(0, d + 1))}
              disabled={deslocamento >= 0}
              aria-label="Próximo mês"
              className="flex h-11 w-11 items-center justify-center rounded-xl text-ink-2 hover:bg-surface disabled:opacity-30"
            >
              <MaterialIcon icon="chevron_right" size={22} aria-hidden="true" />
            </button>
          </div>
        </div>

        {resumo === null ? (
          <div className="space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-5 w-1/2" />
          </div>
        ) : resumo.length === 0 ? (
          <p className="text-sm text-ink-2">
            {deslocamento < 0
              ? `Sem números do anúncio e do robô em ${mesNome}.`
              : "Os números do mês aparecem aqui assim que o anúncio e o robô começarem a trabalhar."}
          </p>
        ) : (
          <>
            {deslocamento === 0 && <p className="text-xs text-ink-3">Mês em andamento: números até hoje.</p>}
            <ul className="space-y-2">
              {resumo.map((l) => (
                <li key={l.chave} className="flex items-start gap-2 text-sm text-ink">
                  <MaterialIcon icon={l.icone} size={20} className="text-brand shrink-0" aria-hidden="true" />
                  <span>{l.texto}</span>
                </li>
              ))}
            </ul>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={baixarPdf}
              disabled={gerando}
              className="w-full sm:w-auto border-brand text-brand hover:bg-brand/5"
            >
              <MaterialIcon icon="picture_as_pdf" size={18} className="mr-1.5" aria-hidden="true" />
              {gerando ? "Gerando PDF..." : "Baixar em PDF"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
