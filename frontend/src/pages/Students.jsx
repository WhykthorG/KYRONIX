import React, { useDeferredValue, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DataTable from '@/components/common/DataTable';
import StatusBadge from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import {
  User, MapPin, Heart, BookOpen,
  Eye, Edit, Trash2, Upload, ChevronLeft, ChevronRight,
  CheckCircle, ArrowRight, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format } from 'date-fns';
import BulkImportDialog from '@/components/common/BulkImportDialog';
import PageHeader from '@/components/common/PageHeader';
import { ClassApi, StudentApi } from '@/services/supabaseApi';
import { usePermissions } from '@/components/hooks/usePermissions';
import { useLocation } from 'react-router-dom';
import {
  createEnrollmentWithAccess,
  formatAdminRequestErrorMessage,
} from '@/lib/supabaseAdmin';
import {
  buildEnrollmentMutationInput,
  buildEnrollmentRegularizationPayload,
  canManageEnrollmentRegularization,
  canRegularizeEnrollment,
  countStudentsBlockedForRegularization,
  ENROLLMENT_STATUSES,
  formatEnrollmentStudentFormInitialData,
  filterStudentsPendingRegularization,
  getEnrollmentRegularizationIssues,
  normalizeEnrollmentStudentPayload,
} from '@shared/contracts/enrollment';
import {
  canAccessDashboard,
  canWriteStudents,
} from '@shared/contracts/access';
import { CPFInput, PhoneInput, EmailInput, NameInput, DateInput, CEPInput } from '@/components/common/ValidatedInput';
import { useGlobalSearchNavigation } from '@/hooks/useGlobalSearchNavigation';

const STUDENT_SCHEMA = {
  type: 'object',
  properties: {
    full_name: { type: 'string' }, birth_date: { type: 'string' },
    cpf: { type: 'string' }, email: { type: 'string' },
    phone: { type: 'string' }, gender: { type: 'string' },
    current_grade: { type: 'string' }, shift: { type: 'string' },
    guardian_name: { type: 'string' }, guardian_phone: { type: 'string' },
  },
};
const STUDENT_PREVIEW_COLS = ['full_name', 'birth_date', 'cpf', 'email', 'current_grade', 'shift', 'guardian_name'];
const STUDENT_FILTERS = {
  ALL: 'all',
  PENDING_REGULARIZATION: 'pending_regularization',
  ACTIVE: 'active',
  PENDING_OR_INACTIVE: 'pending_or_inactive',
};

const SECTIONS = [
  { id: 'personal', label: 'Dados Pessoais', icon: User },
  { id: 'address',  label: 'Endereço',       icon: MapPin },
  { id: 'guardian', label: 'Responsável',    icon: Heart },
  { id: 'academic', label: 'Acadêmico',      icon: BookOpen },
];

const EMPTY = {
  full_name: '', birth_date: '', gender: '', cpf: '',
  email: '', phone: '', blood_type: '', health_conditions: '', medications: '',
  address: { street: '', number: '', complement: '', neighborhood: '', city: '', state: '', zip_code: '' },
  guardian_name: '', guardian_cpf: '', guardian_relationship: '',
  guardian_phone: '', guardian_mobile: '', guardian_email: '',
  current_grade: '', shift: '', current_class_id: '', enrollment_status: 'pendente', notes: '',
};

function Field({ label, children, required }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-slate-700">
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}

function SectionPersonal({ data, onChange }) {
  const set = (k, v) => onChange({ ...data, [k]: v });
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="md:col-span-2">
        <NameInput
          label="Nome Completo"
          required
          value={data.full_name}
          onChange={v => set('full_name', v)}
        />
      </div>
      <DateInput
        label="Data de Nascimento"
        required
        value={data.birth_date}
        onChange={v => set('birth_date', v)}
      />
      <Field label="Gênero">
        <Select value={data.gender} onValueChange={v => set('gender', v)}>
          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="masculino">Masculino</SelectItem>
            <SelectItem value="feminino">Feminino</SelectItem>
            <SelectItem value="outro">Outro</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <CPFInput
        label="CPF"
        value={data.cpf}
        onChange={v => set('cpf', v)}
      />

      <EmailInput label="E-mail" value={data.email} onChange={v => set('email', v)} />
      <PhoneInput label="Telefone" value={data.phone} onChange={v => set('phone', v)} />
      <Field label="Tipo Sanguíneo">
        <Select value={data.blood_type} onValueChange={v => set('blood_type', v)}>
          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>{['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <Field label="Condições de saúde / alergias"><Input value={data.health_conditions} onChange={e => set('health_conditions', e.target.value)} placeholder="Descreva se houver" /></Field>
      <div className="md:col-span-2">
        <Field label="Medicamentos de uso contínuo"><Input value={data.medications} onChange={e => set('medications', e.target.value)} placeholder="Descreva se houver" /></Field>
      </div>
    </div>
  );
}

function SectionAddress({ data, onChange }) {
  const set = (k, v) => onChange({ ...data, address: { ...data.address, [k]: v } });
  const addr = data.address || {};
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="md:col-span-2"><Field label="Logradouro"><Input value={addr.street} onChange={e => set('street', e.target.value)} placeholder="Rua, Avenida..." /></Field></div>
      <Field label="Número"><Input value={addr.number} onChange={e => set('number', e.target.value)} placeholder="Nº" /></Field>
      <Field label="Complemento"><Input value={addr.complement} onChange={e => set('complement', e.target.value)} placeholder="Apto, Bloco..." /></Field>
      <Field label="Bairro"><Input value={addr.neighborhood} onChange={e => set('neighborhood', e.target.value)} placeholder="Bairro" /></Field>
      <CEPInput label="CEP" value={addr.zip_code} onChange={v => set('zip_code', v)} />
      <Field label="Cidade"><Input value={addr.city} onChange={e => set('city', e.target.value)} placeholder="Cidade" /></Field>
      <Field label="Estado">
        <Select value={addr.state} onValueChange={v => set('state', v)}>
          <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
          <SelectContent>{['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
    </div>
  );
}

function SectionGuardian({ data, onChange }) {
  const set = (k, v) => onChange({ ...data, [k]: v });
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="md:col-span-2"><NameInput label="Nome do Responsável" required value={data.guardian_name} onChange={v => set('guardian_name', v)} /></div>
      <Field label="Parentesco">
        <Select value={data.guardian_relationship} onValueChange={v => set('guardian_relationship', v)}>
          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pai">Pai</SelectItem>
            <SelectItem value="mae">Mãe</SelectItem>
            <SelectItem value="avo">Avô/Avó</SelectItem>
            <SelectItem value="tio">Tio/Tia</SelectItem>
            <SelectItem value="responsavel_legal">Responsável Legal</SelectItem>
            <SelectItem value="outro">Outro</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <CPFInput
        label="CPF do Responsável"
        value={data.guardian_cpf}
        onChange={v => set('guardian_cpf', v)}
      />
      <PhoneInput label="Telefone" required value={data.guardian_phone} onChange={v => set('guardian_phone', v)} />
      <PhoneInput label="Celular" value={data.guardian_mobile} onChange={v => set('guardian_mobile', v)} />
      <div className="md:col-span-2"><EmailInput label="E-mail do Responsável" value={data.guardian_email} onChange={v => set('guardian_email', v)} /></div>
    </div>
  );
}

function SectionAcademic({ data, onChange, classes }) {
  const set = (k, v) => onChange({ ...data, [k]: v });
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Field label="Série / Ano"><Input value={data.current_grade} onChange={e => set('current_grade', e.target.value)} placeholder="Ex: 1º Ano" /></Field>
      <Field label="Turno">
        <Select value={data.shift} onValueChange={v => set('shift', v)}>
          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="matutino">Matutino</SelectItem>
            <SelectItem value="vespertino">Vespertino</SelectItem>
            <SelectItem value="noturno">Noturno</SelectItem>
            <SelectItem value="integral">Integral</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <div className="md:col-span-2">
        <Field label="Turma">
          <Select value={data.current_class_id} onValueChange={v => set('current_class_id', v)}>
            <SelectTrigger><SelectValue placeholder="Selecione a turma" /></SelectTrigger>
            <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name} — {c.year}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
      </div>
      <Field label="Status">
        <Select value={data.enrollment_status} onValueChange={v => set('enrollment_status', v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="inativo">Inativo</SelectItem>
            <SelectItem value="transferido">Transferido</SelectItem>
            <SelectItem value="formado">Formado</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <div className="md:col-span-2"><Field label="Observações"><Textarea value={data.notes} onChange={e => set('notes', e.target.value)} rows={3} placeholder="Informações adicionais..." /></Field></div>
    </div>
  );
}

function StudentForm({ initialData, isEdit, classes, onBack, onSave, isSaving }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState(
    initialData
      ? { ...EMPTY, ...formatEnrollmentStudentFormInitialData(initialData) }
      : { ...EMPTY }
  );
  const totalSteps = SECTIONS.length;
  const current = SECTIONS[step];
  const Icon = current.icon;

  const handleSubmit = async () => {
    if (!data.full_name?.trim()) { toast.error('Nome completo é obrigatório.'); setStep(0); return; }
    await onSave(data);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-slate-400 hover:text-slate-600 transition-colors" aria-label="Voltar para a etapa anterior" data-tooltip="Voltar para a etapa anterior"><ChevronLeft className="w-5 h-5" /></button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{isEdit ? 'Editar Aluno' : 'Novo Aluno'}</h1>
          <p className="text-slate-500 text-sm">Etapa {step + 1} de {totalSteps} — {current.label}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {SECTIONS.map((s, i) => {
          const SIcon = s.icon;
          return (
            <React.Fragment key={s.id}>
              <button onClick={() => setStep(i)} className={cn("flex items-center justify-center w-9 h-9 rounded-full font-bold transition-all border-2",
                i < step ? 'bg-indigo-600 border-indigo-600 text-white' :
                i === step ? 'bg-white border-indigo-600 text-indigo-600' : 'bg-white border-slate-200 text-slate-400')}
                aria-label={`Ir para a etapa ${s.label}`}
                data-tooltip={`Ir para a etapa ${s.label}`}>
                {i < step ? <CheckCircle className="w-4 h-4" /> : <SIcon className="w-4 h-4" />}
              </button>
              {i < totalSteps - 1 && <div className={cn("flex-1 h-1 rounded transition-all", i < step ? 'bg-indigo-600' : 'bg-slate-200')} />}
            </React.Fragment>
          );
        })}
      </div>

      <div className="flex items-center gap-3 p-4 rounded-2xl border-2 border-indigo-100 bg-indigo-50">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-semibold text-indigo-900">{current.label}</p>
          <p className="text-xs text-indigo-600">Preencha os campos desta etapa</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        {step === 0 && <SectionPersonal data={data} onChange={setData} />}
        {step === 1 && <SectionAddress data={data} onChange={setData} />}
        {step === 2 && <SectionGuardian data={data} onChange={setData} />}
        {step === 3 && <SectionAcademic data={data} onChange={setData} classes={classes} />}
      </div>

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => setStep(s => s - 1)} disabled={step === 0}>
          <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
        </Button>
        {step < totalSteps - 1 ? (
          <Button onClick={() => setStep(s => s + 1)} className="bg-indigo-600 hover:bg-indigo-700">
            Próximo <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700 px-8">
            {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</> : <>{isEdit ? 'Salvar Alterações' : 'Cadastrar Aluno'} <ArrowRight className="w-4 h-4 ml-2" /></>}
          </Button>
        )}
      </div>
    </div>
  );
}

export default function Students({ globalSearch, openApp }) {
  const { profileType } = usePermissions();
  const location = useLocation();
  const [view, setView] = useState('list');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [studentFilter, setStudentFilter] = useState(STUDENT_FILTERS.ALL);
  const [showDetails, setShowDetails] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [highlightedStudentId, setHighlightedStudentId] = useState(null);
  const [savedData, setSavedData] = useState(null);
  const [regularizingStudentId, setRegularizingStudentId] = useState(null);
  const queryClient = useQueryClient();
  const openEnrollmentRegistration = () => {
    if (typeof openApp === 'function') {
      openApp('registration', { initialModeProp: 'matricula' });
      return;
    }

    window.location.href = '/Registration?mode=matricula';
  };

  const { data: students = [], isLoading } = useQuery({ queryKey: ['students'], queryFn: () => StudentApi.list('-created_at') });
  const { data: classes = [] } = useQuery({ queryKey: ['classes'], queryFn: () => ClassApi.list() });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const enrollmentRequest = buildEnrollmentMutationInput({
        student: normalizeEnrollmentStudentPayload({
          ...data,
          enrollment_date: data.enrollment_date || new Date().toISOString().split('T')[0],
        }),
      });

      const result = await createEnrollmentWithAccess({
        student: enrollmentRequest.student,
        access: enrollmentRequest.access,
      });

      return {
        student: result.student,
        submittedData: data,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setSavedData(result?.submittedData || null);
      setView('success');
    },
    onError: (error) => toast.error(formatAdminRequestErrorMessage(
      error,
      'Erro ao cadastrar aluno.'
    )),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => StudentApi.update(id, normalizeEnrollmentStudentPayload(data)),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['students'] }); toast.success('Aluno atualizado!'); setView('list'); setSelectedStudent(null); },
    onError: () => toast.error('Erro ao atualizar aluno.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => StudentApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['students'] }); toast.success('Aluno removido.'); },
  });

  const regularizeEnrollmentMutation = useMutation({
    mutationFn: ({ id, data }) => StudentApi.update(id, data),
    onMutate: ({ id }) => {
      setRegularizingStudentId(id);
    },
    onSuccess: (updatedStudent) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setSelectedStudent((currentStudent) => (
        currentStudent?.id === updatedStudent.id ? updatedStudent : currentStudent
      ));
      toast.success('Matrícula regularizada com sucesso.');
    },
    onError: (error) => {
      toast.error(error?.message || 'Não foi possível regularizar a matrícula.');
    },
    onSettled: () => {
      setRegularizingStudentId(null);
    },
  });

  const bulkImportMutation = useMutation({
    mutationFn: (rows) => StudentApi.bulkCreate(
      rows.map((row) => normalizeEnrollmentStudentPayload({
        ...row,
        enrollment_status: row.enrollment_status || 'pendente',
      }))
    ),
    onSuccess: (_, rows) => { queryClient.invalidateQueries({ queryKey: ['students'] }); toast.success(`${rows.length} aluno(s) importado(s)!`); },
  });

  const handleSave = (data) => {
    const payload = normalizeEnrollmentStudentPayload(data);

    if (selectedStudent) { updateMutation.mutate({ id: selectedStudent.id, data: payload }); }
    else { createMutation.mutate({ ...payload, enrollment_status: payload.enrollment_status || 'pendente' }); }
  };

  const handleRegularizeEnrollment = (student) => {
    const issues = getEnrollmentRegularizationIssues(student);

    if (issues.length > 0) {
      toast.error(issues[0]);
      return;
    }

    regularizeEnrollmentMutation.mutate({
      id: student.id,
      data: buildEnrollmentRegularizationPayload(student, {
        actorName: profileType || 'gestao',
        now: new Date(),
      }),
    });
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const canSeeDashboard = canAccessDashboard(profileType);
  const canManageRegularizations = canManageEnrollmentRegularization(profileType);
  const canWriteStudentRecords = canWriteStudents(profileType);
  const cameFromDashboard = Boolean(
    location.state?.fromDashboard || sessionStorage.getItem('route_previous') === '/Dashboard'
  );
  const showDashboardBack = canSeeDashboard && cameFromDashboard;

  const searchedStudents = useMemo(() => (
    students.filter((student) =>
      student.full_name?.toLowerCase().includes(deferredSearch.toLowerCase()) ||
      student.registration_number?.toLowerCase().includes(deferredSearch.toLowerCase()) ||
      student.email?.toLowerCase().includes(deferredSearch.toLowerCase())
    )
  ), [deferredSearch, students]);

  const studentsPendingRegularization = useMemo(
    () => filterStudentsPendingRegularization(searchedStudents, profileType),
    [searchedStudents, profileType]
  );

  const blockedRegularizationCount = useMemo(
    () => countStudentsBlockedForRegularization(searchedStudents, profileType),
    [searchedStudents, profileType]
  );

  const readyRegularizationCount = studentsPendingRegularization.length - blockedRegularizationCount;

  const filtered = useMemo(() => {
    switch (studentFilter) {
      case STUDENT_FILTERS.PENDING_REGULARIZATION:
        return studentsPendingRegularization;
      case STUDENT_FILTERS.ACTIVE:
        return searchedStudents.filter((student) => student.enrollment_status === ENROLLMENT_STATUSES.ACTIVE);
      case STUDENT_FILTERS.PENDING_OR_INACTIVE:
        return searchedStudents.filter((student) => (
          [ENROLLMENT_STATUSES.PENDING, ENROLLMENT_STATUSES.INACTIVE].includes(student.enrollment_status)
        ));
      default:
        return searchedStudents;
    }
  }, [searchedStudents, studentFilter, studentsPendingRegularization]);

  useGlobalSearchNavigation({
    entityKey: 'students',
    globalSearch,
    isReady: !isLoading,
    onNavigate: ({ query, recordId }) => {
      const matchedStudent = students.find((student) => student.id === recordId) || null;
      setView('list');
      setStudentFilter(STUDENT_FILTERS.ALL);
      setSearch(query || '');
      setHighlightedStudentId(recordId || null);
      setSelectedStudent(matchedStudent);
      setShowDetails(Boolean(matchedStudent));
    },
  });

  const emptyMessageByFilter = {
    [STUDENT_FILTERS.ALL]: 'Nenhum aluno encontrado',
    [STUDENT_FILTERS.PENDING_REGULARIZATION]: 'Nenhuma matrícula pendente de regularização para os filtros atuais.',
    [STUDENT_FILTERS.ACTIVE]: 'Nenhum aluno ativo encontrado para os filtros atuais.',
    [STUDENT_FILTERS.PENDING_OR_INACTIVE]: 'Nenhum aluno pendente ou inativo encontrado para os filtros atuais.',
  };

  const columns = [
    { key: 'full_name', label: 'Aluno', render: (row) => (
      <div className="flex items-center gap-3">
        <Avatar className="w-10 h-10">
          <AvatarImage src={row.photo_url} />
          <AvatarFallback className="bg-indigo-100 text-indigo-700">{row.full_name?.charAt(0)}</AvatarFallback>
        </Avatar>
        <div>
          <p className="font-medium text-slate-900">{row.full_name}</p>
          <p className="text-sm text-slate-500">{row.registration_number || 'Sem matrícula'}</p>
          {canManageRegularizations && canRegularizeEnrollment(row, profileType) && (
            <p className={cn(
              'mt-1 text-xs font-medium',
              getEnrollmentRegularizationIssues(row).length > 0 ? 'text-amber-700' : 'text-emerald-700'
            )}>
              {getEnrollmentRegularizationIssues(row).length > 0
                ? 'Regularização bloqueada por dados acadêmicos pendentes'
                : 'Pronto para regularização'}
            </p>
          )}
        </div>
      </div>
    )},
    { key: 'current_grade', label: 'Série/Turma', render: (row) => <span className="text-slate-600">{row.current_grade || '-'}</span> },
    { key: 'shift', label: 'Turno', render: (row) => <span className="text-slate-600">{{ matutino:'Matutino', vespertino:'Vespertino', noturno:'Noturno', integral:'Integral' }[row.shift] || '-'}</span> },
    { key: 'guardian_name', label: 'Responsável', render: (row) => <span className="text-slate-600">{row.guardian_name || '-'}</span> },
    { key: 'enrollment_status', label: 'Status', render: (row) => <StatusBadge status={row.enrollment_status} /> },
    { key: 'actions', label: 'Ações', render: (row) => (
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setSelectedStudent(row); setShowDetails(true); }} aria-label={`Ver aluno ${row.full_name}`} data-tooltip={`Ver aluno ${row.full_name}`}><Eye className="w-4 h-4 text-slate-500" /></Button>
        {canWriteStudentRecords && (
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setSelectedStudent(row); setView('edit'); }} aria-label={`Editar aluno ${row.full_name}`} data-tooltip={`Editar aluno ${row.full_name}`}><Edit className="w-4 h-4 text-slate-500" /></Button>
        )}
        {canRegularizeEnrollment(row, profileType) && (
          <Button
            variant="ghost"
            size="icon"
            title="Regularizar matrícula"
            aria-label={`Regularizar matrícula de ${row.full_name}`}
            data-tooltip={`Regularizar matrícula de ${row.full_name}`}
            onClick={(e) => {
              e.stopPropagation();
              handleRegularizeEnrollment(row);
            }}
            disabled={regularizeEnrollmentMutation.isPending && regularizingStudentId === row.id}
          >
            {regularizeEnrollmentMutation.isPending && regularizingStudentId === row.id ? (
              <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
            ) : (
              <CheckCircle className="w-4 h-4 text-emerald-600" />
            )}
          </Button>
        )}
        {canWriteStudentRecords && (
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); if (confirm('Excluir este aluno?')) deleteMutation.mutate(row.id); }} aria-label={`Excluir aluno ${row.full_name}`} data-tooltip={`Excluir aluno ${row.full_name}`}><Trash2 className="w-4 h-4 text-rose-500" /></Button>
        )}
      </div>
    )},
  ];

  if (view === 'success') {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto"><CheckCircle className="w-10 h-10 text-emerald-600" /></div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Aluno Cadastrado!</h2>
          <p className="text-slate-500 mt-2"><strong>{savedData?.full_name}</strong> foi cadastrado com sucesso.</p>
        </div>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={openEnrollmentRegistration}>Novo Cadastro</Button>
          <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={() => { setSavedData(null); setView('list'); }}>Ver Lista de Alunos</Button>
        </div>
      </div>
    );
  }

  if ((view === 'new' || view === 'edit') && canWriteStudentRecords) {
    return <StudentForm initialData={view === 'edit' ? selectedStudent : null} isEdit={view === 'edit'} classes={classes} onBack={() => { setView('list'); setSelectedStudent(null); }} onSave={handleSave} isSaving={isSaving} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alunos"
        subtitle={`${students.length} aluno(s) cadastrado(s) e disponíveis para consulta e edição.`}
        backTo={showDashboardBack ? '/Dashboard' : undefined}
        action={canWriteStudentRecords ? openEnrollmentRegistration : undefined}
        actionLabel={canWriteStudentRecords ? 'Novo Aluno' : undefined}
      >
        {canWriteStudentRecords && (
          <Button variant="outline" onClick={() => setShowImport(true)}>
            <Upload className="w-4 h-4 mr-2" /> Importar CSV/Excel
          </Button>
        )}
      </PageHeader>

      {canManageRegularizations && (
        <>
          <div className="app-metric-grid">
            <button
              type="button"
              onClick={() => setStudentFilter(STUDENT_FILTERS.PENDING_REGULARIZATION)}
              className={cn(
                'app-surface-card p-5 text-left transition-all hover:-translate-y-0.5',
                studentFilter === STUDENT_FILTERS.PENDING_REGULARIZATION && 'ring-2 ring-primary/25'
              )}
            >
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--feedback-warning-fg))]">
                Pendentes de regularização
              </p>
              <p className="text-3xl font-bold text-foreground">{studentsPendingRegularization.length}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Matrículas que ainda exigem ação da gestão.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setStudentFilter(STUDENT_FILTERS.PENDING_REGULARIZATION)}
              className={cn(
                'app-surface-card border-[hsl(var(--feedback-success-fg)/0.14)] bg-[hsl(var(--feedback-success-bg))] p-5 text-left transition-all hover:-translate-y-0.5',
                studentFilter === STUDENT_FILTERS.PENDING_REGULARIZATION && 'ring-2 ring-[hsl(var(--feedback-success-fg)/0.2)]'
              )}
            >
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--feedback-success-fg))]">
                Prontas para ativar
              </p>
              <p className="text-3xl font-bold text-[hsl(var(--feedback-success-fg))]">{readyRegularizationCount}</p>
              <p className="mt-2 text-sm text-[hsl(var(--feedback-success-fg))]">
                Já têm turma e série informadas.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setStudentFilter(STUDENT_FILTERS.PENDING_REGULARIZATION)}
              className={cn(
                'app-surface-card border-[hsl(var(--feedback-warning-fg)/0.14)] bg-[hsl(var(--feedback-warning-bg))] p-5 text-left transition-all hover:-translate-y-0.5',
                studentFilter === STUDENT_FILTERS.PENDING_REGULARIZATION && 'ring-2 ring-[hsl(var(--feedback-warning-fg)/0.2)]'
              )}
            >
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--feedback-warning-fg))]">
                Bloqueadas por cadastro
              </p>
              <p className="text-3xl font-bold text-[hsl(var(--feedback-warning-fg))]">{blockedRegularizationCount}</p>
              <p className="mt-2 text-sm text-[hsl(var(--feedback-warning-fg))]">

                Precisam de turma ou série antes da regularização.
              </p>
            </button>
          </div>

          <div className="app-surface-card flex flex-wrap items-center gap-2 p-4">
            <Button
              variant={studentFilter === STUDENT_FILTERS.ALL ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStudentFilter(STUDENT_FILTERS.ALL)}
            >
              Todos ({searchedStudents.length})
            </Button>
            <Button
              variant={studentFilter === STUDENT_FILTERS.PENDING_REGULARIZATION ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStudentFilter(STUDENT_FILTERS.PENDING_REGULARIZATION)}
            >
              Regularização pendente ({studentsPendingRegularization.length})
            </Button>
            <Button
              variant={studentFilter === STUDENT_FILTERS.ACTIVE ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStudentFilter(STUDENT_FILTERS.ACTIVE)}
            >
              Ativos ({searchedStudents.filter((student) => student.enrollment_status === ENROLLMENT_STATUSES.ACTIVE).length})
            </Button>
            <Button
              variant={studentFilter === STUDENT_FILTERS.PENDING_OR_INACTIVE ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStudentFilter(STUDENT_FILTERS.PENDING_OR_INACTIVE)}
            >
              Pendentes/Inativos ({searchedStudents.filter((student) => [ENROLLMENT_STATUSES.PENDING, ENROLLMENT_STATUSES.INACTIVE].includes(student.enrollment_status)).length})
            </Button>
          </div>
        </>
      )}

      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        searchPlaceholder="Buscar por nome, matrícula ou e-mail..."
        searchValue={search}
        onSearchChange={setSearch}
        highlightedRowId={highlightedStudentId}
        emptyMessage={emptyMessageByFilter[studentFilter]}
      />

      {canWriteStudentRecords && (
        <BulkImportDialog open={showImport} onOpenChange={setShowImport} entityName="Alunos" schema={STUDENT_SCHEMA} previewColumns={STUDENT_PREVIEW_COLS} onImport={(rows) => bulkImportMutation.mutate(rows)} isLoading={bulkImportMutation.isPending} />
      )}

      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <Avatar className="w-14 h-14">
                <AvatarImage src={selectedStudent?.photo_url} />
                <AvatarFallback className="bg-indigo-100 text-indigo-700 text-2xl">{selectedStudent?.full_name?.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-xl font-bold text-slate-900">{selectedStudent?.full_name}</h3>
                <p className="text-slate-500">Matrícula: {selectedStudent?.registration_number || 'Não informada'}</p>
                <StatusBadge status={selectedStudent?.enrollment_status} className="mt-1" />
              </div>
            </div>
          </DialogHeader>
          {selectedStudent && (
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[['Nascimento', selectedStudent.birth_date ? format(new Date(selectedStudent.birth_date), 'dd/MM/yyyy') : '-'],
                  ['CPF', selectedStudent.cpf || '-'], ['Série', selectedStudent.current_grade || '-'],
                  ['Turno', selectedStudent.shift || '-'], ['E-mail', selectedStudent.email || '-'],
                  ['Telefone', selectedStudent.phone || '-'], ['Responsável', selectedStudent.guardian_name || '-'],
                  ['Tel. Responsável', selectedStudent.guardian_phone || '-'],
                ].map(([k, v]) => <div key={k}><p className="text-slate-500 text-xs">{k}</p><p className="font-medium text-slate-800">{v}</p></div>)}
              </div>
              {canRegularizeEnrollment(selectedStudent, profileType) && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                  <p className="font-semibold">Matrícula aguardando regularização</p>
                  <p className="mt-1">
                    Esta ação ativa o vínculo do aluno e libera o uso normal dos módulos acadêmicos que dependem de matrícula ativa.
                  </p>
                </div>
              )}
              <div className="flex gap-2 pt-2 border-t">
                {canRegularizeEnrollment(selectedStudent, profileType) && (
                  <Button
                    variant="outline"
                    className="flex-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    onClick={() => handleRegularizeEnrollment(selectedStudent)}
                    disabled={regularizeEnrollmentMutation.isPending}
                  >
                    {regularizeEnrollmentMutation.isPending && regularizingStudentId === selectedStudent.id ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Regularizando...</>
                    ) : (
                      <><CheckCircle className="w-4 h-4 mr-2" /> Regularizar Matrícula</>
                    )}
                  </Button>
                )}
                {canWriteStudentRecords && (
                  <Button className="flex-1 bg-indigo-600 hover:bg-indigo-700" onClick={() => { setShowDetails(false); setView('edit'); }}>
                    <Edit className="w-4 h-4 mr-2" /> Editar
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

