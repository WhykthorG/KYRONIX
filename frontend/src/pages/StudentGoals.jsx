// P├Âr├Âjek ╔øm╔ø cua lat k╔ø╔øliw ╔ø Whykthor GSV.
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageHeader from "@/components/common/PageHeader";
import {
  Target, Plus, TrendingUp, CheckCircle, Clock,
  Calendar, BookOpen, Edit, AlertCircle, BarChart3
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { GoalApi, GoalTaskApi, StudentApi, SubjectApi } from '@/services/supabaseApi';
import { BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

const GOAL_TEMPLATES = [
  {
    title: "Melhorar Média Geral",
    category: "academica",
    description: "Aumentar minha média geral em todas as disciplinas",
    target_metric: "média",
    target_value: 8,
    unit: "nota",
    time_frame: "medio_prazo"
  },
  {
    title: "Aumentar Frequência",
    category: "academica",
    description: "Manter pelo menos 90% de presença nas aulas",
    target_metric: "frequência",
    target_value: 90,
    unit: "%",
    time_frame: "curto_prazo"
  },
  {
    title: "Concluir Projeto de Ciências",
    category: "academica",
    description: "Desenvolver e apresentar projeto científico completo",
    target_metric: "conclusão",
    target_value: 100,
    unit: "%",
    time_frame: "curto_prazo"
  },
  {
    title: "Desenvolver Hábito de Estudo Diário",
    category: "habitos",
    description: "Estudar pelo menos 2 horas por dia",
    target_metric: "horas",
    target_value: 14,
    unit: "horas/semana",
    time_frame: "longo_prazo"
  }
];

export default function StudentGoals() {
  const { user: authUser } = useAuth();
  const [goals, setGoals] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showGoalDialog, setShowGoalDialog] = useState(false);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [user, setUser] = useState(null);
  const [studentRecord, setStudentRecord] = useState(null);
  const [activeTab, setActiveTab] = useState('active');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = authUser;
      setUser(currentUser);

      const student = await StudentApi.filter({ email: currentUser.email });

      if (student.length === 0) {
        setLoading(false);
        return;
      }

      setStudentRecord(student[0]);

      const [goalsData, tasksData, subjectsData] = await Promise.all([
        GoalApi.filter({ student_id: student[0].id }),
        GoalTaskApi.filter({ student_id: student[0].id }),
        SubjectApi.list()
      ]);

      setGoals(goalsData);
      setTasks(tasksData);
      setSubjects(subjectsData);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGoal = async (formData) => {
    try {
      if (selectedGoal) {
        await GoalApi.update(selectedGoal.id, formData);
        toast.success('Meta atualizada com sucesso');
      } else {
        await GoalApi.create({
          ...formData,
          student_id: studentRecord.id
        });
        toast.success('Meta criada com sucesso');
      }

      setShowGoalDialog(false);
      setSelectedGoal(null);
      loadData();
    } catch (error) {
      toast.error('Erro ao salvar meta');
    }
  };

  const handleSaveTask = async (formData) => {
    try {
      if (selectedTask) {
        await GoalTaskApi.update(selectedTask.id, formData);
        toast.success('Tarefa atualizada');
      } else {
        await GoalTaskApi.create({
          ...formData,
          student_id: studentRecord.id
        });
        toast.success('Tarefa criada');
      }

      setShowTaskDialog(false);
      setSelectedTask(null);
      loadData();
    } catch (error) {
      toast.error('Erro ao salvar tarefa');
    }
  };

  const updateGoalProgress = async (goalId, newProgress) => {
    try {
      await GoalApi.update(goalId, { progress_percentage: newProgress });
      loadData();
    } catch (error) {
      toast.error('Erro ao atualizar progresso');
    }
  };

  const completeTask = async (taskId) => {
    try {
      await GoalTaskApi.update(taskId, {
        status: 'concluida',
        completed_at: new Date().toISOString()
      });
      toast.success('Tarefa concluída!');
      loadData();
    } catch (error) {
      toast.error('Erro ao completar tarefa');
    }
  };

  const activeGoals = goals.filter(g => ['nao_iniciada', 'em_progresso'].includes(g.status));
  const completedGoals = goals.filter(g => g.status === 'concluida');

  // Estatísticas
  const stats = {
    total: goals.length,
    active: activeGoals.length,
    completed: completedGoals.length,
    avgProgress: goals.length > 0
      ? Math.round(goals.reduce((sum, g) => sum + (g.progress_percentage || 0), 0) / goals.length)
      : 0
  };

  // Dados para gráficos
  const categoryData = ['academica', 'pessoal', 'extracurricular', 'habitos', 'carreira'].map(cat => ({
    name: cat.charAt(0).toUpperCase() + cat.slice(1).replace('_', ' '),
    value: goals.filter(g => g.category === cat).length
  })).filter(d => d.value > 0);

  const progressData = goals.map(g => ({
    name: g.title.substring(0, 20),
    progresso: g.progress_percentage || 0
  }));

  if (loading) {
    return <div className="p-6">Carregando metas...</div>;
  }

  if (!user) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <h2 className="text-xl font-semibold mb-2">Acesso de Estudante Necessário</h2>
            <p className="text-slate-600">Esta funcionalidade é exclusiva para alunos.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
          backTo="/Dashboard"
          backLabel="Dashboard"
        title="Minhas Metas"
        subtitle="Defina, acompanhe e alcance seus objetivos acadêmicos e pessoais"
        action={() => setShowTemplateDialog(true)}
        actionLabel="Nova Meta"
        actionIcon={Plus}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total de Metas</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">{stats.total}</p>
              </div>
              <Target className="w-10 h-10 text-indigo-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Em Progresso</p>
                <p className="text-3xl font-bold text-blue-600 mt-1">{stats.active}</p>
              </div>
              <TrendingUp className="w-10 h-10 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Concluídas</p>
                <p className="text-3xl font-bold text-green-600 mt-1">{stats.completed}</p>
              </div>
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Progresso Médio</p>
                <p className="text-3xl font-bold text-purple-600 mt-1">{stats.avgProgress}%</p>
              </div>
              <BarChart3 className="w-10 h-10 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {goals.length > 0 && (
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle>Metas por Categoria</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Progresso das Metas</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={progressData.slice(0, 5)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Bar dataKey="progresso" fill="#6366f1" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="active">Em Progresso ({stats.active})</TabsTrigger>
          <TabsTrigger value="completed">Concluídas ({stats.completed})</TabsTrigger>
          <TabsTrigger value="tasks">Tarefas</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <GoalsList
            goals={activeGoals}
            tasks={tasks}
            subjects={subjects}
            onEdit={(goal) => {
              setSelectedGoal(goal);
              setShowGoalDialog(true);
            }}
            onUpdateProgress={updateGoalProgress}
            onAddTask={(goalId) => {
              setSelectedTask({ goal_id: goalId });
              setShowTaskDialog(true);
            }}
          />
        </TabsContent>

        <TabsContent value="completed">
          <GoalsList
            goals={completedGoals}
            tasks={tasks}
            subjects={subjects}
            onEdit={(goal) => {
              setSelectedGoal(goal);
              setShowGoalDialog(true);
            }}
            onUpdateProgress={updateGoalProgress}
          />
        </TabsContent>

        <TabsContent value="tasks">
          <TasksList
            tasks={tasks}
            goals={goals}
            onComplete={completeTask}
            onEdit={(task) => {
              setSelectedTask(task);
              setShowTaskDialog(true);
            }}
          />
        </TabsContent>
      </Tabs>

      <TemplateDialog
        open={showTemplateDialog}
        onClose={() => setShowTemplateDialog(false)}
        onSelectTemplate={(template) => {
          setSelectedGoal(template);
          setShowTemplateDialog(false);
          setShowGoalDialog(true);
        }}
        onCreateBlank={() => {
          setSelectedGoal(null);
          setShowTemplateDialog(false);
          setShowGoalDialog(true);
        }}
      />

      <GoalDialog
        open={showGoalDialog}
        onClose={() => {
          setShowGoalDialog(false);
          setSelectedGoal(null);
        }}
        onSave={handleSaveGoal}
        goal={selectedGoal}
        subjects={subjects}
      />

      <TaskDialog
        open={showTaskDialog}
        onClose={() => {
          setShowTaskDialog(false);
          setSelectedTask(null);
        }}
        onSave={handleSaveTask}
        task={selectedTask}
        goals={goals}
      />
    </div>
  );
}

function GoalsList({ goals, tasks, subjects, onEdit, onUpdateProgress, onAddTask }) {
  if (goals.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center text-slate-500">
          <Target className="w-12 h-12 mx-auto mb-4 text-slate-300" />
          <p>Nenhuma meta encontrada</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {goals.map(goal => {
        const goalTasks = tasks.filter(t => t.goal_id === goal.id);
        const completedTasks = goalTasks.filter(t => t.status === 'concluida').length;
        const daysLeft = differenceInDays(new Date(goal.target_date), new Date());
        const subject = subjects.find(s => s.id === goal.subject_id);

        return (
          <Card key={goal.id} className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-slate-900">{goal.title}</h3>
                    <Badge variant="outline" className="bg-indigo-50 text-indigo-700">
                      {goal.category}
                    </Badge>
                    <Badge className={
                      goal.priority === 'alta' ? 'bg-red-100 text-red-700' :
                      goal.priority === 'media' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-green-100 text-green-700'
                    }>
                      {goal.priority}
                    </Badge>
                  </div>

                  {goal.description && (
                    <p className="text-sm text-slate-600 mb-3">{goal.description}</p>
                  )}

                  {subject && (
                    <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
                      <BookOpen className="w-4 h-4" />
                      {subject.name}
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-sm text-slate-600 mb-3">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      Até {format(new Date(goal.target_date), "dd/MM/yyyy", { locale: ptBR })}
                    </div>
                    {daysLeft >= 0 && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {daysLeft} dias restantes
                      </div>
                    )}
                  </div>

                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-700">
                        Progresso: {goal.progress_percentage || 0}%
                      </span>
                      {goalTasks.length > 0 && (
                        <span className="text-sm text-slate-600">
                          {completedTasks}/{goalTasks.length} tarefas concluídas
                        </span>
                      )}
                    </div>
                    <Progress value={goal.progress_percentage || 0} className="h-3" />
                  </div>

                  {goal.target_value && (
                    <div className="text-sm text-slate-600 mb-3">
                      <strong>Meta:</strong> {goal.current_value || 0} → {goal.target_value} {goal.unit}
                    </div>
                  )}
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onEdit(goal)}
                >
                  <Edit className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex gap-2">
                {onAddTask && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onAddTask(goal.id)}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Adicionar Tarefa
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const newProgress = prompt(`Atualizar progresso (0-100):`, goal.progress_percentage || 0);
                    if (newProgress !== null) {
                      onUpdateProgress(goal.id, Math.min(100, Math.max(0, parseInt(newProgress))));
                    }
                  }}
                >
                  Atualizar Progresso
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function TasksList({ tasks, goals, onComplete, onEdit }) {
  const pendingTasks = tasks.filter(t => t.status !== 'concluida');
  const completedTasks = tasks.filter(t => t.status === 'concluida');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Tarefas Pendentes ({pendingTasks.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {pendingTasks.map(task => {
              const goal = goals.find(g => g.id === task.goal_id);
              const isOverdue = new Date(task.due_date) < new Date();

              return (
                <div
                  key={task.id}
                  className={`p-4 border rounded-lg ${isOverdue ? 'border-red-200 bg-red-50' : 'border-slate-200'}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-900">{task.title}</h4>
                      {goal && (
                        <p className="text-sm text-slate-600">Meta: {goal.title}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-sm text-slate-600">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {format(new Date(task.due_date), "dd/MM/yyyy", { locale: ptBR })}
                        </div>
                        {task.estimated_hours && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {task.estimated_hours}h
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onEdit(task)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => onComplete(task.id)}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Concluir
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}

            {pendingTasks.length === 0 && (
              <div className="text-center py-8 text-slate-500">
                Nenhuma tarefa pendente
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {completedTasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Tarefas Concluídas ({completedTasks.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {completedTasks.slice(0, 5).map(task => {
                const goal = goals.find(g => g.id === task.goal_id);
                return (
                  <div key={task.id} className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-slate-900 line-through">{task.title}</h4>
                        {goal && (
                          <p className="text-sm text-slate-600">Meta: {goal.title}</p>
                        )}
                      </div>
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TemplateDialog({ open, onClose, onSelectTemplate, onCreateBlank }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Escolha um Modelo de Meta</DialogTitle>
        </DialogHeader>
        <div className="grid md:grid-cols-2 gap-4">
          <Card
            className="cursor-pointer hover:shadow-lg transition-shadow border-2 border-dashed"
            onClick={onCreateBlank}
          >
            <CardContent className="p-6 text-center">
              <Plus className="w-12 h-12 mx-auto mb-3 text-slate-400" />
              <h3 className="font-semibold mb-2">Criar do Zero</h3>
              <p className="text-sm text-slate-600">Crie uma meta personalizada</p>
            </CardContent>
          </Card>

          {GOAL_TEMPLATES.map((template, index) => (
            <Card
              key={index}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => onSelectTemplate(template)}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                    <Target className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">{template.title}</h3>
                    <p className="text-sm text-slate-600 mb-2">{template.description}</p>
                    <div className="flex gap-2">
                      <Badge variant="outline">{template.category}</Badge>
                      <Badge variant="outline">{template.time_frame}</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GoalDialog({ open, onClose, onSave, goal, subjects }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'academica',
    subject_id: '',
    target_metric: '',
    current_value: 0,
    target_value: 0,
    unit: '',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    target_date: '',
    time_frame: 'medio_prazo',
    priority: 'media',
    status: 'nao_iniciada',
    progress_percentage: 0
  });

  useEffect(() => {
    if (goal) {
      setFormData({
        title: goal.title || '',
        description: goal.description || '',
        category: goal.category || 'academica',
        subject_id: goal.subject_id || '',
        target_metric: goal.target_metric || '',
        current_value: goal.current_value || 0,
        target_value: goal.target_value || 0,
        unit: goal.unit || '',
        start_date: goal.start_date || format(new Date(), 'yyyy-MM-dd'),
        target_date: goal.target_date || '',
        time_frame: goal.time_frame || 'medio_prazo',
        priority: goal.priority || 'media',
        status: goal.status || 'nao_iniciada',
        progress_percentage: goal.progress_percentage || 0
      });
    }
  }, [goal, open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{goal && goal.id ? 'Editar Meta' : 'Nova Meta'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Título da Meta *</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              placeholder="Ex: Melhorar nota em Matemática"
            />
          </div>

          <div>
            <Label>Descrição</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              placeholder="Descreva sua meta em detalhes..."
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Categoria *</Label>
              <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="academica">Acadêmica</SelectItem>
                  <SelectItem value="pessoal">Pessoal</SelectItem>
                  <SelectItem value="extracurricular">Extracurricular</SelectItem>
                  <SelectItem value="habitos">Hábitos</SelectItem>
                  <SelectItem value="carreira">Carreira</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Disciplina (se aplicável)</Label>
              <Select value={formData.subject_id} onValueChange={(value) => setFormData({ ...formData, subject_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Nenhuma</SelectItem>
                  {subjects.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <Label>Valor Atual</Label>
              <Input
                type="number"
                step="0.1"
                value={formData.current_value}
                onChange={(e) => setFormData({ ...formData, current_value: parseFloat(e.target.value) })}
              />
            </div>
            <div>
              <Label>Valor Alvo</Label>
              <Input
                type="number"
                step="0.1"
                value={formData.target_value}
                onChange={(e) => setFormData({ ...formData, target_value: parseFloat(e.target.value) })}
              />
            </div>
            <div>
              <Label>Unidade</Label>
              <Input
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                placeholder="nota, %, horas..."
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Data Início</Label>
              <Input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              />
            </div>
            <div>
              <Label>Data Alvo *</Label>
              <Input
                type="date"
                value={formData.target_date}
                onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <Label>Prazo</Label>
              <Select value={formData.time_frame} onValueChange={(value) => setFormData({ ...formData, time_frame: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="curto_prazo">Curto Prazo</SelectItem>
                  <SelectItem value="medio_prazo">Médio Prazo</SelectItem>
                  <SelectItem value="longo_prazo">Longo Prazo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Prioridade</Label>
              <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nao_iniciada">Não Iniciada</SelectItem>
                  <SelectItem value="em_progresso">Em Progresso</SelectItem>
                  <SelectItem value="pausada">Pausada</SelectItem>
                  <SelectItem value="concluida">Concluída</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit">
              Salvar Meta
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TaskDialog({ open, onClose, onSave, task, goals }) {
  const [formData, setFormData] = useState({
    goal_id: '',
    title: '',
    description: '',
    due_date: '',
    estimated_hours: 0,
    priority: 'media',
    status: 'pendente'
  });

  useEffect(() => {
    if (task) {
      setFormData({
        goal_id: task.goal_id || '',
        title: task.title || '',
        description: task.description || '',
        due_date: task.due_date || '',
        estimated_hours: task.estimated_hours || 0,
        priority: task.priority || 'media',
        status: task.status || 'pendente'
      });
    }
  }, [task, open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{task && task.id ? 'Editar Tarefa' : 'Nova Tarefa'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Meta Relacionada *</Label>
            <Select value={formData.goal_id} onValueChange={(value) => setFormData({ ...formData, goal_id: value })} required>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma meta" />
              </SelectTrigger>
              <SelectContent>
                {goals.filter(g => g.status !== 'concluida').map(g => (
                  <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Título da Tarefa *</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              placeholder="Ex: Estudar capítulo 5"
            />
          </div>

          <div>
            <Label>Descrição</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Data de Entrega *</Label>
              <Input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Horas Estimadas</Label>
              <Input
                type="number"
                step="0.5"
                value={formData.estimated_hours}
                onChange={(e) => setFormData({ ...formData, estimated_hours: parseFloat(e.target.value) })}
              />
            </div>
          </div>

          <div>
            <Label>Prioridade</Label>
            <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="baixa">Baixa</SelectItem>
                <SelectItem value="media">Média</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit">
              Salvar Tarefa
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
