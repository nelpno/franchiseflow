// Fonte única dos links de materiais externos (Drive, Canva, vídeo de boas-vindas).
// Usada pela trilha "Primeiros passos" (journeySteps.js), pelo CatalogUpload.jsx (wizard
// "Meu Vendedor") e pelo guia de Tutoriais. Trocar um link é mudar aqui — um lugar só.
// Ver CLAUDE.md raiz do dashboard, seção "Primeiros passos (onboarding)".

// Drive reorganizado em 28/09/2026 em 6 pastas (1. Comece aqui · 2. Vender e atender ·
// 3. Estoque e fábrica · 4. Marketing e postagens · 5. Robô vendedor · 6. Marca e artes) +
// Arquivo. Mover no Drive NÃO muda o link: os ids abaixo seguem valendo; o comentário diz
// onde cada pasta mora hoje. Tudo abre para qualquer um com o link (leitura).
export const DRIVE_FRANQUEADOS = "https://drive.google.com/drive/folders/1JuqdvhWBdK7-YvLhZEMX0mh9xfrel3lh"; // raiz "Franqueados"
export const DRIVE_VIDEOS_TREINAMENTO = "https://drive.google.com/drive/folders/1DwQLHOKo2Lf8RJ83-ADAqJcIYmi5m-VH"; // 1. Comece aqui › Vídeos de configuração (WhatsApp e Meta)
export const DRIVE_ROBO = "https://drive.google.com/drive/folders/18W51ZqadWPZ5Fta6TSfIt0PWwC4y6fDV"; // 5. Robô vendedor › Vídeos do robô
export const DRIVE_SACOLA = "https://drive.google.com/drive/folders/1GrhGrvR7x1tBYSwWQQEs5gQk4YqoR2h9"; // 3. Estoque e fábrica › Sacola e embalagens
export const DRIVE_META_BUSINESS = "https://drive.google.com/drive/folders/1dHR5Erx6ShhkL4eIFFZPUm-R4q2bjbXU"; // …Vídeos de configuração › 2. Meta Business Suite
export const DRIVE_POSTAGENS = "https://drive.google.com/drive/folders/1r-0rojeukSj4Hdw98zSmPEqemwg7anWC"; // 4. Marketing e postagens › Postagens redes sociais

// Link para a franqueada COPIAR o cardápio (Nelson, 17/09/2026). É um link de edição: a
// trilha pede "Faça uma cópia do modelo" antes de trocar cidade e telefone. Se alguém
// mexer no original, o "Link de modelo" do Canva (cópia automática) resolve.
export const CANVA_CARDAPIO = "https://www.canva.com/design/DAHAY6s9N14/jD40oAe1dD47Ie-hEJ0adQ/edit?utm_content=DAHAY6s9N14&utm_campaign=designshare&utm_medium=link2&utm_source=sharebutton";

// Vídeo de boas-vindas: o Short EH-zq8NzvjQ (tour do menu) NÃO é o vídeo certo para esta
// tela (Nelson, 16/09/2026). Fica null até gravar o novo; a tela esconde o link.
// Roteiro: docs/roteiro-tutoriais.md, VIDEO 2. Formato: { url: "https://www.youtube.com/shorts/<ID>" }.
export const VIDEO_BOAS_VINDAS = null;
