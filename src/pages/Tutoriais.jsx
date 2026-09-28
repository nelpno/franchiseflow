import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import PageHeader, { BuscaCabecalho } from "@/components/shared/PageHeader";
import { CARTAO, PAGINA } from "@/components/shared/adminUi";
import GuiaLista from "@/components/ajuda/GuiaLista";
import GuiaDetalhe from "@/components/ajuda/GuiaDetalhe";
import VideosAntigos from "@/components/ajuda/VideosAntigos";
import AjudaFaq from "@/components/ajuda/AjudaFaq";
import FalarComMaxiCard from "@/components/ajuda/FalarComMaxiCard";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import { FEATURE_KEYS } from "@/lib/featureFlags";
import { MENSAGEM_AJUDA, linkWhatsAppMaxi } from "@/lib/contatoMaxi";
import {
  acharGuia, buscarGuias, ehEquipe, guiasComecePorAqui, guiasParaPapel, guiasPorArea, PUBLICO,
} from "@/lib/guiasAjuda";

// Ajuda / Tutoriais (Fase 4 do redesenho, 26/09/2026): guias ESCRITOS com passos numerados,
// pensados para o franqueado. Conteúdo em src/lib/guiasAjuda.js (testado).
// O guia aberto fica na URL (`?abrir=<slug>`): é o link que vai no WhatsApp, e os links
// antigos (?abrir=primeiros-passos, ?abrir=clientes) continuam abrindo o mesmo guia.
// O menu chama esta tela de "Tutoriais" para o franqueado e de "Ajuda" para a equipe.
export default function Tutoriais() {
  const { user } = useAuth();
  const role = user?.role;
  const equipe = ehEquipe(role);
  const [searchParams, setSearchParams] = useSearchParams();
  const abrir = searchParams.get("abrir");
  const guia = acharGuia(abrir, role);
  const nomeDaTela = equipe ? "Ajuda" : "Tutoriais";
  const [busca, setBusca] = useState("");

  // Tela Ajuda v2 (S10.1, 28/09/2026): busca, "Comece por aqui", por área e perguntas
  // frequentes. Atrás de ui_v2 e só para o franqueado — com a chave desligada (e para
  // admin/manager/CS), a tela Tutoriais segue EXATAMENTE igual (ver ramos abaixo).
  const uiV2 = useFeatureFlag(FEATURE_KEYS.UI_V2);
  const ajudaV2 = uiV2 && !equipe;

  useEffect(() => {
    if (guia) window.scrollTo({ top: 0 });
  }, [guia]);

  const abrirGuia = (slug) => setSearchParams({ abrir: slug });
  const voltar = () => setSearchParams({});

  if (guia) {
    return (
      <div className={PAGINA}>
        <GuiaDetalhe guia={guia} voltarLabel={nomeDaTela} onVoltar={voltar} equipe={equipe} mostrarAjudaExtra={ajudaV2} />
      </div>
    );
  }

  if (ajudaV2) {
    const termo = busca.trim();
    const resultados = termo ? buscarGuias(role, termo) : [];
    const comecePorAqui = guiasComecePorAqui(role);
    const porArea = guiasPorArea(role);
    // Sem WHATSAPP_MAXI cadastrado, não prometer "fale com a Maxi, abaixo" (P3, 28/09/2026)
    // — o card abaixo (FalarComMaxiCard) já some sozinho nesse caso.
    const temFalarComMaxi = Boolean(linkWhatsAppMaxi(MENSAGEM_AJUDA));
    return (
      <div className={`${PAGINA} pb-24 md:pb-6`}>
        <PageHeader
          titulo="Ajuda"
          subtitulo="Busque por nome, palavra-chave ou veja por área."
          acao={
            <BuscaCabecalho
              id="busca-ajuda"
              value={busca}
              onChange={setBusca}
              placeholder="Buscar ajuda"
              rotulo="Buscar por título, palavra-chave ou área"
            />
          }
        />
        {termo ? (
          resultados.length ? (
            <GuiaLista titulo={`Resultados para "${termo}"`} guias={resultados} onAbrir={abrirGuia} />
          ) : (
            <div className={`${CARTAO} text-sm text-ink-2`}>
              Nada encontrado para "{termo}". Veja as perguntas frequentes{temFalarComMaxi ? " ou fale com a Maxi, abaixo." : "."}
            </div>
          )
        ) : (
          <>
            <GuiaLista titulo="Comece por aqui" ajuda="O essencial para a unidade abrir e vender." guias={comecePorAqui} onAbrir={abrirGuia} />
            {porArea.map(({ area, guias: guiasDaArea }) => (
              <GuiaLista key={area} titulo={area} guias={guiasDaArea} onAbrir={abrirGuia} />
            ))}
          </>
        )}
        <AjudaFaq role={role} onAbrir={abrirGuia} />
        <FalarComMaxiCard />
        <VideosAntigos />
      </div>
    );
  }

  const guias = guiasParaPapel(role);
  const daUnidade = guias.filter((g) => g.publico === PUBLICO.franqueado);
  const daEquipe = guias.filter((g) => g.publico === PUBLICO.equipe);

  return (
    <div className={`${PAGINA} pb-24 md:pb-6`}>
      <PageHeader
        titulo={nomeDaTela}
        subtitulo={
          equipe
            ? "Guias passo a passo para a equipe e para mandar às unidades pelo WhatsApp."
            : "Guias passo a passo do app. Abra o guia e siga os passos na tela."
        }
      />
      {equipe && (
        <GuiaLista
          titulo="Para a equipe Maxi"
          ajuda="Rotina do admin, gerente e CS."
          guias={daEquipe}
          onAbrir={abrirGuia}
        />
      )}
      <GuiaLista
        titulo={equipe ? "Para os franqueados" : "Guias da sua unidade"}
        ajuda={equipe ? "Cada guia tem o botão para mandar no WhatsApp." : undefined}
        guias={daUnidade}
        onAbrir={abrirGuia}
      />
      <VideosAntigos />
    </div>
  );
}
