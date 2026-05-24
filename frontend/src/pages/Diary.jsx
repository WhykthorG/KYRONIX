import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import PageHeader from "@/components/common/PageHeader";
import { BookOpen, Plus, Calendar, FileText, CheckSquare, Clock, Download, Edit } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { AttendanceApi, ClassApi, DiaryApi, LessonPlanApi, StudentApi, SubjectApi } from '@/services/supabaseApi';

import {
  DEFAULT_STORAGE_BUCKET,
  normalizeStorageFileReferences,
  diffRemovedStorageFileReferences,
  getStorageFileKey,
  getStoredFileName,
  uploadStorageFile,
  resolveStorageFileUrl,
  deleteStorageFile,
  deleteStorageFiles
} from '@/lib/storageFiles';


export default function Diary() {
  const [activeTab, setActiveTab] = useState('diary');
  const [diaryEntries, setDiaryEntries] = useState([]);
  const [lessonPlans, setLessonPlans] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDiaryDialog, setShowDiaryDialog] = useState(false);
  const [showPlanDialog, setShowPlanDialog] = useState(false);
  const [showAttendanceDialog, setShowAttendanceDialog] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [attendanceList, setAttendanceList] = useState([]);
  const [filters, setFilters] = useState({
    classId: '',
    subjectId: '',
    date: format(new Date(), 'yyyy-MM-dd')
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [entriesData, plansData, classesData, subjectsData] = await Promise.all([
        DiaryApi.list('-date', 100),
        LessonPlanApi.list('-updated_at', 100),
        ClassApi.filter({ status: 'ativa' }),
        SubjectApi.list()
      ]);
      setDiaryEntries(entriesData.map((entry) => ({
        ...entry,
        attachment_urls: normalizeStorageFileReferences(entry.attachment_urls),
      })));
      setLessonPlans(plansData.map((plan) => ({
        ...plan,
        attachment_urls: normalizeStorageFileReferences(plan.attachment_urls),
      })));
      setClasses(classesData);
      setSubjects(subjectsData);
    } catch (error) {
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDiary = async (formData, { removedPersistedAttachments = [] } = {}) => {
    try {
      const payload = {
        ...formData,
        attachment_urls: normalizeStorageFileReferences(formData.attachment_urls),
      };
      if (!payload.class_id) payload.class_id = null;
      if (!payload.subject_id) payload.subject_id = null;

      if (selectedEntry) {
        await DiaryApi.update(selectedEntry.id, payload);
        toast.success('Aula atualizada com sucesso');
      } else {
        await DiaryApi.create(payload);
        toast.success('Aula registrada com sucesso');
      }

      if (removedPersistedAttachments.length > 0) {
        try {
          await deleteStorageFiles(removedPersistedAttachments);
        } catch (error) {
          toast.error(`O registro foi salvo, mas houve falha ao limpar anexos antigos: ${error.message}`);
        }
      }

      setShowDiaryDialog(false);
      setSelectedEntry(null);
      loadData();
    } catch (error) {
      toast.error('Erro ao salvar registro');
      throw error;
    }
  };

  const handleSavePlan = async (formData, { removedPersistedAttachments = [] } = {}) => {
    try {
      const payload = {
        ...formData,
        attachment_urls: normalizeStorageFileReferences(formData.attachment_urls),
      };
      if (!payload.subject_id) payload.subject_id = null;

      if (selectedPlan) {
        await LessonPlanApi.update(selectedPlan.id, payload);
        toast.success('Plano de aula atualizado');
      } else {
        await LessonPlanApi.create(payload);
        toast.success('Plano de aula criado');
      }

      if (removedPersistedAttachments.length > 0) {
        try {
          await deleteStorageFiles(removedPersistedAttachments);
        } catch (error) {
          toast.error(`O plano foi salvo, mas houve falha ao limpar anexos antigos: ${error.message}`);
        }
      }

      setShowPlanDialog(false);
      setSelectedPlan(null);
      loadData();
    } catch (error) {
      toast.error('Erro ao salvar plano de aula');
      throw error;
    }
  };

  const handleRegisterAttendance = async (entry) => {
    try {
      const studentsData = await StudentApi.filter({ 
        current_class_id: entry.class_id,
        enrollment_status: 'ativo'
      });
      
      const existingAttendance = await AttendanceApi.filter({
        class_id: entry.class_id,
        subject_id: entry.subject_id,
        date: entry.date
      });
      
      const attendanceMap = {};
      existingAttendance.forEach(att => {
        attendanceMap[att.student_id] = att.status;
      });
      
      setAttendanceList(studentsData.map(student => ({
        studentId: student.id,
        studentName: student.full_name,
        status: attendanceMap[student.id] || 'presente'
      })));
      
      setSelectedEntry(entry);
      setShowAttendanceDialog(true);
    } catch (error) {
      toast.error('Erro ao carregar alunos');
    }
  };

  const handleSaveAttendance = async () => {
    try {
      const presentCount = attendanceList.filter(a => a.status === 'presente').length;
      const absentCount = attendanceList.filter(a => a.status === 'ausente').length;
      
      await Promise.all(attendanceList.map(att => 
        AttendanceApi.create({
          student_id: att.studentId,
          class_id: selectedEntry.class_id,
          subject_id: selectedEntry.subject_id,
          teacher_id: selectedEntry.teacher_id,
          date: selectedEntry.date,
          status: att.status,
          lesson_number: selectedEntry.lesson_number
        })
      ));
      
      await DiaryApi.update(selectedEntry.id, {
        attendance_registered: true,
        total_students: attendanceList.length,
        present_count: presentCount,
        absent_count: absentCount
      });
      
      toast.success('Frequência registrada com sucesso');
      setShowAttendanceDialog(false);
      loadData();
    } catch (error) {
      toast.error('Erro ao registrar frequência');
    }
  };

  const handleFileUpload = async (event, callback) => {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
      const BUCKET = DEFAULT_STORAGE_BUCKET;
      const path = await uploadStorageFile({ file, folder: 'diary', bucket: BUCKET });

      toast.success('Arquivo enviado com sucesso');
    } catch (error) {
      toast.error('Erro ao enviar arquivo');
    }
  };

  const openAttachment = async (fileRef) => {
    const url = await resolveStorageFileUrl(fileRef);
    if (!url) {
      toast.error('Não foi possível gerar um link temporário para este arquivo.');
      return;
    }

    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const filteredEntries = diaryEntries.filter(entry => {
    if (filters.classId && entry.class_id !== filters.classId) return false;
    if (filters.subjectId && entry.subject_id !== filters.subjectId) return false;
    if (filters.date && entry.date !== filters.date) return false;
    return true;
  });

  if (loading) {
    return <div className="p-6">Carregando...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
          backTo="/TeacherPortal"
          backLabel="Portal do Professor"
        title="Diário Eletrônico"
        subtitle="Registre aulas, gerencie planos de aula e controle frequência"
        action={() => setShowDiaryDialog(true)}
        actionLabel="Nova Aula"
        actionIcon={Plus}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="diary">
            <BookOpen className="w-4 h-4 mr-2" />
            Registro de Aulas
          </TabsTrigger>
          <TabsTrigger value="plans">
            <FileText className="w-4 h-4 mr-2" />
            Planos de Aula
          </TabsTrigger>
        </TabsList>

        <TabsContent value="diary" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Filtros</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Turma</Label>
                  <Select value={filters.classId} onValueChange={(value) => setFilters({...filters, classId: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas as turmas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>Todas</SelectItem>
                      {classes.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Disciplina</Label>
                  <Select value={filters.subjectId} onValueChange={(value) => setFilters({...filters, subjectId: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas as disciplinas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>Todas</SelectItem>
                      {subjects.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Data</Label>
                  <Input 
                    type="date" 
                    value={filters.date}
                    onChange={(e) => setFilters({...filters, date: e.target.value})}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            {filteredEntries.map(entry => {
              const classData = classes.find(c => c.id === entry.class_id);
              const subjectData = subjects.find(s => s.id === entry.subject_id);
              
              return (
                <Card key={entry.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <Badge variant="outline" className="bg-indigo-50 text-indigo-700">
                            {classData?.name}
                          </Badge>
                          <Badge variant="outline" className="bg-blue-50 text-blue-700">
                            {subjectData?.name}
                          </Badge>
                          <Badge className={
                            entry.status === 'realizada' ? 'bg-green-100 text-green-700' :
                            entry.status === 'cancelada' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'
                          }>
                            {entry.status}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-slate-600 mb-3">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {format(new Date(entry.date), "dd/MM/yyyy", { locale: ptBR })}
                          </div>
                          {entry.start_time && (
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {entry.start_time} - {entry.end_time}
                            </div>
                          )}
                          {entry.attendance_registered && (
                            <div className="flex items-center gap-1 text-green-600">
                              <CheckSquare className="w-4 h-4" />
                              Frequência: {entry.present_count}/{entry.total_students}
                            </div>
                          )}
                        </div>
                        
                        {entry.content && (
                          <div className="mb-3">
                            <p className="text-sm font-medium text-slate-700 mb-1">Conteúdo:</p>
                            <p className="text-sm text-slate-600">{entry.content}</p>
                          </div>
                        )}
                        
                        {entry.homework && (
                          <div className="mb-3">
                            <p className="text-sm font-medium text-slate-700 mb-1">Tarefa de Casa:</p>
                            <p className="text-sm text-slate-600">{entry.homework}</p>
                          </div>
                        )}
                        
                        {entry.attachment_urls && entry.attachment_urls.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                              <Download className="w-4 h-4" />
                              {entry.attachment_urls.length} material(is) anexado(s)
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {entry.attachment_urls.map((fileRef) => (
                                <Button
                                  key={getStorageFileKey(fileRef)}
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => void openAttachment(fileRef)}
                                >
                                  <Download className="w-4 h-4 mr-1" />
                                  {getStoredFileName(fileRef)}
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex gap-2">
                        {!entry.attendance_registered && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleRegisterAttendance(entry)}
                          >
                            <CheckSquare className="w-4 h-4 mr-1" />
                            Frequência
                          </Button>
                        )}
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => {
                            setSelectedEntry(entry);
                            setShowDiaryDialog(true);
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            
            {filteredEntries.length === 0 && (
              <Card>
                <CardContent className="p-12 text-center text-slate-500">
                  <BookOpen className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                  <p>Nenhuma aula registrada para os filtros selecionados</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="plans" className="space-y-6">
          <div className="flex justify-end mb-4">
            <Button onClick={() => {
              setSelectedPlan(null);
              setShowPlanDialog(true);
            }}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Plano de Aula
            </Button>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {lessonPlans.map(plan => {
              const subjectData = subjects.find(s => s.id === plan.subject_id);
              
              return (
                <Card key={plan.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-semibold text-slate-900">{plan.title}</h3>
                      <Badge className={
                        plan.status === 'aprovado' ? 'bg-green-100 text-green-700' :
                        plan.status === 'em_uso' ? 'bg-blue-100 text-blue-700' :
                        plan.status === 'arquivado' ? 'bg-gray-100 text-gray-700' :
                        'bg-yellow-100 text-yellow-700'
                      }>
                        {plan.status}
                      </Badge>
                    </div>
                    
                    <div className="space-y-2 text-sm text-slate-600 mb-4">
                      <p><strong>Disciplina:</strong> {subjectData?.name}</p>
                      <p><strong>Série:</strong> {plan.grade_level}</p>
                      {plan.duration_minutes && (
                        <p><strong>Duração:</strong> {plan.duration_minutes} min</p>
                      )}
                      <p><strong>Usado:</strong> {plan.times_used || 0} vezes</p>
                    </div>
                    
                    {plan.content && (
                      <p className="text-sm text-slate-600 line-clamp-3 mb-4">
                        {plan.content}
                      </p>
                    )}
                    
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex-1"
                        onClick={() => {
                          setSelectedPlan(plan);
                          setShowPlanDialog(true);
                        }}
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Editar
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={async () => {
                          const classId = prompt('ID da turma:');
                          const date = prompt('Data (YYYY-MM-DD):');
                          if (classId && date) {
                            await DiaryApi.create({
                              class_id: classId,
                              subject_id: plan.subject_id,
                              teacher_id: plan.teacher_id,
                              date,
                              content: plan.content,
                              objectives: plan.objectives,
                              methodology: plan.methodology,
                              homework: plan.homework,
                              lesson_plan_id: plan.id,
                              status: 'planejada'
                            });
                            await LessonPlanApi.update(plan.id, {
                              times_used: (plan.times_used || 0) + 1
                            });
                            toast.success('Aula criada a partir do plano');
                            loadData();
                          }
                        }}
                      >
                        Usar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      <DiaryDialog 
        open={showDiaryDialog}
        onClose={() => {
          setShowDiaryDialog(false);
          setSelectedEntry(null);
        }}
        onSave={handleSaveDiary}
        entry={selectedEntry}
        classes={classes}
        subjects={subjects}
        onFileUpload={handleFileUpload}
        onOpenAttachment={openAttachment}
      />

      <PlanDialog
        open={showPlanDialog}
        onClose={() => {
          setShowPlanDialog(false);
          setSelectedPlan(null);
        }}
        onSave={handleSavePlan}
        plan={selectedPlan}
        subjects={subjects}
        onFileUpload={handleFileUpload}
        onOpenAttachment={openAttachment}
      />

      <AttendanceDialog
        open={showAttendanceDialog}
        onClose={() => setShowAttendanceDialog(false)}
        onSave={handleSaveAttendance}
        attendanceList={attendanceList}
        setAttendanceList={setAttendanceList}
      />
    </div>
  );
}

function DiaryDialog({ open, onClose, onSave, entry, classes, subjects, onFileUpload, onOpenAttachment }) {
  const [formData, setFormData] = useState({
    class_id: '',
    subject_id: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    lesson_number: 1,
    start_time: '',
    end_time: '',
    content: '',
    methodology: '',
    homework: '',
    observations: '',
    status: 'realizada',
    attachment_urls: []
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (entry) {
      setFormData({
        ...entry,
        attachment_urls: normalizeStorageFileReferences(entry.attachment_urls),
      });
    } else {
      setFormData({
        class_id: '',
        subject_id: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        lesson_number: 1,
        start_time: '',
        end_time: '',
        content: '',
        methodology: '',
        homework: '',
        observations: '',
        status: 'realizada',
        attachment_urls: []
      });
    }
  }, [entry, open]);

  const { user: authUser } = useAuth();
  const initialAttachmentRefs = normalizeStorageFileReferences(entry?.attachment_urls);

  const removeAttachment = async (fileRefToRemove) => {
    const fileKey = getStorageFileKey(fileRefToRemove);
    const isPersistedFile = initialAttachmentRefs.some((item) => getStorageFileKey(item) === fileKey);

    if (!isPersistedFile) {
      try {
        await deleteStorageFile(fileRefToRemove);
      } catch (error) {
        toast.error(`Erro ao remover ${getStoredFileName(fileRefToRemove)}: ${error.message}`);
        return;
      }
    }

    setFormData((current) => ({
      ...current,
      attachment_urls: (current.attachment_urls || []).filter(
        (item) => getStorageFileKey(item) !== fileKey
      ),
    }));
  };

  const handleDialogClose = async () => {
    const transientFiles = diffRemovedStorageFileReferences(
      formData.attachment_urls || [],
      initialAttachmentRefs
    );

    if (transientFiles.length > 0) {
      try {
        await deleteStorageFiles(transientFiles);
      } catch (error) {
        toast.error(`Falha ao descartar anexos temporários: ${error.message}`);
        return;
      }
    }

    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const normalizedAttachments = normalizeStorageFileReferences(formData.attachment_urls);
      await onSave({
        ...formData,
        teacher_id: authUser?.id,
        attachment_urls: normalizedAttachments,
      }, {
        removedPersistedAttachments: diffRemovedStorageFileReferences(
          initialAttachmentRefs,
          normalizedAttachments
        ),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen && !saving) {
        void handleDialogClose();
      }
    }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{entry ? 'Editar Aula' : 'Registrar Nova Aula'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Turma *</Label>
              <Select value={formData.class_id} onValueChange={(value) => setFormData({...formData, class_id: value})} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Disciplina *</Label>
              <Select value={formData.subject_id} onValueChange={(value) => setFormData({...formData, subject_id: value})} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <Label>Data *</Label>
              <Input 
                type="date" 
                value={formData.date}
                onChange={(e) => setFormData({...formData, date: e.target.value})}
                required
              />
            </div>
            <div>
              <Label>Horário Início</Label>
              <Input 
                type="time" 
                value={formData.start_time}
                onChange={(e) => setFormData({...formData, start_time: e.target.value})}
              />
            </div>
            <div>
              <Label>Horário Fim</Label>
              <Input 
                type="time" 
                value={formData.end_time}
                onChange={(e) => setFormData({...formData, end_time: e.target.value})}
              />
            </div>
          </div>

          <div>
            <Label>Conteúdo Ministrado *</Label>
            <Textarea 
              value={formData.content}
              onChange={(e) => setFormData({...formData, content: e.target.value})}
              rows={4}
              required
            />
          </div>

          <div>
            <Label>Metodologia Aplicada</Label>
            <Textarea 
              value={formData.methodology}
              onChange={(e) => setFormData({...formData, methodology: e.target.value})}
              rows={3}
            />
          </div>

          <div>
            <Label>Tarefa de Casa</Label>
            <Textarea 
              value={formData.homework}
              onChange={(e) => setFormData({...formData, homework: e.target.value})}
              rows={3}
            />
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea 
              value={formData.observations}
              onChange={(e) => setFormData({...formData, observations: e.target.value})}
              rows={2}
            />
          </div>

          <div>
            <Label>Materiais de Apoio</Label>
            <Input 
              type="file" 
              onChange={(e) => onFileUpload(e, (fileRef) => {
                setFormData({
                  ...formData, 
                  attachment_urls: [...(formData.attachment_urls || []), fileRef]
                });
              })}
            />
            {formData.attachment_urls && formData.attachment_urls.length > 0 && (
              <div className="mt-3 space-y-2">
                {formData.attachment_urls.map((fileRef) => {
                  const fileKey = getStorageFileKey(fileRef);

                  return (
                    <div key={fileKey} className="flex items-center justify-between rounded-lg border p-2 text-sm">
                      <button
                        type="button"
                        className="truncate text-left text-indigo-600 hover:underline"
                        onClick={() => void onOpenAttachment(fileRef)}
                      >
                        {getStoredFileName(fileRef)}
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => void removeAttachment(fileRef)}
                      >
                        Remover
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <Label>Status</Label>
            <Select value={formData.status} onValueChange={(value) => setFormData({...formData, status: value})}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="planejada">Planejada</SelectItem>
                <SelectItem value="realizada">Realizada</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
                <SelectItem value="reposta">Reposta</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => void handleDialogClose()} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              Salvar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PlanDialog({ open, onClose, onSave, plan, subjects, onFileUpload, onOpenAttachment }) {
  const [formData, setFormData] = useState({
    title: '',
    subject_id: '',
    grade_level: '',
    duration_minutes: 50,
    theme: '',
    content: '',
    methodology: '',
    homework: '',
    evaluation: '',
    objectives: [],
    resources: [],
    references: [],
    competencies: [],
    status: 'rascunho',
    attachment_urls: [],
    tags: []
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (plan) {
      setFormData({
        ...plan,
        attachment_urls: normalizeStorageFileReferences(plan.attachment_urls),
      });
    } else {
      setFormData({
        title: '',
        subject_id: '',
        grade_level: '',
        duration_minutes: 50,
        theme: '',
        content: '',
        methodology: '',
        homework: '',
        evaluation: '',
        objectives: [],
        resources: [],
        references: [],
        competencies: [],
        status: 'rascunho',
        attachment_urls: [],
        tags: []
      });
    }
  }, [plan, open]);

  const { user: authUser } = useAuth();
  const initialAttachmentRefs = normalizeStorageFileReferences(plan?.attachment_urls);

  const removeAttachment = async (fileRefToRemove) => {
    const fileKey = getStorageFileKey(fileRefToRemove);
    const isPersistedFile = initialAttachmentRefs.some((item) => getStorageFileKey(item) === fileKey);

    if (!isPersistedFile) {
      try {
        await deleteStorageFile(fileRefToRemove);
      } catch (error) {
        toast.error(`Erro ao remover ${getStoredFileName(fileRefToRemove)}: ${error.message}`);
        return;
      }
    }

    setFormData((current) => ({
      ...current,
      attachment_urls: (current.attachment_urls || []).filter(
        (item) => getStorageFileKey(item) !== fileKey
      ),
    }));
  };

  const handleDialogClose = async () => {
    const transientFiles = diffRemovedStorageFileReferences(
      formData.attachment_urls || [],
      initialAttachmentRefs
    );

    if (transientFiles.length > 0) {
      try {
        await deleteStorageFiles(transientFiles);
      } catch (error) {
        toast.error(`Falha ao descartar anexos temporários: ${error.message}`);
        return;
      }
    }

    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const normalizedAttachments = normalizeStorageFileReferences(formData.attachment_urls);
      await onSave({
        ...formData,
        teacher_id: authUser?.id,
        attachment_urls: normalizedAttachments,
      }, {
        removedPersistedAttachments: diffRemovedStorageFileReferences(
          initialAttachmentRefs,
          normalizedAttachments
        ),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen && !saving) {
        void handleDialogClose();
      }
    }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{plan ? 'Editar Plano de Aula' : 'Novo Plano de Aula'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Título *</Label>
              <Input 
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                required
              />
            </div>
            <div>
              <Label>Disciplina *</Label>
              <Select value={formData.subject_id} onValueChange={(value) => setFormData({...formData, subject_id: value})} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <Label>Série/Ano</Label>
              <Input 
                value={formData.grade_level}
                onChange={(e) => setFormData({...formData, grade_level: e.target.value})}
              />
            </div>
            <div>
              <Label>Duração (min)</Label>
              <Input 
                type="number"
                value={formData.duration_minutes}
                onChange={(e) => setFormData({...formData, duration_minutes: Number(e.target.value)})}
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({...formData, status: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rascunho">Rascunho</SelectItem>
                  <SelectItem value="aprovado">Aprovado</SelectItem>
                  <SelectItem value="em_uso">Em Uso</SelectItem>
                  <SelectItem value="arquivado">Arquivado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Tema/Unidade Temática</Label>
            <Input 
              value={formData.theme}
              onChange={(e) => setFormData({...formData, theme: e.target.value})}
            />
          </div>

          <div>
            <Label>Conteúdo Programático *</Label>
            <Textarea 
              value={formData.content}
              onChange={(e) => setFormData({...formData, content: e.target.value})}
              rows={4}
              required
            />
          </div>

          <div>
            <Label>Metodologia/Procedimentos Didáticos</Label>
            <Textarea 
              value={formData.methodology}
              onChange={(e) => setFormData({...formData, methodology: e.target.value})}
              rows={3}
            />
          </div>

          <div>
            <Label>Avaliação/Critérios</Label>
            <Textarea 
              value={formData.evaluation}
              onChange={(e) => setFormData({...formData, evaluation: e.target.value})}
              rows={3}
            />
          </div>

          <div>
            <Label>Tarefa de Casa Sugerida</Label>
            <Textarea 
              value={formData.homework}
              onChange={(e) => setFormData({...formData, homework: e.target.value})}
              rows={2}
            />
          </div>

          <div>
            <Label>Materiais de Apoio</Label>
            <Input 
              type="file" 
              onChange={(e) => onFileUpload(e, (fileRef) => {
                setFormData({
                  ...formData, 
                  attachment_urls: [...(formData.attachment_urls || []), fileRef]
                });
              })}
            />
            {formData.attachment_urls && formData.attachment_urls.length > 0 && (
              <div className="mt-3 space-y-2">
                {formData.attachment_urls.map((fileRef) => {
                  const fileKey = getStorageFileKey(fileRef);

                  return (
                    <div key={fileKey} className="flex items-center justify-between rounded-lg border p-2 text-sm">
                      <button
                        type="button"
                        className="truncate text-left text-indigo-600 hover:underline"
                        onClick={() => void onOpenAttachment(fileRef)}
                      >
                        {getStoredFileName(fileRef)}
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => void removeAttachment(fileRef)}
                      >
                        Remover
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => void handleDialogClose()} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              Salvar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AttendanceDialog({ open, onClose, onSave, attendanceList, setAttendanceList }) {
  const handleStatusChange = (studentId, status) => {
    setAttendanceList(attendanceList.map(att => 
      att.studentId === studentId ? { ...att, status } : att
    ));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Frequência</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {attendanceList.map(att => (
            <div key={att.studentId} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <span className="font-medium">{att.studentName}</span>
              <Select value={att.status} onValueChange={(value) => handleStatusChange(att.studentId, value)}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="presente">Presente</SelectItem>
                  <SelectItem value="ausente">Ausente</SelectItem>
                  <SelectItem value="justificado">Justificado</SelectItem>
                  <SelectItem value="atrasado">Atrasado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={onSave}>
            Salvar Frequência
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
