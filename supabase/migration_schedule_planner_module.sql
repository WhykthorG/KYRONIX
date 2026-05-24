-- ðæÐïð╗ ËÖð╣ð▒ðÁÐÇÊÖðÁ ÐéÐâð╗ÐïÊ╗Ðïð¢Ðüð░ Whyktor GSV ð║ð¥ð╝ð┐ð░ð¢ð©ÐÅÊ╗Ðï ðÁÐéðÁÐêÐéðÁÐÇËÖ.
CREATE TABLE IF NOT EXISTS public.school_schedule_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID DEFAULT current_tenant_id(),
  name TEXT NOT NULL,
  academic_year INTEGER NOT NULL CHECK (academic_year BETWEEN 2020 AND 2100),
  term_label TEXT NOT NULL DEFAULT 'Ano letivo',
  status TEXT NOT NULL DEFAULT 'planejamento'
    CHECK (status IN ('planejamento', 'coleta', 'gerando', 'publicado', 'arquivado')),
  default_max_lessons_per_day INTEGER NOT NULL DEFAULT 6 CHECK (default_max_lessons_per_day BETWEEN 1 AND 12),
  allow_windows BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.school_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID DEFAULT current_tenant_id(),
  setting_id UUID NOT NULL REFERENCES public.school_schedule_settings(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  lesson_count INTEGER NOT NULL CHECK (lesson_count BETWEEN 1 AND 12),
  active_days SMALLINT[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (setting_id, code)
);

CREATE TABLE IF NOT EXISTS public.school_environments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID DEFAULT current_tenant_id(),
  setting_id UUID NOT NULL REFERENCES public.school_schedule_settings(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  environment_type TEXT NOT NULL DEFAULT 'sala'
    CHECK (environment_type IN ('sala', 'laboratorio', 'quadra', 'video', 'especial')),
  capacity INTEGER NOT NULL DEFAULT 1 CHECK (capacity >= 1),
  is_special BOOLEAN NOT NULL DEFAULT false,
  exclusive_per_slot BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (setting_id, code)
);

CREATE TABLE IF NOT EXISTS public.curriculum_matrix (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID DEFAULT current_tenant_id(),
  setting_id UUID NOT NULL REFERENCES public.school_schedule_settings(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  shift_id UUID REFERENCES public.school_shifts(id) ON DELETE SET NULL,
  preferred_environment_id UUID REFERENCES public.school_environments(id) ON DELETE SET NULL,
  weekly_lessons INTEGER NOT NULL CHECK (weekly_lessons BETWEEN 1 AND 20),
  requires_special_environment BOOLEAN NOT NULL DEFAULT false,
  double_lesson_preference TEXT NOT NULL DEFAULT 'flexivel'
    CHECK (double_lesson_preference IN ('prefere', 'evita', 'flexivel')),
  max_lessons_per_day INTEGER NOT NULL DEFAULT 2 CHECK (max_lessons_per_day BETWEEN 1 AND 8),
  distribution_priority INTEGER NOT NULL DEFAULT 5 CHECK (distribution_priority BETWEEN 1 AND 10),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (setting_id, class_id, subject_id, teacher_id)
);

CREATE TABLE IF NOT EXISTS public.teacher_availability_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID DEFAULT current_tenant_id(),
  setting_id UUID NOT NULL REFERENCES public.school_schedule_settings(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'nao_enviado'
    CHECK (status IN ('nao_enviado', 'enviado', 'respondido', 'atrasado')),
  assigned_workload_hours INTEGER,
  sent_at TIMESTAMPTZ,
  due_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (setting_id, teacher_id)
);

CREATE TABLE IF NOT EXISTS public.teacher_availability_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID DEFAULT current_tenant_id(),
  form_id UUID NOT NULL REFERENCES public.teacher_availability_forms(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  shift_id UUID NOT NULL REFERENCES public.school_shifts(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 6),
  lesson_index SMALLINT NOT NULL CHECK (lesson_index BETWEEN 1 AND 12),
  is_available BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (form_id, shift_id, day_of_week, lesson_index)
);

CREATE TABLE IF NOT EXISTS public.teacher_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID DEFAULT current_tenant_id(),
  form_id UUID NOT NULL REFERENCES public.teacher_availability_forms(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  prefers_double_lessons BOOLEAN NOT NULL DEFAULT false,
  prefers_separate_lessons BOOLEAN NOT NULL DEFAULT false,
  accepts_gaps BOOLEAN NOT NULL DEFAULT false,
  avoid_single_lesson_days BOOLEAN NOT NULL DEFAULT false,
  max_lessons_per_day INTEGER NOT NULL DEFAULT 5 CHECK (max_lessons_per_day BETWEEN 1 AND 10),
  preferred_days SMALLINT[] NOT NULL DEFAULT '{}'::SMALLINT[],
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (form_id)
);

CREATE TABLE IF NOT EXISTS public.schedule_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID DEFAULT current_tenant_id(),
  setting_id UUID NOT NULL REFERENCES public.school_schedule_settings(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho', 'processando', 'concluida', 'concluida_com_pendencias', 'falhou')),
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  generation_mode TEXT NOT NULL DEFAULT 'automatico'
    CHECK (generation_mode IN ('automatico', 'assistido', 'manual')),
  validation_report JSONB NOT NULL DEFAULT '{}'::JSONB,
  summary JSONB NOT NULL DEFAULT '{}'::JSONB,
  quality_score NUMERIC(8,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.schedule_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID DEFAULT current_tenant_id(),
  generation_id UUID NOT NULL REFERENCES public.schedule_generations(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  environment_id UUID REFERENCES public.school_environments(id) ON DELETE SET NULL,
  shift_id UUID NOT NULL REFERENCES public.school_shifts(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 6),
  lesson_index SMALLINT NOT NULL CHECK (lesson_index BETWEEN 1 AND 12),
  status TEXT NOT NULL DEFAULT 'alocada' CHECK (status IN ('alocada', 'ajustada', 'cancelada')),
  source TEXT NOT NULL DEFAULT 'automatico' CHECK (source IN ('automatico', 'manual', 'sugestao_aplicada')),
  is_locked BOOLEAN NOT NULL DEFAULT false,
  quality_penalty NUMERIC(8,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.schedule_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID DEFAULT current_tenant_id(),
  generation_id UUID NOT NULL REFERENCES public.schedule_generations(id) ON DELETE CASCADE,
  conflict_type TEXT NOT NULL
    CHECK (conflict_type IN ('missing_data', 'teacher_unavailable', 'teacher_overlap', 'class_overlap', 'environment_overlap', 'daily_limit', 'unscheduled_lesson')),
  severity TEXT NOT NULL DEFAULT 'media' CHECK (severity IN ('baixa', 'media', 'alta')),
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  environment_id UUID REFERENCES public.school_environments(id) ON DELETE SET NULL,
  shift_id UUID REFERENCES public.school_shifts(id) ON DELETE SET NULL,
  day_of_week SMALLINT CHECK (day_of_week BETWEEN 1 AND 6),
  lesson_index SMALLINT CHECK (lesson_index BETWEEN 1 AND 12),
  reason_code TEXT NOT NULL,
  reason_text TEXT NOT NULL,
  impact_summary TEXT,
  blocking_data JSONB NOT NULL DEFAULT '{}'::JSONB,
  status TEXT NOT NULL DEFAULT 'aberto'
    CHECK (status IN ('aberto', 'aceito', 'resolvido', 'ignorado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.schedule_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID DEFAULT current_tenant_id(),
  generation_id UUID NOT NULL REFERENCES public.schedule_generations(id) ON DELETE CASCADE,
  conflict_id UUID REFERENCES public.schedule_conflicts(id) ON DELETE SET NULL,
  suggestion_type TEXT NOT NULL
    CHECK (suggestion_type IN ('move_entry', 'swap_entries', 'split_double_lesson', 'regroup_double_lesson', 'rebalance_day')),
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'aplicada', 'rejeitada')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  impact_score NUMERIC(8,2) NOT NULL DEFAULT 0,
  before_state JSONB NOT NULL DEFAULT '{}'::JSONB,
  after_state JSONB NOT NULL DEFAULT '{}'::JSONB,
  operation_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.optimization_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID DEFAULT current_tenant_id(),
  setting_id UUID NOT NULL UNIQUE REFERENCES public.school_schedule_settings(id) ON DELETE CASCADE,
  reduce_teacher_gaps NUMERIC(8,2) NOT NULL DEFAULT 8,
  avoid_single_lesson_days NUMERIC(8,2) NOT NULL DEFAULT 9,
  cluster_pedagogical_blocks NUMERIC(8,2) NOT NULL DEFAULT 6,
  spread_across_week NUMERIC(8,2) NOT NULL DEFAULT 7,
  avoid_daily_overload NUMERIC(8,2) NOT NULL DEFAULT 8,
  optimize_special_environments NUMERIC(8,2) NOT NULL DEFAULT 5,
  minimize_intercampus_travel NUMERIC(8,2) NOT NULL DEFAULT 4,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_school_schedule_settings_year ON public.school_schedule_settings(academic_year, status);
CREATE INDEX IF NOT EXISTS idx_school_shifts_setting ON public.school_shifts(setting_id);
CREATE INDEX IF NOT EXISTS idx_school_environments_setting ON public.school_environments(setting_id, is_special);
CREATE INDEX IF NOT EXISTS idx_curriculum_matrix_setting_class ON public.curriculum_matrix(setting_id, class_id);
CREATE INDEX IF NOT EXISTS idx_teacher_availability_forms_setting_teacher ON public.teacher_availability_forms(setting_id, teacher_id, status);
CREATE INDEX IF NOT EXISTS idx_teacher_availability_slots_teacher_shift ON public.teacher_availability_slots(teacher_id, shift_id, day_of_week, lesson_index);
CREATE INDEX IF NOT EXISTS idx_schedule_generations_setting_status ON public.schedule_generations(setting_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_schedule_entries_generation_class ON public.schedule_entries(generation_id, class_id, shift_id, day_of_week, lesson_index);
CREATE INDEX IF NOT EXISTS idx_schedule_entries_generation_teacher ON public.schedule_entries(generation_id, teacher_id, shift_id, day_of_week, lesson_index);
CREATE INDEX IF NOT EXISTS idx_schedule_conflicts_generation_status ON public.schedule_conflicts(generation_id, status, severity);
CREATE INDEX IF NOT EXISTS idx_schedule_suggestions_generation_status ON public.schedule_suggestions(generation_id, status, suggestion_type);

DROP TRIGGER IF EXISTS trg_school_schedule_settings_updated_at ON public.school_schedule_settings;
CREATE TRIGGER trg_school_schedule_settings_updated_at
  BEFORE UPDATE ON public.school_schedule_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_school_shifts_updated_at ON public.school_shifts;
CREATE TRIGGER trg_school_shifts_updated_at
  BEFORE UPDATE ON public.school_shifts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_school_environments_updated_at ON public.school_environments;
CREATE TRIGGER trg_school_environments_updated_at
  BEFORE UPDATE ON public.school_environments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_curriculum_matrix_updated_at ON public.curriculum_matrix;
CREATE TRIGGER trg_curriculum_matrix_updated_at
  BEFORE UPDATE ON public.curriculum_matrix
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_teacher_availability_forms_updated_at ON public.teacher_availability_forms;
CREATE TRIGGER trg_teacher_availability_forms_updated_at
  BEFORE UPDATE ON public.teacher_availability_forms
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_teacher_availability_slots_updated_at ON public.teacher_availability_slots;
CREATE TRIGGER trg_teacher_availability_slots_updated_at
  BEFORE UPDATE ON public.teacher_availability_slots
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_teacher_preferences_updated_at ON public.teacher_preferences;
CREATE TRIGGER trg_teacher_preferences_updated_at
  BEFORE UPDATE ON public.teacher_preferences
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_schedule_generations_updated_at ON public.schedule_generations;
CREATE TRIGGER trg_schedule_generations_updated_at
  BEFORE UPDATE ON public.schedule_generations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_schedule_entries_updated_at ON public.schedule_entries;
CREATE TRIGGER trg_schedule_entries_updated_at
  BEFORE UPDATE ON public.schedule_entries
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_schedule_conflicts_updated_at ON public.schedule_conflicts;
CREATE TRIGGER trg_schedule_conflicts_updated_at
  BEFORE UPDATE ON public.schedule_conflicts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_schedule_suggestions_updated_at ON public.schedule_suggestions;
CREATE TRIGGER trg_schedule_suggestions_updated_at
  BEFORE UPDATE ON public.schedule_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_optimization_settings_updated_at ON public.optimization_settings;
CREATE TRIGGER trg_optimization_settings_updated_at
  BEFORE UPDATE ON public.optimization_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.school_schedule_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_environments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curriculum_matrix ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_availability_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_availability_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.optimization_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "schedule settings read" ON public.school_schedule_settings;
CREATE POLICY "schedule settings read" ON public.school_schedule_settings
  FOR SELECT USING (
    auth_has_permission('schedules.manage')
    OR auth_has_permission('schedules.respond')
  );

DROP POLICY IF EXISTS "schedule settings write" ON public.school_schedule_settings;
CREATE POLICY "schedule settings write" ON public.school_schedule_settings
  FOR ALL USING (auth_has_permission('schedules.manage'))
  WITH CHECK (auth_has_permission('schedules.manage'));

DROP POLICY IF EXISTS "school shifts read" ON public.school_shifts;
CREATE POLICY "school shifts read" ON public.school_shifts
  FOR SELECT USING (
    auth_has_permission('schedules.manage')
    OR auth_has_permission('schedules.respond')
  );

DROP POLICY IF EXISTS "school shifts write" ON public.school_shifts;
CREATE POLICY "school shifts write" ON public.school_shifts
  FOR ALL USING (auth_has_permission('schedules.manage'))
  WITH CHECK (auth_has_permission('schedules.manage'));

DROP POLICY IF EXISTS "school environments read" ON public.school_environments;
CREATE POLICY "school environments read" ON public.school_environments
  FOR SELECT USING (
    auth_has_permission('schedules.manage')
    OR auth_has_permission('schedules.respond')
  );

DROP POLICY IF EXISTS "school environments write" ON public.school_environments;
CREATE POLICY "school environments write" ON public.school_environments
  FOR ALL USING (auth_has_permission('schedules.manage'))
  WITH CHECK (auth_has_permission('schedules.manage'));

DROP POLICY IF EXISTS "curriculum matrix read" ON public.curriculum_matrix;
CREATE POLICY "curriculum matrix read" ON public.curriculum_matrix
  FOR SELECT USING (
    auth_has_permission('schedules.manage')
    OR auth_has_permission('schedules.respond')
  );

DROP POLICY IF EXISTS "curriculum matrix write" ON public.curriculum_matrix;
CREATE POLICY "curriculum matrix write" ON public.curriculum_matrix
  FOR ALL USING (auth_has_permission('schedules.manage'))
  WITH CHECK (auth_has_permission('schedules.manage'));

DROP POLICY IF EXISTS "teacher availability forms read" ON public.teacher_availability_forms;
CREATE POLICY "teacher availability forms read" ON public.teacher_availability_forms
  FOR SELECT USING (
    auth_has_permission('schedules.manage')
    OR EXISTS (
      SELECT 1
      FROM public.teachers t
      WHERE t.id = teacher_availability_forms.teacher_id
        AND t.email = auth.jwt() ->> 'email'
        AND auth_has_permission('schedules.respond')
    )
  );

DROP POLICY IF EXISTS "teacher availability forms write" ON public.teacher_availability_forms;
CREATE POLICY "teacher availability forms write" ON public.teacher_availability_forms
  FOR ALL USING (
    auth_has_permission('schedules.manage')
    OR EXISTS (
      SELECT 1
      FROM public.teachers t
      WHERE t.id = teacher_availability_forms.teacher_id
        AND t.email = auth.jwt() ->> 'email'
        AND auth_has_permission('schedules.respond')
    )
  )
  WITH CHECK (
    auth_has_permission('schedules.manage')
    OR EXISTS (
      SELECT 1
      FROM public.teachers t
      WHERE t.id = teacher_availability_forms.teacher_id
        AND t.email = auth.jwt() ->> 'email'
        AND auth_has_permission('schedules.respond')
    )
  );

DROP POLICY IF EXISTS "teacher availability slots read" ON public.teacher_availability_slots;
CREATE POLICY "teacher availability slots read" ON public.teacher_availability_slots
  FOR SELECT USING (
    auth_has_permission('schedules.manage')
    OR EXISTS (
      SELECT 1
      FROM public.teachers t
      WHERE t.id = teacher_availability_slots.teacher_id
        AND t.email = auth.jwt() ->> 'email'
        AND auth_has_permission('schedules.respond')
    )
  );

DROP POLICY IF EXISTS "teacher availability slots write" ON public.teacher_availability_slots;
CREATE POLICY "teacher availability slots write" ON public.teacher_availability_slots
  FOR ALL USING (
    auth_has_permission('schedules.manage')
    OR EXISTS (
      SELECT 1
      FROM public.teachers t
      WHERE t.id = teacher_availability_slots.teacher_id
        AND t.email = auth.jwt() ->> 'email'
        AND auth_has_permission('schedules.respond')
    )
  )
  WITH CHECK (
    auth_has_permission('schedules.manage')
    OR EXISTS (
      SELECT 1
      FROM public.teachers t
      WHERE t.id = teacher_availability_slots.teacher_id
        AND t.email = auth.jwt() ->> 'email'
        AND auth_has_permission('schedules.respond')
    )
  );

DROP POLICY IF EXISTS "teacher preferences read" ON public.teacher_preferences;
CREATE POLICY "teacher preferences read" ON public.teacher_preferences
  FOR SELECT USING (
    auth_has_permission('schedules.manage')
    OR EXISTS (
      SELECT 1
      FROM public.teachers t
      WHERE t.id = teacher_preferences.teacher_id
        AND t.email = auth.jwt() ->> 'email'
        AND auth_has_permission('schedules.respond')
    )
  );

DROP POLICY IF EXISTS "teacher preferences write" ON public.teacher_preferences;
CREATE POLICY "teacher preferences write" ON public.teacher_preferences
  FOR ALL USING (
    auth_has_permission('schedules.manage')
    OR EXISTS (
      SELECT 1
      FROM public.teachers t
      WHERE t.id = teacher_preferences.teacher_id
        AND t.email = auth.jwt() ->> 'email'
        AND auth_has_permission('schedules.respond')
    )
  )
  WITH CHECK (
    auth_has_permission('schedules.manage')
    OR EXISTS (
      SELECT 1
      FROM public.teachers t
      WHERE t.id = teacher_preferences.teacher_id
        AND t.email = auth.jwt() ->> 'email'
        AND auth_has_permission('schedules.respond')
    )
  );

DROP POLICY IF EXISTS "schedule generations read" ON public.schedule_generations;
CREATE POLICY "schedule generations read" ON public.schedule_generations
  FOR SELECT USING (
    auth_has_permission('schedules.manage')
    OR auth_has_permission('schedules.respond')
  );

DROP POLICY IF EXISTS "schedule generations write" ON public.schedule_generations;
CREATE POLICY "schedule generations write" ON public.schedule_generations
  FOR ALL USING (auth_has_permission('schedules.manage'))
  WITH CHECK (auth_has_permission('schedules.manage'));

DROP POLICY IF EXISTS "schedule entries read" ON public.schedule_entries;
CREATE POLICY "schedule entries read" ON public.schedule_entries
  FOR SELECT USING (
    auth_has_permission('schedules.manage')
    OR auth_has_permission('schedules.respond')
  );

DROP POLICY IF EXISTS "schedule entries write" ON public.schedule_entries;
CREATE POLICY "schedule entries write" ON public.schedule_entries
  FOR ALL USING (auth_has_permission('schedules.manage'))
  WITH CHECK (auth_has_permission('schedules.manage'));

DROP POLICY IF EXISTS "schedule conflicts read" ON public.schedule_conflicts;
CREATE POLICY "schedule conflicts read" ON public.schedule_conflicts
  FOR SELECT USING (auth_has_permission('schedules.manage'));

DROP POLICY IF EXISTS "schedule conflicts write" ON public.schedule_conflicts;
CREATE POLICY "schedule conflicts write" ON public.schedule_conflicts
  FOR ALL USING (auth_has_permission('schedules.manage'))
  WITH CHECK (auth_has_permission('schedules.manage'));

DROP POLICY IF EXISTS "schedule suggestions read" ON public.schedule_suggestions;
CREATE POLICY "schedule suggestions read" ON public.schedule_suggestions
  FOR SELECT USING (auth_has_permission('schedules.manage'));

DROP POLICY IF EXISTS "schedule suggestions write" ON public.schedule_suggestions;
CREATE POLICY "schedule suggestions write" ON public.schedule_suggestions
  FOR ALL USING (auth_has_permission('schedules.manage'))
  WITH CHECK (auth_has_permission('schedules.manage'));

DROP POLICY IF EXISTS "optimization settings read" ON public.optimization_settings;
CREATE POLICY "optimization settings read" ON public.optimization_settings
  FOR SELECT USING (
    auth_has_permission('schedules.manage')
    OR auth_has_permission('schedules.respond')
  );

DROP POLICY IF EXISTS "optimization settings write" ON public.optimization_settings;
CREATE POLICY "optimization settings write" ON public.optimization_settings
  FOR ALL USING (auth_has_permission('schedules.manage'))
  WITH CHECK (auth_has_permission('schedules.manage'));
