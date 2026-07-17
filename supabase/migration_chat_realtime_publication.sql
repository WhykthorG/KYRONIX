-- Migração: Adicionar tabelas de chamadas ao Supabase Realtime — KYRONIX S.E.N.O
-- Whykthor GSV

BEGIN;

-- ── Adicionar tabelas à publicação Realtime ───────────────────
-- Isso permite que o frontend receba atualizações em tempo real
-- via assinaturas postgres_changes

ALTER PUBLICATION supabase_realtime ADD TABLE chat_call_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_call_signals;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_call_participants;

COMMIT;
