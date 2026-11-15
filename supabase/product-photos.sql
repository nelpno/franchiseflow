-- Migration: product_photos table for WhatsApp bot product images
-- Date: 2026-04-06

-- Table: master catalog of product photos (NOT per-franchise)
CREATE TABLE IF NOT EXISTS public.product_photos (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  category TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  maps_to_products TEXT[] NOT NULL DEFAULT '{}',
  keywords TEXT[] NOT NULL DEFAULT '{}',
  photo_type TEXT NOT NULL DEFAULT 'prepared'
    CHECK (photo_type IN ('prepared', 'raw', 'institutional')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: public read, admin write
ALTER TABLE product_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "photos_select" ON product_photos
  FOR SELECT USING (true);

CREATE POLICY "photos_admin_insert" ON product_photos
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "photos_admin_update" ON product_photos
  FOR UPDATE USING (is_admin());

CREATE POLICY "photos_admin_delete" ON product_photos
  FOR DELETE USING (is_admin());

-- Index for keyword search (used by sub-workflow)
CREATE INDEX idx_product_photos_keywords ON product_photos USING GIN (keywords);
CREATE INDEX idx_product_photos_active ON product_photos (active) WHERE active = true;

-- Seed data: 11 unique photos + 1 alias (sofioli reuses massas_tabua)
INSERT INTO product_photos (id, display_name, category, storage_path, public_url, maps_to_products, keywords, photo_type, sort_order) VALUES

-- Nhoque
('nhoque_pesto', 'Nhoque ao Pesto', 'nhoque',
 'produtos/nhoque_pesto.jpg',
 'https://sulgicnqqopyhulglakd.supabase.co/storage/v1/object/public/catalog-images/produtos/nhoque_pesto.jpg',
 ARRAY['Nhoque de Batata - 500g', 'Nhoque de Batata - 1kg'],
 ARRAY['nhoque', 'gnocchi', 'pesto', 'batata', 'nhoqui'],
 'prepared', 1),

('nhoque_bolonhesa', 'Nhoque à Bolonhesa', 'nhoque',
 'produtos/nhoque_bolonhesa.jpg',
 'https://sulgicnqqopyhulglakd.supabase.co/storage/v1/object/public/catalog-images/produtos/nhoque_bolonhesa.jpg',
 ARRAY['Nhoque Recheado com 4 Queijos - 700g', 'Nhoque Recheado com Calabresa - 700g', 'Nhoque Recheado com Mussarela - 700g', 'Nhoque Recheado com Presunto e Mussarela - 700g'],
 ARRAY['nhoque', 'gnocchi', 'bolonhesa', 'recheado', 'nhoqui'],
 'prepared', 2),

-- Rondelli
('rondelli_sugo_travessa', 'Rondelli ao Sugo (travessa)', 'rondelli',
 'produtos/rondelli_sugo_travessa.jpg',
 'https://sulgicnqqopyhulglakd.supabase.co/storage/v1/object/public/catalog-images/produtos/rondelli_sugo_travessa.jpg',
 ARRAY['Rondelli 4 Queijos - 700g Rolo', 'Rondelli Brócolis e Mussarela - 700g Rolo', 'Rondelli Frango e Requeijão - 700g Rolo', 'Rondelli Presunto e Mussarela - 700g Rolo'],
 ARRAY['rondelli', 'rondeli', 'sugo', 'travessa', 'rolo'],
 'prepared', 3),

('rondelli_sugo_individual', 'Rondelli ao Sugo (porção)', 'rondelli',
 'produtos/rondelli_sugo_individual.jpg',
 'https://sulgicnqqopyhulglakd.supabase.co/storage/v1/object/public/catalog-images/produtos/rondelli_sugo_individual.jpg',
 ARRAY['Rondelli 4 Queijos - 500g Fatiado', 'Rondelli Presunto e Mussarela - 500g Fatiado'],
 ARRAY['rondelli', 'rondeli', 'sugo', 'individual', 'fatiado', 'porcao'],
 'prepared', 4),

('rondelli_closeup', 'Rondelli (close-up recheio)', 'rondelli',
 'produtos/rondelli_closeup.jpg',
 'https://sulgicnqqopyhulglakd.supabase.co/storage/v1/object/public/catalog-images/produtos/rondelli_closeup.jpg',
 ARRAY['Rondelli 4 Queijos - 700g Rolo', 'Rondelli 4 Queijos - 500g Fatiado', 'Rondelli Presunto e Mussarela - 700g Rolo', 'Rondelli Presunto e Mussarela - 500g Fatiado'],
 ARRAY['rondelli', 'rondeli', 'recheio', 'closeup', 'dentro'],
 'prepared', 5),

-- Canelone
('canelone_molho_branco', 'Canelone ao Molho Branco', 'canelone',
 'produtos/canelone_molho_branco.jpg',
 'https://sulgicnqqopyhulglakd.supabase.co/storage/v1/object/public/catalog-images/produtos/canelone_molho_branco.jpg',
 ARRAY['Canelone 4 Queijos - 700g', 'Canelone Brócolis e Mussarela - 700g', 'Canelone Frango e Requeijão - 700g', 'Canelone Presunto e Mussarela - 700g'],
 ARRAY['canelone', 'caneloni', 'molho branco', 'bechamel'],
 'prepared', 6),

-- Conchiglione
('conchiglione_sugo', 'Conchiglione ao Sugo', 'conchiglione',
 'produtos/conchiglione_sugo.jpg',
 'https://sulgicnqqopyhulglakd.supabase.co/storage/v1/object/public/catalog-images/produtos/conchiglione_sugo.jpg',
 ARRAY['Conchiglione 4 Queijos - 700g', 'Conchiglione Brócolis e Mussarela - 700g', 'Conchiglione Frango e Requeijão - 700g', 'Conchiglione Presunto e Mussarela - 700g'],
 ARRAY['conchiglione', 'concha', 'conchiglia', 'sugo'],
 'prepared', 7),

('conchiglione_cru', 'Conchiglione (formato cru)', 'conchiglione',
 'produtos/conchiglione_cru.jpg',
 'https://sulgicnqqopyhulglakd.supabase.co/storage/v1/object/public/catalog-images/produtos/conchiglione_cru.jpg',
 ARRAY['Conchiglione 4 Queijos - 700g', 'Conchiglione Brócolis e Mussarela - 700g', 'Conchiglione Frango e Requeijão - 700g', 'Conchiglione Presunto e Mussarela - 700g'],
 ARRAY['conchiglione', 'concha', 'formato', 'cru'],
 'raw', 8),

-- Lasanha
('lasanha_pesto', 'Lasanha ao Pesto', 'lasanha',
 'produtos/lasanha_pesto.jpg',
 'https://sulgicnqqopyhulglakd.supabase.co/storage/v1/object/public/catalog-images/produtos/lasanha_pesto.jpg',
 ARRAY['Massa de Lasanha - 500g', 'Lasanha de Berinjela ao Sugo 800g'],
 ARRAY['lasanha', 'lasagna', 'pesto', 'berinjela'],
 'prepared', 9),

-- Pastel
('pastel_frito', 'Pastel Frito', 'pastel',
 'produtos/pastel_frito.jpg',
 'https://sulgicnqqopyhulglakd.supabase.co/storage/v1/object/public/catalog-images/produtos/pastel_frito.jpg',
 ARRAY['Massa de Pastel - 500g', 'Massa de Pastel - 1kg'],
 ARRAY['pastel', 'massa de pastel', 'frito', 'pasteis'],
 'prepared', 10),

-- Institucional / Sofioli (shared photo)
('massas_tabua', 'Massas Artesanais Maxi Massas', 'institucional',
 'produtos/massas_tabua.jpg',
 'https://sulgicnqqopyhulglakd.supabase.co/storage/v1/object/public/catalog-images/produtos/massas_tabua.jpg',
 ARRAY['Sofioli 4 Queijos - 700g', 'Sofioli Brócolis e Mussarela - 700g', 'Sofioli Frango e Requeijão - 700g', 'Sofioli Presunto e Mussarela - 700g'],
 ARRAY['sofioli', 'sofiolli', 'massas', 'tabua', 'produtos', 'geral', 'todos', 'institucional', 'variedade'],
 'institutional', 11)

ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  category = EXCLUDED.category,
  storage_path = EXCLUDED.storage_path,
  public_url = EXCLUDED.public_url,
  maps_to_products = EXCLUDED.maps_to_products,
  keywords = EXCLUDED.keywords,
  photo_type = EXCLUDED.photo_type,
  sort_order = EXCLUDED.sort_order;
