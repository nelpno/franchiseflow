// Fonte única dos links de materiais externos (Drive, Canva, vídeo de boas-vindas).
// Usada pela trilha "Primeiros passos" (journeySteps.js), pelo CatalogUpload.jsx (wizard
// "Meu Vendedor") e pelo guia de Tutoriais. Trocar um link é mudar aqui — um lugar só.
// Ver CLAUDE.md raiz do dashboard, seção "Primeiros passos (onboarding)".

export const DRIVE_FRANQUEADOS = "https://drive.google.com/drive/folders/1JuqdvhWBdK7-YvLhZEMX0mh9xfrel3lh";
export const DRIVE_VIDEOS_TREINAMENTO = "https://drive.google.com/drive/folders/1DwQLHOKo2Lf8RJ83-ADAqJcIYmi5m-VH";
export const DRIVE_SACOLA = "https://drive.google.com/drive/folders/1GrhGrvR7x1tBYSwWQQEs5gQk4YqoR2h9";
export const DRIVE_META_BUSINESS = "https://drive.google.com/drive/folders/1dHR5Erx6ShhkL4eIFFZPUm-R4q2bjbXU";
export const DRIVE_POSTAGENS = "https://drive.google.com/drive/folders/1r-0rojeukSj4Hdw98zSmPEqemwg7anWC";

// Link para a franqueada COPIAR o cardápio (Nelson, 17/09/2026). É um link de edição: a
// trilha pede "Faça uma cópia do modelo" antes de trocar cidade e telefone. Se alguém
// mexer no original, o "Link de modelo" do Canva (cópia automática) resolve.
export const CANVA_CARDAPIO = "https://www.canva.com/design/DAHAY6s9N14/jD40oAe1dD47Ie-hEJ0adQ/edit?utm_content=DAHAY6s9N14&utm_campaign=designshare&utm_medium=link2&utm_source=sharebutton";

// Vídeo de boas-vindas: o Short EH-zq8NzvjQ (tour do menu) NÃO é o vídeo certo para esta
// tela (Nelson, 16/09/2026). Fica null até gravar o novo; a tela esconde o link.
// Roteiro: docs/roteiro-tutoriais.md, VIDEO 2. Formato: { url: "https://www.youtube.com/shorts/<ID>" }.
export const VIDEO_BOAS_VINDAS = null;
