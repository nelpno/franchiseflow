-- Auto-gerar evolution_instance_id quando não fornecido
CREATE OR REPLACE FUNCTION public.auto_generate_instance_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.evolution_instance_id IS NULL OR NEW.evolution_instance_id = '' THEN
    NEW.evolution_instance_id = 'maxi_' || replace(lower(NEW.city), ' ', '_') || '_' || substr(gen_random_uuid()::text, 1, 8);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_instance_id ON franchises;
CREATE TRIGGER auto_instance_id
  BEFORE INSERT ON franchises
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_instance_id();

-- Trigger: ao criar franquia, auto-criar config + popular estoque
CREATE OR REPLACE FUNCTION public.on_franchise_created()
RETURNS TRIGGER AS $$
BEGIN
  -- Criar franchise_configuration vazia
  INSERT INTO franchise_configurations (franchise_evolution_instance_id, franchise_name)
  VALUES (NEW.evolution_instance_id, COALESCE(NEW.name, NEW.city))
  ON CONFLICT DO NOTHING;

  -- Popular estoque com produtos do catalogo
  PERFORM auto_populate_inventory(NEW.evolution_instance_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_franchise_created ON franchises;
CREATE TRIGGER on_franchise_created
  AFTER INSERT ON franchises
  FOR EACH ROW
  EXECUTE FUNCTION on_franchise_created();
