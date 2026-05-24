-- ðƒÐÇð¥ðÁð║Ðé ð┐ð¥ð╗ð¢ð¥ÐüÐéÐîÐÄ ÐÇð░ðÀÐÇð░ð▒ð¥Ðéð░ð¢ ðúð©ð║Ðéð¥ÐÇð¥ð╝ ðôðíðÆ.
CREATE TABLE IF NOT EXISTS public.schedule_rule_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID DEFAULT current_tenant_id(),
  setting_id UUID NOT NULL REFERENCES public.school_schedule_settings(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'arquivado')),
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  deleted_at TIMESTAMPTZ,
  UNIQUE (setting_id, name)
);

CREATE TABLE IF NOT EXISTS public.schedule_rule_weights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID DEFAULT current_tenant_id(),
  rule_set_id UUID NOT NULL REFERENCES public.schedule_rule_sets(id) ON DELETE CASCADE,
  rule_key TEXT NOT NULL,
  rule_type TEXT NOT NULL DEFAULT 'SOFT' CHECK (rule_type IN ('HARD', 'SOFT')),
  weight NUMERIC(10,2) NOT NULL DEFAULT 1 CHECK (weight >= 0),
  enabled BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  deleted_at TIMESTAMPTZ,
  UNIQUE (rule_set_id, rule_key)
);

CREATE TABLE IF NOT EXISTS public.schedule_generation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID DEFAULT current_tenant_id(),
  setting_id UUID NOT NULL REFERENCES public.school_schedule_settings(id) ON DELETE CASCADE,
  generation_id UUID REFERENCES public.schedule_generations(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED')),
  stage TEXT NOT NULL DEFAULT 'validation',
  progress NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  trace_id TEXT,
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.schedule_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID DEFAULT current_tenant_id(),
  setting_id UUID NOT NULL REFERENCES public.school_schedule_settings(id) ON DELETE CASCADE,
  generation_id UUID REFERENCES public.schedule_generations(id) ON DELETE SET NULL,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  origin TEXT NOT NULL DEFAULT 'automatica' CHECK (origin IN ('automatica', 'manual', 'restaurada', 'publicada')),
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'ativa', 'publicada', 'arquivada')),
  title TEXT NOT NULL,
  snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
  summary JSONB NOT NULL DEFAULT '{}'::JSONB,
  score JSONB NOT NULL DEFAULT '{}'::JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  is_active BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  published_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  restored_from_version_id UUID REFERENCES public.schedule_versions(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  deleted_at TIMESTAMPTZ,
  UNIQUE (setting_id, version_number)
);

CREATE TABLE IF NOT EXISTS public.schedule_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID DEFAULT current_tenant_id(),
  setting_id UUID NOT NULL REFERENCES public.school_schedule_settings(id) ON DELETE CASCADE,
  generation_id UUID REFERENCES public.schedule_generations(id) ON DELETE SET NULL,
  version_id UUID REFERENCES public.schedule_versions(id) ON DELETE SET NULL,
  entity_table TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  before_state JSONB NOT NULL DEFAULT '{}'::JSONB,
  after_state JSONB NOT NULL DEFAULT '{}'::JSONB,
  reason TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.schedule_publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID DEFAULT current_tenant_id(),
  setting_id UUID NOT NULL REFERENCES public.school_schedule_settings(id) ON DELETE CASCADE,
  version_id UUID NOT NULL REFERENCES public.schedule_versions(id) ON DELETE CASCADE,
  generation_id UUID REFERENCES public.schedule_generations(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'publicada' CHECK (status IN ('rascunho', 'publicada', 'revogada')),
  notes TEXT,
  published_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  published_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.schedule_manual_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID DEFAULT current_tenant_id(),
  setting_id UUID NOT NULL REFERENCES public.school_schedule_settings(id) ON DELETE CASCADE,
  generation_id UUID REFERENCES public.schedule_generations(id) ON DELETE SET NULL,
  version_id UUID REFERENCES public.schedule_versions(id) ON DELETE SET NULL,
  entry_id UUID REFERENCES public.schedule_entries(id) ON DELETE SET NULL,
  from_state JSONB NOT NULL DEFAULT '{}'::JSONB,
  to_state JSONB NOT NULL DEFAULT '{}'::JSONB,
  edit_reason TEXT,
  edited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.schedule_slot_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID DEFAULT current_tenant_id(),
  setting_id UUID NOT NULL REFERENCES public.school_schedule_settings(id) ON DELETE CASCADE,
  generation_id UUID REFERENCES public.schedule_generations(id) ON DELETE SET NULL,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE CASCADE,
  environment_id UUID REFERENCES public.school_environments(id) ON DELETE CASCADE,
  shift_id UUID REFERENCES public.school_shifts(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 6),
  lesson_index SMALLINT NOT NULL CHECK (lesson_index BETWEEN 1 AND 12),
  reason TEXT,
  locked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (setting_id, shift_id, day_of_week, lesson_index, class_id, teacher_id, environment_id)
);

CREATE TABLE IF NOT EXISTS public.schedule_run_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID DEFAULT current_tenant_id(),
  run_id UUID NOT NULL REFERENCES public.schedule_generation_runs(id) ON DELETE CASCADE,
  metric_key TEXT NOT NULL,
  metric_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (run_id, metric_key)
);

CREATE TABLE IF NOT EXISTS public.teacher_workload_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID DEFAULT current_tenant_id(),
  setting_id UUID NOT NULL REFERENCES public.school_schedule_settings(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  total_lessons INTEGER NOT NULL DEFAULT 0,
  daily_max INTEGER NOT NULL DEFAULT 0,
  daily_min INTEGER NOT NULL DEFAULT 0,
  gaps_count INTEGER NOT NULL DEFAULT 0,
  overload_count INTEGER NOT NULL DEFAULT 0,
  score NUMERIC(10,2) NOT NULL DEFAULT 0,
  summary JSONB NOT NULL DEFAULT '{}'::JSONB,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.environment_usage_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID DEFAULT current_tenant_id(),
  setting_id UUID NOT NULL REFERENCES public.school_schedule_settings(id) ON DELETE CASCADE,
  environment_id UUID NOT NULL REFERENCES public.school_environments(id) ON DELETE CASCADE,
  total_usages INTEGER NOT NULL DEFAULT 0,
  occupied_slots INTEGER NOT NULL DEFAULT 0,
  utilization_rate NUMERIC(8,2) NOT NULL DEFAULT 0,
  summary JSONB NOT NULL DEFAULT '{}'::JSONB,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_schedule_rule_sets_setting_tenant ON public.schedule_rule_sets(tenant_id, setting_id, status);
CREATE INDEX IF NOT EXISTS idx_schedule_rule_weights_ruleset ON public.schedule_rule_weights(rule_set_id, rule_type, enabled);
CREATE INDEX IF NOT EXISTS idx_schedule_generation_runs_setting_status ON public.schedule_generation_runs(tenant_id, setting_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_schedule_versions_setting_active ON public.schedule_versions(tenant_id, setting_id, is_active, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_schedule_change_log_setting_created ON public.schedule_change_log(tenant_id, setting_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_schedule_publications_setting_created ON public.schedule_publications(tenant_id, setting_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_schedule_manual_edits_setting_created ON public.schedule_manual_edits(tenant_id, setting_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_schedule_slot_locks_setting_slot ON public.schedule_slot_locks(tenant_id, setting_id, shift_id, day_of_week, lesson_index);
CREATE INDEX IF NOT EXISTS idx_teacher_workload_summary_setting_teacher ON public.teacher_workload_summary(tenant_id, setting_id, teacher_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_environment_usage_summary_setting_environment ON public.environment_usage_summary(tenant_id, setting_id, environment_id, generated_at DESC);

DROP TRIGGER IF EXISTS trg_schedule_rule_sets_updated_at ON public.schedule_rule_sets;
CREATE TRIGGER trg_schedule_rule_sets_updated_at
  BEFORE UPDATE ON public.schedule_rule_sets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_schedule_rule_weights_updated_at ON public.schedule_rule_weights;
CREATE TRIGGER trg_schedule_rule_weights_updated_at
  BEFORE UPDATE ON public.schedule_rule_weights
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_schedule_generation_runs_updated_at ON public.schedule_generation_runs;
CREATE TRIGGER trg_schedule_generation_runs_updated_at
  BEFORE UPDATE ON public.schedule_generation_runs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_schedule_versions_updated_at ON public.schedule_versions;
CREATE TRIGGER trg_schedule_versions_updated_at
  BEFORE UPDATE ON public.schedule_versions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_schedule_publications_updated_at ON public.schedule_publications;
CREATE TRIGGER trg_schedule_publications_updated_at
  BEFORE UPDATE ON public.schedule_publications
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_schedule_manual_edits_updated_at ON public.schedule_manual_edits;
CREATE TRIGGER trg_schedule_manual_edits_updated_at
  BEFORE UPDATE ON public.schedule_manual_edits
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_schedule_slot_locks_updated_at ON public.schedule_slot_locks;
CREATE TRIGGER trg_schedule_slot_locks_updated_at
  BEFORE UPDATE ON public.schedule_slot_locks
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.schedule_rule_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_rule_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_generation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_change_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_manual_edits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_slot_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_run_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_workload_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.environment_usage_summary ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "schedule planner manage" ON public.schedule_rule_sets;
CREATE POLICY "schedule planner manage" ON public.schedule_rule_sets
  FOR ALL USING (auth_has_permission('schedules.manage'))
  WITH CHECK (auth_has_permission('schedules.manage'));

DROP POLICY IF EXISTS "schedule rule weights manage" ON public.schedule_rule_weights;
CREATE POLICY "schedule rule weights manage" ON public.schedule_rule_weights
  FOR ALL USING (auth_has_permission('schedules.manage'))
  WITH CHECK (auth_has_permission('schedules.manage'));

DROP POLICY IF EXISTS "schedule runs manage" ON public.schedule_generation_runs;
CREATE POLICY "schedule runs manage" ON public.schedule_generation_runs
  FOR ALL USING (auth_has_permission('schedules.manage'))
  WITH CHECK (auth_has_permission('schedules.manage'));

DROP POLICY IF EXISTS "schedule versions manage" ON public.schedule_versions;
CREATE POLICY "schedule versions manage" ON public.schedule_versions
  FOR ALL USING (
    auth_has_permission('schedules.manage')
    OR auth_has_permission('schedules.publish')
    OR auth_has_permission('schedules.audit')
    OR auth_has_permission('schedules.view')
  )
  WITH CHECK (
    auth_has_permission('schedules.manage')
    OR auth_has_permission('schedules.publish')
    OR auth_has_permission('schedules.audit')
  );

DROP POLICY IF EXISTS "schedule change log read" ON public.schedule_change_log;
CREATE POLICY "schedule change log read" ON public.schedule_change_log
  FOR SELECT USING (
    auth_has_permission('schedules.manage')
    OR auth_has_permission('schedules.audit')
  );

DROP POLICY IF EXISTS "schedule publications manage" ON public.schedule_publications;
CREATE POLICY "schedule publications manage" ON public.schedule_publications
  FOR ALL USING (
    auth_has_permission('schedules.manage')
    OR auth_has_permission('schedules.publish')
  )
  WITH CHECK (
    auth_has_permission('schedules.manage')
    OR auth_has_permission('schedules.publish')
  );

DROP POLICY IF EXISTS "schedule manual edits manage" ON public.schedule_manual_edits;
CREATE POLICY "schedule manual edits manage" ON public.schedule_manual_edits
  FOR ALL USING (auth_has_permission('schedules.manage'))
  WITH CHECK (auth_has_permission('schedules.manage'));

DROP POLICY IF EXISTS "schedule slot locks manage" ON public.schedule_slot_locks;
CREATE POLICY "schedule slot locks manage" ON public.schedule_slot_locks
  FOR ALL USING (auth_has_permission('schedules.manage'))
  WITH CHECK (auth_has_permission('schedules.manage'));

DROP POLICY IF EXISTS "schedule run metrics read" ON public.schedule_run_metrics;
CREATE POLICY "schedule run metrics read" ON public.schedule_run_metrics
  FOR SELECT USING (
    auth_has_permission('schedules.manage')
    OR auth_has_permission('schedules.audit')
    OR auth_has_permission('schedules.view')
  );

DROP POLICY IF EXISTS "teacher workload summary read" ON public.teacher_workload_summary;
CREATE POLICY "teacher workload summary read" ON public.teacher_workload_summary
  FOR SELECT USING (
    auth_has_permission('schedules.manage')
    OR auth_has_permission('schedules.respond')
  );

DROP POLICY IF EXISTS "environment usage summary read" ON public.environment_usage_summary;
CREATE POLICY "environment usage summary read" ON public.environment_usage_summary
  FOR SELECT USING (
    auth_has_permission('schedules.manage')
    OR auth_has_permission('schedules.respond')
  );

CREATE OR REPLACE VIEW public.schedule_versions_overview AS
SELECT
  v.id,
  v.tenant_id,
  v.setting_id,
  v.generation_id,
  v.version_number,
  v.origin,
  v.status,
  v.title,
  v.is_active,
  v.published_at,
  v.published_by,
  v.created_by,
  v.created_at,
  v.updated_at,
  v.summary,
  v.score
FROM public.schedule_versions v
WHERE v.deleted_at IS NULL;

CREATE OR REPLACE VIEW public.schedule_generation_dashboard AS
SELECT
  g.id,
  g.tenant_id,
  g.setting_id,
  g.status,
  g.started_at,
  g.finished_at,
  g.quality_score,
  g.summary,
  g.validation_report,
  COUNT(e.id) AS entries_count,
  COUNT(c.id) AS conflicts_count,
  COUNT(s.id) AS suggestions_count
FROM public.schedule_generations g
LEFT JOIN public.schedule_entries e ON e.generation_id = g.id
LEFT JOIN public.schedule_conflicts c ON c.generation_id = g.id
LEFT JOIN public.schedule_suggestions s ON s.generation_id = g.id
GROUP BY g.id;
