// ┌ñÏ▒┘êÏ»┘ê┘é Ïº┘è┘å Ï»┌ñÏ▒Ï¿┘êÏºÏ¬ Ï│┌ñ┘å┘ê┘ç┌¢ Ïº┘ê┘ä┘è┘ç Whyktor GSV.
import React, { useDeferredValue, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import PageHeader from '@/components/common/PageHeader';
import StatusBadge from '@/components/common/StatusBadge';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Clock, Eye, Loader2, Mail, MessageSquare, Search, Send, Smartphone, Trash2, Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ClassApi, MessageApi, StudentApi } from '@/services/supabaseApi';
import { usePermissions } from '@/components/hooks/usePermissions';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import {
  buildMessagePayload,
  filterMessagesForStudent,
  getMessageRecipientLabel,
  MESSAGE_RECIPIENT_TYPES,
  MESSAGE_STATUSES,
  normalizeMessageStatus,
  STAFF_MESSAGE_RECIPIENT_OPTIONS,
} from '@shared/contracts/messages';
import {
  canCreateOwnClassMessages,
  canManageMessages,
} from '@shared/contracts/access';
import { createManagedMessage } from '@/lib/notificationsClient';
import { useGlobalSearchNavigation } from '@/hooks/useGlobalSearchNavigation';

const EMPTY_FORM = {
  channels: ['app'],
  recipient_type: MESSAGE_RECIPIENT_TYPES.ALL,
  class_id: '',
  subject: '',
  content: '',
  category: 'comunicado',
  priority: 'normal',
};

export default function Messages({ globalSearch }) {
  const { profileType, isStudent } = usePermissions();
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [activeTab, setActiveTab] = useState('todas');
  const [search, setSearch] = useState('');
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const deferredSearch = useDeferredValue(search);

  const queryClient = useQueryClient();
  const canManageMessagesPermission = canManageMessages(profileType);
  const canCreateClassMessage = canCreateOwnClassMessages(profileType);
  const canWriteMessages = canManageMessagesPermission || canCreateClassMessage;

  const { data: studentRecords = [] } = useQuery({
    queryKey: ['student-by-email', user?.email],
    queryFn: () => StudentApi.filter({ email: user?.email }),
    enabled: !!user?.email && isStudent,
  });

  const student = studentRecords[0] || null;

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['messages', profileType, user?.email, student?.id, student?.current_class_id],
    enabled: !isStudent || !!student?.id,
    queryFn: async () => {
      if (!isStudent) {
        return MessageApi.list('-created_at');
      }

      if (!student?.id) {
        return [];
      }

      const [broadcastMessages, classMessages, directResult] = await Promise.all([
        MessageApi.filter({ recipient_type: MESSAGE_RECIPIENT_TYPES.ALL }, '-created_at', 100),
        student.current_class_id
          ? MessageApi.filter({
              recipient_type: MESSAGE_RECIPIENT_TYPES.CLASS,
              class_id: student.current_class_id,
            }, '-created_at', 100)
          : [],
        supabase
          .from('messages')
          .select('*')
          .eq('recipient_type', MESSAGE_RECIPIENT_TYPES.STUDENT)
          .contains('recipient_ids', [student.id])
          .order('created_at', { ascending: false })
          .limit(100),
      ]);

      if (directResult.error) throw directResult.error;

      return [...broadcastMessages, ...classMessages, ...(directResult.data ?? [])]
        .reduce((uniqueMessages, message) => {
          if (!uniqueMessages.find((item) => item.id === message.id)) {
            uniqueMessages.push(message);
          }
          return uniqueMessages;
        }, [])
        .sort((left, right) => (
          new Date(right.created_at || right.sent_at || 0).getTime()
          - new Date(left.created_at || left.sent_at || 0).getTime()
        ));
    },
  });

  const { data: classes = [] } = useQuery({
    queryKey: ['classes'],
    queryFn: () => ClassApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => createManagedMessage(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      setShowForm(false);
      setFormData(EMPTY_FORM);
      toast.success('Comunicado criado com sucesso!');
    },
    onError: (error) => {
      toast.error(error?.message || 'Nao foi possivel enviar o comunicado.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => MessageApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      toast.success('Comunicado removido com sucesso!');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canWriteMessages) return;

    if (isStudent && !student?.current_class_id) {
      toast.error('Não foi possível identificar sua turma. Contate a coordenação.');
      return;
    }

    try {
      const payload = buildMessagePayload({
        formData,
        sender: user,
        senderType: isStudent ? 'aluno' : profileType,
        studentContext: isStudent ? student : null,
      });

      createMutation.mutate(payload);
    } catch (error) {
      toast.error(error.message || 'Não foi possível enviar o comunicado.');
    }
  };

  const handleChannelToggle = (channel) => {
    if (isStudent && channel === 'email') {
      return;
    }

    const channels = formData.channels || [];
    if (channels.includes(channel)) {
      setFormData({ ...formData, channels: channels.filter((item) => item !== channel) });
    } else {
      setFormData({ ...formData, channels: [...channels, channel] });
    }
  };

  const visibleMessages = useMemo(
    () => (isStudent ? filterMessagesForStudent(messages, student) : messages),
    [isStudent, messages, student]
  );

  const filteredMessages = useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase();

    return visibleMessages.filter((message) => {
      if (activeTab !== 'todas' && normalizeMessageStatus(message.status) !== activeTab) {
        return false;
      }

      if (!normalizedSearch) return true;

      return [
        message.subject,
        message.content,
        message.category,
        message.priority,
        message.status,
        getMessageRecipientLabel(message, classes),
      ].some((value) => String(value ?? '').toLowerCase().includes(normalizedSearch));
    });
  }, [activeTab, classes, deferredSearch, visibleMessages]);

  const categoryLabels = {
    aviso: 'Aviso',
    comunicado: 'Comunicado',
    lembrete: 'Lembrete',
    evento: 'Evento',
    academico: 'Acadêmico',
    financeiro: 'Financeiro',
    outro: 'Outro',
  };

  const categoryColors = {
    aviso: 'bg-amber-100 text-amber-700',
    comunicado: 'bg-blue-100 text-blue-700',
    lembrete: 'bg-purple-100 text-purple-700',
    evento: 'bg-emerald-100 text-emerald-700',
    academico: 'bg-indigo-100 text-indigo-700',
    financeiro: 'bg-rose-100 text-rose-700',
    outro: 'bg-slate-100 text-slate-700',
  };

  const priorityColors = {
    baixa: 'bg-slate-100 text-slate-700',
    normal: 'bg-blue-100 text-blue-700',
    alta: 'bg-amber-100 text-amber-700',
    urgente: 'bg-rose-100 text-rose-700',
  };

  useGlobalSearchNavigation({
    entityKey: 'messages',
    globalSearch,
    isReady: !isLoading,
    onNavigate: ({ query, recordId }) => {
      setActiveTab('todas');
      setShowForm(false);
      setSearch(query || '');
      setHighlightedMessageId(recordId || null);
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
    <div className="space-y-6">
      <PageHeader
        backTo="/Dashboard"
        backLabel="Dashboard"
        title="Comunicados"
        subtitle={`${filteredMessages.length} comunicados disponíveis`}
        action={canWriteMessages ? () => {
          setFormData({
            ...EMPTY_FORM,
            recipient_type: canCreateClassMessage || isStudent
              ? MESSAGE_RECIPIENT_TYPES.CLASS
              : MESSAGE_RECIPIENT_TYPES.ALL,
            class_id: canCreateClassMessage || isStudent ? student?.current_class_id || '' : '',
          });
          setShowForm(true);
        } : undefined}
        actionLabel={canWriteMessages ? (isStudent || canCreateClassMessage ? "Nova Mensagem de Turma" : "Novo Comunicado") : undefined}
        actionIcon={canWriteMessages ? Send : undefined}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="todas">Todos</TabsTrigger>
          <TabsTrigger value={MESSAGE_STATUSES.SENT}>Enviados</TabsTrigger>
          <TabsTrigger value={MESSAGE_STATUSES.DRAFT}>Rascunhos</TabsTrigger>
          <TabsTrigger value={MESSAGE_STATUSES.SCHEDULED}>Agendados</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="app-search-field max-w-xl">
        <Search className="w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por assunto, conteúdo, destinatário ou status..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="h-auto border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0"
        />
      </div>

      <div className="space-y-4">
        {filteredMessages.map((message) => (
          <Card
            key={message.id}
            className={cn(
              "hover:shadow-md transition-shadow",
              highlightedMessageId === message.id && "ring-2 ring-indigo-300 ring-offset-2"
            )}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className={categoryColors[message.category]}>
                      {categoryLabels[message.category] || message.category}
                    </Badge>
                    <Badge variant="outline" className={priorityColors[message.priority]}>
                      {message.priority}
                    </Badge>
                    <StatusBadge status={message.status} />
                  </div>
                  <h3 className="font-semibold text-lg text-slate-900 mb-1">{message.subject}</h3>
                  <p className="text-slate-600 line-clamp-2">{message.content}</p>
                  <div className="flex items-center gap-4 mt-3 text-sm text-slate-500">
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>
                        {message.sent_at
                          ? format(new Date(message.sent_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                          : 'Não enviado'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      <span>{getMessageRecipientLabel(message, classes)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Eye className="w-4 h-4" />
                      <span>{message.read_count || 0} leituras</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    {message.channels?.map((channel) => (
                      <Badge key={channel} variant="outline" className="text-xs">
                        {channel === 'app' && <Smartphone className="w-3 h-3 mr-1" />}
                        {channel === 'email' && <Mail className="w-3 h-3 mr-1" />}
                        {channel}
                      </Badge>
                    ))}
                  </div>
                </div>
                {canManageMessagesPermission && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (confirm('Tem certeza que deseja excluir este comunicado?')) {
                        deleteMutation.mutate(message.id);
                      }
                    }}
                    aria-label={`Excluir comunicado ${message.title}`}
                    data-tooltip={`Excluir comunicado ${message.title}`}
                  >
                    <Trash2 className="w-4 h-4 text-rose-500" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredMessages.length === 0 && (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-slate-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <p>Nenhum comunicado encontrado</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={canWriteMessages && showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Comunicado</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Assunto *</Label>
              <Input
                value={formData.subject || ''}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Mensagem *</Label>
              <Textarea
                value={formData.content || ''}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={5}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Categoria</Label>
                <Select
                  value={formData.category || ''}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(categoryLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridade</Label>
                <Select
                  value={formData.priority || 'normal'}
                  onValueChange={(value) => setFormData({ ...formData, priority: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {isStudent ? (
                <div>
                  <Label>Destinatários</Label>
                  <div className="rounded-lg border border-slate-200 p-3 text-sm text-slate-700 bg-slate-50">
                    Turma (apenas mensagem de turma permitida)
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    {student?.current_class_id
                      ? `Turma identificada: ${classes.find((item) => item.id === student.current_class_id)?.name || 'não disponível'}.`
                      : 'Nenhuma turma associada no perfil. Contate a coordenação.'}
                  </div>
                </div>
              ) : (
                <div>
                  <Label>Destinatários</Label>
                  <Select
                    value={formData.recipient_type || ''}
                    onValueChange={(value) => setFormData({
                      ...formData,
                      recipient_type: value,
                      class_id: value === MESSAGE_RECIPIENT_TYPES.CLASS ? formData.class_id : '',
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {STAFF_MESSAGE_RECIPIENT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {(formData.recipient_type === MESSAGE_RECIPIENT_TYPES.CLASS || isStudent) && (
                <div>
                  <Label>Turma</Label>
                  <Select
                    value={formData.class_id || (isStudent ? student?.current_class_id || '' : '')}
                    onValueChange={(value) => setFormData({ ...formData, class_id: value })}
                    disabled={isStudent}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((item) => (
                        <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div>
              <Label className="mb-3 block">Canais de Envio</Label>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={formData.channels?.includes('app')}
                    onCheckedChange={() => handleChannelToggle('app')}
                  />
                  <Label className="flex items-center gap-1">
                    <Smartphone className="w-4 h-4" />
                    Aplicativo
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={formData.channels?.includes('email')}
                    disabled={isStudent}
                    onCheckedChange={() => handleChannelToggle('email')}
                  />
                  <Label className={`flex items-center gap-1 ${isStudent ? 'text-slate-400' : ''}`}>
                    <Mail className="w-4 h-4" />
                    E-mail
                  </Label>
                </div>
              </div>
              {isStudent && (
                <p className="mt-2 text-xs text-slate-500">
                  Mensagens enviadas por aluno ficam restritas ao aplicativo e passam pelo endpoint autenticado.
                </p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={createMutation.isPending}>
                {createMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                {createMutation.isPending ? 'Enviando...' : 'Enviar Comunicado'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
