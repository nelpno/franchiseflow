import React, { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { getCardapioPainel, FranchiseConfiguration } from "@/entities/all";
import { montarCardapio, dadosDoCardapio, escondidosDaArte } from "@/lib/cardapioArte";
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
  const [cortados, setCortados] = useState(0);
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
        if (!cardapio.principais.length && !cardapio.grupos.length) {
          dadosRef.current = null; blobRef.current = null;
          setPrevia(""); setEstado("vazio");
          return;
        }
        const { canvas, cortados: n } = await gerarCardapioCanvas(dados);
        const blob = await canvasParaJpeg(canvas);
        if (!vivo) return;
        dadosRef.current = dados;
        blobRef.current = blob;
        setCortados(n);
        setPrevia(URL.createObjectURL(blob));
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
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.${ext}`;

  const usarNoRobo = useCallback(async () => {
    if (!blobRef.current) return;
    setOcupado("robo");
    try {
      // o upload mostra o próprio erro (toast); a janela só fecha se a imagem foi mesmo trocada
      const ok = await onUsar(new File([blobRef.current], "catalogo.jpg", { type: "image/jpeg" }));
      if (ok) {
        registrarEvento("cardapio_arte_usado_robo");
        onOpenChange(false);
      }
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
  // escondido no Cardápio digital some da arte também: dizer QUAL e levar direto ao "Mostrar" (Jaraguá, 13/11/2026)
  const escondidos = base ? escondidosDaArte(base.painel.produtos, { incluirOutros }) : [];
  const avisoEscondidos = escondidos.length > 0 && (
    <div className="text-xs text-brand-gold-ink bg-brand-gold/10 rounded-lg p-2 space-y-1">
      <p>
        {escondidos.length === 1 ? "Ficou de fora porque está escondido" : `${escondidos.length} produtos ficaram de fora porque estão escondidos`} no
        Cardápio digital: {escondidos.slice(0, 5).join(", ")}{escondidos.length > 5 ? ` e mais ${escondidos.length - 5}` : ""}.
      </p>
      <Link to="/CardapioDigital?produtos=escondidos&bloco=produtos" className="inline-flex min-h-10 items-center font-semibold text-brand-dark hover:underline"
        onClick={() => registrarEvento("cardapio_arte_ver_escondidos", { detalhe: String(escondidos.length) })}>
        Mostrar no cardápio →
      </Link>
    </div>
  );

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
            {outros > 0
              ? "Nenhuma massa da Maxi com preço no seu Estoque. Marque abaixo para montar com os outros produtos que você vende."
              : "Nenhum produto com preço no seu Estoque ainda. Cadastre os preços em Estoque e gere de novo."}
          </p>
        )}
        {estado === "vazio" && avisoEscondidos}

        {(estado === "pronto" || estado === "vazio") && outros > 0 && (
          <label className="flex items-center gap-2 text-sm text-ink-2">
            <input type="checkbox" checked={incluirOutros} onChange={(e) => setIncluirOutros(e.target.checked)} />
            Incluir outros produtos que você vende ({outros})
          </label>
        )}

        {estado === "pronto" && previa && (
          <div className="space-y-3">
            <img src={previa} alt="Prévia do cardápio" className="w-full max-w-sm mx-auto rounded-lg border border-surface-line/20 shadow-sm" />
            <p className="text-xs text-ink-2 text-center">
              {total} produtos. Os que estão escondidos ou em falta há mais de 30 dias ficam de fora.
            </p>
            {avisoEscondidos}
            {cortados > 0 && (
              <p className="text-xs text-brand bg-brand/5 rounded-lg p-2">
                {cortados} {cortados === 1 ? "item não coube" : "itens não couberam"} na folha.
                {incluirOutros ? " Desmarque os outros produtos para caber tudo da Maxi." : ""}
              </p>
            )}
            {!dadosRef.current?.whatsapp && (
              <p className="text-xs text-brand-gold-ink bg-brand-gold/10 rounded-lg p-2">
                Sem número para receber pedido: conecte o robô no Meu robô para o número sair no cardápio.
              </p>
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
