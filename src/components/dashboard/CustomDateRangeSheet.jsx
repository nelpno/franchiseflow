import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { format, differenceInDays, subDays } from "date-fns";
import { parseDateOnly } from "@/lib/dateOnly";

const MAX_DAYS = 90;

// maxDays: teto do intervalo (Início antigo = 90). null = sem teto (Gestão › Resultado, 13/10/2026:
// "de tal a tal data" sem limite; a data final continua até hoje).
export default function CustomDateRangeSheet({ open, onOpenChange, currentRange, onApply, onClear, maxDays = MAX_DAYS, descricao }) {
  const [startStr, setStartStr] = useState("");
  const [endStr, setEndStr] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (currentRange?.start && currentRange?.end) {
      setStartStr(format(currentRange.start, "yyyy-MM-dd"));
      setEndStr(format(currentRange.end, "yyyy-MM-dd"));
    } else {
      const today = new Date();
      setStartStr(format(subDays(today, 30), "yyyy-MM-dd"));
      setEndStr(format(today, "yyyy-MM-dd"));
    }
  }, [open, currentRange]);

  const handleApply = () => {
    const start = parseDateOnly(startStr);
    const end = parseDateOnly(endStr);
    if (!start || !end) {
      setError("Preencha as duas datas.");
      return;
    }
    if (end < start) {
      setError("Data final deve ser maior ou igual à inicial.");
      return;
    }
    const today = parseDateOnly(format(new Date(), "yyyy-MM-dd"));
    if (end > today) {
      setError("Data final não pode ser futura.");
      return;
    }
    if (maxDays) {
      const oldestAllowed = subDays(today, maxDays - 1);
      if (start < oldestAllowed) {
        setError(`Período máximo: últimos ${maxDays} dias.`);
        return;
      }
      if (differenceInDays(end, start) + 1 > maxDays) {
        setError(`Intervalo máximo: ${maxDays} dias.`);
        return;
      }
    }
    setError(null);
    onApply({ start, end });
    onOpenChange(false);
  };

  const handleClear = () => {
    onClear();
    onOpenChange(false);
  };

  const hasRange = !!(currentRange?.start && currentRange?.end);
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const minStartStr = maxDays ? format(subDays(new Date(), maxDays - 1), "yyyy-MM-dd") : undefined;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[90dvh] overflow-y-auto overscroll-contain sm:max-w-lg sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:rounded-t-2xl sm:bottom-8 sm:rounded-2xl"
      >
        <SheetHeader className="mb-4">
          <SheetTitle className="text-lg font-semibold flex items-center gap-2">
            <MaterialIcon icon="event" className="text-brand" />
            Período personalizado
          </SheetTitle>
          <SheetDescription className="text-sm text-gray-600">
            {descricao || (maxDays ? `Escolha o intervalo (máximo ${maxDays} dias).` : "Escolha o intervalo.")}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-ink-2">Início</span>
              <input
                type="date"
                value={startStr}
                onChange={(e) => setStartStr(e.target.value)}
                min={minStartStr}
                max={todayStr}
                className="border border-ink-shadow/15 rounded-lg px-3 py-2 text-sm font-mono-numbers tabular-nums focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-ink-2">Fim</span>
              <input
                type="date"
                value={endStr}
                onChange={(e) => setEndStr(e.target.value)}
                min={startStr || minStartStr}
                max={todayStr}
                className="border border-ink-shadow/15 rounded-lg px-3 py-2 text-sm font-mono-numbers tabular-nums focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </label>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <MaterialIcon icon="error" style={{ fontSize: 18 }} />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button onClick={handleApply} className="flex-1 bg-brand hover:bg-brand text-white min-h-[44px]">
              Aplicar
            </Button>
            {hasRange && (
              <Button onClick={handleClear} variant="outline" className="min-h-[44px]">
                Limpar
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
