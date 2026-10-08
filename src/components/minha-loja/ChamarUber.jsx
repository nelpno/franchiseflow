import { useQuery } from "@tanstack/react-query";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { supabase } from "@/api/supabaseClient";

// "Chamar Uber" na venda com entrega (chave chamar_uber, piloto São Miguel 08/10/2026).
// Abre o app da Uber da franqueada com retirada na unidade e entrega no cliente já
// preenchidas: conta e preço dela, ela só confirma. O link vem da Edge Function uber-link
// (o endereço do cliente precisa virar lat/lng, e a chave do Google fica no servidor).
// Só busca quando a venda está aberta; erro = botão some (a franqueada chama como sempre).
export default function ChamarUber({ saleId }) {
  const { data, isLoading } = useQuery({
    queryKey: ["uber-link", saleId],
    queryFn: async () => {
      const { data: resp, error } = await supabase.functions.invoke("uber-link", { body: { sale_id: saleId } });
      if (error || !resp?.url) throw new Error("sem link");
      return resp;
    },
    staleTime: 30 * 60 * 1000,
    retry: false,
  });

  if (isLoading) {
    return (
      <span className="inline-flex items-center gap-1.5 h-10 px-3 text-sm text-ink-2">
        <MaterialIcon icon="progress_activity" size={16} className="animate-spin" />
        Uber...
      </span>
    );
  }
  if (!data?.url) return null;

  return (
    <div className="flex flex-col gap-1">
      <a
        href={data.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-1.5 h-10 px-3 rounded-md bg-black text-white text-sm font-medium hover:bg-black/85 w-fit"
      >
        <MaterialIcon icon="delivery_dining" size={16} />
        Chamar Uber
      </a>
      {data.precisao === "aproximado" && (
        <span className="text-xs text-[#b45309]">Endereço aproximado: confira o pino no mapa do Uber.</span>
      )}
    </div>
  );
}
