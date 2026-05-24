import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpenText,
  GraduationCap,
  IdCard,
  ShieldCheck,
} from 'lucide-react';

import { ClassApi, StudentApi } from '@/services/supabaseApi';
import PageHeader from '@/components/common/PageHeader';
import StatePanel from '@/components/common/StatePanel';
import StudentReportCard from '@/components/common/StudentReportCard';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/lib/AuthContext';

const ENROLLMENT_STATUS_LABELS = {
  ativo: 'Ativo',
  inativo: 'Inativo',
  transferido: 'Transferido',
  concluido: 'Concluído',
  trancado: 'Trancado',
};

function StudentInfoCard({ icon: Icon, label, value, detail }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex items-start gap-3 p-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {label}
          </p>
          <p className="truncate text-base font-semibold text-foreground md:text-lg">
            {value}
          </p>
          {detail ? (
            <p className="text-sm text-muted-foreground">{detail}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export default function StudentGradesView() {
  const { user: authUser } = useAuth();

  const {
    data: studentRecord,
    isLoading: isLoadingStudent,
    isError: isStudentError,
    refetch: refetchStudent,
  } = useQuery({
    queryKey: ['student-grades-view', authUser?.email],
    queryFn: async () => {
      const students = await StudentApi.filter({ email: authUser.email });
      return students[0] ?? null;
    },
    enabled: !!authUser?.email,
  });

  const { data: classRecord } = useQuery({
    queryKey: ['student-grades-view-class', studentRecord?.current_class_id],
    queryFn: () => ClassApi.get(studentRecord.current_class_id),
    enabled: !!studentRecord?.current_class_id,
  });

  if (!authUser?.email) {
    return (
      <StatePanel
        variant="error"
        title="Sessão indisponível"
        description="Não foi possível confirmar seu usuário autenticado para carregar suas notas."
      />
    );
  }

  if (isLoadingStudent) {
    return (
      <StatePanel
        variant="loading"
        title="Carregando suas notas"
        description="Estamos validando seu vínculo de aluno e preparando o seu boletim."
      />
    );
  }

  if (isStudentError) {
    return (
      <StatePanel
        variant="error"
        title="Falha ao carregar suas notas"
        description="O sistema não conseguiu validar seu cadastro de aluno agora. Tente novamente."
        actionLabel="Tentar novamente"
        onAction={() => refetchStudent()}
      />
    );
  }

  if (!studentRecord?.id) {
    return (
      <StatePanel
        variant="empty"
        icon={BookOpenText}
        title="Cadastro de aluno não encontrado"
        description="Seu acesso não está vinculado a um cadastro acadêmico válido. Procure a secretaria para regularizar o vínculo."
      />
    );
  }

  const classLabel = classRecord
    ? `${classRecord.name}${classRecord.year ? ` • ${classRecord.year}` : ''}`
    : 'Turma não vinculada';
  const enrollmentStatus = ENROLLMENT_STATUS_LABELS[studentRecord.enrollment_status] ?? 'Status não informado';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Minhas Notas"
        subtitle="Esta área mostra apenas o seu boletim e a sua frequência publicada pela escola."
      >
        <Badge className="gap-1.5 rounded-full border-[hsl(var(--feedback-info-fg)/0.16)] bg-[hsl(var(--feedback-info-bg))] px-3 py-1 text-[hsl(var(--feedback-info-fg))]">
          <ShieldCheck className="h-3.5 w-3.5" />
          Acesso individual
        </Badge>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-3">
        <StudentInfoCard
          icon={GraduationCap}
          label="Aluno"
          value={studentRecord.full_name || authUser.email}
          detail={authUser.email}
        />
        <StudentInfoCard
          icon={IdCard}
          label="Matrícula"
          value={studentRecord.registration_number || 'Não informada'}
          detail={classLabel}
        />
        <StudentInfoCard
          icon={ShieldCheck}
          label="Situação"
          value={enrollmentStatus}
          detail="Somente seus próprios dados acadêmicos são exibidos aqui."
        />
      </div>

      <Card className="border-[hsl(var(--feedback-info-fg)/0.14)] bg-[hsl(var(--feedback-info-bg))]">
        <CardContent className="flex flex-col gap-2 p-5 text-sm text-[hsl(var(--feedback-info-fg))] md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="font-semibold">Visão exclusiva do aluno</p>
            <p className="max-w-3xl">
              Você visualiza somente notas e frequência vinculadas ao seu cadastro.
              Nenhum filtro por outros alunos fica disponível neste fluxo.
            </p>
          </div>
          <Badge className="w-fit rounded-full border-white/40 bg-white/70 px-3 py-1 text-[hsl(var(--feedback-info-fg))]">
            {classLabel}
          </Badge>
        </CardContent>
      </Card>

      <StudentReportCard studentId={studentRecord.id} />
    </div>
  );
}
