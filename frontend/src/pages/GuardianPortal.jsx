// ð¡ð¢Ðì ð▒Ê»ÐéÐìÐìð│ð┤ÐìÐàÊ»Ê»ð¢ð©ð╣ð│ ð▒Ê»ÐàÐìð╗ð┤ ð¢Ðî Whyktor GSV Ê»ð╣ð╗ð┤ð▓ÐìÐÇð╗Ðìð┤Ðìð│.
import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Download,
  FileText,
  GraduationCap,
  Loader2,
  MessageSquare,
  School,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';

import { ClassApi, MessageApi } from '@/services/supabaseApi';
import PageHeader from '@/components/common/PageHeader';
import StatePanel from '@/components/common/StatePanel';
import StudentReportCard from '@/components/common/StudentReportCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePermissions } from '@/components/hooks/usePermissions';
import {
  filterMessagesForStudent,
  getMessageRecipientLabel,
} from '@shared/contracts/messages';
import {
  buildGuardianMonthlyStudentReportPdfModel,
  sanitizePdfFilename,
} from '@shared/contracts/pdfReports';
import { generateGuardianMonthlyStudentReportPdf } from '@/lib/pdfReports';
import { normalizeStorageFileReferences } from '@shared/contracts/storage';
import {
  getGuardianDocumentSignedUrl,
  getGuardianMonthlyReportData,
  listGuardianPortalStudents,
} from '@/lib/guardianPortalClient';

const ENROLLMENT_STATUS_LABELS = {
  ativo: 'Ativo',
  pendente: 'Pendente',
  inativo: 'Inativo',
  transferido: 'Transferido',
  formado: 'Formado',
  evadido: 'Evadido',
};

const SHIFT_LABELS = {
  matutino: 'Matutino',
  vespertino: 'Vespertino',
  noturno: 'Noturno',
  integral: 'Integral',
};

function StudentSummaryCard({ title, value, description, icon: Icon }) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {title}
          </p>
          <p className="truncate text-base font-semibold text-foreground md:text-lg">
            {value}
          </p>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function formatMessageTimestamp(message) {
  const rawValue = message?.sent_at || message?.created_at;
  if (!rawValue) return 'Data indisponivel';

  return format(new Date(rawValue), "dd/MM/yyyy 'as' HH:mm", {
    locale: ptBR,
  });
}

export default function GuardianPortal() {
  const { isGuardian } = usePermissions();
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [downloadingPath, setDownloadingPath] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), 'yyyy-MM'));
  const [isGeneratingMonthlyReport, setIsGeneratingMonthlyReport] = useState(false);

  const {
    data: linkedStudents = [],
    isLoading: isLoadingStudents,
    isError: isStudentsError,
    refetch: refetchStudents,
  } = useQuery({
    queryKey: ['guardian-portal-students'],
    queryFn: listGuardianPortalStudents,
    enabled: isGuardian,
  });

  const { data: classes = [] } = useQuery({
    queryKey: ['guardian-portal-classes'],
    queryFn: () => ClassApi.list('-created_at', 200),
    enabled: isGuardian && linkedStudents.length > 0,
  });

  useEffect(() => {
    if (linkedStudents.length === 0) {
      setSelectedStudentId(null);
      return;
    }

    const selectedStillExists = linkedStudents.some((student) => student.id === selectedStudentId);
    if (!selectedStillExists) {
      setSelectedStudentId(linkedStudents[0].id);
    }
  }, [linkedStudents, selectedStudentId]);

  const selectedStudent = useMemo(
    () => linkedStudents.find((student) => student.id === selectedStudentId) || linkedStudents[0] || null,
    [linkedStudents, selectedStudentId]
  );

  const classesById = useMemo(
    () => Object.fromEntries((classes || []).map((item) => [item.id, item])),
    [classes]
  );

  const {
    data: accessibleMessages = [],
    isLoading: isLoadingMessages,
    isError: isMessagesError,
    refetch: refetchMessages,
  } = useQuery({
    queryKey: ['guardian-portal-messages', selectedStudent?.id || null],
    queryFn: () => MessageApi.list('-created_at', 120),
    enabled: isGuardian && Boolean(selectedStudent?.id),
  });

  const visibleMessages = useMemo(
    () => (selectedStudent ? filterMessagesForStudent(accessibleMessages, selectedStudent) : []),
    [accessibleMessages, selectedStudent]
  );

  const documents = useMemo(
    () => normalizeStorageFileReferences(selectedStudent?.attachments || []),
    [selectedStudent?.attachments]
  );

  const selectedClass = selectedStudent?.current_class_id
    ? classesById[selectedStudent.current_class_id] || null
    : null;

  const classLabel = selectedClass
    ? `${selectedClass.name}${selectedClass.year ? ` • ${selectedClass.year}` : ''}`
    : 'Turma nao vinculada';

  const enrollmentStatusLabel = ENROLLMENT_STATUS_LABELS[selectedStudent?.enrollment_status] || 'Nao informado';
  const shiftLabel = SHIFT_LABELS[selectedStudent?.shift] || 'Turno nao informado';

  const handleOpenDocument = async (document) => {
    if (!selectedStudent?.id || !document?.file_path || downloadingPath === document.file_path) {
      return;
    }

    setDownloadingPath(document.file_path);

    try {
      const payload = await getGuardianDocumentSignedUrl({
        studentId: selectedStudent.id,
        filePath: document.file_path,
      });

      if (typeof window !== 'undefined' && payload?.signedUrl) {
        window.open(payload.signedUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      toast.error(error?.message || 'Nao foi possivel abrir o documento agora.');
    } finally {
      setDownloadingPath(null);
    }
  };

  const handleDownloadMonthlyReport = async () => {
    if (!selectedStudent?.id || !selectedMonth || isGeneratingMonthlyReport) {
      return;
    }

    setIsGeneratingMonthlyReport(true);

    try {
      const reportData = await getGuardianMonthlyReportData({
        studentId: selectedStudent.id,
        month: selectedMonth,
      });

      const model = buildGuardianMonthlyStudentReportPdfModel(reportData || {});
      generateGuardianMonthlyStudentReportPdf({
        model,
        filename: `${sanitizePdfFilename(`relatorio-mensal-${selectedStudent.full_name}-${selectedMonth}`)}.pdf`,
      });
      toast.success('Relatorio mensal gerado com sucesso.');
    } catch (error) {
      toast.error(error?.message || 'Nao foi possivel gerar o relatorio mensal agora.');
    } finally {
      setIsGeneratingMonthlyReport(false);
    }
  };

  if (!isGuardian) {
    return (
      <StatePanel
        variant="error"
        title="Acesso indisponivel"
        description="Este modulo e restrito ao perfil de responsavel."
      />
    );
  }

  if (isLoadingStudents) {
    return (
      <StatePanel
        variant="loading"
        title="Carregando portal do responsavel"
        description="Estamos validando os alunos vinculados ao seu acesso."
      />
    );
  }

  if (isStudentsError) {
    return (
      <StatePanel
        variant="error"
        title="Falha ao carregar o portal"
        description="Nao foi possivel listar os alunos vinculados ao seu perfil agora."
        actionLabel="Tentar novamente"
        onAction={() => refetchStudents()}
      />
    );
  }

  if (!selectedStudent?.id) {
    return (
      <StatePanel
        variant="empty"
        icon={GraduationCap}
        title="Nenhum aluno vinculado"
        description="Seu acesso ainda nao possui um aluno associado. Procure a secretaria ou a coordenacao para liberar o portal."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Portal do Responsavel"
        subtitle="Acompanhe somente os dados autorizados dos alunos vinculados ao seu perfil."
      >
        <Badge className="gap-1.5 rounded-full border-[hsl(var(--feedback-info-fg)/0.16)] bg-[hsl(var(--feedback-info-bg))] px-3 py-1 text-[hsl(var(--feedback-info-fg))]">
          <ShieldCheck className="h-3.5 w-3.5" />
          Leitura controlada por vinculo
        </Badge>
      </PageHeader>

      <Card className="border-[hsl(var(--feedback-info-fg)/0.14)] bg-[hsl(var(--feedback-info-bg))]">
        <CardContent className="flex flex-col gap-2 p-5 text-sm text-[hsl(var(--feedback-info-fg))] md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="font-semibold">Visao somente leitura</p>
            <p className="max-w-3xl">
              Este portal mostra apenas notas, frequencia, comunicados e anexos canonicamente vinculados ao aluno selecionado.
            </p>
          </div>
          <Badge className="w-fit rounded-full border-white/40 bg-white/70 px-3 py-1 text-[hsl(var(--feedback-info-fg))]">
            {linkedStudents.length} aluno(s) vinculado(s)
          </Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alunos vinculados</CardTitle>
          <CardDescription>
            Selecione um aluno para alternar a visao do portal sem sair do seu acesso.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {linkedStudents.map((student) => {
            const isSelected = student.id === selectedStudent.id;
            const studentClass = student.current_class_id
              ? classesById[student.current_class_id] || null
              : null;

            return (
              <button
                key={student.id}
                type="button"
                onClick={() => setSelectedStudentId(student.id)}
                className={`rounded-2xl border p-4 text-left transition-all ${
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-[var(--shadow-soft)]'
                    : 'border-border/80 bg-card hover:border-[hsl(var(--border-strong))] hover:bg-accent/30'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="truncate font-semibold text-foreground">{student.full_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {student.registration_number || 'Matricula nao informada'}
                    </p>
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    {ENROLLMENT_STATUS_LABELS[student.enrollment_status] || 'Nao informado'}
                  </Badge>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  {studentClass
                    ? `${studentClass.name}${studentClass.year ? ` • ${studentClass.year}` : ''}`
                    : 'Turma nao vinculada'}
                </p>
              </button>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <StudentSummaryCard
          icon={GraduationCap}
          title="Aluno"
          value={selectedStudent.full_name}
          description={selectedStudent.registration_number || 'Matricula nao informada'}
        />
        <StudentSummaryCard
          icon={School}
          title="Turma"
          value={classLabel}
          description={selectedStudent.current_grade || shiftLabel}
        />
        <StudentSummaryCard
          icon={ShieldCheck}
          title="Situacao"
          value={enrollmentStatusLabel}
          description={selectedStudent.course || 'Curso nao informado'}
        />
      </div>

      <Tabs defaultValue="academic">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="academic">Notas e frequencia</TabsTrigger>
          <TabsTrigger value="messages">Recados</TabsTrigger>
          <TabsTrigger value="documents">Documentos</TabsTrigger>
        </TabsList>

        <TabsContent value="academic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Relatorio mensal em PDF</CardTitle>
              <CardDescription>
                Gere um arquivo com notas publicadas, faltas e ocorrencias do aluno selecionado no mes escolhido.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="w-full max-w-xs space-y-2">
                <label htmlFor="guardian-monthly-report-month" className="text-sm font-medium text-foreground">
                  Mes de referencia
                </label>
                <Input
                  id="guardian-monthly-report-month"
                  type="month"
                  value={selectedMonth}
                  onChange={(event) => setSelectedMonth(event.target.value)}
                  max={format(new Date(), 'yyyy-MM')}
                />
              </div>
              <Button
                type="button"
                onClick={() => void handleDownloadMonthlyReport()}
                disabled={!selectedStudent?.id || !selectedMonth || isGeneratingMonthlyReport}
                className="min-w-[220px]"
              >
                {isGeneratingMonthlyReport ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {isGeneratingMonthlyReport ? 'Gerando PDF...' : 'Baixar relatorio mensal'}
              </Button>
            </CardContent>
          </Card>
          <StudentReportCard studentId={selectedStudent.id} />
        </TabsContent>

        <TabsContent value="messages">
          <Card>
            <CardHeader>
              <CardTitle>Comunicados do aluno selecionado</CardTitle>
              <CardDescription>
                Recados visiveis para este aluno por audiencia geral, turma ou envio direto.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingMessages ? (
                <StatePanel
                  variant="loading"
                  compact
                  title="Carregando comunicados"
                  description="Buscando recados autorizados para o aluno selecionado."
                />
              ) : isMessagesError ? (
                <StatePanel
                  variant="error"
                  compact
                  title="Falha ao carregar comunicados"
                  description="Nao foi possivel consultar os recados vinculados a este aluno."
                  actionLabel="Tentar novamente"
                  onAction={() => refetchMessages()}
                />
              ) : visibleMessages.length === 0 ? (
                <StatePanel
                  variant="empty"
                  compact
                  icon={MessageSquare}
                  title="Nenhum comunicado disponivel"
                  description="Ainda nao ha recados publicados para o aluno selecionado."
                />
              ) : (
                <div className="space-y-3">
                  {visibleMessages.map((message) => (
                    <div
                      key={message.id}
                      className="rounded-2xl border border-border/80 bg-card/80 p-4 shadow-[var(--shadow-soft)]"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{message.category || 'comunicado'}</Badge>
                            <Badge className="bg-primary/10 text-primary">{message.priority || 'normal'}</Badge>
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">{message.subject}</p>
                            <p className="mt-1 text-sm leading-6 text-muted-foreground">
                              {message.content}
                            </p>
                          </div>
                        </div>
                        <div className="space-y-1 text-sm text-muted-foreground md:text-right">
                          <p>{formatMessageTimestamp(message)}</p>
                          <p>{message.sender_name || 'Equipe escolar'}</p>
                          <p>{getMessageRecipientLabel(message, classes)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>Documentos permitidos</CardTitle>
              <CardDescription>
                Este acesso libera apenas os anexos canonicos do cadastro do aluno selecionado.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <StatePanel
                  variant="empty"
                  compact
                  icon={FileText}
                  title="Nenhum documento disponivel"
                  description="Nao ha anexos permitidos para este aluno neste momento."
                />
              ) : (
                <div className="space-y-3">
                  {documents.map((document) => {
                    const isDownloading = downloadingPath === document.file_path;

                    return (
                      <div
                        key={document.file_path}
                        className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-card/80 p-4 md:flex-row md:items-center md:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-foreground">
                            {document.file_name || 'Documento'}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {document.file_path}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => void handleOpenDocument(document)}
                          disabled={isDownloading}
                        >
                          {isDownloading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                          {isDownloading ? 'Abrindo...' : 'Abrir documento'}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
