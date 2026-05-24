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
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import {
  User, BookOpen, Briefcase, MapPin,
  Eye, Edit, Trash2, Upload, ChevronLeft, ChevronRight,
  CheckCircle, ArrowRight, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import BulkImportDialog from '@/components/common/BulkImportDialog';
import { usePermissions } from '@/components/hooks/usePermissions';
import { SubjectApi, TeacherApi, UserProfileApi } from '@/services/supabaseApi';
import { CPFInput, PhoneInput, EmailInput, NameInput, DateInput, CEPInput } from '@/components/common/ValidatedInput';
import { useLocation } from 'react-router-dom';
import { canAccessDashboard, canWriteTeachers } from '@shared/contracts/access';
import { useGlobalSearchNavigation } from '@/hooks/useGlobalSearchNavigation';

const TEACHER_SCHEMA = {
  type: 'object',
  properties: {
    full_name: { type: 'string' }, email: { type: 'string' },
    phone: { type: 'string' }, cpf: { type: 'string' },
    employee_id: { type: 'string' }, education_level: { type: 'string' },
    degree_area: { type: 'string' }, contract_type: { type: 'string' },
    hire_date: { type: 'string' },
  },
};
const TEACHER_PREVIEW_COLS = ['full_name', 'email', 'phone', 'cpf', 'degree_area', 'contract_type'];

const VALID_TEACHER_CONTRACT_TYPES = new Set(['clt', 'pj', 'temporario', 'substituto']);
const VALID_TEACHER_STATUSES = new Set(['ativo', 'inativo', 'licenca', 'demitido']);

const normalizeOptionalText = (value) => {
  if (typeof value !== 'string') return value ?? null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeOptionalInteger = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : null;
};

const normalizeOptionalDate = (value) => {
  const normalizedValue = normalizeOptionalText(value);
  if (!normalizedValue) return null;

  const isoMatch = normalizedValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return normalizedValue;

  const brMatch = normalizedValue.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) {
    const [, day, month, year] = brMatch;
    return `${year}-${month}-${day}`;
  }

  return normalizedValue;
};

const normalizeTeacherContractType = (value) => {
  const rawValue = normalizeOptionalText(value)?.toLowerCase();
  const normalized = ({ estagiario: 'temporario' })[rawValue] || rawValue || null;
  return normalized && VALID_TEACHER_CONTRACT_TYPES.has(normalized) ? normalized : null;
};

const normalizeTeacherStatus = (value) => {
  const rawValue = normalizeOptionalText(value)?.toLowerCase();
  const normalized = ({ ferias: 'licenca', afastado: 'inativo' })[rawValue] || rawValue || 'ativo';
  return VALID_TEACHER_STATUSES.has(normalized) ? normalized : 'ativo';
};

const normalizeTeacherAddress = (address) => {
  const normalized = {
    street: normalizeOptionalText(address?.street),
    number: normalizeOptionalText(address?.number),
    complement: normalizeOptionalText(address?.complement),
    neighborhood: normalizeOptionalText(address?.neighborhood),
    city: normalizeOptionalText(address?.city),
    state: normalizeOptionalText(address?.state),
    zip_code: normalizeOptionalText(address?.zip_code),
  };

  return Object.values(normalized).some(Boolean) ? normalized : null;
};

const buildTeacherPayload = (data = {}) => ({
  full_name: normalizeOptionalText(data.full_name) ?? '',
  email: normalizeOptionalText(data.email),
  phone: normalizeOptionalText(data.phone),
  cpf: normalizeOptionalText(data.cpf) ?? '',
  birth_date: normalizeOptionalDate(data.birth_date),
  gender: normalizeOptionalText(data.gender),
  employee_id: normalizeOptionalText(data.employee_id),
  education_level: normalizeOptionalText(data.education_level),
  degree_area: normalizeOptionalText(data.degree_area),
  contract_type: normalizeTeacherContractType(data.contract_type),
  workload_hours: normalizeOptionalInteger(data.workload_hours),
  hire_date: normalizeOptionalDate(data.hire_date),
  status: normalizeTeacherStatus(data.status),
  address: normalizeTeacherAddress(data.address),
  subject_ids: Array.isArray(data.subject_ids) ? data.subject_ids.filter(Boolean) : [],
  notes: normalizeOptionalText(data.notes),
});

const mapTeacherToProfile = (teacher) => {
  const normalizedTeacher = buildTeacherPayload(teacher);
  const addr = normalizedTeacher.address;
  const statusMap = { ativo: 'ativo', inativo: 'inativo', licenca: 'ativo', ferias: 'ativo', afastado: 'inativo', demitido: 'inativo' };
  return {
    full_name: normalizedTeacher.full_name || '',
    user_email: normalizedTeacher.email || '',
    phone: normalizedTeacher.phone || '',
    registration_number: normalizedTeacher.employee_id || '',
    department: normalizedTeacher.degree_area || '',
    birth_date: normalizedTeacher.birth_date || '',
    document_id: normalizedTeacher.cpf || '',
    address: addr,
    profile_type: 'professor',
    status: statusMap[normalizedTeacher.status] || 'ativo',
  };
};

const syncUserProfile = async (teacherData) => {
  const profileData = mapTeacherToProfile(teacherData);
  const existing = await UserProfileApi.filter({ user_email: profileData.user_email, profile_type: 'professor' });
  if (existing && existing.length > 0) { await UserProfileApi.update(existing[0].id, profileData); }
  else { await UserProfileApi.create(profileData); }
};

const SECTIONS = [
  { id: 'personal',      label: 'Dados Pessoais',   icon: User },
  { id: 'professional',  label: 'Dados Profissionais', icon: Briefcase },
  { id: 'address',       label: 'Endereço',          icon: MapPin },
  { id: 'disciplines',   label: 'Disciplinas',        icon: BookOpen },
];

const EMPTY = {
  full_name: '', email: '', phone: '', cpf: '', birth_date: '', gender: '',
  employee_id: '', education_level: '', degree_area: '', contract_type: '',
  workload_hours: '', hire_date: '', status: 'ativo',
  address: { street: '', number: '', complement: '', neighborhood: '', city: '', state: '', zip_code: '' },
  subject_ids: [], notes: '',
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

// ... (rest of the component functions and main export remain the same as in the conflicted version, but with canAccessDashboard kept)

function SectionPersonal({ data, onChange }) {
  const set = (k, v) => onChange({ ...data, [k]: v });
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="md:col-span-2">
        <NameInput label="Nome Completo" required value={data.full_name} onChange={v => set('full_name', v)} />
      </div>
      <EmailInput label="E-mail" required value={data.email} onChange={v => set('email', v)} />
      <PhoneInput label="Telefone" required value={data.phone} onChange={v => set('phone', v)} />
      <CPFInput
        label="CPF"
        required
        value={data.cpf}
        onChange={v => set('cpf', v)}
      />

      <DateInput label="Data de Nascimento" value={data.birth_date} onChange={v => set('birth_date', v)} />
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
    </div>
  );
}

function SectionProfessional({ data, onChange }) {
  const set = (k, v) => onChange({ ...data, [k]: v });
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Field label="Matrícula Funcional"><Input value={data.employee_id} onChange={e => set('employee_id', e.target.value)} placeholder="Nº funcional" /></Field>
      <Field label="Formação">
        <Select value={data.education_level} onValueChange={v => set('education_level', v)}>
          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="graduacao">Graduação</SelectItem>
            <SelectItem value="especializacao">Especialização</SelectItem>
            <SelectItem value="mestrado">Mestrado</SelectItem>
            <SelectItem value="doutorado">Doutorado</SelectItem>
            <SelectItem value="pos_doutorado">Pós-Doutorado</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Área de Formação"><Input value={data.degree_area} onChange={e => set('degree_area', e.target.value)} placeholder="Ex: Matemática" /></Field>
      <Field label="Tipo de Contrato">
        <Select value={data.contract_type} onValueChange={v => set('contract_type', v)}>
          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="clt">CLT</SelectItem>
            <SelectItem value="pj">PJ</SelectItem>
            <SelectItem value="temporario">Temporário</SelectItem>
            <SelectItem value="substituto">Substituto</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Carga Horária Semanal">
        <Input
          type="number"
          value={data.workload_hours ?? ''}
          onChange={e => set('workload_hours', e.target.value === '' ? null : Number(e.target.value))}
          placeholder="Ex: 20"
        />
      </Field>
      <Field label="Data de Admissão">
        <Input type="date" value={data.hire_date} onChange={e => set('hire_date', e.target.value)} />
      </Field>
      <Field label="Status">
        <Select value={data.status} onValueChange={v => set('status', v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="inativo">Inativo</SelectItem>
            <SelectItem value="licenca">Licença</SelectItem>
            <SelectItem value="demitido">Demitido</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <div className="md:col-span-2">
        <Field label="Observações"><Textarea value={data.notes} onChange={e => set('notes', e.target.value)} rows={3} placeholder="Informações adicionais..." /></Field>
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
      <Field label="Número"><Input value={addr.number} onChange={e => set('number', e.target.value)} /></Field>
      <Field label="Complemento"><Input value={addr.complement} onChange={e => set('complement', e.target.value)} placeholder="Apto, Bloco..." /></Field>
      <Field label="Bairro"><Input value={addr.neighborhood} onChange={e => set('neighborhood', e.target.value)} /></Field>
      <CEPInput label="CEP" value={addr.zip_code} onChange={v => set('zip_code', v)} />
      <Field label="Cidade"><Input value={addr.city} onChange={e => set('city', e.target.value)} /></Field>
      <Field label="Estado">
        <Select value={addr.state} onValueChange={v => set('state', v)}>
          <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
          <SelectContent>{['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
    </div>
  );
}

function SectionDisciplines({ data, onChange, subjects }) {
  const toggle = (id) => {
    const current = data.subject_ids || [];
    const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
    onChange({ ...data, subject_ids: next });
  };
  const selected = data.subject_ids || [];
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">Selecione as disciplinas que este professor leciona:</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {subjects.map(s => {
          const active = selected.includes(s.id);
          return (
            <button key={s.id} type="button" onClick={() => toggle(s.id)}
              className={cn("p-3 rounded-xl border-2 text-left transition-all text-sm font-medium",
                active ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300')}>

              {active && <CheckCircle className="w-3.5 h-3.5 inline mr-1.5 text-indigo-500" />}
              {s.name}
            </button>
          );
        })}
        {subjects.length === 0 && <p className="col-span-3 text-slate-400 text-sm">Nenhuma disciplina cadastrada ainda.</p>}
      </div>
    </div>
  );
}

function TeacherForm({ initialData, isEdit, subjects, onBack, onSave, isSaving }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState(() => ({
    ...EMPTY,
    ...(initialData || {}),
    contract_type: normalizeTeacherContractType(initialData?.contract_type) || '',
    status: normalizeTeacherStatus(initialData?.status),
    workload_hours: normalizeOptionalInteger(initialData?.workload_hours),
    address: {
      ...EMPTY.address,
      ...(initialData?.address || {}),
    },
    subject_ids: Array.isArray(initialData?.subject_ids) ? initialData.subject_ids : [],
  }));
  const totalSteps = SECTIONS.length;
  const current = SECTIONS[step];
  const Icon = current.icon;

  const handleSubmit = async () => {
    if (!data.full_name?.trim()) { toast.error('Nome completo é obrigatório.'); setStep(0); return; }
    if (!data.email?.trim()) { toast.error('E-mail é obrigatório.'); setStep(0); return; }
    if (!data.cpf?.trim()) { toast.error('CPF é obrigatório.'); setStep(0); return; }
    await onSave(data);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-slate-400 hover:text-slate-600 transition-colors" aria-label="Voltar para a etapa anterior" data-tooltip="Voltar para a etapa anterior"><ChevronLeft className="w-5 h-5" /></button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{isEdit ? 'Editar Professor' : 'Novo Professor'}</h1>
          <p className="text-slate-500 text-sm">Etapa {step + 1} de {totalSteps} — {current.label}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {SECTIONS.map((s, i) => {
          const SIcon = s.icon;
          return (
            <React.Fragment key={s.id}>
              <button onClick={() => setStep(i)} className={cn("flex items-center justify-center w-9 h-9 rounded-full font-bold transition-all border-2",
                i < step ? 'bg-emerald-600 border-emerald-600 text-white' :
                i === step ? 'bg-white border-emerald-600 text-emerald-600' : 'bg-white border-slate-200 text-slate-400')}
                aria-label={`Ir para a etapa ${s.label}`}
                data-tooltip={`Ir para a etapa ${s.label}`}>
                {i < step ? <CheckCircle className="w-4 h-4" /> : <SIcon className="w-4 h-4" />}
              </button>
              {i < totalSteps - 1 && <div className={cn("flex-1 h-1 rounded transition-all", i < step ? 'bg-emerald-600' : 'bg-slate-200')} />}
            </React.Fragment>
          );
        })}
      </div>

      <div className="flex items-center gap-3 p-4 rounded-2xl border-2 border-emerald-100 bg-emerald-50">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-semibold text-emerald-900">{current.label}</p>
          <p className="text-xs text-emerald-600">Preencha os campos desta etapa</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        {step === 0 && <SectionPersonal data={data} onChange={setData} />}
        {step === 1 && <SectionProfessional data={data} onChange={setData} />}
        {step === 2 && <SectionAddress data={data} onChange={setData} />}
        {step === 3 && <SectionDisciplines data={data} onChange={setData} subjects={subjects} />}
      </div>

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => setStep(s => s - 1)} disabled={step === 0}>
          <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
        </Button>
        {step < totalSteps - 1 ? (
          <Button onClick={() => setStep(s => s + 1)} className="bg-emerald-600 hover:bg-emerald-700">
            Próximo <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700 px-8">
            {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</> : <>{isEdit ? 'Salvar Alterações' : 'Cadastrar Professor'} <ArrowRight className="w-4 h-4 ml-2" /></>}
          </Button>
        )}
      </div>
    </div>
  );
}

export default function Teachers({ globalSearch }) {
  const { canDeleteTeacher, profileType } = usePermissions();
  const location = useLocation();
  const [view, setView] = useState('list');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [showDetails, setShowDetails] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [highlightedTeacherId, setHighlightedTeacherId] = useState(null);
  const [savedData, setSavedData] = useState(null);
  const queryClient = useQueryClient();

  const { data: teachers = [], isLoading } = useQuery({ queryKey: ['teachers'], queryFn: () => TeacherApi.list('-created_at') });
  const { data: subjects = [] } = useQuery({ queryKey: ['subjects'], queryFn: () => SubjectApi.list() });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const payload = buildTeacherPayload(data);
      const teacher = await TeacherApi.create(payload);
      await syncUserProfile(payload);
      return teacher;
    },
    onSuccess: (_, vars) => { queryClient.invalidateQueries({ queryKey: ['teachers'] }); setSavedData(vars); setView('success'); },
    onError: (error) => toast.error(error?.message || 'Erro ao cadastrar professor.'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const payload = buildTeacherPayload(data);
      const teacher = await TeacherApi.update(id, payload);
      await syncUserProfile(payload);
      return teacher;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['teachers'] }); toast.success('Professor atualizado!'); setView('list'); setSelectedTeacher(null); },
    onError: (error) => toast.error(error?.message || 'Erro ao atualizar professor.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => TeacherApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['teachers'] }); toast.success('Professor removido.'); },
  });

  const bulkImportMutation = useMutation({
    mutationFn: async (rows) => {
      const payload = rows.map((row) => buildTeacherPayload({ ...row, status: row.status || 'ativo' }));
      await TeacherApi.bulkCreate(payload);
      await Promise.all(payload.map((row) => syncUserProfile(row)));
      return payload;
    },
    onSuccess: (n) => { queryClient.invalidateQueries({ queryKey: ['teachers'] }); toast.success(`${n.length} professor(es) importado(s)!`); },
    onError: (error) => toast.error(error?.message || 'Erro ao importar professores.'),
  });

  const handleSave = (data) => {
    if (selectedTeacher) { updateMutation.mutate({ id: selectedTeacher.id, data }); }
    else { createMutation.mutate({ ...data, status: data.status || 'ativo' }); }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const canSeeDashboard = canAccessDashboard(profileType);
  const canWriteTeacherRecords = canWriteTeachers(profileType);
  const cameFromDashboard = Boolean(
    location.state?.fromDashboard || sessionStorage.getItem('route_previous') === '/Dashboard'
  );
  const showDashboardBack = canSeeDashboard && cameFromDashboard;

  const getSubjectNames = (ids) => {
    if (!ids || ids.length === 0) return [];
    return subjects.filter(s => ids.includes(s.id)).map(s => s.name);
  };

  const filtered = useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase();
    return teachers.filter((t) =>
      t.full_name?.toLowerCase().includes(normalizedSearch) ||
      t.email?.toLowerCase().includes(normalizedSearch)
    );
  }, [deferredSearch, teachers]);

  useGlobalSearchNavigation({
    entityKey: 'teachers',
    globalSearch,
    isReady: !isLoading,
    onNavigate: ({ query, recordId }) => {
      const matchedTeacher = teachers.find((teacher) => teacher.id === recordId) || null;
      setView('list');
      setSearch(query || '');
      setHighlightedTeacherId(recordId || null);
      setSelectedTeacher(matchedTeacher);
      setShowDetails(Boolean(matchedTeacher));
    },
  });

  const columns = [
    { key: 'full_name', label: 'Professor', render: (row) => (
      <div className="flex items-center gap-3">
        <Avatar className="w-10 h-10">
          <AvatarImage src={row.photo_url} />
          <AvatarFallback className="bg-emerald-100 text-emerald-700">{row.full_name?.charAt(0)}</AvatarFallback>
        </Avatar>
        <div>
          <p className="font-medium text-slate-900">{row.full_name}</p>
          <p className="text-sm text-slate-500">{row.email}</p>
        </div>
      </div>
    )},
    { key: 'phone', label: 'Telefone', render: (row) => <span className="text-slate-600">{row.phone || '-'}</span> },
    { key: 'subject_ids', label: 'Disciplinas', render: (row) => {
      const names = getSubjectNames(row.subject_ids);
      return names.length > 0
        ? <div className="flex flex-wrap gap-1">{names.slice(0,2).map(n => <Badge key={n} variant="secondary" className="text-xs">{n}</Badge>)}{names.length > 2 && <Badge variant="outline" className="text-xs">+{names.length-2}</Badge>}</div>
        : <span className="text-slate-400 text-sm">-</span>;
    }},
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'actions', label: 'Ações', render: (row) => (
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setSelectedTeacher(row); setShowDetails(true); }} aria-label={`Ver professor ${row.full_name}`} data-tooltip={`Ver professor ${row.full_name}`}><Eye className="w-4 h-4 text-slate-500" /></Button>
        {canWriteTeacherRecords && <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setSelectedTeacher(row); setView('edit'); }} aria-label={`Editar professor ${row.full_name}`} data-tooltip={`Editar professor ${row.full_name}`}><Edit className="w-4 h-4 text-slate-500" /></Button>}
        {canDeleteTeacher && canWriteTeacherRecords && <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); if (confirm('Excluir este professor?')) deleteMutation.mutate(row.id); }} aria-label={`Excluir professor ${row.full_name}`} data-tooltip={`Excluir professor ${row.full_name}`}><Trash2 className="w-4 h-4 text-rose-500" /></Button>}
      </div>
    )},
  ];

  if (view === 'success') {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto"><CheckCircle className="w-10 h-10 text-emerald-600" /></div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Professor Cadastrado!</h2>
          <p className="text-slate-500 mt-2"><strong>{savedData?.full_name}</strong> foi cadastrado com sucesso.</p>
        </div>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={() => { setSavedData(null); setView('new'); }}>Novo Cadastro</Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => { setSavedData(null); setView('list'); }}>Ver Lista de Professores</Button>
        </div>
      </div>
    );
  }

  if ((view === 'new' || view === 'edit') && canWriteTeacherRecords) {
    return <TeacherForm initialData={view === 'edit' ? selectedTeacher : null} isEdit={view === 'edit'} subjects={subjects} onBack={() => { setView('list'); setSelectedTeacher(null); }} onSave={handleSave} isSaving={isSaving} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          {showDashboardBack && (
            <button onClick={() => window.history.back()} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-1 -ml-1 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"><ChevronLeft className="w-4 h-4" /> Dashboard</button>
          )}
          <h1 className="text-2xl font-bold text-slate-900">Professores</h1>
          <p className="text-slate-500">{teachers.length} professores cadastrados</p>
        </div>
        <div className="flex gap-2">
          {canWriteTeacherRecords && (
            <Button variant="outline" onClick={() => setShowImport(true)}><Upload className="w-4 h-4 mr-2" /> Importar CSV/Excel</Button>
          )}
          {canWriteTeacherRecords && (
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => { setSelectedTeacher(null); setView('new'); }}>+ Novo Professor</Button>
          )}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        searchPlaceholder="Buscar por nome ou e-mail..."
        searchValue={search}
        onSearchChange={setSearch}
        highlightedRowId={highlightedTeacherId}
        emptyMessage="Nenhum professor encontrado"
      />

      {canWriteTeacherRecords && (
        <BulkImportDialog open={showImport} onOpenChange={setShowImport} entityName="Professores" schema={TEACHER_SCHEMA} previewColumns={TEACHER_PREVIEW_COLS} onImport={(rows) => bulkImportMutation.mutate(rows)} isLoading={bulkImportMutation.isPending} />
      )}

      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <Avatar className="w-14 h-14">
                <AvatarImage src={selectedTeacher?.photo_url} />
                <AvatarFallback className="bg-emerald-100 text-emerald-700 text-2xl">{selectedTeacher?.full_name?.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-xl font-bold text-slate-900">{selectedTeacher?.full_name}</h3>
                <p className="text-slate-500">{selectedTeacher?.email}</p>
                <StatusBadge status={selectedTeacher?.status} className="mt-1" />
              </div>
            </div>
          </DialogHeader>
          {selectedTeacher && (
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[['Telefone', selectedTeacher.phone || '-'],
                  ['Formação', selectedTeacher.education_level || '-'],
                  ['Área', selectedTeacher.degree_area || '-'],
                  ['Contrato', selectedTeacher.contract_type || '-'],
                  ['Carga Horária', selectedTeacher.workload_hours ? `${selectedTeacher.workload_hours}h/sem` : '-'],
                  ['Matrícula', selectedTeacher.employee_id || '-'],
                ].map(([k, v]) => <div key={k}><p className="text-slate-500 text-xs">{k}</p><p className="font-medium text-slate-800">{v}</p></div>)}
              </div>
              {selectedTeacher.subject_ids?.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 mb-2">Disciplinas</p>
                  <div className="flex flex-wrap gap-1">{getSubjectNames(selectedTeacher.subject_ids).map(n => <Badge key={n} variant="secondary">{n}</Badge>)}</div>
                </div>
              )}
              <div className="flex gap-2 pt-2 border-t">
                <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => { setShowDetails(false); setView('edit'); }}>
                  <Edit className="w-4 h-4 mr-2" /> Editar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

