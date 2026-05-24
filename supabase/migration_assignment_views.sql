CREATE TABLE IF NOT EXISTS public.assignment_views (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id   UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  first_viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_viewed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  view_count      INTEGER NOT NULL DEFAULT 1 CHECK (view_count >= 1),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (assignment_id, student_id)
);

DROP TRIGGER IF EXISTS trg_assignment_views_updated_at ON public.assignment_views;
CREATE TRIGGER trg_assignment_views_updated_at
  BEFORE UPDATE ON public.assignment_views
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_assignment_views_assignment
  ON public.assignment_views(assignment_id);

CREATE INDEX IF NOT EXISTS idx_assignment_views_student
  ON public.assignment_views(student_id);

ALTER TABLE public.assignment_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "student manage own assignment views" ON public.assignment_views;
DROP POLICY IF EXISTS "teacher read assignment views" ON public.assignment_views;

CREATE POLICY "student manage own assignment views" ON public.assignment_views
  FOR ALL
  USING (student_id IN (SELECT id FROM public.students WHERE email = auth.jwt() ->> 'email'));

CREATE POLICY "teacher read assignment views" ON public.assignment_views
  FOR SELECT
  USING (auth_has_permission('submissions.read.all'));
