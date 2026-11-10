// Bloco 1 da página "Cardápio digital": ligar/desligar e divulgar o link (ESPEC do cardápio § 4.2).
// É a única coisa que a franqueada precisa FAZER para o cardápio existir. Também o estado de primeiro uso (§ 4.8).
// 10f (rede aberta): ligar só com o checklist do banco em dia (ChecklistCard); o link nasce sozinho do nome da unidade.
import { useRef, useState } from "react";
import { toast } from "sonner";
import MaterialIcon from "@/components/ui/MaterialIcon";
import Interruptor from "./Interruptor";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ChecklistCard from "./ChecklistCard";
import { BTN_PRIMARIO, BTN_SECUNDARIO, CARTAO, H3_CARTAO, TOM_CHEGADA } from "@/components/shared/adminUi";
import { itensDoChecklist, linkSemProtocolo, linksDoCardapio, podeLigarCardapio } from "@/lib/cardapioDigital";
import { registrarEvento } from "@/lib/telemetria";

async function copiar(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    // navegador sem permissão de área de transferência (http, iframe): seleção à moda antiga
    const t = document.createElement("textarea");
    t.value = texto;
    t.setAttribute("readonly", "");
    t.style.position = "fixed";
    t.style.opacity = "0";
    document.body.appendChild(t);
    t.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { ok = false; }
    document.body.removeChild(t);
    return ok;
  }
}

// Tocou em ligar com item vermelho: não vai ao servidor; leva ao 1º item que falta e conta o motivo (telemetria na página)
function useRecusa(itens, onRecusado) {
  const refTrava = useRef(null);
  const recusar = () => {
    const travas = itens.filter((i) => i.estado === "trava");
    onRecusado?.(travas.map((i) => i.id));
    toast.error(travas.length === 1 ? `Para ligar, falta: ${travas[0].titulo}.` : `Para ligar, faltam ${travas.length} itens em vermelho.`);
    refTrava.current?.scrollIntoView?.({ behavior: "smooth", block: "center" });
    refTrava.current?.focus?.({ preventScroll: true });
  };
  return { refTrava, recusar };
}

export function PrimeiroUsoCard({ painel, ligando, onLigar, onRecusado, onUsarRobo, salvandoRobo }) {
  const itens = itensDoChecklist(painel);
  const pode = podeLigarCardapio(painel);
  const faltam = itens.filter((i) => i.estado === "trava").length;
  const link = linkSemProtocolo(painel?.url || painel?.url_sugerida);
  const { refTrava, recusar } = useRecusa(itens, onRecusado);
  return (
    <section className={`${TOM_CHEGADA} space-y-4`} aria-labelledby="cardapio-chegada">
      <h2 id="cardapio-chegada" className={H3_CARTAO}>
        {pode ? "Seu cardápio está pronto para ligar. Antes, confira:" : `Antes de ligar, falta arrumar ${faltam === 1 ? "1 item" : `${faltam} itens`}:`}
      </h2>
      <div className="rounded-xl bg-white p-3 sm:p-4">
        <ChecklistCard itens={itens} nomeUnidade={painel?.nome} refItem={refTrava} onUsarRobo={onUsarRobo} salvandoRobo={salvandoRobo} />
      </div>
      {link && (
        <p className="text-sm text-ink-2">
          {painel?.url ? "Seu link: " : "Seu link vai ser: "}
          <span className="break-all font-semibold text-ink">{link}</span>
        </p>
      )}
      <button type="button" className={`${BTN_PRIMARIO} min-h-11 w-full sm:w-auto ${pode ? "" : "opacity-50"}`}
        aria-disabled={!pode || undefined} disabled={ligando} onClick={() => (pode ? onLigar(true) : recusar())}>
        <MaterialIcon icon="storefront" size={18} aria-hidden="true" />
        {ligando ? "Ligando…" : "Ligar o cardápio"}
      </button>
      {!pode && <p className="text-sm text-ink-2">Arrume os itens em vermelho e volte aqui: a lista se atualiza sozinha.</p>}
    </section>
  );
}

export default function LinkCard({ painel, ligando, onLigar, onRecusado, onUsarRobo, salvandoRobo }) {
  const [qr, setQr] = useState(null); // dataURL do QR aberto no diálogo
  const [gerandoQr, setGerandoQr] = useState(false);
  const links = linksDoCardapio(painel?.url);
  const ativo = !!painel?.ativo;
  const nomeArquivo = `cardapio-${painel?.slug || "unidade"}-qr.png`;
  // em pausa: religar também pede o checklist em dia (o servidor recusa igual)
  const itens = itensDoChecklist(painel);
  const pode = podeLigarCardapio(painel);
  const temTrava = itens.some((i) => i.estado === "trava");
  const { refTrava, recusar } = useRecusa(itens, onRecusado);
  const mudar = (v) => (v && !ativo && !pode ? recusar() : onLigar(v));

  const copiarLink = async () => {
    if (!links) return;
    const ok = await copiar(links.divulgar);
    if (ok) {
      toast.success("Link copiado. Cole na bio do Instagram e no perfil do Google.");
      registrarEvento("cardapio_link_copiado");
    } else {
      toast.error("Não deu para copiar. Toque e segure no link para copiar.");
    }
  };

  const baixar = (dataUrl) => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = nomeArquivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const baixarQr = async () => {
    if (!links || gerandoQr) return;
    setGerandoQr(true);
    try {
      const QRCode = (await import("qrcode")).default;
      const dataUrl = await QRCode.toDataURL(links.qr, { errorCorrectionLevel: "M", width: 1024, margin: 2 });
      baixar(dataUrl);
      setQr(dataUrl);
      registrarEvento("cardapio_qr_baixado");
    } catch {
      toast.error("Não deu para gerar o QR. Tente de novo.");
    } finally {
      setGerandoQr(false);
    }
  };

  return (
    <section className={`${CARTAO} space-y-4`} aria-labelledby="cardapio-link">
      <div className="flex items-center justify-between gap-3">
        <h2 id="cardapio-link" className={H3_CARTAO}>{ativo ? "Cardápio no ar" : "Cardápio em pausa"}</h2>
        <Interruptor checked={ativo} disabled={ligando} onCheckedChange={mudar} rotulo={ativo ? "Ligado" : "Desligado"}
          ariaLabel={ativo ? "Cardápio ligado. Tocar desliga" : "Cardápio desligado. Tocar liga"} className="-my-1" />
      </div>

      {painel?.chave_ligada === false && (
        <p className="rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn-ink">
          A chave do cardápio está desligada para esta unidade: a página fica em pausa e o robô não manda o link, mesmo ligado aqui.
        </p>
      )}
      {!ativo && (
        <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm text-ink-2">
          Clientes que abrirem o link veem: “Cardápio em pausa. Chame a unidade no WhatsApp.” O robô para de mandar o link.
        </p>
      )}
      {!ativo && temTrava && (
        <div className="space-y-2 rounded-xl border border-err/30 bg-white p-3">
          <p className="text-sm font-semibold text-ink">Para ligar de novo, falta arrumar:</p>
          <ChecklistCard itens={itens.filter((i) => i.estado === "trava")} nomeUnidade={painel?.nome} refItem={refTrava}
            onUsarRobo={onUsarRobo} salvandoRobo={salvandoRobo} />
        </div>
      )}

      {links ? (
        <>
          <p className="text-sm text-ink-2">
            Seu link: <span className="select-all break-all font-semibold text-ink">{links.semProtocolo}</span>
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button type="button" className={`${BTN_PRIMARIO} min-h-11`} onClick={copiarLink}>
              <MaterialIcon icon="content_copy" size={18} aria-hidden="true" />
              Copiar link
            </button>
            <button type="button" className={`${BTN_SECUNDARIO} min-h-11`} onClick={baixarQr} disabled={gerandoQr}>
              <MaterialIcon icon="qr_code_2" size={18} aria-hidden="true" />
              {gerandoQr ? "Gerando…" : "Baixar QR"}
            </button>
            <a className={`${BTN_SECUNDARIO} min-h-11`} href={links.teste} target="_blank" rel="noopener noreferrer"
              onClick={() => registrarEvento("cardapio_ver_cliente")}>
              <MaterialIcon icon="open_in_new" size={18} aria-hidden="true" />
              Ver como o cliente vê
            </a>
          </div>
          {ativo && <p className="text-sm text-ink-3">O robô já manda este link junto com o catálogo.</p>}
        </>
      ) : (
        <p className="text-sm text-ink-2">O link aparece aqui quando você ligar o cardápio.</p>
      )}

      <Dialog open={!!qr} onOpenChange={(v) => { if (!v) setQr(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>QR do cardápio</DialogTitle>
            <DialogDescription>Baixado como {nomeArquivo}. Imprima com pelo menos 3 cm.</DialogDescription>
          </DialogHeader>
          {qr && <img src={qr} alt="QR que abre o cardápio da unidade" width={160} height={160} className="mx-auto h-40 w-40" />}
          <button type="button" className={`${BTN_SECUNDARIO} min-h-11 w-full`} onClick={() => qr && baixar(qr)}>
            <MaterialIcon icon="download" size={18} aria-hidden="true" />
            Baixar de novo
          </button>
        </DialogContent>
      </Dialog>
    </section>
  );
}
