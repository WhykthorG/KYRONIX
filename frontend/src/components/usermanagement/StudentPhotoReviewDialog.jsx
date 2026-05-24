// Bu proje tamamen Whykthor GSV taraf─▒ndan yap─▒lm─▒┼ƒt─▒r.
import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { StudentPhotoRequestApi } from '@/services/supabaseApi';
import { useAuth } from '@/lib/AuthContext';
import { combineDateAndTime, reviewStudentPhotoRequest } from '@/lib/studentPhotoRequests';
import { resolveStorageFileUrl } from '@/lib/storageFiles';
import { syncAvatarToAcademicRecords } from '@/lib/userAvatar';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, Clock3, Eye, Loader2, XCircle } from 'lucide-react';

function formatDateTime(value) {
  if (!value) return 'Sem data';
  try {
    return new Date(value).toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return String(value);
  }
}

function getDefaultReviewDate() {
  const next = new Date();
  next.setDate(next.getDate() + 1);
  next.setHours(8, 0, 0, 0);
  return next;
}

function RequestPhotoPreview({ request }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Foto atual</p>
        <div className="flex items-center gap-3">
          <Avatar className="h-16 w-16 border border-slate-200">
            <ResolvedAvatarImage value={request.current_avatar_url} alt={request.student_full_name} />
            <AvatarFallback className="bg-slate-200 text-slate-700">
              {request.student_full_name?.charAt(0) || '?'}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-900">{request.student_full_name}</p>
            <p className="truncate text-xs text-slate-500">{request.student_email}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-indigo-500">Foto solicitada</p>
        <Avatar className="h-16 w-16 border border-indigo-200">
          <ResolvedAvatarImage value={request.requested_avatar_url} alt={request.student_full_name} />
          <AvatarFallback className="bg-indigo-200 text-indigo-700">
            {request.student_full_name?.charAt(0) || '?'}
          </AvatarFallback>
        </Avatar>
      </div>
    </div>
  );
}

function ResolvedAvatarImage({ value, alt }) {
  const [resolvedSrc, setResolvedSrc] = useState('');

  useEffect(() => {
    let active = true;

    if (!value) {
      setResolvedSrc('');
      return () => {
        active = false;
      };
    }

    if (typeof value === 'string' && value.startsWith('data:')) {
      setResolvedSrc(value);
      return () => {
        active = false;
      };
    }

    if (typeof value === 'string' && /^https?:\/\//i.test(value)) {
      setResolvedSrc(value);
      return () => {
        active = false;
      };
    }

    (async () => {
      try {
        const url = await resolveStorageFileUrl(value);
        if (active) {
          setResolvedSrc(url || '');
        }
      } catch {
        if (active) {
          setResolvedSrc('');
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [value]);

  return <AvatarImage src={resolvedSrc || undefined} alt={alt} />;
}

export default function StudentPhotoReviewDialog({ open, onOpenChange }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [denyRequestId, setDenyRequestId] = useState(null);
  const [denialReason, setDenialReason] = useState('');
  const [reviewDate, setReviewDate] = useState(getDefaultReviewDate());
  const [reviewTime, setReviewTime] = useState('08:00');

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['student-photo-requests', 'pending'],
    queryFn: () => StudentPhotoRequestApi.filter({ status: 'pendente' }, '-created_at', 50),
    enabled: open,
    staleTime: 30 * 1000,
  });

  useEffect(() => {
    if (!open) {
      setDenyRequestId(null);
      setDenialReason('');
      setReviewDate(getDefaultReviewDate());
      setReviewTime('08:00');
    }
  }, [open]);

  const invalidateRequests = async () => {
    await queryClient.invalidateQueries({ queryKey: ['student-photo-requests'] });
    await queryClient.invalidateQueries({ queryKey: ['start-menu-photo-request'] });
    await queryClient.invalidateQueries({ queryKey: ['start-menu-profile'] });
    await queryClient.invalidateQueries({ queryKey: ['userProfiles'] });
    await queryClient.invalidateQueries({ queryKey: ['students'] });
  };

  const approveMutation = useMutation({
    mutationFn: async (request) => {
      await reviewStudentPhotoRequest({
        requestId: request.id,
        action: 'aprovada',
        reviewerEmail: user?.email,
        reviewerName: user?.user_metadata?.full_name || user?.user_metadata?.name || null,
      });

      try {
        await syncAvatarToAcademicRecords({
          profileType: 'aluno',
          userEmail: request.student_email,
          avatarUrl: request.requested_avatar_url || null,
        });
      } catch (avatarError) {
        console.warn('[student-photo-review] Falha ao sincronizar foto aprovada no cadastro do aluno.', avatarError);
      }
    },
    onSuccess: async () => {
      toast.success('Foto aprovada e aplicada no perfil.');
      await invalidateRequests();
    },
    onError: (error) => {
      toast.error(error?.message || 'Nao foi possivel aprovar a foto.');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ request, reason, nextAllowedAt }) => reviewStudentPhotoRequest({
      requestId: request.id,
      action: 'negada',
      denialReason: reason,
      nextAllowedAt,
      reviewerEmail: user?.email,
      reviewerName: user?.user_metadata?.full_name || user?.user_metadata?.name || null,
    }),
    onSuccess: async () => {
      toast.success('Solicitação negada.');
      setDenyRequestId(null);
      setDenialReason('');
      setReviewDate(getDefaultReviewDate());
      setReviewTime('08:00');
      await invalidateRequests();
    },
    onError: (error) => {
      toast.error(error?.message || 'Nao foi possivel negar a solicitação.');
    },
  });

  const pendingCount = requests.length;

  const handleRejectStart = (request) => {
    setDenyRequestId(request.id);
    setDenialReason('');
    setReviewDate(getDefaultReviewDate());
    setReviewTime('08:00');
  };

  const handleRejectSubmit = (request) => {
    const nextAllowedAt = combineDateAndTime(reviewDate, reviewTime);
    rejectMutation.mutate({
      request,
      reason: denialReason,
      nextAllowedAt,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl overflow-hidden border-slate-200 bg-white">
        <DialogHeader>
          <DialogTitle>Solicitações de foto do aluno</DialogTitle>
          <DialogDescription>
            Revise a imagem enviada, aprove com um clique ou negue informando o próximo momento permitido para nova solicitação.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <Eye className="h-4 w-4 text-slate-500" />
          <span>{pendingCount} solicitação{pendingCount === 1 ? '' : 'ões'} pendente{pendingCount === 1 ? '' : 's'}</span>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 px-2 py-8 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando solicitações...
          </div>
        ) : requests.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-sm text-slate-500">
            Nenhuma solicitação aguardando revisão no momento.
          </div>
        ) : (
          <div className="max-h-[68vh] space-y-4 overflow-y-auto pr-1">
            {requests.map((request) => {
              const isRejecting = denyRequestId === request.id;

              return (
                <div key={request.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{request.student_full_name}</p>
                        <p className="text-xs text-slate-500">{request.student_email}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="gap-1.5 border-amber-200 bg-amber-50 text-amber-700">
                          <Clock3 className="h-3.5 w-3.5" />
                          Pendente
                        </Badge>
                        <Badge variant="outline" className="gap-1.5 border-slate-200 bg-slate-50 text-slate-600">
                          {formatDateTime(request.created_at)}
                        </Badge>
                      </div>
                    </div>

                    <RequestPhotoPreview request={request} />

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        onClick={() => approveMutation.mutate(request)}
                        disabled={approveMutation.isPending || rejectMutation.isPending}
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Aprovar
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleRejectStart(request)}
                        disabled={approveMutation.isPending || rejectMutation.isPending}
                        className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Negar
                      </Button>
                    </div>

                    {isRejecting && (
                      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4">
                        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-rose-700">
                          <AlertTriangle className="h-4 w-4" />
                          Recusa com bloqueio de nova solicitação
                        </div>

                        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                          <div className="space-y-3">
                            <div>
                              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-rose-700">
                                Motivo da recusa
                              </p>
                              <Textarea
                                value={denialReason}
                                onChange={(event) => setDenialReason(event.target.value)}
                                placeholder="Opcional: explique por que a foto foi negada"
                                className="border-rose-200 bg-white"
                              />
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                              <div>
                                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-rose-700">
                                  Nova tentativa em
                                </p>
                                <Input
                                  type="time"
                                  value={reviewTime}
                                  onChange={(event) => setReviewTime(event.target.value)}
                                  className="border-rose-200 bg-white"
                                />
                              </div>

                              <div className="rounded-2xl border border-rose-200 bg-white p-3">
                                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-rose-700">
                                  Data escolhida
                                </p>
                                <p className="mt-1 text-sm text-slate-700">
                                  {reviewDate ? reviewDate.toLocaleDateString('pt-BR') : 'Selecione no calendário'}
                                </p>
                                <p className="text-xs text-slate-500">
                                  A liberação volta exatamente no horário definido.
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                onClick={() => handleRejectSubmit(request)}
                                disabled={rejectMutation.isPending}
                                className="bg-rose-600 hover:bg-rose-700"
                              >
                                {rejectMutation.isPending ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : null}
                                Confirmar recusa
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setDenyRequestId(null)}
                              >
                                Cancelar
                              </Button>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-rose-200 bg-white p-3">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-rose-700">
                              Calendário
                            </p>
                            <CalendarPicker
                              mode="single"
                              selected={reviewDate}
                              onSelect={(date) => setReviewDate(date || getDefaultReviewDate())}
                              className="rounded-xl border border-rose-100 bg-white p-2"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
