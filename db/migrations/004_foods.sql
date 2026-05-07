-- =============================================================================
-- 004_foods.sql — Canonical foods table + ~50 staples seed
-- =============================================================================
--
-- This is the "nutrition truth" layer — independent of supermarkets. Each row
-- is a generic food item ("pechuga de pollo", "leche entera") with macros +
-- micros per 100g. Scraped products in `products` (next migration) link to
-- one canonical food via fuzzy name match.
--
-- We seed ~50 staples covering the bulk of a typical AR weekly cart. The LLM
-- (Phase 4) will eventually fill gaps for products that don't match any of
-- these — but the seeded set covers ~80% of what real users buy.
--
-- Nutrition values are USDA SR-Legacy / FoodData Central where available;
-- AR-specific items (yerba, pan lactal) are RDA estimates from package data.
-- All values per 100g unless noted.
--
-- RLS: any authenticated user can read; only service role writes (seeds,
-- LLM-generated entries from /api/foods/enrich in a future phase).
-- =============================================================================

create extension if not exists pgcrypto;

create table if not exists foods (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name_es text not null,
  category text not null check (category in (
    'protein_animal', 'protein_vegetal',
    'carbs_grain', 'carbs_tuber',
    'fats_oil', 'fats_nuts',
    'dairy', 'vegetable', 'fruit', 'legume', 'condiment', 'beverage'
  )),
  -- Lowercase tokens that, when found as a substring of a scraped product
  -- name, indicate this canonical food. Order matters: more specific terms
  -- first so "pechuga de pollo" beats "pollo".
  search_terms text[] not null default '{}',
  kcal_per_100g numeric not null,
  protein_per_100g numeric not null,
  carbs_per_100g numeric not null,
  fats_per_100g numeric not null,
  fiber_per_100g numeric not null default 0,
  sodium_mg_per_100g numeric,
  micros_json jsonb not null default '{}'::jsonb,
  is_vegan boolean not null default false,
  is_vegetarian boolean not null default false,
  is_gluten_free boolean not null default true,
  is_lactose_free boolean not null default true,
  source text not null default 'manual_seed' check (source in ('manual_seed', 'usda', 'llm', 'open_food_facts')),
  created_at timestamptz not null default now()
);

create index if not exists foods_category_idx on foods(category);
create index if not exists foods_slug_idx on foods(slug);

alter table foods enable row level security;

drop policy if exists "authenticated read foods" on foods;
create policy "authenticated read foods" on foods
  for select using (auth.role() = 'authenticated');

-- ============================================================================
-- Seed: ~50 staples covering the bulk of an AR weekly cart.
-- Idempotent: ON CONFLICT DO NOTHING so re-running this migration is safe.
-- ============================================================================

insert into foods (slug, name_es, category, search_terms, kcal_per_100g, protein_per_100g, carbs_per_100g, fats_per_100g, fiber_per_100g, is_vegan, is_vegetarian, is_gluten_free, is_lactose_free) values
  -- Animal proteins
  ('pollo_pechuga',     'Pechuga de pollo',  'protein_animal', '{"pechuga de pollo","pechuga","suprema de pollo"}', 165, 31,   0,    3.6,  0,   false, false, true,  true),
  ('pollo_muslo',       'Muslo de pollo',    'protein_animal', '{"muslo de pollo","pata muslo","pata de pollo"}',     209, 26,   0,    11,   0,   false, false, true,  true),
  ('carne_magra',       'Peceto / nalga',    'protein_animal', '{"peceto","nalga","cuadril","bola de lomo","lomo"}',  158, 26,   0,    5.5,  0,   false, false, true,  true),
  ('carne_molida',      'Carne picada',      'protein_animal', '{"carne picada","carne molida","picada"}',            254, 26,   0,    17,   0,   false, false, true,  true),
  ('huevo',             'Huevo de gallina',  'protein_animal', '{"huevo","huevos"}',                                  155, 13,   1.1,  11,   0,   false, true,  true,  true),
  ('atun_lata',         'Atún en lata',      'protein_animal', '{"atun","atún en lata","atun al natural"}',           116, 26,   0,    1,    0,   false, false, true,  true),
  ('merluza',           'Merluza',           'protein_animal', '{"merluza","filet de merluza"}',                       76, 17,   0,    0.7,  0,   false, false, true,  true),
  ('salmon',            'Salmón',            'protein_animal', '{"salmon","salmón"}',                                 208, 20,   0,    13,   0,   false, false, true,  true),
  ('jamon_cocido',      'Jamón cocido',      'protein_animal', '{"jamon cocido","jamón cocido"}',                     145, 21,   1.5,  5.5,  0,   false, false, true,  true),
  ('jamon_crudo',       'Jamón crudo',       'protein_animal', '{"jamon crudo","jamón crudo","prosciutto"}',          200, 28,   1,    9,    0,   false, false, true,  true),
  -- Plant proteins / legumes
  ('lentejas',          'Lentejas',          'legume',         '{"lentejas","lenteja"}',                              116,  9,  20,    0.4,  8,   true,  true,  true,  true),
  ('garbanzos',         'Garbanzos',         'legume',         '{"garbanzos","garbanzo"}',                            164,  9,  27,    2.6,  8,   true,  true,  true,  true),
  ('porotos',           'Porotos',           'legume',         '{"porotos","poroto","alubias","frijoles"}',           127,  9,  23,    0.5,  9,   true,  true,  true,  true),
  ('tofu',              'Tofu',              'protein_vegetal','{"tofu"}',                                             76,  8,   1.9,  4.8,  0.3, true,  true,  true,  true),
  -- Dairy
  ('leche_entera',      'Leche entera',      'dairy',          '{"leche entera","leche"}',                             60,  3.2, 4.8,  3.3,  0,   false, true,  true,  false),
  ('leche_descremada',  'Leche descremada',  'dairy',          '{"leche descremada","leche desnatada","leche light"}', 35,  3.4, 5,    0.1,  0,   false, true,  true,  false),
  ('yogur_natural',     'Yogur natural',     'dairy',          '{"yogur natural","yogurt natural","yogur entero"}',    60,  3.5, 4.7,  3.3,  0,   false, true,  true,  false),
  ('yogur_descremado',  'Yogur descremado',  'dairy',          '{"yogur descremado","yogur light","yogur 0%"}',        40,  4.3, 6.2,  0.4,  0,   false, true,  true,  false),
  ('queso_fresco',      'Queso fresco',      'dairy',          '{"queso fresco","queso port salut","queso cremoso"}', 250, 18,   4,   19,    0,   false, true,  true,  false),
  ('queso_duro',        'Queso duro',        'dairy',          '{"queso sardo","queso reggianito","queso duro","queso rallado"}', 380, 26, 1, 30, 0, false, true, true, false),
  ('ricota',            'Ricota',            'dairy',          '{"ricota","ricotta"}',                                174, 11,   3,   13,    0,   false, true,  true,  false),
  -- Grains and starchy carbs
  ('arroz_blanco',      'Arroz blanco',      'carbs_grain',    '{"arroz blanco","arroz largo fino","arroz"}',         130,  2.7,28,    0.3,  0.4, true,  true,  true,  true),
  ('arroz_integral',    'Arroz integral',    'carbs_grain',    '{"arroz integral","arroz yamaní"}',                   111,  2.6,23,    0.9,  1.8, true,  true,  true,  true),
  ('avena',             'Avena',             'carbs_grain',    '{"avena","copos de avena"}',                          379, 13,  68,    7,   10,   true,  true,  false, true),
  ('fideos',            'Fideos secos',      'carbs_grain',    '{"fideos","spaghetti","tallarines","mostachol","tirabuzon","tirabuzón"}', 158, 6, 31, 0.9, 1.8, true, true, false, true),
  ('pan_blanco',        'Pan blanco',        'carbs_grain',    '{"pan blanco","pan baguette","pan miñon","pan flauta","pan francés"}', 265, 9, 49, 3.2, 2.7, true, true, false, true),
  ('pan_integral',      'Pan integral',      'carbs_grain',    '{"pan integral","pan negro","pan de salvado"}',       247, 13,  41,    3.4,  7,   true,  true,  false, true),
  ('pan_lactal',        'Pan lactal',        'carbs_grain',    '{"pan lactal","pan de molde","pan de miga"}',         270,  9,  50,    4,    2.5, false, true,  false, false),
  ('polenta',           'Polenta',           'carbs_grain',    '{"polenta","harina de maiz"}',                         71,  1.6,16,    0.3,  1,   true,  true,  true,  true),
  ('papa',              'Papa',              'carbs_tuber',    '{"papa","papas"}',                                     77,  2,  17,    0.1,  2.2, true,  true,  true,  true),
  ('batata',            'Batata',            'carbs_tuber',    '{"batata","batatas"}',                                 86,  1.6,20,    0.1,  3,   true,  true,  true,  true),
  -- Fats
  ('aceite_oliva',      'Aceite de oliva',   'fats_oil',       '{"aceite de oliva","aceite oliva","oliva extra virgen"}', 884, 0, 0, 100, 0, true, true, true, true),
  ('aceite_girasol',    'Aceite de girasol', 'fats_oil',       '{"aceite de girasol","aceite girasol","aceite de maíz","aceite mezcla"}', 884, 0, 0, 100, 0, true, true, true, true),
  ('palta',             'Palta',             'fruit',          '{"palta","aguacate","paltas"}',                       160,  2,   9,   15,    7,   true,  true,  true,  true),
  ('almendras',         'Almendras',         'fats_nuts',      '{"almendras","almendra"}',                            579, 21,  22,   50,   12,   true,  true,  true,  true),
  ('nueces',            'Nueces',            'fats_nuts',      '{"nueces","nuez"}',                                   654, 15,  14,   65,    7,   true,  true,  true,  true),
  ('mani',              'Maní',              'fats_nuts',      '{"mani","maní","cacahuete"}',                         567, 26,  16,   49,    9,   true,  true,  true,  true),
  -- Vegetables
  ('tomate',            'Tomate',            'vegetable',      '{"tomate","tomates"}',                                 18,  0.9, 3.9,  0.2,  1.2, true,  true,  true,  true),
  ('lechuga',           'Lechuga',           'vegetable',      '{"lechuga"}',                                          15,  1.4, 2.9,  0.2,  1.3, true,  true,  true,  true),
  ('zanahoria',         'Zanahoria',         'vegetable',      '{"zanahoria","zanahorias"}',                           41,  0.9,10,    0.2,  2.8, true,  true,  true,  true),
  ('zapallito',         'Zapallito',         'vegetable',      '{"zapallito","zucchini","zapallitos"}',                17,  1.2, 3.1,  0.3,  1,   true,  true,  true,  true),
  ('zapallo',           'Zapallo',           'vegetable',      '{"zapallo","calabaza","anco"}',                        26,  1,   6.5,  0.1,  0.5, true,  true,  true,  true),
  ('brocoli',           'Brócoli',           'vegetable',      '{"brocoli","brócoli"}',                                34,  2.8, 7,    0.4,  2.6, true,  true,  true,  true),
  ('espinaca',          'Espinaca',          'vegetable',      '{"espinaca","espinacas"}',                             23,  2.9, 3.6,  0.4,  2.2, true,  true,  true,  true),
  ('cebolla',           'Cebolla',           'vegetable',      '{"cebolla","cebollas"}',                               40,  1.1, 9.3,  0.1,  1.7, true,  true,  true,  true),
  ('pimiento',          'Pimiento / morrón', 'vegetable',      '{"morron","morrón","pimiento","pimientos","ají dulce"}', 31, 1, 6, 0.3, 2.1, true, true, true, true),
  -- Fruits
  ('banana',            'Banana',            'fruit',          '{"banana","bananas","plátano"}',                       89,  1.1,23,    0.3,  2.6, true,  true,  true,  true),
  ('manzana',           'Manzana',           'fruit',          '{"manzana","manzanas"}',                               52,  0.3,14,    0.2,  2.4, true,  true,  true,  true),
  ('naranja',           'Naranja',           'fruit',          '{"naranja","naranjas"}',                               47,  0.9,12,    0.1,  2.4, true,  true,  true,  true),
  ('mandarina',         'Mandarina',         'fruit',          '{"mandarina","mandarinas"}',                           53,  0.8,13,    0.3,  1.8, true,  true,  true,  true),
  ('frutilla',          'Frutilla',          'fruit',          '{"frutilla","frutillas","fresa","fresas"}',            32,  0.7, 7.7,  0.3,  2,   true,  true,  true,  true),
  ('pera',              'Pera',              'fruit',          '{"pera","peras"}',                                     57,  0.4,15,    0.1,  3.1, true,  true,  true,  true),
  ('kiwi',              'Kiwi',              'fruit',          '{"kiwi","kiwis"}',                                     61,  1.1,15,    0.5,  3,   true,  true,  true,  true),
  -- Condiments / beverages
  ('azucar',            'Azúcar',            'condiment',      '{"azucar","azúcar"}',                                 387,  0,  100,    0,    0,   true,  true,  true,  true),
  ('yerba_mate',        'Yerba mate',        'beverage',       '{"yerba","yerba mate"}',                                0,  0,    0,    0,    0,   true,  true,  true,  true)
on conflict (slug) do nothing;
