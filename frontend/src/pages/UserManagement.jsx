// P├Âr├Âjek ╔øm╔ø cua lat k╔ø╔øliw ╔ø Whykthor GSV.
import React, { useDeferredValue, useMemo, useReducer, useRef, useState } from 'react';
import {
  Shield, GraduationCap, Users, Briefcase, ClipboardList, ArrowLeft,
  Search, CheckCircle, Clock, Eye,
  MoreVertical, UserCheck, UserX, Edit, Trash2,
  AlertTriangle, Copy, Check, KeyRound, ChevronLeft, ArrowRight, Loader2, Upload
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import ProfileCard from '@/components/usermanagement/ProfileCard';

import { formatPhone, normalizeEmail, formatName } from '@/lib/validators';
import { CPFInput } from '@/components/common/ValidatedInput';
import {
  createManagedProfile,
  generateTempPassword,
} from '@/lib/supabaseAdmin';
import { toast } from 'sonner';
import { useLocation } from 'react-router-dom';
import { usePermissions } from '@/components/hooks/usePermissions';
import { useGlobalSearchNavigation } from '@/hooks/useGlobalSearchNavigation';
import { useGuardianLinkEditor } from '@/hooks/useGuardianLinkEditor';
import { useUserManagementData } from '@/hooks/useUserManagementData';
import { canAccessDashboard } from '@shared/contracts/access';
import {
  OPTIMIZABLE_IMAGE_MIME_TYPES,
} from '@/lib/imageUploadOptimizer';

// ── Configs ─────────────────────────────────────────────────
const PROFILE_CONFIG = {
  administrador: { label: 'Administrador', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: Shield,        dot: 'bg-purple-500' },
  coordenador:   { label: 'Coordenador',   color: 'bg-violet-100 text-violet-700 border-violet-200',  icon: Briefcase,    dot: 'bg-violet-500' },
  secretario:    { label: 'Secretário',    color: 'bg-amber-100 text-amber-700 border-amber-200',     icon: ClipboardList, dot: 'bg-amber-500' },
  professor:     { label: 'Professor',     color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: Users,      dot: 'bg-emerald-500' },
  responsavel:   { label: 'Responsável',   color: 'bg-cyan-100 text-cyan-700 border-cyan-200',        icon: UserCheck,   dot: 'bg-cyan-500' },
  aluno:         { label: 'Aluno',         color: 'bg-blue-100 text-blue-700 border-blue-200',         icon: GraduationCap, dot: 'bg-blue-500' },
};

const STATUS_CONFIG = {
  pendente: { label: 'Pendente', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
  ativo:    { label: 'Ativo',    color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle },
  inativo:  { label: 'Inativo',  color: 'bg-red-100 text-red-700 border-red-200',        icon: AlertTriangle },
};

// ── Role cards — exatamente como no Registration.jsx ────────
const ROLE_CARDS = [
  {
    id: 'administrador',
    label: 'Administrador',
    description: 'Acesso total ao sistema, usuários e configurações.',
    icon: Shield,
    color: 'from-purple-500 to-purple-700',
    bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700',
    permissions: ['Gerenciar todos os usuários', 'Configurar o sistema', 'Acesso a todos os módulos'],
  },
  {
    id: 'professor',
    label: 'Professor',
    description: 'Gerencie turmas, registre notas, frequência e atividades.',
    icon: Users,
    color: 'from-emerald-500 to-emerald-600',
    bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700',
    permissions: ['Lançar notas e frequência', 'Gerenciar atividades', 'Acessar diário de classe'],
  },
  {
    id: 'responsavel',
    label: 'Responsável',
    description: 'Acesso somente leitura ao portal do aluno vinculado.',
    icon: UserCheck,
    color: 'from-cyan-500 to-sky-600',
    bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700',
    permissions: ['Consultar notas e frequência', 'Ler comunicados', 'Baixar documentos permitidos'],
  },
  {
    id: 'gestao',
    label: 'Gestão',
    description: 'Coordenadores e Secretários com acesso administrativo.',
    icon: Briefcase,
    color: 'from-violet-500 to-purple-600',
    bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700',
    subRoles: [
      { id: 'coordenador', label: 'Coordenador', desc: 'Supervisão pedagógica, professores e currículos.' },
      { id: 'secretario',  label: 'Secretário',  desc: 'Matrículas, documentação e financeiro.' },
    ],
    permissions: ['Gerenciar alunos e professores', 'Aprovar matrículas', 'Emitir relatórios'],
  },
];

const buildEditFormFromProfile = (profile) => ({
  id: profile.id,
  full_name: profile.full_name || '',
  profile_type: profile.profile_type,
  status: profile.status,
  department: profile.department || '',
  phone: profile.phone || '',
  notes: profile.notes || '',
  avatar_url: profile.avatar_url || '',
  user_email: profile.user_email || '',
});

const initialUserManagementState = {
  search: '',
  filterProfile: 'todos',
  filterStatus: 'todos',
  activeTab: 'todos',
  selectedProfileId: null,
  editOpen: false,
  editForm: {},
  resetDialogOpen: false,
  resetCredentials: null,
  copiedField: '',
  highlightedProfileId: null,
  isPreparingAvatar: false,
};

function userManagementReducer(state, action) {
  switch (action.type) {
    case 'setSearch':
      return { ...state, search: action.payload };
    case 'setFilterProfile':
      return { ...state, filterProfile: action.payload };
    case 'setFilterStatus':
      return { ...state, filterStatus: action.payload };
    case 'setActiveTab':
      return { ...state, activeTab: action.payload };
    case 'openProfile':
      return { ...state, selectedProfileId: action.payload };
    case 'closeProfile':
      return { ...state, selectedProfileId: null };
    case 'openEdit':
      return { ...state, editOpen: true, editForm: action.payload };
    case 'closeEdit':
      return { ...state, editOpen: false, editForm: {}, isPreparingAvatar: false };
    case 'patchEditForm':
      return { ...state, editForm: { ...state.editForm, ...action.payload } };
    case 'openResetDialog':
      return { ...state, resetDialogOpen: true, resetCredentials: action.payload };
    case 'closeResetDialog':
      return { ...state, resetDialogOpen: false, resetCredentials: null, copiedField: '' };
    case 'setCopiedField':
      return { ...state, copiedField: action.payload };
    case 'setHighlightedProfileId':
      return { ...state, highlightedProfileId: action.payload };
    case 'setPreparingAvatar':
      return { ...state, isPreparingAvatar: action.payload };
    case 'applyGlobalSearchNavigation':
      return {
        ...state,
        search: action.payload.query || '',
        filterProfile: 'todos',
        filterStatus: 'todos',
        activeTab: 'todos',
        highlightedProfileId: action.payload.recordId || null,
        selectedProfileId: action.payload.recordId || null,
      };
    default:
      return state;
  }
}

// ── Success Screen ───────────────────────────────────────────
function SuccessScreen({ credentials, onReset, onBack }) {
  const [copied, setCopied] = useState('');
  const copy = async (text, field) => {
    await navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(''), 2000);
  };

  return (
    <div className="max-w-lg mx-auto mt-12 space-y-6">
      <div className="text-center">
        <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-10 h-10 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Usuário Criado!</h2>
        <p className="text-slate-500 mt-1">Compartilhe as credenciais abaixo com <strong>{credentials.name}</strong>.</p>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
        {[
          { label: 'E-mail', value: credentials.email, field: 'email', style: 'text-slate-800 bg-white border-slate-200' },
          { label: 'Senha temporária', value: credentials.password, field: 'password', style: 'font-bold text-indigo-700 bg-indigo-50 border-indigo-200 tracking-widest' },
        ].map(({ label, value, field, style }) => (
          <div key={field}>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">{label}</p>
            <div className="flex items-center gap-2">
              <code className={`flex-1 text-sm rounded-lg px-3 py-2 border ${style}`}>{value}</code>
              <Button size="icon" variant="ghost" className="h-9 w-9 flex-shrink-0" onClick={() => copy(value, field)} aria-label={`Copiar ${label.toLowerCase()}`} data-tooltip={`Copiar ${label.toLowerCase()}`}>
                {copied === field ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-slate-400" />}
              </Button>
            </div>
          </div>
        ))}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-xs text-amber-700">Anote ou copie a senha agora — ela não será exibida novamente. O usuário poderá trocá-la no primeiro acesso.</p>
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onReset}>Novo Usuário</Button>
        <Button className="flex-1 bg-indigo-600 hover:bg-indigo-700" onClick={onBack}>Ver Lista de Usuários</Button>
      </div>
    </div>
  );
}

// ── UserProfileFlow — EXATAMENTE como no Registration.jsx ───
// Adaptado: adiciona campo de e-mail e cria conta no Auth
function UserProfileFlow({ onSuccess, onBack }) {
  const [step, setStep] = useState(1);
  const [selectedRole, setSelectedRole] = useState(null);
  const [selectedSubRole, setSelectedSubRole] = useState(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', birth_date: '',
    cpf: '', address: '', department: '', notes: '',
  });

  const canProceed = () => selectedRole && (selectedRole.id !== 'gestao' || selectedSubRole);
  const getFinalRole = () => selectedRole?.id === 'gestao' ? selectedSubRole : selectedRole?.id;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email?.trim()) { toast.error('E-mail é obrigatório.'); return; }
    if (!form.full_name?.trim()) { toast.error('Nome completo é obrigatório.'); return; }
    setLoading(true);
    try {
      const tempPassword = generateTempPassword();
      await createManagedProfile({
        email: form.email,
        password: tempPassword,
        full_name: form.full_name,
        phone: form.phone || null,
        birth_date: form.birth_date || null,
        document_id: form.cpf || null,
        address: form.address || null,
        department: form.department || null,
        notes: form.notes ? form.notes + ' [primeiro_acesso]' : '[primeiro_acesso]',
        profile_type: getFinalRole(),
      });
      onSuccess({ email: form.email, password: tempPassword, name: form.full_name });
    } catch (err) {
      toast.error(err.message ?? 'Erro ao criar usuário.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-slate-400 hover:text-slate-600 transition-colors" aria-label="Voltar para a etapa anterior" data-tooltip="Voltar para a etapa anterior">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cadastro de Usuário</h1>
          <p className="text-slate-500 text-sm">Passo {step} de 2</p>
        </div>
      </div>

      {/* Progress — igual ao Registration.jsx */}
      <div className="flex items-center gap-3">
        {[1, 2].map((s) => (
          <React.Fragment key={s}>
            <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all',
              step >= s ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500')}>
              {s}
            </div>
            {s < 2 && <div className={cn('flex-1 h-1 rounded', step > s ? 'bg-indigo-600' : 'bg-slate-200')} />}
          </React.Fragment>
        ))}
        <span className="ml-2 text-sm text-slate-500">{step === 1 ? 'Escolher perfil' : 'Preencher dados'}</span>
      </div>

      {/* Passo 1: Escolher perfil — igual ao Registration.jsx */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ROLE_CARDS.map((role) => {
              const Icon = role.icon;
              const isSelected = selectedRole?.id === role.id;
              return (
                <button key={role.id}
                  onClick={() => { setSelectedRole(role); setSelectedSubRole(null); }}
                  className={cn('text-left p-5 rounded-2xl border-2 transition-all duration-200 hover:shadow-md',
                    isSelected ? `${role.border} ${role.bg} shadow-md` : 'border-slate-200 bg-white hover:border-slate-300')}>
                  <div className={cn('w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center mb-4', role.color)}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className={cn('font-bold text-lg', isSelected ? role.text : 'text-slate-900')}>{role.label}</h3>
                  <p className="text-sm text-slate-500 mt-1">{role.description}</p>
                  <ul className="mt-3 space-y-1">
                    {role.permissions.map((p, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs text-slate-500">
                        <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0',
                          isSelected ? role.text.replace('text-', 'bg-') : 'bg-slate-300')} />
                        {p}
                      </li>
                    ))}
                  </ul>
                </button>
              );
            })}
          </div>

          {selectedRole?.id === 'gestao' && (
            <div className="p-5 bg-violet-50 border border-violet-200 rounded-2xl space-y-3">
              <p className="font-semibold text-violet-800 text-sm">Selecione a função na gestão:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {selectedRole.subRoles.map((sub) => (
                  <button key={sub.id} onClick={() => setSelectedSubRole(sub.id)}
                    className={cn('text-left p-4 rounded-xl border-2 transition-all',
                      selectedSubRole === sub.id ? 'border-violet-500 bg-violet-100' : 'border-violet-200 bg-white hover:border-violet-300')}>
                    <p className="font-semibold text-violet-900">{sub.label}</p>
                    <p className="text-xs text-violet-600 mt-0.5">{sub.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={() => setStep(2)} disabled={!canProceed()} className="bg-indigo-600 hover:bg-indigo-700 px-6">
              Continuar <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Passo 2: Preencher dados — igual ao Registration.jsx + campo email */}
      {step === 2 && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <button type="button" onClick={() => setStep(1)}
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
            <ChevronLeft className="w-4 h-4" /> Voltar
          </button>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label>Nome completo <span className="text-red-500">*</span></Label>
                <input required placeholder="Nome completo"
                  value={form.full_name}
                  onChange={e => setForm({ ...form, full_name: e.target.value })}
                  onBlur={e => setForm(f => ({ ...f, full_name: formatName(e.target.value) }))}
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
              </div>
              <div className="md:col-span-2">
                <Label>E-mail <span className="text-red-500">*</span></Label>
                <input required type="email" placeholder="email@escola.com"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: normalizeEmail(e.target.value) })}
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
              </div>
              <CPFInput
                value={form.cpf}
                onChange={v => setForm({ ...form, cpf: v })}
                label="CPF"
              />
              <div>
                <Label>Telefone</Label>
                <input placeholder="(00) 00000-0000"
                  value={form.phone} onChange={e => setForm({ ...form, phone: formatPhone(e.target.value) })}
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
              </div>
              <div>
                <Label>Data de nascimento</Label>
                <input type="date" value={form.birth_date} onChange={e => setForm({ ...form, birth_date: e.target.value })}
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
              </div>

              <div>
                <Label>Departamento</Label>
                <input placeholder="Ex: Ensino Médio"
                  value={form.department} onChange={e => setForm({ ...form, department: e.target.value })}
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
              </div>
              <div className="md:col-span-2">
                <Label>Endereço</Label>
                <input placeholder="Rua, número, bairro, cidade"
                  value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
              </div>
              <div className="md:col-span-2">
                <Label>Observações</Label>
                <input placeholder="Informações adicionais"
                  value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
              </div>
            </div>
          </div>

          <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
            <p className="text-sm text-indigo-800">🔑 Uma senha temporária forte será gerada e exibida após o cadastro.</p>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 px-8">
              {loading ? 'Criando...' : 'Criar Usuário'} <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────
export default function UserManagement({ openApp, globalSearch }) {
  const location = useLocation();
  const { profileType } = usePermissions();
  const [state, dispatch] = useReducer(userManagementReducer, initialUserManagementState);
  const {
    search,
    filterProfile,
    filterStatus,
    selectedProfileId,
    editOpen,
    editForm,
    activeTab,
    resetDialogOpen,
    resetCredentials,
    copiedField,
    highlightedProfileId,
    isPreparingAvatar,
  } = state;
  const deferredSearch = useDeferredValue(search);
  const avatarInputRef = useRef(null);

  const {
    profiles,
    classes,
    students,
    guardianLinks,
    guardianLinksLoading,
    isLoading,
    saveEditMutation,
    deleteMutation,
    approveProfile,
    suspendProfile,
    saveEditedProfile,
    requestPasswordReset,
    prepareAvatarDataUrl,
  } = useUserManagementData({
    editOpen,
    editProfileId: editForm.id,
    selectedProfileId,
    onEditSaved: () => {
      dispatch({ type: 'closeEdit' });
      resetLinkedStudents();
    },
    onResetPasswordGenerated: (result) => {
      dispatch({ type: 'openResetDialog', payload: result });
    },
  });
  const {
    linkedStudentIds,
    availableGuardianStudents,
    toggleLinkedStudent,
    resetLinkedStudents,
  } = useGuardianLinkEditor({
    editOpen,
    editProfileId: editForm.id,
    students,
    guardianLinks,
  });

  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId) || null;
  const copyToClipboard = async (text, field) => {
    await navigator.clipboard.writeText(text);
    dispatch({ type: 'setCopiedField', payload: field });
    setTimeout(() => dispatch({ type: 'setCopiedField', payload: '' }), 2000);
  };

  const handleAvatarSelect = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;
    dispatch({ type: 'setPreparingAvatar', payload: true });

    try {
      const avatarUrl = await prepareAvatarDataUrl(file);
      dispatch({ type: 'patchEditForm', payload: { avatar_url: avatarUrl } });
    } catch (error) {
      toast.error(error?.message || 'Nao foi possivel preparar a foto.');
    } finally {
      dispatch({ type: 'setPreparingAvatar', payload: false });
    }
  };

  const handleRemoveAvatar = () => {
    dispatch({ type: 'patchEditForm', payload: { avatar_url: '' } });
  };

  const handleEdit = (profile) => {
    resetLinkedStudents();
    dispatch({ type: 'openEdit', payload: buildEditFormFromProfile(profile) });
  };

  const handleSaveEdit = () => {
    saveEditedProfile(editForm, linkedStudentIds);
  };

  const filtered = useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase();

    return profiles.filter((p) => {
      const matchSearch =
        !normalizedSearch ||
        p.full_name?.toLowerCase().includes(normalizedSearch) ||
        p.user_email?.toLowerCase().includes(normalizedSearch);
      const matchProfile = filterProfile === 'todos' || p.profile_type === filterProfile;
      const matchStatus = filterStatus === 'todos' || p.status === filterStatus;
      const matchTab =
        activeTab === 'todos' || (activeTab === 'pendentes' ? p.status === 'pendente' : p.status !== 'pendente');
      return matchSearch && matchProfile && matchStatus && matchTab;
    });
  }, [activeTab, deferredSearch, filterProfile, filterStatus, profiles]);

  const pendingCount = useMemo(
    () => profiles.filter((p) => p.status === 'pendente').length,
    [profiles]
  );
  const stats = useMemo(
    () => Object.entries(PROFILE_CONFIG).map(([key, cfg]) => ({
      key,
      ...cfg,
      count: profiles.filter((p) => p.profile_type === key).length,
    })),
    [profiles]
  );


  useGlobalSearchNavigation({
    entityKey: 'users',
    globalSearch,
    isReady: !isLoading,
    onNavigate: ({ query, recordId }) => {
      dispatch({ type: 'applyGlobalSearchNavigation', payload: { query, recordId } });
    },
  });

  const canSeeDashboard = canAccessDashboard(profileType);
  const cameFromDashboard = Boolean(
    location.state?.fromDashboard || sessionStorage.getItem('route_previous') === '/Dashboard'
  );
  const showDashboardBack = canSeeDashboard && cameFromDashboard;

  // ── Lista ───────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          {showDashboardBack && (
            <button onClick={() => window.history.back()} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-1 -ml-1 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Dashboard
            </button>
          )}
          <h1 className="text-2xl font-bold text-slate-900" data-cy="page-title">
            Gestão de Usuários
          </h1>
          <p className="text-slate-500">Gerencie perfis, permissões e acessos ao sistema</p>
        </div>
        <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={() => openApp?.('registration', { initialModeProp: 'usuario' })}>
          <Users className="w-4 h-4 mr-2" /> Novo Usuário
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {stats.map(({ key, label, color, icon: Icon, count, dot }) => (
          <button key={key} onClick={() => dispatch({ type: 'setFilterProfile', payload: filterProfile === key ? 'todos' : key })}
            className={cn('p-4 rounded-2xl border-2 text-left transition-all hover:shadow-md',
              filterProfile === key ? color : 'bg-white border-slate-200')}>
            <div className="flex items-center gap-2 mb-2">
              <div className={cn('w-2 h-2 rounded-full', dot)} />
              <span className="text-xs font-medium text-slate-500">{label}</span>
            </div>
            <p className="text-2xl font-bold text-slate-900">{count}</p>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-3">
          <Tabs value={activeTab} onValueChange={(value) => dispatch({ type: 'setActiveTab', payload: value })} className="flex-1">
            <TabsList className="bg-slate-100">
              <TabsTrigger value="todos">Todos</TabsTrigger>
              <TabsTrigger value="pendentes" className="relative">
                Pendentes
                {pendingCount > 0 && <span className="ml-1.5 px-1.5 py-0.5 bg-amber-500 text-white text-xs rounded-full">{pendingCount}</span>}
              </TabsTrigger>
              <TabsTrigger value="ativos">Ativos</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex gap-2">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input placeholder="Buscar usuário..." className="pl-9" value={search} onChange={(e) => dispatch({ type: 'setSearch', payload: e.target.value })} />
            </div>
            <Select value={filterStatus} onValueChange={(value) => dispatch({ type: 'setFilterStatus', payload: value })}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos status</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-12 text-center text-slate-400">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">Nenhum usuário encontrado</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Usuário</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 hidden md:table-cell">Perfil</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 hidden lg:table-cell">Departamento</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((profile) => {
                  const pCfg = PROFILE_CONFIG[profile.profile_type] || PROFILE_CONFIG.aluno;
                  const sCfg = STATUS_CONFIG[profile.status] || STATUS_CONFIG.pendente;
                  const PIcon = pCfg.icon;
                  const SIcon = sCfg.icon;
                  return (
                    <tr
                      key={profile.id}
                      className={cn(
                        "hover:bg-slate-50/50 transition-colors",
                        highlightedProfileId === profile.id && "bg-indigo-50/80"
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-9 h-9">
                            <AvatarImage src={profile.avatar_url || undefined} />
                            <AvatarFallback className="bg-indigo-100 text-indigo-700 text-sm font-semibold">
                              {profile.full_name?.charAt(0) || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-slate-900 text-sm">{profile.full_name}</p>
                            <p className="text-xs text-slate-500">{profile.user_email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <Badge variant="outline" className={cn('gap-1.5 font-medium', pCfg.color)}>
                          <PIcon className="w-3 h-3" />{pCfg.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-sm text-slate-600">{profile.department || '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={cn('gap-1 font-medium', sCfg.color)}>
                          <SIcon className="w-3 h-3" />{sCfg.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          {profile.status === 'pendente' && (
                            <Button size="sm" variant="outline" className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 h-8 text-xs" onClick={() => approveProfile(profile)}>
                              <UserCheck className="w-3.5 h-3.5 mr-1" /> Aprovar
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => dispatch({ type: 'openProfile', payload: profile.id })} aria-label={`Ver perfil de ${profile.full_name}`} data-tooltip={`Ver perfil de ${profile.full_name}`}>
                            <Eye className="w-4 h-4 text-slate-400" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Mais ações para ${profile.full_name}`} data-tooltip={`Mais ações para ${profile.full_name}`}>
                                <MoreVertical className="w-4 h-4 text-slate-400" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(profile)}><Edit className="w-4 h-4 mr-2" /> Editar</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => requestPasswordReset(profile)} className="text-indigo-600"><KeyRound className="w-4 h-4 mr-2" /> Redefinir senha</DropdownMenuItem>
                              {profile.status === 'ativo' && <DropdownMenuItem onClick={() => suspendProfile(profile)} className="text-amber-600"><UserX className="w-4 h-4 mr-2" /> Suspender</DropdownMenuItem>}
                              {profile.status === 'inativo' && <DropdownMenuItem onClick={() => approveProfile(profile)} className="text-emerald-600"><UserCheck className="w-4 h-4 mr-2" /> Reativar</DropdownMenuItem>}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => deleteMutation.mutate(profile)} className="text-red-600"><Trash2 className="w-4 h-4 mr-2" /> Excluir</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Profile Detail */}
      {selectedProfile && (
        <ProfileCard profile={selectedProfile} profileConfig={PROFILE_CONFIG} statusConfig={STATUS_CONFIG}
          onClose={() => dispatch({ type: 'closeProfile' })} onApprove={approveProfile} onSuspend={suspendProfile} />
      )}

      {/* Reset credentials dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={(open) => !open && dispatch({ type: 'closeResetDialog' })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><KeyRound className="w-5 h-5 text-indigo-600" /> Nova senha gerada</DialogTitle>
            <DialogDescription>Compartilhe com {resetCredentials?.name}.</DialogDescription>
          </DialogHeader>
          {resetCredentials && (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                {[['E-mail', resetCredentials.email, 'email', 'text-slate-800 bg-white border-slate-200'],
                  ['Nova senha', resetCredentials.password, 'password', 'font-bold text-indigo-700 bg-indigo-50 border-indigo-200 tracking-widest']
                ].map(([label, value, field, style]) => (
                  <div key={field}>
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">{label}</p>
                    <div className="flex items-center gap-2">
                      <code className={`flex-1 text-sm rounded-lg px-3 py-2 border ${style}`}>{value}</code>
                      <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => copyToClipboard(value, field)} aria-label={`Copiar ${label.toLowerCase()}`} data-tooltip={`Copiar ${label.toLowerCase()}`}>
                        {copiedField === field ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-slate-400" />}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-700">Anote a senha agora — ela não será exibida novamente.</p>
              </div>
            </div>
          )}
          <Button className="w-full bg-indigo-600 hover:bg-indigo-700" onClick={() => dispatch({ type: 'closeResetDialog' })}>Entendido</Button>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          if (open) return;
          dispatch({ type: 'closeEdit' });
          resetLinkedStudents();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Perfil</DialogTitle>
            <DialogDescription>Altere os dados do perfil do usuário.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20 border border-slate-200 shadow-sm">
                  <AvatarImage src={editForm.avatar_url || undefined} alt={editForm.full_name || 'Usuario'} />
                  <AvatarFallback className="bg-indigo-100 text-xl font-semibold text-indigo-700">
                    {editForm.full_name?.charAt(0) || '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">Foto do usuario</p>
                  <p className="mt-1 text-xs text-slate-500">
                    JPG, PNG e WebP sao comprimidos automaticamente antes de salvar.
                  </p>
                  {editForm.profile_type === 'aluno' && (
                    <p className="mt-2 text-xs text-slate-600">
                      A secretaria controla se o aluno pode alterar a propria foto.
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={isPreparingAvatar}
                    >
                      {isPreparingAvatar ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando...</>
                      ) : (
                        <><Upload className="mr-2 h-4 w-4" /> {editForm.avatar_url ? 'Alterar foto' : 'Adicionar foto'}</>
                      )}
                    </Button>
                    {editForm.avatar_url && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-slate-600 hover:text-slate-900"
                        onClick={handleRemoveAvatar}
                      >
                        Remover
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              <input
                ref={avatarInputRef}
                type="file"
                accept={OPTIMIZABLE_IMAGE_MIME_TYPES.join(',')}
                className="hidden"
                onChange={handleAvatarSelect}
              />
            </div>
            <div><Label>Nome completo</Label><Input value={editForm.full_name || ''} onChange={(e) => dispatch({ type: 'patchEditForm', payload: { full_name: e.target.value } })} className="mt-1" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Perfil</Label>
                <Select value={editForm.profile_type} onValueChange={(value) => dispatch({ type: 'patchEditForm', payload: { profile_type: value } })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(PROFILE_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={editForm.status} onValueChange={(value) => dispatch({ type: 'patchEditForm', payload: { status: value } })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Departamento / Turma</Label>
              <Select value={editForm.department || ''} onValueChange={(value) => dispatch({ type: 'patchEditForm', payload: { department: value } })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione a turma" /></SelectTrigger>
                <SelectContent>
                  {classes.length > 0 ? classes.map((c) => (
                    <SelectItem key={c.id} value={c.name}>{c.name} {c.year ? `(${c.year})` : ''}</SelectItem>
                  )) : (
                    <SelectItem value="" disabled>Nenhuma turma cadastrada</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Telefone</Label><Input value={editForm.phone || ''} onChange={(e) => dispatch({ type: 'patchEditForm', payload: { phone: formatPhone(e.target.value) } })} className="mt-1" placeholder="(00) 00000-0000" maxLength={15} /></div>
            <div><Label>Observações</Label><Input value={editForm.notes || ''} onChange={(e) => dispatch({ type: 'patchEditForm', payload: { notes: e.target.value } })} className="mt-1" /></div>
            {editForm.profile_type === 'responsavel' && (
              <div className="space-y-3 rounded-xl border border-cyan-200 bg-cyan-50 p-4">
                <div>
                  <Label>Vínculo responsável-aluno</Label>
                  <p className="mt-1 text-xs text-cyan-800">
                    O responsável verá apenas notas, faltas, recados e documentos dos alunos marcados abaixo.
                  </p>
                </div>
                <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-cyan-200 bg-white p-3">
                  {guardianLinksLoading ? (
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Carregando vínculos atuais...
                    </div>
                  ) : availableGuardianStudents.length === 0 ? (
                    <p className="text-sm text-slate-500">Nenhum aluno disponível para vínculo.</p>
                  ) : availableGuardianStudents.map((student) => {
                    const isChecked = linkedStudentIds.includes(student.id);

                    return (
                      <label
                        key={student.id}
                        className={cn(
                          'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                          isChecked ? 'border-cyan-300 bg-cyan-50' : 'border-slate-200 hover:bg-slate-50'
                        )}
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleLinkedStudent(student.id)}
                        />
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900">{student.full_name}</p>
                          <p className="text-xs text-slate-500">
                            {student.registration_number || 'Sem matrícula'} • {student.current_grade || 'Série não informada'}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={handleSaveEdit} disabled={saveEditMutation.isPending || isPreparingAvatar}>
              {saveEditMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</> : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
