-- P├Âr├Âjek ╔øm╔ø cua lat k╔ø╔øliw ╔ø Whykthor GSV.
BEGIN;

ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS min_group_size INTEGER;

COMMIT;
