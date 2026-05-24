import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, Loader2, Mail, MessageSquare, Send, Users } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { MessageApi, StudentApi } from '@/services/supabaseApi';
import {
  buildMessagePayload,
  getMessageRecipientLabel,
  MESSAGE_CHANNELS,
  MESSAGE_PRIORITIES,
  MESSAGE_RECIPIENT_TYPES,
  TEACHER_CENTER_RECIPIENT_OPTIONS,
} from '@shared/contracts/messages';


const EMPTY_FORM = {
  recipient_type: MESSAGE_RECIPIENT_TYPES.CLASS,
  recipient_ids: [],
  class_id: '',
  subject: '',
  content: '',
  priority: MESSAGE_PRIORITIES.NORMAL,
  category: 'comunicado',
  channels: [MESSAGE_CHANNELS.APP],
};

export default function CommunicationCenter({ classes, senderType = 'professor' }) {
  const { user: authUser } = useAuth();
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const [messages, setMessages] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState(EMPTY_FORM);

  useEffect(() => {
    if (!authUser?.id) return;

    loadMessages();
    loadStudents();
  }, [authUser?.id, classes]);

  const loadMessages = async () => {
    try {
      const messagesData = await MessageApi.filter({
        sender_id: authUser.id,
      }, '-sent_at', 50);
      setMessages(messagesData);
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStudents = async () => {
    try {
      const classIds = new Set(classes.map((item) => item.id));
      const allStudents = await StudentApi.filter({
        enrollment_status: 'ativo',
      });

      setStudents(allStudents.filter((student) => classIds.has(student.current_class_id)));
    } catch (error) {
      console.error('Erro ao carregar alunos:', error);
    }
  };

  const availableStudents = useMemo(() => {
    return students.filter((student) => {
      if (!formData.class_id) return true;
      return student.current_class_id === formData.class_id;
    });
  }, [formData.class_id, students]);

  const toggleRecipient = (studentId) => {
    setFormData((current) => {
      const recipients = current.recipient_ids || [];
      const nextRecipients = recipients.includes(studentId)
        ? recipients.filter((id) => id !== studentId)
        : [...recipients, studentId];

      return {
        ...current,
        recipient_ids: nextRecipients,
      };
    });
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();

    try {
      const payload = buildMessagePayload({
        formData,
        sender: authUser,
        senderType,
      });



      toast.success('Mensagem enviada com sucesso!');
      setShowMessageDialog(false);
      setFormData(EMPTY_FORM);
      loadMessages();
    } catch (error) {
      toast.error(error.message || 'Erro ao enviar mensagem');
      console.error(error);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case MESSAGE_PRIORITIES.URGENT:
        return 'bg-red-100 text-red-700';
      case MESSAGE_PRIORITIES.HIGH:
        return 'bg-orange-100 text-orange-700';
      case MESSAGE_PRIORITIES.LOW:
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-blue-100 text-blue-700';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Centro de Comunicação</CardTitle>
            <Button onClick={() => setShowMessageDialog(true)}>
              <Send className="w-4 h-4 mr-2" />
              Nova Mensagem
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-indigo-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Mail className="w-8 h-8 text-indigo-600" />
                <div>
                  <p className="text-sm text-indigo-600">Mensagens Enviadas</p>
                  <p className="text-2xl font-bold text-indigo-900">{messages.length}</p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-green-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Users className="w-8 h-8 text-green-600" />
                <div>
                  <p className="text-sm text-green-600">Alunos Ativos</p>
                  <p className="text-2xl font-bold text-green-900">{students.length}</p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-3">
                <MessageSquare className="w-8 h-8 text-blue-600" />
                <div>
                  <p className="text-sm text-blue-600">Turmas</p>
                  <p className="text-2xl font-bold text-blue-900">{classes.length}</p>
                </div>
              </div>
            </div>
          </div>

          <Tabs defaultValue="sent">
            <TabsList>
              <TabsTrigger value="sent">Enviadas</TabsTrigger>
              <TabsTrigger value="templates">Modelos Rápidos</TabsTrigger>
            </TabsList>

            <TabsContent value="sent" className="space-y-3 mt-4">
              {loading && (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                </div>
              )}

              {!loading && messages.map((message) => (
                <div key={message.id} className="p-4 border rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-slate-900">{message.subject}</h4>
                        <Badge className={getPriorityColor(message.priority)}>
                          {message.priority}
                        </Badge>
                        <Badge variant="outline">{message.category}</Badge>
                      </div>
                      <p className="text-sm text-slate-600 mb-2">{getMessageRecipientLabel(message, classes)}</p>
                      <p className="text-sm text-slate-700 line-clamp-2">{message.content}</p>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-slate-500">
                      <Clock className="w-4 h-4" />
                      {message.sent_at && format(new Date(message.sent_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </div>
                  </div>
                </div>
              ))}

              {!loading && messages.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>Nenhuma mensagem enviada ainda</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="templates" className="mt-4">
              <div className="grid md:grid-cols-2 gap-4">
                <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => {
                  setFormData({
                    ...EMPTY_FORM,
                    subject: 'Lembrete de Entrega de Atividade',
                    content: 'Prezados alunos,\n\nLembro que a atividade [nome da atividade] deve ser entregue até [data].\n\nAtenciosamente,',
                    category: 'lembrete',
                    recipient_type: MESSAGE_RECIPIENT_TYPES.CLASS,
                  });
                  setShowMessageDialog(true);
                }}>
                  <CardContent className="p-6">
                    <h3 className="font-semibold mb-2">Lembrete de Atividade</h3>
                    <p className="text-sm text-slate-600">Lembrar alunos sobre entrega de trabalhos</p>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => {
                  setFormData({
                    ...EMPTY_FORM,
                    subject: 'Aviso aos Responsáveis',
                    content: 'Prezados responsáveis,\n\n[Escreva seu comunicado aqui]\n\nAtenciosamente,',
                    category: 'comunicado',
                    recipient_type: MESSAGE_RECIPIENT_TYPES.CLASS,
                  });
                  setShowMessageDialog(true);
                }}>
                  <CardContent className="p-6">
                    <h3 className="font-semibold mb-2">Comunicado aos Pais</h3>
                    <p className="text-sm text-slate-600">Enviar avisos importantes aos responsáveis</p>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => {
                  setFormData({
                    ...EMPTY_FORM,
                    subject: 'Parabenização por Desempenho',
                    content: 'Olá [nome do aluno],\n\nParabéns pelo excelente desempenho! Continue assim!\n\nAtenciosamente,',
                    category: 'elogio',
                    priority: MESSAGE_PRIORITIES.LOW,
                    recipient_type: MESSAGE_RECIPIENT_TYPES.STUDENT,
                  });
                  setShowMessageDialog(true);
                }}>
                  <CardContent className="p-6">
                    <h3 className="font-semibold mb-2">Parabenizar Aluno</h3>
                    <p className="text-sm text-slate-600">Reconhecer bom desempenho</p>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => {
                  setFormData({
                    ...EMPTY_FORM,
                    subject: 'Convocação para Reunião',
                    content: 'Prezados responsáveis,\n\nConvoco para uma reunião sobre o desempenho do(a) aluno(a).\n\nData: [data]\nHorário: [horário]\n\nAtenciosamente,',
                    category: 'academico',
                    priority: MESSAGE_PRIORITIES.HIGH,
                    recipient_type: MESSAGE_RECIPIENT_TYPES.STUDENT,
                  });
                  setShowMessageDialog(true);
                }}>
                  <CardContent className="p-6">
                    <h3 className="font-semibold mb-2">Convocação de Reunião</h3>
                    <p className="text-sm text-slate-600">Agendar reunião com responsáveis</p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={showMessageDialog} onOpenChange={setShowMessageDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nova Mensagem</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSendMessage} className="space-y-4">
            <div>
              <Label>Destinatários</Label>
              <Select
                value={formData.recipient_type}
                onValueChange={(value) => setFormData({ ...EMPTY_FORM, recipient_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEACHER_CENTER_RECIPIENT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(formData.recipient_type === MESSAGE_RECIPIENT_TYPES.CLASS || formData.recipient_type === MESSAGE_RECIPIENT_TYPES.STUDENT) && (
              <div>
                <Label>Selecione a Turma</Label>
                <Select value={formData.class_id} onValueChange={(value) => setFormData({ ...formData, class_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha uma turma" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((item) => (
                      <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {formData.recipient_type === MESSAGE_RECIPIENT_TYPES.STUDENT && (
              <div className="space-y-3">
                <Label>Selecione os alunos</Label>
                <div className="max-h-52 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-3">
                  {availableStudents.length === 0 && (
                    <p className="text-sm text-slate-500">
                      Nenhum aluno encontrado para a turma selecionada.
                    </p>
                  )}
                  {availableStudents.map((student) => (
                    <label key={student.id} className="flex items-center gap-3 text-sm text-slate-700">
                      <Checkbox
                        checked={formData.recipient_ids.includes(student.id)}
                        onCheckedChange={() => toggleRecipient(student.id)}
                      />
                      <span>{student.full_name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Prioridade</Label>
                <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={MESSAGE_PRIORITIES.LOW}>Baixa</SelectItem>
                    <SelectItem value={MESSAGE_PRIORITIES.NORMAL}>Normal</SelectItem>
                    <SelectItem value={MESSAGE_PRIORITIES.HIGH}>Alta</SelectItem>
                    <SelectItem value={MESSAGE_PRIORITIES.URGENT}>Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Categoria</Label>
                <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aviso">Aviso</SelectItem>
                    <SelectItem value="comunicado">Comunicado</SelectItem>
                    <SelectItem value="lembrete">Lembrete</SelectItem>
                    <SelectItem value="academico">Acadêmico</SelectItem>
                    <SelectItem value="evento">Evento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Assunto *</Label>
              <Input
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                required
                placeholder="Digite o assunto da mensagem"
              />
            </div>

            <div>
              <Label>Mensagem *</Label>
              <Textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={8}
                required
                placeholder="Digite sua mensagem..."
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setShowMessageDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                <Send className="w-4 h-4 mr-2" />
                Enviar Mensagem
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
