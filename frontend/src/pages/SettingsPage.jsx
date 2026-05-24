import React, { useEffect, useState } from 'react';
import PageHeader from '@/components/common/PageHeader';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  School, Bell, Shield, Save, Loader2, AlertTriangle, Download, FileSpreadsheet, FileText, Database
} from 'lucide-react';
import { toast } from 'sonner';
import { AppSettingsApi } from '@/services/supabaseApi';
import StudentPhotoReviewDialog from '@/components/usermanagement/StudentPhotoReviewDialog';
import {
  downloadSystemExport,
  formatAdminRequestErrorMessage,
} from '@/lib/supabaseAdmin';
import {
  buildSystemSettingsRecord,
  isSettingsRecordMissing,
  isSettingsTableUnavailable,
  mapSystemSettingsRecord,
  normalizeSystemSettings,
  readSystemSettingsFromStorage,
  writeSystemSettingsToStorage,
} from '@shared/contracts/settings';
import {
  DEFAULT_CSV_EXPORT_DATASET,
  listSystemExportDatasets,
} from '@shared/contracts/systemExport';

const SYSTEM_EXPORT_DATASETS = listSystemExportDatasets();

export default function SettingsPage() {
  const [settings, setSettings] = useState(() => readSystemSettingsFromStorage());
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [persistenceMode, setPersistenceMode] = useState('server');
  const [saving, setSaving] = useState(false);
  const [exportingXlsx, setExportingXlsx] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [csvDataset, setCsvDataset] = useState(DEFAULT_CSV_EXPORT_DATASET);
  const [photoReviewOpen, setPhotoReviewOpen] = useState(false);
  const safeSettings = normalizeSystemSettings(settings);

  useEffect(() => {
    const loadSettings = async () => {
      setLoadingSettings(true);

      try {
        const record = await AppSettingsApi.getOptional('system');

        if (record) {
          const serverSettings = mapSystemSettingsRecord(record);
          setSettings(serverSettings);
          writeSystemSettingsToStorage(serverSettings);
        } else {
          const localSettings = readSystemSettingsFromStorage();
          setSettings(localSettings);
        }

        setPersistenceMode('server');
      } catch (error) {
        const localSettings = readSystemSettingsFromStorage();
        setSettings(localSettings);

        if (isSettingsRecordMissing(error)) {
          setPersistenceMode('server');
        } else if (isSettingsTableUnavailable(error)) {
          setPersistenceMode('local');
        } else {
          setPersistenceMode('local');
          toast.error('Nao foi possivel carregar as configuracoes do servidor.');
        }
      } finally {
        setLoadingSettings(false);
      }
    };

    loadSettings();
  }, []);

  const updateSetting = (key, value) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      const normalized = normalizeSystemSettings(settings);
      await AppSettingsApi.upsert(buildSystemSettingsRecord(normalized), { onConflict: 'id' });
      writeSystemSettingsToStorage(normalized);
      setSettings(normalized);
      setPersistenceMode('server');
      toast.success('Configuracoes salvas com sucesso!');
    } catch (error) {
      const normalized = writeSystemSettingsToStorage(safeSettings);
      setSettings(normalized);
      setPersistenceMode('local');

      if (isSettingsTableUnavailable(error)) {
        toast.success('Configuracoes salvas neste navegador.');
      } else {
        toast.error('Falha ao salvar no servidor. As alteracoes ficaram salvas neste navegador.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSystemExport = async () => {
    if (exportingXlsx || exportingCsv) return;

    setExportingXlsx(true);

    try {
      const { filename } = await downloadSystemExport({ format: 'xlsx' });
      toast.success(`Backup exportado com sucesso: ${filename}`);
    } catch (error) {
      toast.error(
        formatAdminRequestErrorMessage(error, 'Nao foi possivel exportar o sistema.'),
      );
    } finally {
      setExportingXlsx(false);
    }
  };

  const handleDatasetCsvExport = async () => {
    if (!csvDataset || exportingXlsx || exportingCsv) return;

    setExportingCsv(true);

    try {
      const { filename } = await downloadSystemExport({
        format: 'csv',
        dataset: csvDataset,
      });
      toast.success(`Arquivo CSV exportado com sucesso: ${filename}`);
    } catch (error) {
      toast.error(
        formatAdminRequestErrorMessage(
          error,
          'Nao foi possivel exportar o modulo selecionado.',
        ),
      );
    } finally {
      setExportingCsv(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurações"
        subtitle="Gerencie as configurações do sistema"
      />

      {persistenceMode === 'local' && (
        <Card className="border-amber-200 bg-amber-50/80">
          <CardContent className="flex items-start gap-3 p-4 text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div className="space-y-1 text-sm">
              <p className="font-medium">Persistencia local ativa</p>
              <p>
                A tabela <code>app_settings</code> nao esta disponivel neste ambiente ou nao respondeu.
                As alteracoes desta tela ficam salvas apenas neste navegador.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="geral" className="space-y-6">
        <TabsList>
          <TabsTrigger value="geral" className="flex items-center gap-2">
            <School className="w-4 h-4" />
            Geral
          </TabsTrigger>
          <TabsTrigger value="notificacoes" className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Notificações
          </TabsTrigger>
          <TabsTrigger value="seguranca" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Segurança
          </TabsTrigger>
          <TabsTrigger value="exportacao" className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            Exportação
          </TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="geral">
          <Card>
            <CardHeader>
              <CardTitle>Informações da Escola</CardTitle>
              <CardDescription>
                Configure as informações básicas da instituição
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Nome da Escola</Label>
                  <Input
                    value={safeSettings.schoolName}
                    onChange={(e) => updateSetting('schoolName', e.target.value)}
                  />
                </div>
                <div>
                  <Label>E-mail</Label>
                  <Input
                    type="email"
                    value={safeSettings.schoolEmail}
                    onChange={(e) => updateSetting('schoolEmail', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input
                    value={safeSettings.schoolPhone}
                    onChange={(e) => updateSetting('schoolPhone', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Endereço</Label>
                  <Input
                    value={safeSettings.schoolAddress}
                    onChange={(e) => updateSetting('schoolAddress', e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Idioma</Label>
                  <Input value={safeSettings.language} disabled />
                </div>
                <div>
                  <Label>Fuso Horário</Label>
                  <Input value={safeSettings.timezone} disabled />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notification Settings */}
        <TabsContent value="notificacoes">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Notificações</CardTitle>
              <CardDescription>
                Defina quais notificações devem ser enviadas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Nova Matrícula</p>
                  <p className="text-sm text-slate-500">Notificar quando uma nova matrícula for realizada</p>
                </div>
                <Switch
                  checked={safeSettings.notifyNewEnrollment}
                  onCheckedChange={(checked) => updateSetting('notifyNewEnrollment', checked)}

                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Vencimento de Pagamento</p>
                  <p className="text-sm text-slate-500">Notificar responsáveis sobre vencimentos próximos</p>
                </div>
                <Switch
                  checked={safeSettings.notifyPaymentDue}
                  onCheckedChange={(checked) => updateSetting('notifyPaymentDue', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Notas Lançadas</p>
                  <p className="text-sm text-slate-500">Notificar quando novas notas forem lançadas</p>
                </div>
                <Switch
                  checked={safeSettings.notifyGradePosted}
                  onCheckedChange={(checked) => updateSetting('notifyGradePosted', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Problemas de Frequência</p>
                  <p className="text-sm text-slate-500">Notificar quando aluno tiver muitas faltas</p>
                </div>
                <Switch
                  checked={safeSettings.notifyAttendanceIssue}
                  onCheckedChange={(checked) => updateSetting('notifyAttendanceIssue', checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value="seguranca">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Segurança</CardTitle>
              <CardDescription>
                Gerencie as políticas de segurança e privacidade
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Foto do Aluno</p>
                  <p className="text-sm text-slate-500">Permitir que alunos alterem a própria foto no portal</p>
                </div>
                <Switch
                  checked={safeSettings.allowStudentPhotoUpload}
                  onCheckedChange={(checked) => updateSetting('allowStudentPhotoUpload', checked)}
                />
              </div>
              <p className="text-xs text-slate-400">
                Quando desativado, apenas secretaria e administração podem ajustar fotos de alunos.
              </p>
              <div className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPhotoReviewOpen(true)}
                >
                  Abrir aprovações de foto
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Aprovação do Responsável</p>
                  <p className="text-sm text-slate-500">Exigir aprovação do responsável para certas ações</p>
                </div>
                <Switch
                  checked={safeSettings.requireGuardianApproval}
                  onCheckedChange={(checked) => updateSetting('requireGuardianApproval', checked)}
                />
              </div>
              <div className="pt-4 border-t">
                <h4 className="font-medium mb-4">Conformidade LGPD</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="p-4 bg-emerald-50 border-emerald-200">
                    <div className="flex items-center gap-2">
                      <Shield className="w-5 h-5 text-emerald-600" />
                      <span className="font-medium text-emerald-700">Criptografia de Dados</span>
                    </div>
                    <p className="text-sm text-emerald-600 mt-1">Ativo</p>
                  </Card>
                  <Card className="p-4 bg-emerald-50 border-emerald-200">
                    <div className="flex items-center gap-2">
                      <Shield className="w-5 h-5 text-emerald-600" />
                      <span className="font-medium text-emerald-700">Backup Automático</span>
                    </div>
                    <p className="text-sm text-emerald-600 mt-1">Diário</p>
                  </Card>
                  <Card className="p-4 bg-emerald-50 border-emerald-200">
                    <div className="flex items-center gap-2">
                      <Shield className="w-5 h-5 text-emerald-600" />
                      <span className="font-medium text-emerald-700">Logs de Auditoria</span>
                    </div>
                    <p className="text-sm text-emerald-600 mt-1">Ativo</p>
                  </Card>
                  <Card className="p-4 bg-emerald-50 border-emerald-200">
                    <div className="flex items-center gap-2">
                      <Shield className="w-5 h-5 text-emerald-600" />
                      <span className="font-medium text-emerald-700">Controle de Acesso</span>
                    </div>
                    <p className="text-sm text-emerald-600 mt-1">Por Perfil</p>
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="exportacao">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Backup completo do sistema
                </CardTitle>
                <CardDescription>
                  Exporta o banco operacional em um arquivo Excel com abas separadas para alunos, materias,
                  turmas, professores, coordenacao, configuracoes e outros registros necessarios para manter o sistema.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-700">
                  <p className="font-medium text-slate-900">Modo recomendado para backup e migracao</p>
                  <p className="mt-1">
                    O servidor monta o arquivo em lotes, tabela por tabela, para reduzir picos de memoria e evitar
                    sobrecarga no navegador.
                  </p>
                </div>
                <div className="grid gap-3 text-sm text-slate-600 md:grid-cols-2">
                  {SYSTEM_EXPORT_DATASETS.slice(0, 8).map((dataset) => (
                    <div key={dataset.key} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                      {dataset.label}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-500">
                  O arquivo nao inclui credenciais do Supabase Auth. O restante dos dados operacionais sai organizado
                  em abas, com manifesto e contagem por tabela.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={handleSystemExport}
                    disabled={exportingXlsx || exportingCsv}
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    {exportingXlsx ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="mr-2 h-4 w-4" />
                    )}
                    {exportingXlsx ? 'Exportando backup...' : 'Exportar sistema em Excel'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Exportacao CSV por modulo
                </CardTitle>
                <CardDescription>
                  Ideal para integracoes e cargas parciais. O CSV sai de um modulo por vez para manter o processo leve.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="space-y-2">
                    <Label>Modulo para exportar</Label>
                    <Select value={csvDataset} onValueChange={setCsvDataset}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um modulo" />
                      </SelectTrigger>
                      <SelectContent>
                        {SYSTEM_EXPORT_DATASETS.map((dataset) => (
                          <SelectItem key={dataset.key} value={dataset.key}>
                            {dataset.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button
                      variant="outline"
                      onClick={handleDatasetCsvExport}
                      disabled={!csvDataset || exportingXlsx || exportingCsv}
                      className="min-w-52"
                    >
                      {exportingCsv ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <FileText className="mr-2 h-4 w-4" />
                      )}
                      {exportingCsv ? 'Gerando CSV...' : 'Exportar modulo em CSV'}
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  Use CSV quando precisar importar um modulo especifico em outro sistema ou revisar dados sem baixar
                  um backup completo.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <StudentPhotoReviewDialog
        open={photoReviewOpen}
        onOpenChange={setPhotoReviewOpen}
      />

      {/* Save Button */}
      <div className="flex justify-end">
        <Button 
          onClick={handleSave} 
          disabled={saving || loadingSettings}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          {(saving || loadingSettings) ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          {loadingSettings ? 'Carregando...' : 'Salvar Configuracoes'}
        </Button>
      </div>
    </div>
  );
}
