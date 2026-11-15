-- Padronizar categorias dos 28 produtos padrão Maxi Massas
-- Executado em 2026-03-21

-- Todas as massas recheadas → categoria "Massas" (Canelone, Conchiglione, Nhoque, Rondelli, Sofioli)
UPDATE inventory_items SET category = 'Massas'
WHERE category IN ('Canelone', 'Conchiglione', 'Nhoque', 'Rondelli', 'Sofioli');

-- Molho já estava correto como "Molhos"

-- Resultado: 27 Massas + 1 Molhos = 28 produtos padrão
-- Categorias disponíveis no app: Massas, Molhos, Recheios, Embalagens, Insumos, Outros
-- Franqueado adiciona itens próprios com a categoria que quiser
