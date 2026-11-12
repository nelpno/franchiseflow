import React, { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { toast } from "sonner";
import { getCardapioPainel, FranchiseConfiguration } from "@/entities/all";
import { montarCardapio, dadosDoCardapio } from "@/lib/cardapioArte";
import { gerarCardapioCanvas, canvasParaJpeg, baixarCardapioPdf } from "@/lib/cardapioArteDesenho";
import { safeErrorMessage } from "@/lib/safeErrorMessage";
import { registrarEvento } from "@/lib/telemetria";

/**
 * "Gerar cardápio" (12/11/2026): monta a imagem do cardápio com os produtos e preços do Estoque da unidade
 * (cardapio_painel), o WhatsApp que recebe o pedido e o link do cardápio digital. "Usar no robô" passa a imagem ao
 * mesmo upload da Imagem do catálogo; "Baixar" dá a imagem (WhatsApp) ou o PDF A4 (gráfica).
 */
export default function GerarCardapioDialog({ open, onOpenChange, franchiseId, onUsar }) {
  const [estado, setEstado] = useState("carregando"); // carregando | pronto | erro | vazio
  const [erro, setErro] = useState("");
  const [base, setBase] = useState(null); // { painel, config }
  const [incluirOutros, setIncluirOutros] = useState(false);
  const [previa, setPrevia] = useState("");
  const [ocupado, setOcupado] = useState("");
  const dadosRef = useRef(null);
  const blobRef = useRef(null);

  useEffect(() => {
    if (!open || !franchiseId) return undefined;
    const ctrl = new AbortController();
    setEstado("carregando"); setErro(""); setPrevia(""); setBase(null);
    (async () => {
      try {
        const [painel, configs] = await Promise.all([
          getCardapioPainel(franchiseId, { signal: ctrl.signal }),
          FranchiseConfiguration.filter({ franchise_evolution_instance_id: franchiseId }, null, 1, { signal: ctrl.signal }),
        ]);
        if (ctrl.signal.aborted) return;
        setBase({ painel: painel || {}, config: configs?.[0] || {} });
      } catch (e) {
        if (ctrl.signal.aborted) return;
        setErro(safeErrorMessage(e, "Não deu para buscar seus produtos. Tente de novo."));
        setEstado("erro");
      }
    })();
    return () => ctrl.abort();
  }, [open, franchiseId]);

  useEffect(() => {
    if (!base) return undefined;
    let vivo = true;
    (async () => {
      try {
        const dados = dadosDoCardapio(base.painel, base.config, { incluirOutros });
        const { cardapio } = dados;
        if (!cardapio.principais.length && !cardapio.grupos.length) { setEstado("vazio"); return; }
        const canvas = await gerarCardapioCanvas(dados);
        const blob = await canvasParaJpeg(canvas);
        if (!vivo) return;
        dadosRef.current = dados;
        blobRef.current = blob;
        setPrevia((antiga) => { if (antiga) URL.revokeObjectURL(antiga); return URL.createObjectURL(blob); });
        setEstado("pronto");
        registrarEvento("cardapio_arte_gerado", { detalhe: `${cardapio.total} produtos${incluirOutros ? " +outros" : ""}` });
      } catch (e) {
        if (!vivo) return;
        setErro(safeErrorMessage(e, "Não deu para montar o cardápio. Tente de novo."));
        setEstado("erro");
      }
    })();
    return () => { vivo = false; };
  }, [base, incluirOutros]);

  useEffect(() => () => { if (previa) URL.revokeObjectURL(previa); }, [previa]);

  const nomeArquivo = (ext) => `cardapio-maxi-massas-${(dadosRef.current?.unidade || "unidade")
    .normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.${ext}`;

  const usarNoRobo = useCallback(async () => {
    if (!blobRef.current) return;
    setOcupado("robo");
    try {
      await onUsar(new File([blobRef.current], "catalogo.jpg", { type: "image/jpeg" }));
      registrarEvento("cardapio_arte_usado_robo");
      onOpenChange(false);
    } finally {
      setOcupado("");
    }
  }, [onUsar, onOpenChange]);

  const baixarImagem = useCallback(() => {
    if (!blobRef.current) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blobRef.current);
    a.download = nomeArquivo("jpg");
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    registrarEvento("cardapio_arte_baixado", { detalhe: "imagem" });
  }, []);

  const baixarPdf = useCallback(async () => {
    if (!dadosRef.current) return;
    setOcupado("pdf");
    try {
      await baixarCardapioPdf(dadosRef.current, nomeArquivo("pdf"));
      registrarEvento("cardapio_arte_baixado", { detalhe: "pdf" });
    } catch (e) {
      toast.error(safeErrorMessage(e, "Não deu para gerar o PDF. Tente de novo."));
    } finally {
      setOcupado("");
    }
  }, []);

  const outros = base ? montarCardapio(base.painel.produtos).outros : 0;
  const total = dadosRef.current?.cardapio?.total;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Cardápio com os seus produtos</DialogTitle>
          <DialogDescription>
            Montado com os produtos e os preços do seu Estoque. Mudou preço ou produto? Gere de novo.
          </DialogDescription>
        </DialogHeader>

        {estado === "carregando" && (
          <div className="aspect-[210/297] w-full max-w-sm mx-auto rounded-lg bg-surface animate-pulse" />
        )}

        {estado === "erro" && (
          <p className="text-sm text-brand bg-brand/5 rounded-lg p-3">{erro}</p>
        )}

        {estado === "vazio" && (
          <p className="text-sm text-ink-2 bg-surface rounded-lg p-3">
            Nenhum produto com preço no seu Estoque ainda. Cadastre os preços em Estoque e gere de novo.
          </p>
        )}

        {estado === "pronto" && previa && (
          <div className="space-y-3">
            <img src={previa} alt="Prévia do cardápio" className="w-full max-w-sm mx-auto rounded-lg border border-surface-line/20 shadow-sm" />
            <p className="text-xs text-ink-2 text-center">
              {total} produtos. Os que estão escondidos ou em falta há mais de 30 dias ficam de fora.
            </p>
            {!dadosRef.current?.whatsapp && (
              <p className="text-xs text-brand-gold-ink bg-brand-gold/10 rounded-lg p-2">
                Sem número para receber pedido: conecte o robô no Meu robô para o número sair no cardápio.
              </p>
            )}
            {outros > 0 && (
              <label className="flex items-center gap-2 text-sm text-ink-2">
                <input type="checkbox" checked={incluirOutros} onChange={(e) => setIncluirOutros(e.target.checked)} />
                Incluir outros produtos que você vende ({outros})
              </label>
            )}
            <div className="flex flex-col sm:flex-row gap-2">
              <button type="button" onClick={usarNoRobo} disabled={Boolean(ocupado)}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-brand text-white text-sm font-bold rounded-lg disabled:opacity-60">
                <MaterialIcon icon={ocupado === "robo" ? "hourglass_empty" : "smart_toy"} size={18} />
                Usar no robô
              </button>
              <button type="button" onClick={baixarImagem} disabled={Boolean(ocupado)}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-brand text-brand text-sm font-bold rounded-lg disabled:opacity-60">
                <MaterialIcon icon="download" size={18} />
                Baixar imagem
              </button>
              <button type="button" onClick={baixarPdf} disabled={Boolean(ocupado)}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-brand text-brand text-sm font-bold rounded-lg disabled:opacity-60">
                <MaterialIcon icon={ocupado === "pdf" ? "hourglass_empty" : "picture_as_pdf"} size={18} />
                PDF para imprimir
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
