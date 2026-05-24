import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { StudentPhotoRequestApi } from '@/services/supabaseApi';
import { useAuth } from '@/lib/AuthContext';
import {
  AVATAR_IMAGE_OPTIMIZATION_DEFAULTS,
  OPTIMIZABLE_IMAGE_MIME_TYPES,
  optimizeImageForUpload,
  shouldOptimizeImageBeforeUpload,
} from '@/lib/imageUploadOptimizer';
import { requestStudentPhotoChange } from '@/lib/studentPhotoRequests';
import { uploadStorageFile } from '@/lib/storageFiles';
import { toast } from 'sonner';
import { AlertTriangle, Clock3, Loader2, Upload } from 'lucide-react';

function formatDateTime(value) {
  if (!value) return 'Sem limite';
  try {
    return new Date(value).toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return String(value);
  }
}

function getBlockingState(requests = []) {
  const latest = requests[0] || null;
  if (!latest) return { latest: null, blocked: false, message: '' };

  if (latest.status === 'pendente') {
    return {
      latest,
      blocked: true,
      message: 'Sua solicitação está em análise.',
    };
  }

  if (latest.status === 'negada' && latest.next_allowed_at) {
    const nextAllowedAt = new Date(latest.next_allowed_at);
    if (!Number.isNaN(nextAllowedAt.getTime()) && nextAllowedAt > new Date()) {
      return {
        latest,
        blocked: true,
        message: `Você poderá solicitar novamente em ${formatDateTime(latest.next_allowed_at)}.`,
      };
    }
  }

  return { latest, blocked: false, message: '' };
}

export default function StudentPhotoRequestDialog({ open, onOpenChange, profile, allowPhotoUpload }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [requestedAvatarUrl, setRequestedAvatarUrl] = useState('');
  const [preparing, setPreparing] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);

  const { data: requestHistory = [] } = useQuery({
    queryKey: ['start-menu-photo-request', profile?.id],
    queryFn: () => StudentPhotoRequestApi.filter({ student_profile_id: profile.id }, '-created_at', 3),
    enabled: open && Boolean(profile?.id),
    staleTime: 30 * 1000,
  });

  const blockingState = useMemo(() => getBlockingState(requestHistory), [requestHistory]);
  const latestRequest = blockingState.latest;

  useEffect(() => {
    if (!open) {
      setSelectedFile(null);
      setPreviewUrl('');
      setRequestedAvatarUrl('');
      setPreparing(false);
      setPreviewDialogOpen(false);
    }
  }, [open]);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl('');
      return undefined;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedFile]);

  const submitMutation = useMutation({
    mutationFn: async (avatarUrl) => requestStudentPhotoChange({
      profileId: profile.id,
      userEmail: profile.user_email,
      fullName: profile.full_name,
      currentAvatarUrl: profile.avatar_url || null,
      requestedAvatarUrl: avatarUrl,
    }),
    onSuccess: async () => {
      toast.success('Solicitação enviada para aprovação.');
      setSelectedFile(null);
      setPreviewUrl('');
      setRequestedAvatarUrl('');
      await queryClient.invalidateQueries({ queryKey: ['start-menu-photo-request'] });
      await queryClient.invalidateQueries({ queryKey: ['student-photo-requests'] });
    },
    onError: (error) => {
      toast.error(error?.message || 'Nao foi possivel enviar sua solicitação.');
    },
  });

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;
    if (!shouldOptimizeImageBeforeUpload(file)) {
      toast.error('Use uma imagem JPG, PNG ou WebP.');
      return;
    }

    setPreparing(true);

    try {
      const optimizedResult = await optimizeImageForUpload(file, AVATAR_IMAGE_OPTIMIZATION_DEFAULTS);
      const preparedFile = optimizedResult?.file || file;

      setSelectedFile(preparedFile);
      setRequestedAvatarUrl('');
      setPreviewDialogOpen(true);
    } catch (error) {
      toast.error(error?.message || 'Nao foi possivel preparar a foto.');
    } finally {
      setPreparing(false);
    }
  };

  const handlePreviewConfirm = async () => {
    if (!selectedFile) return;

    setPreparing(true);

    try {
      if (!user?.id) {
        throw new Error('Nao foi possivel identificar sua conta para enviar a foto.');
      }

      const uploadedPath = await uploadStorageFile({
        file: selectedFile,
        folder: `submissions/${user.id}/photo-requests`,
      });

      setRequestedAvatarUrl(uploadedPath);
      setPreviewDialogOpen(false);
      toast.success('Foto preparada. Revise e envie para aprovação.');
    } catch (error) {
      toast.error(error?.message || 'Nao foi possivel preparar a foto.');
    } finally {
      setPreparing(false);
    }
  };

  const handlePreviewDialogChange = (nextOpen) => {
    setPreviewDialogOpen(nextOpen);
    if (!nextOpen && !requestedAvatarUrl) {
      setSelectedFile(null);
      setPreviewUrl('');
    }
  };

  const handleChoosePhotoClick = () => {
    if (!allowPhotoUpload) {
      toast.error('A secretaria desativou o envio de foto pelo aluno.');
      return;
    }

    if (latestRequest?.status === 'pendente') {
      toast.warning('Você já fez um pedido de alteração de foto. Aguarde a análise da secretaria.');
      return;
    }

    if (blockingState.blocked && blockingState.message) {
      toast.warning(blockingState.message);
      return;
    }

    if (preparing || submitMutation.isPending) {
      return;
    }

    fileInputRef.current?.click();
  };

  const isChooseButtonDisabled = preparing || submitMutation.isPending;
  const isSubmitButtonDisabled = !requestedAvatarUrl || !allowPhotoUpload || blockingState.blocked || preparing || submitMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl border-slate-200 bg-white">
        <DialogHeader>
          <DialogTitle>Solicitar alteração de foto</DialogTitle>
          <DialogDescription>
            Envie uma nova foto para análise da secretaria ou administração.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <Avatar className="h-20 w-20 border border-slate-200">
              <AvatarImage src={previewUrl || profile.avatar_url || undefined} alt={profile.full_name} />
              <AvatarFallback className="bg-blue-500 text-2xl font-semibold text-white">
                {profile.full_name?.charAt(0) || '?'}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-semibold text-slate-900">{profile.full_name}</p>
              <p className="truncate text-sm text-slate-500">{profile.user_email}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {latestRequest?.status === 'pendente' && (
                  <Badge variant="outline" className="gap-1.5 border-amber-200 bg-amber-50 text-amber-700">
                    <Clock3 className="h-3.5 w-3.5" />
                    Em análise
                  </Badge>
                )}
                {latestRequest?.status === 'negada' && latestRequest?.next_allowed_at && (
                  <Badge variant="outline" className="gap-1.5 border-rose-200 bg-rose-50 text-rose-700">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Próxima tentativa: {formatDateTime(latestRequest.next_allowed_at)}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {!allowPhotoUpload ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              A secretaria desativou o envio de foto pelo aluno.
            </div>
          ) : blockingState.message ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              {blockingState.message}
              {latestRequest?.denial_reason ? (
                <p className="mt-2 text-xs text-slate-500">
                  Motivo informado: {latestRequest.denial_reason}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              {requestedAvatarUrl
                ? 'Foto pronta para envio. Confira a prévia e envie para aprovação.'
                : 'Selecione uma imagem para abrir a pré-visualização antes do envio.'}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleChoosePhotoClick}
              disabled={isChooseButtonDisabled}
            >
              {preparing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {selectedFile ? 'Trocar foto escolhida' : 'Escolher foto'}
            </Button>
            <Button
              type="button"
              onClick={() => submitMutation.mutate(requestedAvatarUrl)}
              disabled={isSubmitButtonDisabled}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              Enviar para aprovação
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept={OPTIMIZABLE_IMAGE_MIME_TYPES.join(',')}
              className="hidden"
              onChange={handleFileChange}
            />
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>

          <p className="text-xs text-slate-500">
            A imagem será enviada para revisão, não trocada automaticamente no perfil.
          </p>
        </div>
      </DialogContent>

      <Dialog open={previewDialogOpen} onOpenChange={handlePreviewDialogChange}>
        <DialogContent className="max-w-lg border-slate-200 bg-white">
          <DialogHeader>
            <DialogTitle>Pré-visualização da nova foto</DialogTitle>
            <DialogDescription>
              Confira como a imagem ficará antes de enviar para aprovação.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex justify-center">
                <Avatar className="h-44 w-44 border border-slate-200 shadow-sm">
                  <AvatarImage src={previewUrl || undefined} alt={profile.full_name} className="object-cover" />
                  <AvatarFallback className="bg-blue-500 text-5xl font-semibold text-white">
                    {profile.full_name?.charAt(0) || '?'}
                  </AvatarFallback>
                </Avatar>
              </div>
              <p className="mt-4 text-center text-sm font-medium text-slate-900">{profile.full_name}</p>
              <p className="mt-1 text-center text-xs text-slate-500">
                Essa imagem ainda não está pública. Ela só será analisada após o envio.
              </p>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSelectedFile(null);
                  setPreviewUrl('');
                  setPreviewDialogOpen(false);
                }}
                disabled={preparing}
              >
                Escolher outra
              </Button>
              <Button
                type="button"
                onClick={() => void handlePreviewConfirm()}
                disabled={!selectedFile || preparing}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {preparing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Usar esta foto
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
