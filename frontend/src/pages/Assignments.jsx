// ðƒÐÇð¥ðÁð║Ðé ð┐ð¥ð╗ð¢ð¥ÐüÐéÐîÐÄ ÐÇð░ðÀÐÇð░ð▒ð¥Ðéð░ð¢ ðúð©ð║Ðéð¥ÐÇð¥ð╝ ðôðíðÆ.
import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/common/PageHeader';
import RenderProfiler from '@/components/common/RenderProfiler';
import StatusBadge from '@/components/common/StatusBadge';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, CheckCircle2, Clock3, Edit, Eye, FileText, Loader2, Paperclip, Search, Trash2, Upload, Users, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from "@/lib/utils";
import { AssignmentApi, AssignmentViewApi, ClassApi, SubjectApi, SubmissionApi } from '@/services/supabaseApi';
import { usePermissions } from '@/components/hooks/usePermissions';
import { useAuth } from '@/lib/AuthContext';
import { StudentApi } from '@/services/supabaseApi';
import {
  ASSIGNMENT_STATUSES,
  buildPublishedAssignmentUpdate,
  isAssignmentPublished,
  shouldAutoCloseAssignment,
} from '@shared/contracts/assignments';
import { canManageAssignments as canManageAssignmentsByPermission } from '@shared/contracts/access';
import {
  normalizeSubmissionStatus,
  SUBMISSION_STATUSES,
} from '@shared/contracts/submissions';
import {
  deleteStorageFile,
  deleteStorageFiles,
  diffRemovedStorageFileReferences,
  DEFAULT_STORAGE_BUCKET,
  getStorageFileKey,
  getStoredFileName,
  normalizeStorageFileReferences,
  resolveStorageFileUrl,
  uploadStorageFile,
} from '@/lib/storageFiles';
import { useGlobalSearchNavigation } from '@/hooks/useGlobalSearchNavigation';

const SUBMISSION_ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const SUBMISSION_MAX_SIZE = 10 * 1024 * 1024;
const BUCKET = DEFAULT_STORAGE_BUCKET;

const TRACKING_STATUS_META = Object.freeze({
  on_time: {
    label: 'Entregue no prazo',
    badgeClassName: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    icon: CheckCircle2,
  },
  late: {
    label: 'Entregue com atraso',
    badgeClassName: 'border-amber-200 bg-amber-50 text-amber-700',
    icon: Clock3,
  },
  viewed_pending: {
    label: 'Visualizou e nao entregou',
    badgeClassName: 'border-sky-200 bg-sky-50 text-sky-700',
    icon: Eye,
  },
  not_viewed: {
    label: 'Nao visualizou',
    badgeClassName: 'border-slate-200 bg-slate-100 text-slate-700',
    icon: XCircle,
  },
});

function isAssignmentViewsUnavailable(error) {
  return error?.code === '42P01'
    || error?.code === 'PGRST205'
    || /assignment_views/i.test(error?.message || '');
}

function resolveAssignmentTrackingStatus({ assignment, submission, view }) {
  const submittedAt = submission?.submitted_at ? new Date(submission.submitted_at) : null;
  const dueDate = assignment?.due_date ? new Date(assignment.due_date) : null;
  const normalizedStatus = normalizeSubmissionStatus(submission?.status);
  const hasSubmission = Boolean(
    submission
    && (
      normalizedStatus === SUBMISSION_STATUSES.SENT
      || normalizedStatus === SUBMISSION_STATUSES.IN_REVIEW
      || normalizedStatus === SUBMISSION_STATUSES.GRADED
      || normalizedStatus === SUBMISSION_STATUSES.RETURNED
    )
  );

  if (hasSubmission) {
    const isLate = Boolean(submission?.is_late) || Boolean(
      dueDate
      && submittedAt
      && submittedAt.getTime() > dueDate.getTime()
    );

    return isLate ? 'late' : 'on_time';
  }

  return view ? 'viewed_pending' : 'not_viewed';
}

export default function Assignments({ globalSearch }) {
  const { profileType } = usePermissions();
  const { user: authUser } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [formData, setFormData] = useState({});
  const [showSubmissionForm, setShowSubmissionForm] = useState(false);
  const [selectedAssignmentForSubmission, setSelectedAssignmentForSubmission] = useState(null);
  const [submissionFormData, setSubmissionFormData] = useState({ content: '', file_urls: [] });
  const [uploadingFile, setUploadingFile] = useState(false);
  const [openingSubmissionFileKey, setOpeningSubmissionFileKey] = useState(null);
  const [activeTab, setActiveTab] = useState('todas');
  const [search, setSearch] = useState('');
  const [highlightedAssignmentId, setHighlightedAssignmentId] = useState(null);
  const [selectedAssignmentForTracking, setSelectedAssignmentForTracking] = useState(null);
  const [showTrackingDialog, setShowTrackingDialog] = useState(false);
  const [selectedSubmissionForReview, setSelectedSubmissionForReview] = useState(null);
  const [showSubmissionReviewDialog, setShowSubmissionReviewDialog] = useState(false);
  const [assignmentViewsUnavailable, setAssignmentViewsUnavailable] = useState(false);
  const fileRef = useRef(null);
  const initialSubmissionFilesRef = useRef([]);
  const pendingViewTrackingRef = useRef(new Set());

  const canManageAssignments = canManageAssignmentsByPermission(profileType);
  const isStudent = profileType === 'aluno';
  const queryClient = useQueryClient();

  const { data: myStudentRecord } = useQuery({
    queryKey: ['my-student', authUser?.email],
    queryFn: () => StudentApi.filter({ email: authUser.email }),
    enabled: isStudent && !!authUser?.email,
    select: (data) => data[0],
  });

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['assignments', isStudent, myStudentRecord?.current_class_id || null],
    enabled: !isStudent || !!myStudentRecord?.current_class_id,
    queryFn: () => (
      isStudent
        ? AssignmentApi.filter({
          status: ASSIGNMENT_STATUSES.PUBLISHED,
          class_id: myStudentRecord.current_class_id,
        }, '-created_at', 100)
        : AssignmentApi.list('-created_at')
    ),
  });

  const { data: classes = [] } = useQuery({
    queryKey: ['classes'],
    queryFn: () => ClassApi.list(),
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => SubjectApi.list(),
  });

  const { data: submissions = [] } = useQuery({
    queryKey: ['submissions', isStudent, myStudentRecord?.id],
    enabled: !isStudent || !!myStudentRecord?.id,
    queryFn: () => (
      isStudent
        ? SubmissionApi.filter({ student_id: myStudentRecord.id }, '-submitted_at', 100)
        : SubmissionApi.list('-submitted_at', 5000)
    ),
  });

  const { data: assignmentViews = [] } = useQuery({
    queryKey: ['assignment-views', isStudent, myStudentRecord?.id],
    enabled: !assignmentViewsUnavailable && (!isStudent || !!myStudentRecord?.id),
    queryFn: async () => {
      try {
        return isStudent
          ? await AssignmentViewApi.filter({ student_id: myStudentRecord.id }, '-last_viewed_at', 500)
          : await AssignmentViewApi.list('-last_viewed_at', 5000);
      } catch (error) {
        if (isAssignmentViewsUnavailable(error)) {
          setAssignmentViewsUnavailable(true);
          return [];
        }
        throw error;
      }
    },
  });

  const { data: students = [] } = useQuery({
    queryKey: ['students-for-assignments', isStudent],
    enabled: !isStudent,
    queryFn: () => StudentApi.list('-full_name', 500),
  });

  const createMutation = useMutation({
    mutationFn: (data) => AssignmentApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      setShowForm(false);
      setFormData({});
      toast.success('Atividade criada com sucesso!');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => AssignmentApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      setShowForm(false);
      setFormData({});
      setSelectedAssignment(null);
      toast.success('Atividade atualizada com sucesso!');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => AssignmentApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      toast.success('Atividade removida com sucesso!');
    },
  });

  const autoCloseMutation = useMutation({
    mutationFn: async (assignmentIds) => {
      return Promise.all(
        assignmentIds.map((id) => AssignmentApi.update(id, { status: ASSIGNMENT_STATUSES.CLOSED }))
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canManageAssignments) return;

    if (formData.is_group_work) {
      const minGroupSize = Number(formData.min_group_size);
      const maxGroupSize = Number(formData.max_group_size);

      if (!Number.isInteger(minGroupSize) || minGroupSize < 1) {
        toast.error('Informe o mínimo de integrantes com valor inteiro maior ou igual a 1.');
        return;
      }

      if (!Number.isInteger(maxGroupSize) || maxGroupSize < minGroupSize) {
        toast.error('Informe o máximo de integrantes com valor inteiro maior ou igual ao mínimo.');
        return;
      }
    }

    if (selectedAssignment) {
      updateMutation.mutate({
        id: selectedAssignment.id,
        data: {
          ...formData,
          min_group_size: formData.is_group_work ? Number(formData.min_group_size) : null,
          max_group_size: formData.is_group_work ? Number(formData.max_group_size) : null,
        },
      });
    } else {
      createMutation.mutate({
        ...formData,
        status: ASSIGNMENT_STATUSES.DRAFT,
        min_group_size: formData.is_group_work ? Number(formData.min_group_size) : null,
        max_group_size: formData.is_group_work ? Number(formData.max_group_size) : null,
      });
    }
  };

  const handleEdit = (assignment) => {
    if (!canManageAssignments) return;
    setSelectedAssignment(assignment);
    setFormData(assignment);
    setShowForm(true);
  };

  const handlePublish = (assignment) => {
    if (!canManageAssignments) return;
    updateMutation.mutate({
      id: assignment.id,
      data: buildPublishedAssignmentUpdate(assignment),
    });
  };

  const handleCloseAssignment = (assignment) => {
    if (!canManageAssignments) return;
    updateMutation.mutate({
      id: assignment.id,
      data: {
        ...assignment,
        status: ASSIGNMENT_STATUSES.CLOSED,
      },
    });
  };

  const handleReopenAssignment = (assignment) => {
    if (!canManageAssignments) return;
    updateMutation.mutate({
      id: assignment.id,
      data: buildPublishedAssignmentUpdate(assignment),
    });
  };

  const myStudentId = myStudentRecord?.id;
  const mySubmissionsByAssignmentId = useMemo(() => (
    submissions.reduce((accumulator, submission) => {
      if (submission.student_id === myStudentId) {
        accumulator[submission.assignment_id] = submission;
      }
      return accumulator;
    }, {})
  ), [myStudentId, submissions]);

  const classNameById = useMemo(
    () => Object.fromEntries(classes.map((classItem) => [classItem.id, classItem.name])),
    [classes]
  );
  const subjectNameById = useMemo(
    () => Object.fromEntries(subjects.map((subject) => [subject.id, subject.name])),
    [subjects]
  );
  const submissionCountByAssignmentId = useMemo(() => (
    submissions.reduce((accumulator, submission) => {
      accumulator[submission.assignment_id] = (accumulator[submission.assignment_id] || 0) + 1;
      return accumulator;
    }, {})
  ), [submissions]);

  const assignmentViewsByAssignmentAndStudent = useMemo(() => {
    return assignmentViews.reduce((accumulator, view) => {
      if (!view?.assignment_id || !view?.student_id) {
        return accumulator;
      }

      accumulator[`${view.assignment_id}:${view.student_id}`] = view;
      return accumulator;
    }, {});
  }, [assignmentViews]);

  const submissionsByAssignmentAndStudent = useMemo(() => {
    return submissions.reduce((accumulator, submission) => {
      if (!submission?.assignment_id || !submission?.student_id) {
        return accumulator;
      }

      accumulator[`${submission.assignment_id}:${submission.student_id}`] = submission;
      return accumulator;
    }, {});
  }, [submissions]);

  const openSubmissionForm = (assignment) => {
    const existing = mySubmissionsByAssignmentId[assignment.id];
    const normalizedFiles = normalizeStorageFileReferences(existing?.file_urls);

    initialSubmissionFilesRef.current = normalizedFiles;
    setSelectedAssignmentForSubmission(assignment);
    setSubmissionFormData({
      content: existing?.content || '',
      file_urls: normalizedFiles,
    });
    setShowSubmissionForm(true);
  };

  const handleUploadSubmissionFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!SUBMISSION_ALLOWED_TYPES.includes(file.type)) {
      toast.error('Formato inválido. Envie apenas PDF, DOC ou DOCX.');
      event.target.value = '';
      return;
    }

    if (file.size > SUBMISSION_MAX_SIZE) {
      toast.error('Arquivo muito grande. Máximo de 10 MB.');
      event.target.value = '';
      return;
    }

    setUploadingFile(true);
    try {
      const folder = authUser?.id ? `submissions/${authUser.id}` : 'submissions';
      const path = await uploadStorageFile({ file, folder, bucket: BUCKET });
      setSubmissionFormData((prev) => ({
        ...prev,
        file_urls: [...(prev.file_urls || []), path],
      }));
      toast.success('Arquivo anexado.');
    } catch (err) {
      toast.error(`Falha no upload: ${err.message}`);
    } finally {
      setUploadingFile(false);
      event.target.value = '';
    }
  };

  const removeSubmissionFile = async (fileRefToRemove) => {
    const fileKey = getStorageFileKey(fileRefToRemove);
    const isPersistedFile = initialSubmissionFilesRef.current.some(
      (fileRef) => getStorageFileKey(fileRef) === fileKey
    );

    if (!isPersistedFile) {
      try {
        await deleteStorageFile(fileRefToRemove, { bucket: BUCKET });
      } catch (error) {
        toast.error(`Falha ao remover ${getStoredFileName(fileRefToRemove)}: ${error.message}`);
        return;
      }
    }

    setSubmissionFormData((prev) => ({
      ...prev,
      file_urls: (prev.file_urls || []).filter((fileRef) => getStorageFileKey(fileRef) !== fileKey),
    }));
  };

  const openSubmissionFile = async (fileRef) => {
    const fileKey = getStorageFileKey(fileRef);
    if (!fileKey || openingSubmissionFileKey === fileKey) {
      return;
    }

    setOpeningSubmissionFileKey(fileKey);

    try {
      const url = await resolveStorageFileUrl(fileRef, { bucket: BUCKET });
      if (typeof window !== 'undefined' && url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      toast.error(error?.message || 'Nao foi possivel abrir o anexo agora.');
    } finally {
      setOpeningSubmissionFileKey(null);
    }
  };

  const closeSubmissionForm = async () => {
    const transientFiles = diffRemovedStorageFileReferences(
      submissionFormData.file_urls || [],
      initialSubmissionFilesRef.current,
      BUCKET
    );

    if (transientFiles.length > 0) {
      try {
        await deleteStorageFiles(transientFiles, { bucket: BUCKET });
      } catch (error) {
        toast.error(`Falha ao descartar anexos temporários: ${error.message}`);
        return;
      }
    }

    initialSubmissionFilesRef.current = [];
    setOpeningSubmissionFileKey(null);
    setShowSubmissionForm(false);
    setSelectedAssignmentForSubmission(null);
    setSubmissionFormData({ content: '', file_urls: [] });
  };

  const submitMutation = useMutation({
    mutationFn: async ({ assignment, payload }) => {
      const existing = mySubmissionsByAssignmentId[assignment.id];
      if (existing) return SubmissionApi.update(existing.id, payload);
      return SubmissionApi.create(payload);
    },
    onSuccess: async (_data, variables) => {
      if (variables?.removedPersistedFiles?.length > 0) {
        try {
          await deleteStorageFiles(variables.removedPersistedFiles, { bucket: BUCKET });
        } catch (error) {
          toast.error(`A resposta foi salva, mas houve falha ao limpar anexos antigos: ${error.message}`);
        }
      }

      initialSubmissionFilesRef.current = [];
      setOpeningSubmissionFileKey(null);
      queryClient.invalidateQueries({ queryKey: ['submissions'] });
      setShowSubmissionForm(false);
      setSelectedAssignmentForSubmission(null);
      setSubmissionFormData({ content: '', file_urls: [] });
      toast.success('Resposta enviada com sucesso!');
    },
    onError: (error) => {
      toast.error(error?.message || 'Não foi possível enviar a resposta.');
    },
  });

  const handleSubmitResponse = (e) => {
    e.preventDefault();
    if (!isStudent || !myStudentId || !selectedAssignmentForSubmission) return;

    const submittedAt = new Date();
    const dueDate = selectedAssignmentForSubmission.due_date
      ? new Date(selectedAssignmentForSubmission.due_date)
      : null;
    const isLate = Boolean(dueDate && submittedAt.getTime() > dueDate.getTime());

    if (isLate && !selectedAssignmentForSubmission.allow_late_submission) {
      toast.error('O prazo da atividade ja foi encerrado e nao aceita entrega com atraso.');
      return;
    }

    const normalizedFileRefs = normalizeStorageFileReferences(submissionFormData.file_urls);

    submitMutation.mutate({
      assignment: selectedAssignmentForSubmission,
      payload: {
        assignment_id: selectedAssignmentForSubmission.id,
        student_id: myStudentId,
        content: submissionFormData.content || '',
        file_urls: normalizedFileRefs,
        submitted_at: submittedAt.toISOString(),
        is_late: isLate,
        status: 'enviado',
      },
      removedPersistedFiles: diffRemovedStorageFileReferences(
        initialSubmissionFilesRef.current,
        normalizedFileRefs,
        BUCKET
      ),
    });
  };

  const deferredSearch = useDeferredValue(search);
  const normalizedSearch = useMemo(() => deferredSearch.trim().toLowerCase(), [deferredSearch]);
  const baseAssignments = useMemo(
    () => (
      isStudent
        ? assignments.filter((assignment) => (
          isAssignmentPublished(assignment)
          && !shouldAutoCloseAssignment(assignment)
        ))
        : assignments
    ),
    [assignments, isStudent]
  );

  useEffect(() => {
    if (!canManageAssignments || autoCloseMutation.isPending) {
      return;
    }

    const now = new Date();
    const assignmentIdsToClose = assignments
      .filter((assignment) => shouldAutoCloseAssignment(assignment, now))
      .map((assignment) => assignment.id);

    if (assignmentIdsToClose.length === 0) {
      return;
    }

    autoCloseMutation.mutate(assignmentIdsToClose);
  }, [assignments, autoCloseMutation, canManageAssignments]);

  useEffect(() => {
    if (assignmentViewsUnavailable || !isStudent || !myStudentId || baseAssignments.length === 0) {
      return;
    }

    const viewedAssignmentIds = new Set(
      assignmentViews
        .filter((view) => view?.student_id === myStudentId)
        .map((view) => view.assignment_id)
    );

    const assignmentsToTrack = baseAssignments.filter((assignment) => (
      isAssignmentPublished(assignment)
      && !viewedAssignmentIds.has(assignment.id)
      && !pendingViewTrackingRef.current.has(assignment.id)
    ));

    if (assignmentsToTrack.length === 0) {
      return;
    }

    let cancelled = false;
    const viewedAt = new Date().toISOString();

    assignmentsToTrack.forEach((assignment) => {
      pendingViewTrackingRef.current.add(assignment.id);
    });

    void Promise.all(assignmentsToTrack.map(async (assignment) => {
      try {
        await AssignmentViewApi.upsert({
          assignment_id: assignment.id,
          student_id: myStudentId,
          first_viewed_at: viewedAt,
          last_viewed_at: viewedAt,
          view_count: 1,
        }, {
          onConflict: 'assignment_id,student_id',
        });
      } catch (error) {
        if (isAssignmentViewsUnavailable(error)) {
          setAssignmentViewsUnavailable(true);
          return;
        }
        throw error;
      } finally {
        if (!cancelled) {
          pendingViewTrackingRef.current.delete(assignment.id);
        }
      }
    }));

    return () => {
      cancelled = true;
    };
  }, [assignmentViews, assignmentViewsUnavailable, baseAssignments, isStudent, myStudentId]);
  const filteredAssignments = useMemo(() => (
    baseAssignments
      .filter((assignment) => {
        if (activeTab === 'todas') return true;
        if (activeTab === 'publicadas') return isAssignmentPublished(assignment);
        if (activeTab === 'rascunhos') return assignment.status === ASSIGNMENT_STATUSES.DRAFT;
        if (activeTab === 'encerradas') return assignment.status === ASSIGNMENT_STATUSES.CLOSED;
        return true;
      })
      .filter((assignment) => {
        if (!normalizedSearch) return true;

        return [
          assignment.title,
          assignment.description,
          assignment.instructions,
          assignment.type,
          assignment.status,
          classNameById[assignment.class_id] || '-',
          subjectNameById[assignment.subject_id] || '-',
        ].some((value) => String(value ?? '').toLowerCase().includes(normalizedSearch));
      })
  ), [activeTab, baseAssignments, classNameById, normalizedSearch, subjectNameById]);

  const typeLabels = {
    trabalho: 'Trabalho',
    exercicio: 'Exercício',
    projeto: 'Projeto',
    pesquisa: 'Pesquisa',
    redacao: 'Redação',
    apresentacao: 'Apresentação',
    outro: 'Outro',
  };

  const selectedAssignmentTrackingRows = useMemo(() => {
    if (!selectedAssignmentForTracking) {
      return [];
    }

    return students
      .filter((student) => student.current_class_id === selectedAssignmentForTracking.class_id)
      .map((student) => {
        const submission = submissionsByAssignmentAndStudent[
          `${selectedAssignmentForTracking.id}:${student.id}`
        ] || null;
        const view = assignmentViewsByAssignmentAndStudent[
          `${selectedAssignmentForTracking.id}:${student.id}`
        ] || null;
        const trackingStatus = resolveAssignmentTrackingStatus({
          assignment: selectedAssignmentForTracking,
          submission,
          view,
        });

        return {
          student,
          submission,
          view,
          trackingStatus,
        };
      })
      .sort((left, right) => left.student.full_name.localeCompare(right.student.full_name, 'pt-BR'));
  }, [assignmentViewsByAssignmentAndStudent, selectedAssignmentForTracking, students, submissionsByAssignmentAndStudent]);

  const selectedAssignmentTrackingSummary = useMemo(() => {
    return selectedAssignmentTrackingRows.reduce((accumulator, row) => {
      accumulator[row.trackingStatus] = (accumulator[row.trackingStatus] || 0) + 1;
      return accumulator;
    }, {
      on_time: 0,
      late: 0,
      viewed_pending: 0,
      not_viewed: 0,
    });
  }, [selectedAssignmentTrackingRows]);

  const selectedSubmissionAttachments = useMemo(() => (
    normalizeStorageFileReferences(selectedSubmissionForReview?.file_urls || [], BUCKET)
  ), [selectedSubmissionForReview]);

  const openSubmissionReview = (row) => {
    if (!row?.submission) return;

    setSelectedSubmissionForReview({
      ...row.submission,
      studentName: row.student?.full_name || 'Aluno',
      registrationNumber: row.student?.registration_number || null,
    });
    setShowSubmissionReviewDialog(true);
  };

  const closeSubmissionReview = () => {
    setShowSubmissionReviewDialog(false);
    setSelectedSubmissionForReview(null);
  };

  useGlobalSearchNavigation({
    entityKey: 'assignments',
    globalSearch,
    isReady: !isLoading,
    onNavigate: ({ query, recordId }) => {
      setActiveTab('todas');
      setShowForm(false);
      setShowSubmissionForm(false);
      setSelectedAssignment(null);
      setSelectedAssignmentForSubmission(null);
      setSearch(query || '');
      setHighlightedAssignmentId(recordId || null);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <RenderProfiler id="Assignments">
      <div className="space-y-6">
      <PageHeader
          backTo="/Dashboard"
          backLabel="Dashboard"
        title="Atividades"
        subtitle={`${baseAssignments.length} atividades`}
        action={canManageAssignments ? () => { setSelectedAssignment(null); setFormData({}); setShowForm(true); } : undefined}
        actionLabel={canManageAssignments ? "Nova Atividade" : undefined}
      />

      {!isStudent && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="todas">Todas</TabsTrigger>
            <TabsTrigger value="publicadas">Publicadas</TabsTrigger>
            <TabsTrigger value="rascunhos">Rascunhos</TabsTrigger>
            <TabsTrigger value="encerradas">Encerradas</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      <div className="app-search-field max-w-xl">
        <Search className="w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por atividade, turma, disciplina ou status..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="h-auto border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAssignments.map((assignment) => {
          const isOverdue = isPast(new Date(assignment.due_date));

          return (
            <Card
              key={assignment.id}
              className={cn(
                "hover:shadow-lg transition-shadow",
                highlightedAssignmentId === assignment.id && "ring-2 ring-indigo-300 ring-offset-2"
              )}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-indigo-500" />
                    <Badge variant="secondary">
                      {typeLabels[assignment.type] || assignment.type}
                    </Badge>
                  </div>
                  <StatusBadge status={assignment.status} />
                </div>
                <CardTitle className="text-lg mt-2">{assignment.title}</CardTitle>
                <p className="text-sm text-slate-500 line-clamp-2">
                  {assignment.description || 'Sem descrição'}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4 text-sm text-slate-600">
                  <span>{classNameById[assignment.class_id] || '-'}</span>
                  <span>•</span>
                  <span>{subjectNameById[assignment.subject_id] || '-'}</span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className={cn(
                    "flex items-center gap-1",
                    isOverdue && isAssignmentPublished(assignment) ? "text-rose-500" : "text-slate-500"
                  )}>
                    <Calendar className="w-4 h-4" />
                    <span>
                      {assignment.due_date
                        ? format(new Date(assignment.due_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                        : '-'
                      }
                    </span>
                  </div>
                  {canManageAssignments && (
                    <div className="flex items-center gap-1 text-slate-500">
                      <Users className="w-4 h-4" />
                      <span>{submissionCountByAssignmentId[assignment.id] || 0} entregas</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-2 border-t">
                  {canManageAssignments && assignment.status === ASSIGNMENT_STATUSES.DRAFT && (
                    <Button
                      size="sm"
                      onClick={() => handlePublish(assignment)}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      Publicar
                    </Button>
                  )}
                  {canManageAssignments && assignment.status === ASSIGNMENT_STATUSES.PUBLISHED && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (confirm('Tem certeza que deseja encerrar esta atividade?')) {
                          handleCloseAssignment(assignment);
                        }
                      }}
                      className="border-amber-200 text-amber-700 hover:bg-amber-50"
                      >
                      Encerrar
                    </Button>
                  )}
                  {canManageAssignments && assignment.status === ASSIGNMENT_STATUSES.CLOSED && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (confirm('Tem certeza que deseja reabrir esta atividade?')) {
                          handleReopenAssignment(assignment);
                        }
                      }}
                      className="border-sky-200 text-sky-700 hover:bg-sky-50"
                    >
                      Reabrir
                    </Button>
                  )}
                  {canManageAssignments && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedAssignmentForTracking(assignment);
                          setShowTrackingDialog(true);
                        }}
                      >
                        Acompanhar
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(assignment)}
                        aria-label={`Editar atividade ${assignment.title}`}
                        data-tooltip={`Editar atividade ${assignment.title}`}
                      >
                        <Edit className="w-4 h-4 text-slate-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm('Tem certeza que deseja excluir esta atividade?')) {
                            deleteMutation.mutate(assignment.id);
                          }
                        }}
                        aria-label={`Excluir atividade ${assignment.title}`}
                        data-tooltip={`Excluir atividade ${assignment.title}`}
                      >
                        <Trash2 className="w-4 h-4 text-rose-500" />
                      </Button>
                    </>
                  )}
                  {isStudent && (
                    <Button
                      size="sm"
                      className="bg-indigo-600 hover:bg-indigo-700"
                      onClick={() => openSubmissionForm(assignment)}
                      disabled={!myStudentId}
                    >
                      Responder
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filteredAssignments.length === 0 && (
          <div className="col-span-full flex items-center justify-center h-48 text-slate-500">
            Nenhuma atividade encontrada
          </div>
        )}
      </div>

      {/* Form Modal */}
      <Dialog open={canManageAssignments && showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedAssignment ? 'Editar Atividade' : 'Nova Atividade'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input
                value={formData.title || ''}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Turma *</Label>
                <Select
                  value={formData.class_id || ''}
                  onValueChange={(value) => setFormData({ ...formData, class_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map(cls => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Disciplina *</Label>
                <Select
                  value={formData.subject_id || ''}
                  onValueChange={(value) => setFormData({ ...formData, subject_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map(subject => (
                      <SelectItem key={subject.id} value={subject.id}>
                        {subject.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo</Label>
                <Select
                  value={formData.type || ''}
                  onValueChange={(value) => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trabalho">Trabalho</SelectItem>
                    <SelectItem value="exercicio">Exercício</SelectItem>
                    <SelectItem value="projeto">Projeto</SelectItem>
                    <SelectItem value="pesquisa">Pesquisa</SelectItem>
                    <SelectItem value="redacao">Redação</SelectItem>
                    <SelectItem value="apresentacao">Apresentação</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Bimestre</Label>
                <Select
                  value={formData.bimester?.toString() || ''}
                  onValueChange={(value) => setFormData({ ...formData, bimester: Number(value) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1º Bimestre</SelectItem>
                    <SelectItem value="2">2º Bimestre</SelectItem>
                    <SelectItem value="3">3º Bimestre</SelectItem>
                    <SelectItem value="4">4º Bimestre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data de Entrega *</Label>
                <Input
                  type="datetime-local"
                  value={formData.due_date || ''}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Nota Máxima</Label>
                <Input
                  type="number"
                  value={formData.max_score || 10}
                  onChange={(e) => setFormData({ ...formData, max_score: Number(e.target.value) })}
                />
              </div>
            </div>
            <div>
              <Label>Instruções</Label>
              <Textarea
                value={formData.instructions || ''}
                onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                rows={4}
                placeholder="Instruções detalhadas para a atividade..."
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.allow_late_submission || false}
                  onCheckedChange={(checked) => setFormData({ ...formData, allow_late_submission: checked })}
                  aria-label="Permitir entrega atrasada"
                  data-tooltip="Permitir entrega atrasada"
                />
                <Label>Permitir entrega atrasada</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_group_work || false}
                  onCheckedChange={(checked) => setFormData({
                    ...formData,
                    is_group_work: checked,
                    min_group_size: checked ? (formData.min_group_size || 1) : null,
                    max_group_size: checked ? (formData.max_group_size || 4) : null,
                  })}
                  aria-label="Trabalho em grupo"
                  data-tooltip="Trabalho em grupo"
                />
                <Label>Trabalho em grupo</Label>
              </div>
            </div>

            {formData.is_group_work && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Mínimo de integrantes *</Label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={formData.min_group_size ?? ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      min_group_size: e.target.value === '' ? '' : Number(e.target.value),
                    })}
                    placeholder="Ex: 1"
                    required
                  />
                </div>
                <div>
                  <Label>Máximo de integrantes *</Label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={formData.max_group_size ?? ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      max_group_size: e.target.value === '' ? '' : Number(e.target.value),
                    })}
                    placeholder="Ex: 4"
                    required
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={createMutation.isPending}>
                {selectedAssignment ? 'Salvar Alterações' : 'Criar Atividade'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isStudent && showSubmissionForm} onOpenChange={(open) => {
        if (!open && !submitMutation.isPending) {
          void closeSubmissionForm();
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Responder Atividade</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitResponse} className="space-y-4">
            <div>
              <Label>Resposta</Label>
              <Textarea
                value={submissionFormData.content || ''}
                onChange={(e) => setSubmissionFormData((prev) => ({ ...prev, content: e.target.value }))}
                rows={5}
                placeholder="Digite sua resposta..."
              />
            </div>

            <div className="space-y-2">
              <Label>Anexos (PDF, DOC, DOCX)</Label>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={handleUploadSubmissionFile}
              />
              <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploadingFile}>
                <Upload className="w-4 h-4 mr-2" />
                {uploadingFile ? 'Enviando...' : 'Anexar arquivo'}
              </Button>

              {(submissionFormData.file_urls || []).length > 0 && (
                <div className="space-y-2">
                  {(submissionFormData.file_urls || []).map((fileRef) => {
                    const fileKey = getStorageFileKey(fileRef, BUCKET) || getStoredFileName(fileRef, BUCKET);
                    const isOpening = openingSubmissionFileKey === fileKey;

                    return (
                      <div key={fileKey} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <button
                          type="button"
                          onClick={() => void openSubmissionFile(fileRef)}
                          data-tooltip={`Abrir anexo ${getStoredFileName(fileRef, BUCKET)}`}
                          className="min-w-0 text-left text-sm font-medium text-slate-700 transition hover:text-indigo-600"
                        >
                          <span className="block truncate">{getStoredFileName(fileRef, BUCKET)}</span>
                          <span className="block text-xs text-slate-500">
                            {isOpening ? 'Abrindo anexo...' : 'Abrir arquivo'}
                          </span>
                        </button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => void removeSubmissionFile(fileRef)}
                          className="h-8 w-8 flex-shrink-0 text-rose-500"
                          aria-label={`Remover anexo ${getStoredFileName(fileRef, BUCKET)}`}
                          data-tooltip={`Remover anexo ${getStoredFileName(fileRef, BUCKET)}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => void closeSubmissionForm()} disabled={submitMutation.isPending}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={submitMutation.isPending || !myStudentId}>
                {submitMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Enviar Resposta
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!isStudent && showTrackingDialog} onOpenChange={setShowTrackingDialog}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedAssignmentForTracking
                ? `Acompanhamento: ${selectedAssignmentForTracking.title}`
                : 'Acompanhamento de entregas'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            {Object.entries(TRACKING_STATUS_META).map(([statusKey, meta]) => {
              const Icon = meta.icon;
              return (
                <Card key={statusKey} className="border-slate-200">
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="text-sm text-slate-500">{meta.label}</p>
                      <p className="text-2xl font-semibold text-slate-900">
                        {selectedAssignmentTrackingSummary[statusKey] || 0}
                      </p>
                    </div>
                    <div className={cn('rounded-full p-2', meta.badgeClassName)}>
                      <Icon className="h-4 w-4" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span>Aluno</span>
              <span>Entrega</span>
              <span>Visualizacao</span>
              <span>Detalhes</span>
            </div>

            <div className="divide-y divide-slate-100">
              {selectedAssignmentTrackingRows.map(({ student, submission, view, trackingStatus }) => {
                const meta = TRACKING_STATUS_META[trackingStatus];
                const Icon = meta.icon;

                return (
                  <div
                    key={student.id}
                    className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 px-4 py-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">{student.full_name}</p>
                      <p className="truncate text-xs text-slate-500">{student.registration_number || '-'}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      {submission ? (
                        <>
                          <Badge className={cn('border', meta.badgeClassName)}>
                            <Icon className="mr-1 h-3.5 w-3.5" />
                            {meta.label}
                          </Badge>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => openSubmissionReview({ student, submission })}
                            className="h-8"
                          >
                            Ver resposta
                          </Button>
                        </>
                      ) : (
                        <span className="text-slate-500">Nao entregou</span>
                      )}
                    </div>

                    <div className="flex items-center">
                      {view ? (
                        <Badge className="border border-sky-200 bg-sky-50 text-sky-700">
                          <Eye className="mr-1 h-3.5 w-3.5" />
                          Visualizou
                        </Badge>
                      ) : (
                        <Badge className="border border-slate-200 bg-slate-100 text-slate-600">
                          <XCircle className="mr-1 h-3.5 w-3.5" />
                          Nao visualizou
                        </Badge>
                      )}
                    </div>

                    <div className="min-w-0 text-xs text-slate-500">
                      <p>
                        {submission?.submitted_at
                          ? `Enviado em ${format(new Date(submission.submitted_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
                          : 'Sem envio registrado'}
                      </p>
                      <p>
                        {view?.last_viewed_at
                          ? `Ultima visualizacao ${format(new Date(view.last_viewed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
                          : 'Sem visualizacao registrada'}
                      </p>
                      {submission?.content ? (
                        <p className="mt-2 line-clamp-2 text-slate-600">
                          {submission.content}
                        </p>
                      ) : null}
                    </div>

                  </div>
                );
              })}

              {selectedAssignmentTrackingRows.length === 0 && (
                <div className="px-4 py-10 text-center text-sm text-slate-500">
                  Nenhum aluno vinculado a esta turma.
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showSubmissionReviewDialog} onOpenChange={(open) => {
        if (!open) {
          closeSubmissionReview();
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedSubmissionForReview
                ? `Resposta de ${selectedSubmissionForReview.studentName}`
                : 'Resposta do aluno'}
            </DialogTitle>
          </DialogHeader>

          {selectedSubmissionForReview ? (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Card className="border-slate-200">
                  <CardContent className="p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Aluno</p>
                    <p className="mt-1 font-medium text-slate-900">{selectedSubmissionForReview.studentName}</p>
                    {selectedSubmissionForReview.registrationNumber ? (
                      <p className="text-sm text-slate-500">{selectedSubmissionForReview.registrationNumber}</p>
                    ) : null}
                  </CardContent>
                </Card>
                <Card className="border-slate-200">
                  <CardContent className="p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Status</p>
                    <p className="mt-1 font-medium text-slate-900">
                      {selectedSubmissionForReview.status || 'enviado'}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-slate-200">
                  <CardContent className="p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Envio</p>
                    <p className="mt-1 font-medium text-slate-900">
                      {selectedSubmissionForReview.submitted_at
                        ? format(new Date(selectedSubmissionForReview.submitted_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                        : 'Sem data'}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-800">Resposta do aluno</p>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700 whitespace-pre-wrap">
                  {selectedSubmissionForReview.content?.trim()
                    ? selectedSubmissionForReview.content
                    : 'O aluno não enviou resposta textual.'}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Paperclip className="h-4 w-4 text-slate-500" />
                  <p className="text-sm font-semibold text-slate-800">Arquivos anexados</p>
                </div>

                {selectedSubmissionAttachments.length > 0 ? (
                  <div className="space-y-2">
                    {selectedSubmissionAttachments.map((fileRef) => {
                      const fileKey = getStorageFileKey(fileRef, BUCKET) || getStoredFileName(fileRef, BUCKET);
                      const isOpening = openingSubmissionFileKey === fileKey;

                      return (
                        <div key={fileKey} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-800">
                              {getStoredFileName(fileRef, BUCKET)}
                            </p>
                            <p className="text-xs text-slate-500">Anexo enviado pelo aluno</p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void openSubmissionFile(fileRef)}
                            disabled={isOpening}
                          >
                            {isOpening ? 'Abrindo...' : 'Abrir arquivo'}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                    Nenhum arquivo anexado nesta resposta.
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      </div>
    </RenderProfiler>
  );
}
