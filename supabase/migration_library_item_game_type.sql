-- Þ®▓Úáàþø«Õ«îÕà¿þö▒ Whykthor GSV Þú¢õ¢£
BEGIN;

ALTER TABLE public.library_items
  DROP CONSTRAINT IF EXISTS library_items_type_check;

ALTER TABLE public.library_items
  ADD CONSTRAINT library_items_type_check
  CHECK (type IN ('livro','jogo','periodico','dvd','ebook','outro'));

COMMIT;
