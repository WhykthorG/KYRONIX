import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, User, MapPin, BookOpen, Users, Paperclip, CheckCircle, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import SectionPersonal from '@/components/enrollment/SectionPersonal';
import SectionAddress from '@/components/enrollment/SectionAddress';
import SectionAcademic from '@/components/enrollment/SectionAcademic';
import SectionGuardian from '@/components/enrollment/SectionGuardian';
import SectionAttachments from '@/components/enrollment/SectionAttachments';
import { ClassApi } from '@/services/supabaseApi';
import { toast } from 'sonner';
import {
  createEnrollmentWithAccess,
  formatAdminRequestErrorMessage,
} from '@/lib/supabaseAdmin';
import {
  validateCPF, validateGmail, validatePhone, validateCEP,
  validateDate, toISODate, generateRA
} from '@/components/enrollment/enrollmentUtils';
import { buildEnrollmentMutationInput } from '@shared/contracts/enrollment';
import { deleteStorageFiles } from '@/lib/storageFiles';

const SECTIONS = [
  { id: 'personal', label: 'Dados Pessoais', icon: User },
  { id: 'address',  label: 'Endereço',       icon: MapPin },
  { id: 'academic', label: 'Dados Acadêmicos', icon: BookOpen },
  { id: 'guardian', label: 'Responsável',    icon: Users },
  { id: 'attachments', label: 'Anexos',      icon: Paperclip },
];

const EMPTY = {
  registration_number: generateRA(),
  full_name: '', cpf: '', email: '', birth_date_display: '',
  gender: '', nationality: '', place_of_birth: '', marital_status: '',
  phone: '', mobile_phone: '',
  address: { street: '', number: '', complement: '', neighborhood: '', city: '', state: '', zip_code: '' },
  course: '', entry_period: '', entry_method: '', notes: '',
  guardian_name: '', guardian_cpf: '', guardian_relationship: '', guardian_phone: '', guardian_mobile: '',
  attachments: [],
};

export default function StudentEnrollment() {
  const [data, setData] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [activeSection, setActiveSection] = useState('personal');
  const [saved, setSaved] = useState(false);
  const queryClient = useQueryClient();
  const transientAttachmentsRef = useRef([]);
  const committedAttachmentsRef = useRef(false);

  useEffect(() => {
    transientAttachmentsRef.current = data.attachments || [];
  }, [data.attachments]);

  useEffect(() => () => {
    if (committedAttachmentsRef.current || transientAttachmentsRef.current.length === 0) return;

    void deleteStorageFiles(transientAttachmentsRef.current).catch((error) => {
      console.warn('[StudentEnrollment] Falha ao limpar anexos temporários.', error);
    });
  }, []);

  const { data: classes = [] } = useQuery({
    queryKey: ['classes'],
    queryFn: () => ClassApi.list(),
  });

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      const enrollmentRequest = buildEnrollmentMutationInput({
        student: payload,
      });

      const result = await createEnrollmentWithAccess({
        student: enrollmentRequest.student,
        access: enrollmentRequest.access,
      });

      return result.student;
    },
    onSuccess: () => {
      committedAttachmentsRef.current = true;
      transientAttachmentsRef.current = [];
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setSaved(true);
    },
    onError: (error) => {
      if (error?.details?.attachmentsInvalidated) {
        setData((currentData) => ({
          ...currentData,
          attachments: [],
        }));
      }

      const baseMessage = formatAdminRequestErrorMessage(
        error,
        'Não foi possível salvar a matrícula.'
      );

      toast.error(
        error?.details?.attachmentsInvalidated
          ? `${baseMessage} Os anexos foram revertidos e precisam ser reenviados.`
          : baseMessage
      );
    },
  });

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
    if (data.mobile_phone && !validatePhone(data.mobile_phone)) nextErrors.mobile_phone = 'Formato inválido: (XX) XXXXX-XXXX';

    // Address
    const addr = data.address || {};
    if (!addr.street?.trim()) nextErrors['address.street'] = 'Logradouro obrigatório';
    if (!addr.number?.trim()) nextErrors['address.number'] = 'Número obrigatório';
    if (!addr.neighborhood?.trim()) nextErrors['address.neighborhood'] = 'Bairro obrigatório';
    if (!addr.city?.trim()) nextErrors['address.city'] = 'Cidade obrigatória';
    if (!addr.state) nextErrors['address.state'] = 'Estado obrigatório';
    if (!addr.zip_code) nextErrors['address.zip_code'] = 'CEP obrigatório';
    else if (!validateCEP(addr.zip_code)) nextErrors['address.zip_code'] = 'CEP inválido (XXXXX-XXX)';

    // Academic
    if (!data.course) nextErrors.course = 'Curso obrigatório';
    if (!data.entry_period) nextErrors.entry_period = 'Período obrigatório';
    if (!data.entry_method) nextErrors.entry_method = 'Forma de ingresso obrigatória';

    // Guardian
    if (!data.guardian_name?.trim()) nextErrors.guardian_name = 'Nome do responsável obrigatório';
    if (!data.guardian_cpf) nextErrors.guardian_cpf = 'CPF do responsável obrigatório';
    else if (!validateCPF(data.guardian_cpf)) nextErrors.guardian_cpf = 'CPF do responsável inválido';
    if (!data.guardian_relationship) nextErrors.guardian_relationship = 'Parentesco obrigatório';
    if (!data.guardian_phone) nextErrors.guardian_phone = 'Telefone do responsável obrigatório';
    else if (!validatePhone(data.guardian_phone)) nextErrors.guardian_phone = 'Formato inválido: (XX) XXXX-XXXX';
    if (data.guardian_mobile && !validatePhone(data.guardian_mobile)) nextErrors.guardian_mobile = 'Formato inválido';

    // Attachments descriptions
    (data.attachments || []).forEach((att, i) => {
      if (!att.description?.trim()) nextErrors[`attachment_${i}`] = 'Descrição do arquivo obrigatória';
    });

    setErrors(nextErrors);
    return nextErrors;
  };

  const handleSave = () => {
    const validationErrors = validate();

    if (Object.keys(validationErrors).length > 0) {
      // Jump to first section with error
      const sectionMap = {
        personal: ['full_name','cpf','email','birth_date','gender','nationality','place_of_birth','marital_status','phone','mobile_phone'],
        address:  ['address.street','address.number','address.neighborhood','address.city','address.state','address.zip_code'],
        academic: ['course','entry_period','entry_method'],
        guardian: ['guardian_name','guardian_cpf','guardian_relationship','guardian_phone','guardian_mobile'],
        attachments: (data.attachments || []).map((_, i) => `attachment_${i}`),
      };
      for (const [sec, keys] of Object.entries(sectionMap)) {
        if (keys.some(k => validationErrors[k])) { setActiveSection(sec); break; }
      }
      return;
    }

    const payload = {
      ...data,
      birth_date: toISODate(data.birth_date_display),
      enrollment_date: new Date().toISOString().split('T')[0],
      enrollment_status: 'pendente',
    };
    delete payload.birth_date_display;
    saveMutation.mutate(payload);
  };

  const sectionErrors = (sectionId) => {
    const sectionMap = {
      personal: ['full_name','cpf','email','birth_date','gender','nationality','place_of_birth','marital_status','phone','mobile_phone'],
      address:  ['address.street','address.number','address.neighborhood','address.city','address.state','address.zip_code'],
      academic: ['course','entry_period','entry_method'],
      guardian: ['guardian_name','guardian_cpf','guardian_relationship','guardian_phone','guardian_mobile'],
      attachments: (data.attachments || []).map((_, i) => `attachment_${i}`),
    };
    return (sectionMap[sectionId] || []).some(k => errors[k]);
  };

  if (saved) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
          <CheckCircle className="w-10 h-10 text-emerald-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Matrícula Salva!</h2>
          <p className="text-slate-500 mt-2">RA: <strong>{data.registration_number}</strong></p>
          <p className="text-slate-500">Aluno: <strong>{data.full_name}</strong></p>
        </div>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={() => { setData({ ...EMPTY, registration_number: generateRA() }); setErrors({}); setSaved(false); setActiveSection('personal'); }}>
            Nova Matrícula
          </Button>
          <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={() => window.history.back()}>
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
          <UserPlus className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Matrícula de Aluno</h1>
          <p className="text-slate-500 text-sm">RA: <span className="font-mono font-semibold text-indigo-600">{data.registration_number}</span></p>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {SECTIONS.map((sec) => {
          const Icon = sec.icon;
          const hasErr = sectionErrors(sec.id);
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

      {/* Section Content */}
      <Card className="border-slate-200">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold text-slate-800">
            {SECTIONS.find(s => s.id === activeSection)?.label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeSection === 'personal' && (
            <SectionPersonal data={data} onChange={setData} errors={errors} />
          )}
          {activeSection === 'address' && (
            <SectionAddress data={data} onChange={setData} errors={errors} />
          )}
          {activeSection === 'academic' && (
            <SectionAcademic data={data} onChange={setData} errors={errors} classes={classes} />
          )}
          {activeSection === 'guardian' && (
            <SectionGuardian data={data} onChange={setData} errors={errors} />
          )}
          {activeSection === 'attachments' && (
            <SectionAttachments
              attachments={data.attachments || []}
              onChange={(atts) => setData({ ...data, attachments: atts })}
              errors={errors}
            />
          )}
        </CardContent>
      </Card>

      {/* Navigation + Save */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          disabled={activeSection === SECTIONS[0].id}
          onClick={() => {
            const idx = SECTIONS.findIndex(s => s.id === activeSection);
            if (idx > 0) setActiveSection(SECTIONS[idx - 1].id);
          }}
        >
          Anterior
        </Button>

        <div className="flex gap-2">
          {activeSection !== SECTIONS[SECTIONS.length - 1].id && (
            <Button
              variant="outline"
              className="text-indigo-600 border-indigo-200 hover:bg-indigo-50"
              onClick={() => {
                const idx = SECTIONS.findIndex(s => s.id === activeSection);
                setActiveSection(SECTIONS[idx + 1].id);
              }}
            >
              Próximo <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
          <Button
            className="bg-indigo-600 hover:bg-indigo-700 px-8"
            onClick={handleSave}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin inline" />
                Salvando...
              </>
            ) : (
              'Salvar Matrícula'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

