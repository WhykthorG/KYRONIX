
import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  GraduationCap, Users, Briefcase, School, ChevronRight, ChevronLeft,
  CheckCircle, ArrowRight, UserPlus, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/components/hooks/usePermissions';
import PageHeader from '@/components/common/PageHeader';


// Import enrollment sections
import SectionPersonal from '@/components/enrollment/SectionPersonal';
import SectionAddress from '@/components/enrollment/SectionAddress';
import SectionAcademic from '@/components/enrollment/SectionAcademic';
import SectionGuardian from '@/components/enrollment/SectionGuardian';
import SectionAttachments from '@/components/enrollment/SectionAttachments';
import {
  validateCPF, validateGmail, validatePhone, validateCEP,
  validateDate, toISODate, generateRA
} from '@/components/enrollment/enrollmentUtils';
import { formatName, formatPhone, normalizeEmail } from '@/lib/validators';
import { deleteStorageFiles } from '@/lib/storageFiles';
import {
  createEnrollmentWithAccess,
  createManagedProfile,
  formatAdminRequestErrorMessage,
  generateTempPassword,
} from '@/lib/supabaseAdmin';
import { toast } from 'sonner';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ClassApi } from '@/services/supabaseApi';
import { buildEnrollmentMutationInput } from '@shared/contracts/enrollment';
import { canCreateSystemUsers } from '@shared/contracts/access';


// ── ENTRY POINT CARDS ─────────────────────────────────────────────────────────
const ENTRY_CARDS = [
  {
    id: 'matricula',
    label: 'Nova Matrícula de Aluno',
    description: 'Cadastre um novo aluno com ficha completa, responsável e documentos.',
    icon: UserPlus,
    color: 'from-indigo-500 to-purple-600',
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
    text: 'text-indigo-700',
  },
  {
    id: 'usuario',
    label: 'Cadastro de Usuário do Sistema',
    description: 'Registre professores, responsáveis, coordenadores, secretários ou administradores.',
    icon: Users,
    color: 'from-emerald-500 to-teal-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
  },
];

// ── USER PROFILE ROLES ────────────────────────────────────────────────────────
const ROLE_CARDS = [
  {
    id: 'professor',
    label: 'Professor',
    description: 'Gerencie turmas, registre notas, frequência e atividades.',
    icon: Users,
    color: 'from-emerald-500 to-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    permissions: ['Lançar notas e frequência', 'Gerenciar atividades', 'Acessar diário de classe'],
  },
  {
    id: 'responsavel',
    label: 'Responsável',
    description: 'Acompanhe somente o aluno vinculado pelo portal familiar.',
    icon: Users,
    color: 'from-cyan-500 to-sky-600',
    bg: 'bg-cyan-50',
    border: 'border-cyan-200',
    text: 'text-cyan-700',
    permissions: ['Consultar notas e frequência', 'Ler comunicados', 'Abrir documentos permitidos'],
  },
  {
    id: 'gestao',
    label: 'Gestão',
    description: 'Coordenadores e Secretários com acesso administrativo.',
    icon: Briefcase,
    color: 'from-violet-500 to-purple-600',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    text: 'text-violet-700',
    subRoles: [
      { id: 'coordenador', label: 'Coordenador', desc: 'Supervisão pedagógica, professores e currículos.' },
      { id: 'secretario', label: 'Secretário', desc: 'Matrículas, documentação e financeiro.' },
    ],
    permissions: ['Gerenciar alunos e professores', 'Aprovar matrículas', 'Emitir relatórios'],
  },
];

const ENROLLMENT_SECTIONS = [
  { id: 'personal',    label: 'Dados Pessoais',    icon: GraduationCap },
  { id: 'address',     label: 'Endereço',          icon: School },
  { id: 'academic',    label: 'Dados Acadêmicos',  icon: Briefcase },
  { id: 'guardian',    label: 'Responsável',       icon: Users },
  { id: 'attachments', label: 'Anexos',            icon: UserPlus },
  { id: 'access',      label: 'Criar Acesso',      icon: CheckCircle },
];

const EMPTY_ENROLLMENT = {
  registration_number: generateRA(),
  full_name: '', cpf: '', email: '', birth_date_display: '',
  gender: '', nationality: '', place_of_birth: '', marital_status: '',
  phone: '', mobile_phone: '',
  address: { street: '', number: '', complement: '', neighborhood: '', city: '', state: '', zip_code: '' },
  course: '', entry_period: '', entry_method: '', notes: '',
  guardian_name: '', guardian_cpf: '', guardian_relationship: '', guardian_phone: '', guardian_mobile: '',
  attachments: [],
  create_access: false,
  access_email: '',
};

export default function Registration({ initialModeProp, windowLaunchToken }) {
  const { profileType } = usePermissions();
  // Read ?mode= from URL to allow external pages to deep-link into a specific flow
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get('mode');
  const cameFromExternal = ['matricula', 'usuario'].includes(initialMode);
  const canCreateSystemUsersPermission = canCreateSystemUsers(profileType);
  const availableEntryCards = ENTRY_CARDS.filter((card) => card.id !== 'usuario' || canCreateSystemUsersPermission);
  // top-level: null | 'matricula' | 'usuario'
  const normalizedInitialMode = (() => {
    const requestedMode = cameFromExternal ? initialMode : initialModeProp;
    if (requestedMode === 'usuario' && !canCreateSystemUsersPermission) return null;
    return requestedMode || null;
  })();
  const [mode, setMode] = useState(normalizedInitialMode);

  React.useEffect(() => {
    if (initialModeProp && ['matricula', 'usuario'].includes(initialModeProp)) {
      if (initialModeProp === 'usuario' && !canCreateSystemUsersPermission) {
        setSaved(false);
        setSavedData(null);
        setMode(null);
        return;
      }
      setSaved(false);
      setSavedData(null);
      setMode(initialModeProp);
    }
  }, [initialModeProp, canCreateSystemUsersPermission, windowLaunchToken]);

  const [saved, setSaved] = useState(false);
  const [savedData, setSavedData] = useState(null);

  const handleBack = () => {
    if (cameFromExternal) {
      window.history.back();
    } else {
      setMode(null);
    }
  };

  const reset = () => { setMode(null); setSaved(false); setSavedData(null); };

  if (saved) {
    return <SuccessScreen data={savedData} onReset={reset} />;
  }

  if (mode === 'matricula') {
    return <EnrollmentFlow onSuccess={(d) => { setSavedData(d); setSaved(true); }} onBack={handleBack} />;
  }

  if (mode === 'usuario') {
    return <UserProfileFlow onSuccess={(d) => { setSavedData(d); setSaved(true); }} onBack={handleBack} />;
  }

  // ── Landing
  return (
    <div className="max-w-2xl mx-auto space-y-8 py-4">
      <PageHeader
        title="Cadastros"
        subtitle="Selecione o fluxo de cadastro que deseja realizar para continuar."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {availableEntryCards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.id}
              onClick={() => setMode(card.id)}
              className={cn(
                "group text-left p-6 rounded-[var(--radius-lg)] border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)]",
                `${card.border} ${card.bg}`
              )}
            >
              <div className={cn("w-14 h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center mb-4 shadow-sm", card.color)}>
                <Icon className="w-7 h-7 text-white" />
              </div>
              <h3 className={cn("font-bold text-lg", card.text)}>{card.label}</h3>
              <p className="text-sm text-slate-500 mt-1">{card.description}</p>
              <div className={cn("flex items-center gap-1 text-sm font-medium mt-4", card.text)}>
                Iniciar <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── SUCCESS SCREEN ─────────────────────────────────────────────────────────────
function SuccessScreen({ data, onReset }) {
  return (
    <div className="max-w-lg mx-auto mt-16 text-center space-y-6 app-surface-card p-8">
      <div className="w-20 h-20 rounded-full bg-[hsl(var(--feedback-success-bg))] flex items-center justify-center mx-auto">
        <CheckCircle className="w-10 h-10 text-emerald-600" />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-slate-900">{data?.successTitle || 'Cadastro Realizado!'}</h2>
        <p className="text-slate-500 mt-2">{data?.successMsg}</p>
      </div>
      <div className="flex gap-3 justify-center">
        <Button variant="outline" onClick={onReset}>Novo Cadastro</Button>
      </div>
    </div>
  );
}

// ── ENROLLMENT FLOW ────────────────────────────────────────────────────────────
function EnrollmentFlow({ onSuccess, onBack }) {
  const [data, setData] = useState(EMPTY_ENROLLMENT);
  const [errors, setErrors] = useState({});
  const [activeSection, setActiveSection] = useState('personal');
  const queryClient = useQueryClient();
  const transientAttachmentsRef = useRef([]);
  const committedAttachmentsRef = useRef(false);

  useEffect(() => {
    transientAttachmentsRef.current = data.attachments || [];
  }, [data.attachments]);

  useEffect(() => () => {
    if (committedAttachmentsRef.current || transientAttachmentsRef.current.length === 0) return;

    void deleteStorageFiles(transientAttachmentsRef.current).catch((error) => {
      console.warn('[Registration] Falha ao limpar anexos temporarios da matricula.', error);
    });
  }, []);

  const { data: classes = [] } = useQuery({
    queryKey: ['classes'],
    queryFn: () => ClassApi.list(),
  });

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      const {
        _create_access,
        _access_email,
        ...studentPayload
      } = payload;

      const enrollmentRequest = buildEnrollmentMutationInput({
        student: studentPayload,
        access: {
          create_access: _create_access,
          email: _access_email,
        },
        passwordFactory: generateTempPassword,
      });

      const result = await createEnrollmentWithAccess({
        student: enrollmentRequest.student,
        access: enrollmentRequest.access,
      });

      return {
        student: result.student,
        tempPassword: enrollmentRequest.tempPassword,
      };
    },
    onError: (err) => {
      if (err?.details?.attachmentsInvalidated) {

        setData((currentData) => ({
          ...currentData,
          attachments: [],
        }));
      }

      const baseMessage = formatAdminRequestErrorMessage(
        err,
        'Nao foi possivel salvar a matricula.'
      );

      toast.error(
        err?.details?.attachmentsInvalidated
          ? `${baseMessage} Os anexos foram revertidos e precisam ser reenviados.`
          : baseMessage
      );
    },
    onSuccess: (result) => {
      committedAttachmentsRef.current = true;
      transientAttachmentsRef.current = [];
      queryClient.invalidateQueries({ queryKey: ['students'] });
      onSuccess({
        successTitle: 'Matrícula Salva!',
        successMsg: `RA: ${data.registration_number} — ${data.full_name}${data.create_access ? ` | Acesso criado para ${data.access_email}${result?.tempPassword ? ` | Senha temporária: ${result.tempPassword}` : ''}` : ''}`,
      });
    },
  });

  const discardPendingAttachments = async () => {
    if (committedAttachmentsRef.current || transientAttachmentsRef.current.length === 0) {
      return true;
    }

    try {
      await deleteStorageFiles(transientAttachmentsRef.current);
      transientAttachmentsRef.current = [];
      setData((currentData) => ({
        ...currentData,
        attachments: [],
      }));
      return true;
    } catch (error) {
      toast.error(`Falha ao descartar anexos temporários: ${error.message}`);
      return false;
    }
  };

  const handleBackClick = async () => {
    if (saveMutation.isPending) return;

    const cleanedUp = await discardPendingAttachments();
    if (cleanedUp) {
      onBack();
    }
  };

  const validate = () => {
    const nextErrors = {};
    if (!data.full_name?.trim()) nextErrors.full_name = 'Nome obrigatório';
    if (!data.cpf) nextErrors.cpf = 'CPF obrigatório';
    else if (!validateCPF(data.cpf)) nextErrors.cpf = 'CPF inválido';
    if (!data.email) nextErrors.email = 'E-mail obrigatório';
    else if (!validateGmail(data.email)) nextErrors.email = 'Informe um e-mail válido';
    if (!data.birth_date_display) nextErrors.birth_date = 'Data obrigatória';
    else if (!validateDate(data.birth_date_display)) nextErrors.birth_date = 'Data inválida (DD/MM/AAAA)';
    if (!data.gender) nextErrors.gender = 'Gênero obrigatório';
    if (!data.nationality?.trim()) nextErrors.nationality = 'Nacionalidade obrigatória';
    if (!data.place_of_birth?.trim()) nextErrors.place_of_birth = 'Naturalidade obrigatória';
    if (!data.marital_status) nextErrors.marital_status = 'Estado civil obrigatório';
    if (!data.phone) nextErrors.phone = 'Telefone obrigatório';
    else if (!validatePhone(data.phone)) nextErrors.phone = 'Formato inválido: (XX) XXXX-XXXX';
    if (data.mobile_phone && !validatePhone(data.mobile_phone)) nextErrors.mobile_phone = 'Formato inválido';

    const addr = data.address || {};
    if (!addr.street?.trim()) nextErrors['address.street'] = 'Logradouro obrigatório';
    if (!addr.number?.trim()) nextErrors['address.number'] = 'Número obrigatório';
    if (!addr.neighborhood?.trim()) nextErrors['address.neighborhood'] = 'Bairro obrigatório';
    if (!addr.city?.trim()) nextErrors['address.city'] = 'Cidade obrigatória';
    if (!addr.state) nextErrors['address.state'] = 'Estado obrigatório';
    if (!addr.zip_code) nextErrors['address.zip_code'] = 'CEP obrigatório';
    else if (!validateCEP(addr.zip_code)) nextErrors['address.zip_code'] = 'CEP inválido (XXXXX-XXX)';

    if (!data.course) nextErrors.course = 'Curso obrigatório';
    if (!data.entry_period) nextErrors.entry_period = 'Período obrigatório';
    if (!data.entry_method) nextErrors.entry_method = 'Forma de ingresso obrigatória';

    if (data.has_guardian !== false) {
      if (!data.guardian_name?.trim()) nextErrors.guardian_name = 'Nome obrigatório';
      if (!data.guardian_cpf) nextErrors.guardian_cpf = 'CPF obrigatório';
      else if (!validateCPF(data.guardian_cpf)) nextErrors.guardian_cpf = 'CPF inválido';
      if (!data.guardian_relationship) nextErrors.guardian_relationship = 'Parentesco obrigatório';
      if (!data.guardian_phone) nextErrors.guardian_phone = 'Telefone obrigatório';
      else if (!validatePhone(data.guardian_phone)) nextErrors.guardian_phone = 'Formato inválido';
      if (data.guardian_mobile && !validatePhone(data.guardian_mobile)) nextErrors.guardian_mobile = 'Formato inválido';
    }

    if (data.create_access) {
      if (!data.access_email) nextErrors.access_email = 'E-mail obrigatório para criar acesso';
      else if (!validateGmail(data.access_email)) nextErrors.access_email = 'Informe um e-mail válido';
    }

    (data.attachments || []).forEach((att, i) => {
      if (!att.description?.trim()) nextErrors[`attachment_${i}`] = 'Descrição obrigatória';
    });

    setErrors(nextErrors);
    return nextErrors;
  };

  const sectionHasErrors = (sectionId, validationErrors = errors) => {
    const map = {
      personal: ['full_name','cpf','email','birth_date','gender','nationality','place_of_birth','marital_status','phone','mobile_phone'],
      address:  ['address.street','address.number','address.neighborhood','address.city','address.state','address.zip_code'],
      academic: ['course','entry_period','entry_method'],
      guardian: ['guardian_name','guardian_cpf','guardian_relationship','guardian_phone','guardian_mobile'],
      attachments: (data.attachments || []).map((_, i) => `attachment_${i}`),
      access: ['access_email'],
    };
    return (map[sectionId] || []).some(k => validationErrors[k]);
  };

  const handleSave = () => {
    const validationErrors = validate();

    if (Object.keys(validationErrors).length > 0) {
      const order = ['personal','address','academic','guardian','attachments','access'];
      for (const sec of order) {
        if (sectionHasErrors(sec, validationErrors)) { setActiveSection(sec); break; }
      }
      return;
    }
    const payload = {
      ...data,
      birth_date: toISODate(data.birth_date_display),
      enrollment_date: new Date().toISOString().split('T')[0],
      enrollment_status: 'pendente',
      _create_access: data.create_access,
      _access_email: data.access_email,
    };
    delete payload.birth_date_display;
    delete payload.create_access;
    delete payload.access_email;
    saveMutation.mutate(payload);
  };

  const idx = ENROLLMENT_SECTIONS.findIndex(s => s.id === activeSection);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={() => void handleBackClick()} className="text-slate-400 hover:text-slate-600 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
          <UserPlus className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Matrícula de Aluno</h1>
          <p className="text-slate-500 text-sm">RA: <span className="font-mono font-semibold text-indigo-600">{data.registration_number}</span></p>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1">
        {ENROLLMENT_SECTIONS.map((sec) => {
          const Icon = sec.icon;
          const hasErr = sectionHasErrors(sec.id);
          return (
            <button
              key={sec.id}
              onClick={() => setActiveSection(sec.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all",
                activeSection === sec.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : hasErr
                  ? 'bg-red-50 text-red-600 border border-red-200'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              )}
            >
              <Icon className="w-4 h-4" />
              {sec.label}
              {hasErr && <span className="w-2 h-2 rounded-full bg-red-500" />}
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="text-base font-semibold text-slate-800 mb-4">
          {ENROLLMENT_SECTIONS.find(s => s.id === activeSection)?.label}
        </h2>
        {activeSection === 'personal' && <SectionPersonal data={data} onChange={setData} errors={errors} />}
        {activeSection === 'address'  && <SectionAddress  data={data} onChange={setData} errors={errors} />}
        {activeSection === 'academic' && <SectionAcademic data={data} onChange={setData} errors={errors} classes={classes} />}
        {activeSection === 'guardian' && <SectionGuardian data={data} onChange={setData} errors={errors} />}
        {activeSection === 'attachments' && (
          <SectionAttachments
            attachments={data.attachments || []}
            onChange={(atts) => setData({ ...data, attachments: atts })}
            errors={errors}
          />
        )}
        {activeSection === 'access' && (
          <SectionAccess data={data} onChange={setData} errors={errors} />
        )}
      </div>

      <div className="flex items-center justify-between">
        <Button variant="outline" disabled={idx === 0} onClick={() => setActiveSection(ENROLLMENT_SECTIONS[idx - 1].id)}>
          Anterior
        </Button>
        <div className="flex gap-2">
          {idx < ENROLLMENT_SECTIONS.length - 1 && (
            <Button variant="outline" className="text-indigo-600 border-indigo-200 hover:bg-indigo-50"
              onClick={() => setActiveSection(ENROLLMENT_SECTIONS[idx + 1].id)}>
              Próximo <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
          {activeSection === 'access' && (
            <Button className="bg-indigo-600 hover:bg-indigo-700 px-8" onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin inline" /> Salvando...</> : 'Salvar Matrícula'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── SECTION ACCESS ─────────────────────────────────────────────────────────────
function SectionAccess({ data, onChange, errors }) {
  return (
    <div className="space-y-5">
      <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-sm text-indigo-800">
        <p className="font-medium">Criar acesso ao sistema para o aluno</p>
        <p className="text-indigo-600 mt-1 text-xs">Se ativado, um convite será enviado para o e-mail informado e o aluno poderá fazer login no sistema.</p>
      </div>

      {/* Toggle */}
      <div className="flex items-center gap-3 p-4 bg-white border border-slate-200 rounded-xl cursor-pointer"
        onClick={() => onChange({ ...data, create_access: !data.create_access, access_email: data.create_access ? '' : data.email || '' })}>
        <div className={`w-12 h-6 rounded-full transition-colors flex-shrink-0 ${data.create_access ? 'bg-indigo-600' : 'bg-slate-200'}`}>
          <div className={`w-5 h-5 rounded-full bg-white shadow mt-0.5 transition-transform ${data.create_access ? 'translate-x-6' : 'translate-x-0.5'}`} />
        </div>
        <div>
          <p className="font-medium text-slate-800 text-sm">Criar acesso para este aluno</p>
          <p className="text-xs text-slate-500">Enviar convite por e-mail</p>
        </div>
      </div>

      {data.create_access && (
        <div>
          <label className="text-sm font-medium text-slate-700">
            E-mail para o convite <span className="text-red-500">*</span>
          </label>
          <input
            placeholder="aluno@escola.com"
            value={data.access_email || ''}
            onChange={(e) => onChange({ ...data, access_email: e.target.value.toLowerCase().trim() })}
            className={`mt-1 flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${errors.access_email ? 'border-red-400' : 'border-input'}`}
          />
          {errors.access_email && <p className="text-xs text-red-500 mt-1">{errors.access_email}</p>}
          <p className="text-xs text-slate-400 mt-1">O e-mail do aluno preenchido nos dados pessoais foi sugerido automaticamente.</p>
        </div>
      )}
    </div>
  );
}

// ── USER PROFILE FLOW ──────────────────────────────────────────────────────────
function UserProfileFlow({ onSuccess, onBack }) {
  const [step, setStep] = useState(1);
  const [selectedRole, setSelectedRole] = useState(null);
  const [selectedSubRole, setSelectedSubRole] = useState(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ 
    full_name: '', email: '', phone: '', birth_date: '', 
    document_id: '', address: '', department: '', notes: '' 
  });

  const { data: classes = [] } = useQuery({
    queryKey: ['classes'],
    queryFn: () => ClassApi.list(),
  });
  const canProceed = () => selectedRole && (selectedRole.id !== 'gestao' || selectedSubRole);
  const getFinalRole = () => selectedRole?.id === 'gestao' ? selectedSubRole : selectedRole?.id;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email?.trim()) { 
      toast.error('E-mail é obrigatório.');
      return; 
    }
    if (!form.full_name?.trim()) { 
      toast.error('Nome completo é obrigatório.');
      return; 
    }
    
    setLoading(true);
    try {
      const selectedClass = classes.find((c) => c.id === form.department);
      const tempPassword = generateTempPassword();
      await createManagedProfile({
        email: form.email,
        password: tempPassword,
        full_name: form.full_name,
        phone: form.phone || null,
        birth_date: form.birth_date || null,
        document_id: form.document_id || null,
        address: form.address || null,
        department: selectedClass ? `${selectedClass.name}${selectedClass.year ? ` (${selectedClass.year})` : ''}` : form.department || null,
        notes: form.notes ? form.notes + ' [primeiro_acesso]' : '[primeiro_acesso]',
        profile_type: getFinalRole(),
      });
      
      onSuccess({
        successTitle: 'Usuário Criado!',
        successMsg: `Acesso criado para ${form.full_name} (${getFinalRole()}). A senha temporária gerada é: ${tempPassword} — Por favor, anote-a agora e repasse ao usuário, pois ela não será exibida novamente.`,
      });
    } catch (err) {
      toast.error(err.message ?? 'Erro ao criar usuário.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-slate-400 hover:text-slate-600 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cadastro de Usuário</h1>
          <p className="text-slate-500 text-sm">Passo {step} de 2</p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-3">
        {[1, 2].map((s) => (
          <React.Fragment key={s}>
            <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all",
              step >= s ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500')}>
              {s}
            </div>
            {s < 2 && <div className={cn("flex-1 h-1 rounded", step > s ? 'bg-indigo-600' : 'bg-slate-200')} />}
          </React.Fragment>
        ))}
        <span className="ml-2 text-sm text-slate-500">{step === 1 ? 'Escolher perfil' : 'Preencher dados'}</span>
      </div>

      {step === 1 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {ROLE_CARDS.map((role) => {
              const Icon = role.icon;
              const isSelected = selectedRole?.id === role.id;
              return (
                <button key={role.id} onClick={() => { setSelectedRole(role); setSelectedSubRole(null); }}
                  className={cn("text-left p-5 rounded-2xl border-2 transition-all duration-200 hover:shadow-md",
                    isSelected ? `${role.border} ${role.bg} shadow-md` : 'border-slate-200 bg-white hover:border-slate-300')}>
                  <div className={cn("w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center mb-4", role.color)}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className={cn("font-bold text-lg", isSelected ? role.text : 'text-slate-900')}>{role.label}</h3>
                  <p className="text-sm text-slate-500 mt-1">{role.description}</p>
                  <ul className="mt-3 space-y-1">
                    {role.permissions.map((p, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs text-slate-500">
                        <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", isSelected ? role.text.replace('text-', 'bg-') : 'bg-slate-300')} />
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
                    className={cn("text-left p-4 rounded-xl border-2 transition-all",
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

      {step === 2 && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <button type="button" onClick={() => setStep(1)} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
            <ChevronLeft className="w-4 h-4" /> Voltar
          </button>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label>Nome completo *</Label>
                <input required placeholder="Nome completo"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  onBlur={(e) => setForm(f => ({ ...f, full_name: formatName(e.target.value) }))}
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
              </div>
              <div className="md:col-span-2">
                <Label>E-mail *</Label>
                <input required type="email" placeholder="email@escola.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: normalizeEmail(e.target.value) })}
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
              </div>
              <div>
                <Label>Telefone</Label>
                <input placeholder="(00) 00000-0000"
                  value={form.phone} onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })}
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
              </div>
              <div>
                <Label>Data de nascimento</Label>
                <input type="date" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
              </div>
              <div>
                <Label>CPF</Label>
                <input placeholder="000.000.000-00"
                  maxLength={14}
                  value={form.document_id}
                  onChange={(e) => {
                    const d = e.target.value.replace(/\D/g,"").slice(0,11);
                    setForm({ ...form, document_id: d.replace(/(\d{3})(\d)/,"$1.$2").replace(/(\d{3})(\d)/,"$1.$2").replace(/(\d{3})(\d{1,2})$/,"$1-$2") });
                  }}
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
              </div>
              <div>
              <Label>Departamento / Turma</Label>
              <Select value={form.department || ''} onValueChange={(value) => setForm({ ...form, department: value })}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione uma turma" />
                </SelectTrigger>
                <SelectContent>
                  {classes.length > 0 ? classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name} {c.year ? `(${c.year})` : ''}</SelectItem>
                  )) : (
                    <SelectItem value="" disabled>Nenhuma turma cadastrada</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="mt-2 text-xs text-slate-500">O campo salva o ID da turma selecionada para referência de departamento.</p>
            </div>
            <div className="md:col-span-2">
              <Label>Endereço</Label>
                <input placeholder="Rua, número, bairro, cidade"
                  value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
              </div>
              <div className="md:col-span-2">
                <Label>Observações</Label>
                <input placeholder="Informações adicionais"
                  value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
              </div>
            </div>
          </div>

          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-sm text-amber-800">⚠️ O usuário receberá uma senha temporária gerada automaticamente e será ativada instantaneamente.</p>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 px-8">
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</>
              ) : (
                'Criar Usuário'
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
