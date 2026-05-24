import {
  BellRing,
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  FileSpreadsheet,
  Flag,
  GraduationCap,
  LayoutDashboard,
  LibraryBig,
  MessageSquareDot,
  Rocket,
  School,
  Settings2,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from 'lucide-react';

const makeMetric = (label, value, detail, tone = 'neutral') => ({
  label,
  value,
  detail,
  tone,
});

const makeFeedItem = (eyebrow, title, detail) => ({
  eyebrow,
  title,
  detail,
});

const makeAction = (label, detail) => ({
  label,
  detail,
});

const MOBILE_MODULE_BLUEPRINTS = [
  {
    id: 'dashboard',
    appId: 'dashboard',
    title: 'Dashboard',
    eyebrow: 'Visão Executiva',
    description: 'Painel central com indicadores, pendências e ritmo operacional da escola.',
    heroTitle: 'Panorama do dia letivo com foco em prioridade, comunicação e fluidez operacional.',
    heroCopy: 'Consolida alertas críticos, próximos prazos e visão resumida da jornada escolar em formato mobile-first.',
    accent: 'institutional',
    icon: LayoutDashboard,
    metrics: [
      makeMetric('Pendências críticas', '04', '2 novas desde 07:30', 'warning'),
      makeMetric('Execução diária', '82%', 'acima da média da semana', 'success'),
      makeMetric('Comunicação ativa', '17', 'conversas em acompanhamento', 'info'),
    ],
    feed: [
      makeFeedItem('Agora', 'Rotina pedagógica estabilizada', 'Turmas e comunicação seguem sem incidentes de infraestrutura.'),
      makeFeedItem('Próximo bloco', 'Revisão de matrícula em lote', 'Equipe de gestão separou oito fichas para conferência móvel.'),
      makeFeedItem('Sinal importante', 'Relatórios com pico de acesso', 'Maior volume vindo do portal do responsável.'),
    ],
    actions: [
      makeAction('Abrir resumo operacional', 'Concentra pontos urgentes em leitura curta para o gestor.'),
      makeAction('Revisar comunicação', 'Entra direto no hub de comunicados e mensagens da equipe.'),
    ],
  },
  {
    id: 'users',
    appId: 'users',
    title: 'Usuários',
    eyebrow: 'Gestão de Acesso',
    description: 'Perfis, vínculos e governança de acesso em formato compacto para operação móvel.',
    heroTitle: 'Controle refinado de perfis, convites e ajustes administrativos.',
    heroCopy: 'Experiência pensada para agir rápido sem perder contexto sobre status, função e dependências.',
    accent: 'violet',
    icon: ShieldCheck,
    metrics: [
      makeMetric('Perfis ativos', '248', '12 aguardando revisão', 'info'),
      makeMetric('Ajustes hoje', '09', 'inclui fotos e redefinições', 'success'),
      makeMetric('Risco de acesso', '02', 'perfis sem revisão recente', 'warning'),
    ],
    feed: [
      makeFeedItem('Governança', 'Fila de aprovações enxuta', 'Os convites pendentes estão agrupados por criticidade e papel.'),
      makeFeedItem('Atenção', 'Dois vínculos sem turma', 'Usuários com contexto acadêmico incompleto pedem ajuste.'),
    ],
    actions: [
      makeAction('Criar novo acesso', 'Abre um fluxo guiado com senha temporária simulada.'),
      makeAction('Revisar perfis sensíveis', 'Destaca coordenação, secretaria e administração com prioridade.'),
    ],
  },
  {
    id: 'students',
    appId: 'students',
    title: 'Alunos',
    eyebrow: 'Corpo Discente',
    description: 'Consulta rápida a matrículas, situação acadêmica e sinais de atenção.',
    heroTitle: 'Acompanhamento do aluno com leitura clara, rápida e preparada para campo.',
    heroCopy: 'Resumos curtos, ações de continuidade e integração futura com fichas completas do ERP.',
    accent: 'emerald',
    icon: GraduationCap,
    metrics: [
      makeMetric('Alunos ativos', '612', '95% com dados completos', 'success'),
      makeMetric('Em atenção', '18', 'faltas, notas ou documentos', 'warning'),
      makeMetric('Novas entradas', '07', 'cadastros do turno da manhã', 'info'),
    ],
    feed: [
      makeFeedItem('Sinal pedagógico', 'Três alunos com oscilação de frequência', 'O shell sugere continuidade pelo módulo acadêmico.'),
      makeFeedItem('Documentação', 'Fila de anexos sob controle', 'Apenas duas fichas seguem incompletas.'),
    ],
    actions: [
      makeAction('Filtrar por situação', 'Alterna entre ativos, acompanhamento e novos cadastros.'),
      makeAction('Retomar ficha recente', 'Traz o último aluno visualizado para continuidade rápida.'),
    ],
  },
  {
    id: 'teachers',
    appId: 'teachers',
    title: 'Professores',
    eyebrow: 'Equipe Docente',
    description: 'Acesso rápido à disponibilidade, agenda e contexto operacional da equipe docente.',
    heroTitle: 'Visão mobile da operação docente com foco em agenda e apoio pedagógico.',
    heroCopy: 'Ideal para coordenação acompanhar disponibilidade, atividades críticas e ritmo por professor.',
    accent: 'amber',
    icon: UsersRound,
    metrics: [
      makeMetric('Docentes ativos', '43', 'cobertura plena dos turnos', 'success'),
      makeMetric('Agenda crítica', '05', 'ajustes de calendário em aberto', 'warning'),
      makeMetric('Portais ativos', '31', 'uso recorrente hoje', 'info'),
    ],
    feed: [
      makeFeedItem('Coordenação', 'Janela de substituição detectada', 'Uma turma do fim do dia exige remanejamento leve.'),
      makeFeedItem('Produtividade', 'Diários com boa cadência', 'A maior parte das turmas está com registro no prazo.'),
    ],
    actions: [
      makeAction('Abrir portal do professor', 'Continua a jornada pelo módulo dedicado ao docente.'),
      makeAction('Revisar agenda semanal', 'Foca em disponibilidade e eventos institucionais.'),
    ],
  },
  {
    id: 'classes',
    appId: 'classes',
    title: 'Turmas',
    eyebrow: 'Organização Escolar',
    description: 'Mapa móvel de turmas, distribuição e acompanhamento de contexto acadêmico.',
    heroTitle: 'Turmas agrupadas por leitura operacional e decisão rápida.',
    heroCopy: 'Excelente para coordenação percorrer séries, anos e cargas de atendimento sem ruído visual.',
    accent: 'sky',
    icon: School,
    metrics: [
      makeMetric('Turmas ativas', '28', 'equilíbrio entre manhã e tarde', 'info'),
      makeMetric('Capacidade média', '89%', 'ocupação saudável', 'success'),
      makeMetric('Ajustes pendentes', '03', 'sala, turno ou docente', 'warning'),
    ],
    feed: [
      makeFeedItem('Distribuição', 'Concentração estável por série', 'As turmas do fundamental seguem sem sobrecarga.'),
      makeFeedItem('Ação sugerida', 'Uma turma precisa revisão de horário', 'Ajuste indicado no calendário institucional.'),
    ],
    actions: [
      makeAction('Ler capacidade por turma', 'Mostra ocupação, janela de expansão e observações curtas.'),
      makeAction('Cruzar com calendário', 'Leva a continuidade para agenda e eventos.'),
    ],
  },
  {
    id: 'registration',
    appId: 'registration',
    title: 'Matrícula',
    eyebrow: 'Fluxo de Entrada',
    description: 'Experiência móvel para acompanhar a saúde do pipeline de matrícula.',
    heroTitle: 'Matrículas organizadas por etapa, urgência documental e continuidade.',
    heroCopy: 'A navegação foi desenhada para permitir revisão rápida com ótimo acabamento visual.',
    accent: 'emerald',
    icon: FileSpreadsheet,
    metrics: [
      makeMetric('Em análise', '14', '3 com prioridade alta', 'warning'),
      makeMetric('Concluídas hoje', '11', 'ritmo consistente', 'success'),
      makeMetric('Aguardando documento', '05', 'ações agrupadas', 'info'),
    ],
    feed: [
      makeFeedItem('Fila ativa', 'Lote de matrícula estabilizado', 'A maior parte dos casos segue com dados essenciais completos.'),
      makeFeedItem('Próxima ação', 'Revisão por documentos pendentes', 'O shell destaca apenas o que depende de intervenção humana.'),
    ],
    actions: [
      makeAction('Abrir conferência guiada', 'Foco em documentos e consistência do cadastro.'),
      makeAction('Consultar vínculo do responsável', 'Atalho para validação do portal familiar.'),
    ],
  },
  {
    id: 'academic',
    appId: 'academicrecord',
    title: 'Acadêmico',
    eyebrow: 'Vida Acadêmica',
    description: 'Acesso móvel ao histórico, registros e evolução acadêmica.',
    heroTitle: 'Contexto acadêmico legível, denso e elegante em tela pequena.',
    heroCopy: 'Concentra histórico, marcos e indicadores sem depender da navegação desktop.',
    accent: 'violet',
    icon: BookOpen,
    metrics: [
      makeMetric('Registros íntegros', '97%', 'base pronta para integração real', 'success'),
      makeMetric('Atualizações recentes', '22', 'últimos 3 períodos', 'info'),
      makeMetric('Pontos a revisar', '04', 'diferenças de histórico', 'warning'),
    ],
    feed: [
      makeFeedItem('Evolução', 'Histórico pronto para leitura resumida', 'A experiência prioriza contexto e clareza antes de detalhe extremo.'),
      makeFeedItem('Risco baixo', 'Registros sem anomalias críticas', 'Boa base para futuras jornadas do aluno e do responsável.'),
    ],
    actions: [
      makeAction('Abrir histórico condensado', 'Resumo com marcos, série e situação acadêmica.'),
      makeAction('Cruzar com metas', 'Leitura orientada por evolução e próximos objetivos.'),
    ],
  },
  {
    id: 'assignments',
    appId: 'assignments',
    title: 'Atividades',
    eyebrow: 'Rotina de Entregas',
    description: 'Atividades, prazos e sinais de atraso em uma experiência touch-first.',
    heroTitle: 'Entregas, publicações e acompanhamento com leitura instantânea.',
    heroCopy: 'Projetado para professor e gestão acompanharem o andamento mesmo em deslocamento.',
    accent: 'amber',
    icon: Sparkles,
    metrics: [
      makeMetric('Abertas', '19', '7 vencem em 48h', 'warning'),
      makeMetric('Concluídas', '74%', 'média global do período', 'success'),
      makeMetric('Revisões', '06', 'em correção', 'info'),
    ],
    feed: [
      makeFeedItem('Prazo próximo', 'Pacote de entregas no fim do dia', 'O shell resume apenas o que pede decisão rápida.'),
      makeFeedItem('Engajamento', 'Boa adesão das turmas centrais', 'As atividades recentes tiveram resposta acima da média.'),
    ],
    actions: [
      makeAction('Ver prazos críticos', 'Prioriza entregas com atraso ou risco imediato.'),
      makeAction('Abrir atividade recente', 'Retomada direta da última atividade acompanhada.'),
    ],
  },
  {
    id: 'calendar',
    appId: 'schoolcalendar',
    title: 'Calendário',
    eyebrow: 'Agenda Institucional',
    description: 'Calendário escolar com visão premium e organizado por blocos relevantes.',
    heroTitle: 'Eventos, marcos letivos e cadência diária num calendário mobile convincente.',
    heroCopy: 'Preparado para evoluir para agenda real mantendo estrutura visual sofisticada desde já.',
    accent: 'sky',
    icon: CalendarDays,
    metrics: [
      makeMetric('Eventos hoje', '06', '3 operacionais, 3 pedagógicos', 'info'),
      makeMetric('Semana letiva', '92%', 'sem conflitos graves', 'success'),
      makeMetric('Revisões', '02', 'eventos em ajuste', 'warning'),
    ],
    feed: [
      makeFeedItem('Hoje', 'Agenda com boa distribuição', 'As janelas críticas aparecem com destaque sereno e objetivo.'),
      makeFeedItem('Próximo marco', 'Fechamento de relatórios', 'O shell já sugere continuidade para o módulo de relatórios.'),
    ],
    actions: [
      makeAction('Filtrar compromissos do dia', 'Foco em leitura rápida para quem está em movimento.'),
      makeAction('Ir para quick settings', 'Atalho para ajustar foco, rede e modo de leitura.'),
    ],
  },
  {
    id: 'communications',
    appId: 'messages',
    title: 'Comunicados',
    eyebrow: 'Comunicados Oficiais',
    description: 'Camada institucional de avisos, recados e anúncios com leitura móvel refinada.',
    heroTitle: 'Comunicados com tratamento editorial e alta legibilidade.',
    heroCopy: 'Agrupamento por urgência e tom institucional, sem ruído visual e com ótima hierarquia.',
    accent: 'institutional',
    icon: BellRing,
    metrics: [
      makeMetric('Em destaque', '03', 'dois exigem leitura imediata', 'warning'),
      makeMetric('Alcance estimado', '91%', 'cobertura alta no mobile', 'success'),
      makeMetric('Ritmo semanal', '12', 'comunicados publicados', 'info'),
    ],
    feed: [
      makeFeedItem('Urgente', 'Mudança de agenda informada', 'O shell destaca o que altera a rotina escolar.'),
      makeFeedItem('Institucional', 'Nova rodada de informes agendada', 'Publicações ficam agrupadas por impacto e urgência.'),
    ],
    actions: [
      makeAction('Abrir feed institucional', 'Modo leitura com densidade controlada.'),
      makeAction('Silenciar temporariamente', 'Simulação de foco para jornadas mais limpas.'),
    ],
  },
  {
    id: 'messages',
    appId: 'messages',
    title: 'Mensagens',
    eyebrow: 'Conversa e Follow-up',
    description: 'Centro de mensagens com prioridade, retomada e contexto operacional.',
    heroTitle: 'Mensagens pensadas para continuidade rápida, não só para leitura.',
    heroCopy: 'A experiência separa conversas urgentes, acompanhamento e histórico recente em um fluxo coerente.',
    accent: 'violet',
    icon: MessageSquareDot,
    metrics: [
      makeMetric('Conversas ativas', '17', '5 com ação pendente', 'warning'),
      makeMetric('Tempo de resposta', '12m', 'média simulada do turno', 'success'),
      makeMetric('Pendentes', '04', 'aguardando retorno', 'info'),
    ],
    feed: [
      makeFeedItem('Agora', 'Fila de mensagens estabilizada', 'A maioria dos retornos segue dentro do SLA desejado.'),
      makeFeedItem('Ação', 'Quatro conversas pedem continuidade', 'O shell agrupa e sugere retomada visual.'),
    ],
    actions: [
      makeAction('Retomar conversa recente', 'Volta para o ponto exato da pilha multitarefa.'),
      makeAction('Filtrar urgência', 'Modo rápido entre pendentes, acompanhando e resolvidas.'),
    ],
  },
  {
    id: 'library',
    appId: 'library',
    title: 'Biblioteca',
    eyebrow: 'Acervo e Empréstimos',
    description: 'Catálogo, circulação e atenção operacional do acervo escolar.',
    heroTitle: 'Biblioteca mobile com leitura agradável e pronta para operação em balcão.',
    heroCopy: 'Mostra acervo em evidência, empréstimos correntes e alertas de devolução num fluxo leve.',
    accent: 'amber',
    icon: LibraryBig,
    metrics: [
      makeMetric('Em circulação', '64', 'boa cadência semanal', 'info'),
      makeMetric('Atrasos', '07', 'alertas agrupados', 'warning'),
      makeMetric('Disponibilidade', '88%', 'acervo principal livre', 'success'),
    ],
    feed: [
      makeFeedItem('Acervo', 'Busca rápida preparada', 'Experiência orientada para consulta e continuidade de empréstimo.'),
      makeFeedItem('Atenção', 'Sete devoluções em atraso', 'O módulo destaca só o que afeta a rotina.'),
    ],
    actions: [
      makeAction('Consultar empréstimos', 'Lista filtrada por urgência e situação atual.'),
      makeAction('Ver acervo em destaque', 'Resumo editorial com boa legibilidade.'),
    ],
  },
  {
    id: 'reports',
    appId: 'reports',
    title: 'Relatórios',
    eyebrow: 'Leitura Gerencial',
    description: 'Relatórios condensados com prioridade de decisão e ritmo executivo.',
    heroTitle: 'Análises essenciais com acabamento premium e foco em decisão.',
    heroCopy: 'Concentra KPI, contexto e próximas ações sem tentar reproduzir tabelas desktop inteiras.',
    accent: 'institutional',
    icon: FileSpreadsheet,
    metrics: [
      makeMetric('Pacotes prontos', '09', 'últimas 24h', 'success'),
      makeMetric('Aguardando revisão', '03', 'pendências concentradas', 'warning'),
      makeMetric('Distribuição', '76%', 'consumo mobile alto', 'info'),
    ],
    feed: [
      makeFeedItem('Executivo', 'Relatórios do dia foram consolidados', 'A visão mobile prioriza síntese antes de detalhamento.'),
      makeFeedItem('Próxima ação', 'Fechamento mensal se aproxima', 'Há oportunidade de automatizar continuidade no futuro.'),
    ],
    actions: [
      makeAction('Abrir resumo mensal', 'Foco em indicadores e riscos imediatos.'),
      makeAction('Compartilhar snapshot', 'Simulação de exportação rápida para a equipe.'),
    ],
  },
  {
    id: 'settings',
    appId: 'settings',
    title: 'Configurações',
    eyebrow: 'Preferências do Shell',
    description: 'Tema, cor principal, modos rápidos e ajustes do ambiente móvel.',
    heroTitle: 'Configurações pensadas para refinamento visual e continuidade futura.',
    heroCopy: 'O shell controla tema, acento, feedbacks e preferências rápidas sem depender do backend.',
    accent: 'sky',
    icon: Settings2,
    metrics: [
      makeMetric('Tema atual', 'Dinâmico', 'sincronizado com a preferência do shell', 'info'),
      makeMetric('Accent ativo', 'Institucional', 'pode ser alterado no quick settings', 'success'),
      makeMetric('Ajustes rápidos', '06', 'toggles disponíveis', 'info'),
    ],
    feed: [
      makeFeedItem('Visual', 'Tema e acento centralizados', 'Todo o acabamento do shell responde às preferências do usuário.'),
      makeFeedItem('Produtividade', 'Modo foco e dados leves prontos', 'Interações rápidas sem interromper o fluxo.'),
    ],
    actions: [
      makeAction('Trocar acento visual', 'Alterna a cor principal em tempo real.'),
      makeAction('Ajustar modo de leitura', 'Clareza, contraste e serenidade visual.'),
    ],
  },
  {
    id: 'teacher-portal',
    appId: 'teacherportal',
    title: 'Portal do Professor',
    eyebrow: 'Jornada Docente',
    description: 'Portal mobile com contexto de aula, agenda e ações prioritárias do professor.',
    heroTitle: 'O portal docente ganha uma camada mobile realmente utilizável.',
    heroCopy: 'Foco em continuidade, ação rápida e contexto de turma sem peso visual excessivo.',
    accent: 'amber',
    icon: BriefcaseBusiness,
    metrics: [
      makeMetric('Turmas hoje', '06', 'janela compacta por turno', 'info'),
      makeMetric('Diários em dia', '83%', 'boa cadência de registro', 'success'),
      makeMetric('Pontos urgentes', '02', 'pendências didáticas', 'warning'),
    ],
    feed: [
      makeFeedItem('Hoje', 'Portal pronto para a rotina de sala', 'O professor encontra rapidamente agenda, turmas e continuidade.'),
      makeFeedItem('Sugestão', 'Retomar atividade recente', 'Atalho direto para multitarefa e última ação.'),
    ],
    actions: [
      makeAction('Abrir agenda docente', 'Vai para calendário e compromissos do turno.'),
      makeAction('Retomar diário', 'Continuidade rápida a partir da pilha.'),
    ],
  },
  {
    id: 'student-portal',
    appId: 'studenthomework',
    title: 'Portal do Aluno',
    eyebrow: 'Experiência Discente',
    description: 'Visão compacta das prioridades do aluno com foco em rotina e clareza.',
    heroTitle: 'Portal do aluno adaptado para leitura rápida, leve e objetiva.',
    heroCopy: 'Mostra tarefas, ritmo acadêmico e continuidade sem depender do layout desktop.',
    accent: 'emerald',
    icon: GraduationCap,
    metrics: [
      makeMetric('Tarefas no radar', '05', '2 com alta prioridade', 'warning'),
      makeMetric('Ritmo semanal', '76%', 'engajamento saudável', 'success'),
      makeMetric('Metas em curso', '03', 'acompanhamento ativo', 'info'),
    ],
    feed: [
      makeFeedItem('Aluno', 'Painel preparado para foco diário', 'A leitura prioriza o que precisa ser feito agora.'),
      makeFeedItem('Seguimento', 'Boa consistência nas entregas', 'A experiência favorece continuidade e clareza.'),
    ],
    actions: [
      makeAction('Abrir tarefas do aluno', 'Continua a jornada pelo módulo estudantil disponível hoje.'),
      makeAction('Cruzar com metas', 'Mostra objetivos e progresso em paralelo.'),
    ],
  },
  {
    id: 'guardian-portal',
    appId: 'guardianportal',
    title: 'Portal do Responsável',
    eyebrow: 'Acompanhamento Familiar',
    description: 'Portal familiar em leitura serena, confiável e pronta para comunicação futura.',
    heroTitle: 'Responsáveis acessam um resumo elegante da vida escolar.',
    heroCopy: 'Notas, frequência, comunicados e pendências aparecem com hierarquia clara e linguagem institucional.',
    accent: 'sky',
    icon: UsersRound,
    metrics: [
      makeMetric('Alertas ativos', '03', 'dois exigem leitura hoje', 'warning'),
      makeMetric('Engajamento', '84%', 'retorno positivo do canal', 'success'),
      makeMetric('Documentos lidos', '91%', 'boa cobertura mobile', 'info'),
    ],
    feed: [
      makeFeedItem('Família', 'Resumo escolar atualizado', 'O shell organiza o contexto do aluno sem sobrecarregar a tela.'),
      makeFeedItem('Atenção', 'Pendência documental leve', 'A ação fica sempre próxima e visualmente clara.'),
    ],
    actions: [
      makeAction('Abrir visão familiar', 'Continua no módulo do responsável quando houver integração real.'),
      makeAction('Ler comunicados recentes', 'Atalho para as mensagens relevantes da escola.'),
    ],
  },
  {
    id: 'goals',
    appId: 'goals',
    title: 'Metas',
    eyebrow: 'Evolução e Acompanhamento',
    description: 'Metas com leitura motivadora e acompanhamento institucional maduro.',
    heroTitle: 'Objetivos e progresso com acabamento limpo, humano e bem orientado.',
    heroCopy: 'A interface destaca evolução, próximos passos e confiança, sem cair em visual genérico.',
    accent: 'violet',
    icon: Flag,
    metrics: [
      makeMetric('Metas ativas', '12', '7 em ritmo ideal', 'success'),
      makeMetric('Atenção', '03', 'pedem replanejamento', 'warning'),
      makeMetric('Concluídas', '21', 'acumulado do período', 'info'),
    ],
    feed: [
      makeFeedItem('Progresso', 'Acompanhamento semanal consistente', 'O shell enfatiza clareza do avanço e do próximo passo.'),
      makeFeedItem('Sugestão', 'Revisar metas críticas', 'Itens com risco aparecem em destaque controlado.'),
    ],
    actions: [
      makeAction('Abrir trilha de progresso', 'Resumo com marcos, status e contexto.'),
      makeAction('Priorizar objetivos', 'Reordena a leitura por criticidade e prazo.'),
    ],
  },
];

export const MOBILE_SHELL_ACCENTS = [
  {
    id: 'institutional',
    label: 'Institucional',
    hue: '217 91% 60%',
    hueSoft: '213 94% 68%',
    glow: '0 24px 80px hsl(217 91% 60% / 0.24)',
  },
  {
    id: 'emerald',
    label: 'Esmeralda',
    hue: '160 84% 39%',
    hueSoft: '152 76% 52%',
    glow: '0 24px 80px hsl(160 84% 39% / 0.24)',
  },
  {
    id: 'amber',
    label: 'Âmbar',
    hue: '38 92% 50%',
    hueSoft: '42 96% 62%',
    glow: '0 24px 80px hsl(38 92% 50% / 0.22)',
  },
  {
    id: 'violet',
    label: 'Violeta',
    hue: '262 83% 58%',
    hueSoft: '262 91% 67%',
    glow: '0 24px 80px hsl(262 83% 58% / 0.24)',
  },
  {
    id: 'sky',
    label: 'Ciano',
    hue: '199 89% 48%',
    hueSoft: '192 88% 61%',
    glow: '0 24px 80px hsl(199 89% 48% / 0.24)',
  },
];

export const MOBILE_SHELL_QUICK_SETTINGS = [
  {
    id: 'sync',
    title: 'Sincronização',
    description: 'Mantém o shell pronto para integração futura.',
  },
  {
    id: 'alerts',
    title: 'Alertas',
    description: 'Notificações simuladas e agrupadas por contexto.',
  },
  {
    id: 'focus',
    title: 'Modo foco',
    description: 'Reduz ruído visual e concentra o trabalho atual.',
  },
  {
    id: 'lowData',
    title: 'Dados leves',
    description: 'Simula uma versão otimizada para rede instável.',
  },
  {
    id: 'wifi',
    title: 'Wi‑Fi',
    description: 'Indicador visual de conectividade do aparelho.',
  },
  {
    id: 'reducedMotion',
    title: 'Motion reduzida',
    description: 'Transições mais discretas no shell.',
  },
];

export const MOBILE_SHELL_WIDGETS = [
  {
    id: 'pulse',
    title: 'Pulso operacional',
    eyebrow: 'Hoje',
    value: '82%',
    detail: 'cadência do ERP no turno atual',
    accent: 'institutional',
  },
  {
    id: 'communications',
    title: 'Comunicação ativa',
    eyebrow: 'Inbox',
    value: '17',
    detail: 'mensagens e comunicados em curso',
    accent: 'violet',
  },
  {
    id: 'agenda',
    title: 'Agenda letiva',
    eyebrow: 'Próximo marco',
    value: '14:30',
    detail: 'revisão de relatórios e calendário',
    accent: 'amber',
  },
];

export const MOBILE_SHELL_DEFAULT_VIEW_STATES = {
  reports: 'loading',
  communications: 'error',
  library: 'empty',
};

const NOTIFICATION_SEED = [
  {
    id: 'notif-1',
    moduleId: 'registration',
    title: 'Lote de matrícula precisa revisão',
    body: 'Cinco fichas ficaram separadas para conferência documental ainda hoje.',
    tone: 'warning',
    group: 'Fluxos críticos',
    time: 'Há 5 min',
  },
  {
    id: 'notif-2',
    moduleId: 'messages',
    title: 'Novo comunicado institucional publicado',
    body: 'O aviso de agenda escolar já está pronto para distribuição.',
    tone: 'info',
    group: 'Comunicação',
    time: 'Há 14 min',
  },
  {
    id: 'notif-3',
    moduleId: 'schoolcalendar',
    title: 'Calendário recebeu ajuste de evento',
    body: 'O fechamento do período foi antecipado e pede conferência rápida.',
    tone: 'info',
    group: 'Agenda',
    time: 'Há 24 min',
  },
  {
    id: 'notif-4',
    moduleId: 'guardian-portal',
    title: 'Portal do responsável com alta procura',
    body: 'Pico de leitura nos resumos do aluno foi detectado nesta manhã.',
    tone: 'success',
    group: 'Engajamento',
    time: 'Há 51 min',
  },
];

export const MOBILE_SHELL_DEMO_VIEWER = {
  name: 'Coordenação Mobile',
  role: 'Gestão Escolar',
  campus: 'Unidade Centro',
  avatarFallback: 'CM',
};

export function buildCanonicalMobileModules(apps = []) {
  return apps.map((app) => ({
    id: app.id,
    appId: app.id,
    page: app.page,
    title: app.title,
    eyebrow: 'Módulo ERP',
    description: `Entrada mobile preparada para o módulo ${app.title}.`,
    heroTitle: `${app.title} pronto para integração futura no shell mobile.`,
    heroCopy: 'Esta camada usa o manifesto canônico do projeto e pode alternar depois para renderização real dos módulos.',
    accent: 'institutional',
    icon: app.icon,
    iconColor: app.iconColor,
    bgColor: app.bgColor,
    metrics: [
      makeMetric('Estado', 'Mock', 'sem dependência de backend', 'info'),
      makeMetric('Preparação', 'Alta', 'lazy loading preservado', 'success'),
      makeMetric('Integração', 'Futura', 'app registry compatível', 'warning'),
    ],
    feed: [
      makeFeedItem('Compatibilidade', 'Manifesto preservado', 'O shell mantém o app registry e o app manifest como fonte canônica.'),
      makeFeedItem('Próximo passo', 'Adapter pronto', 'A tela pode trocar do mock para o módulo real quando o backend estiver maduro.'),
    ],
    actions: [
      makeAction('Continuar no shell', 'Explora a navegação, multitarefa e widgets mobile.'),
      makeAction('Preparar integração real', 'Ponto claro para substituir o mock pelo módulo final.'),
    ],
  }));
}

export function buildMobileShellModuleCatalog(apps = []) {
  const appsById = Object.fromEntries(apps.map((app) => [app.id, app]));

  return MOBILE_MODULE_BLUEPRINTS.map((blueprint) => {
    const targetApp = appsById[blueprint.appId];

    return {
      id: blueprint.id,
      appId: blueprint.appId,
      page: targetApp?.page || blueprint.appId,
      title: blueprint.title,
      eyebrow: blueprint.eyebrow,
      description: blueprint.description,
      heroTitle: blueprint.heroTitle,
      heroCopy: blueprint.heroCopy,
      accent: blueprint.accent,
      icon: targetApp?.icon || blueprint.icon || Rocket,
      iconColor: targetApp?.iconColor || '#e2e8f0',
      bgColor: targetApp?.bgColor || 'rgba(15, 23, 42, 0.65)',
      metrics: blueprint.metrics,
      feed: blueprint.feed,
      actions: blueprint.actions,
      integrationStatus: targetApp ? 'manifest-connected' : 'mock-only',
    };
  });
}

export function createMockNotifications(modules = []) {
  const moduleMap = Object.fromEntries(modules.map((module) => [module.id, module]));

  return NOTIFICATION_SEED.map((notification, index) => {
    const linkedModule = moduleMap[notification.moduleId] || null;

    return {
      ...notification,
      read: index > 1,
      dismissed: false,
      appId: linkedModule?.appId || null,
      moduleTitle: linkedModule?.title || 'Shell Mobile',
    };
  });
}

export function getAccentToken(accentId) {
  return MOBILE_SHELL_ACCENTS.find((accent) => accent.id === accentId) || MOBILE_SHELL_ACCENTS[0];
}
