<!-- P├Âr├Âjek ╔øm╔ø cua lat k╔ø╔øliw ╔ø Whykthor GSV. -->
# Modulos, Rotas e Responsabilidades

## Shell e navegacao

- `Desktop`: shell principal com janelas, atalhos, taskbar e menu iniciar.
- `Login`: autenticacao por email/senha e OAuth.
- `SettingsPage`: configuracoes visuais e operacionais.

## Modulos funcionais

| Pagina | Finalidade | Perfis |
|---|---|---|
| `Dashboard` | indicadores e atalhos rapidos | coordenador, secretario, administrador |
| `Students` | cadastro e manutencao de alunos | coordenador, secretario, administrador, professor |
| `Teachers` | cadastro e manutencao de professores | coordenador, secretario, administrador |
| `Classes` | turmas, coordenacao e composicao | coordenador, secretario, administrador, professor |
| `Subjects` | disciplinas e carga horaria | coordenador, secretario, administrador |
| `Grades` | lancamento e consulta de notas | aluno, professor, coordenador, secretario, administrador |
| `Attendance` | registro e consulta de frequencia | aluno, professor, coordenador, secretario, administrador |
| `Assignments` | atividades, publicacao e entregas | aluno, professor, coordenador, administrador |
| `SchoolCalendar` | calendario escolar institucional | aluno, professor, coordenador, secretario, administrador |
| `TeacherCalendar` | agenda operacional do professor | professor, coordenador |
| `Messages` | comunicados institucionais | aluno, professor, coordenador, secretario, administrador |
| `LibraryPage` | acervo e emprestimos | aluno, professor, coordenador, secretario, administrador |
| `Reports` | visoes analiticas | coordenador, secretario, administrador |
| `Diary` | diario de classe e planejamento | professor, coordenador, administrador |
| `StudentGoals` | metas e tarefas pessoais | aluno |
| `TeacherPortal` | visao consolidada do professor | professor, coordenador, administrador |
| `AcademicRecord` | registro academico agregado | professor, coordenador, secretario, administrador |
| `TeacherHomework` | tarefas de casa publicadas pelo professor | professor, coordenador, administrador |
| `StudentHomework` | acompanhamento das tarefas do aluno | aluno |
| `Registration` | fluxo de matricula e cadastro | coordenador, secretario, administrador |
| `StudentEnrollment` | matricula com secoes segmentadas | coordenador, secretario, administrador |
| `UserManagement` | perfis, aprovacoes e credenciais | coordenador, secretario, administrador |

## Componentes de dominio relevantes

### Dashboard

- [src/components/dashboard/StatsCard.jsx](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/src/components/dashboard/StatsCard.jsx)
- [src/components/dashboard/QuickActions.jsx](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/src/components/dashboard/QuickActions.jsx)
- [src/components/dashboard/RecentActivity.jsx](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/src/components/dashboard/RecentActivity.jsx)
- [src/components/dashboard/UpcomingEvents.jsx](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/src/components/dashboard/UpcomingEvents.jsx)

### Matricula

- [src/components/enrollment/SectionPersonal.jsx](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/src/components/enrollment/SectionPersonal.jsx)
- [src/components/enrollment/SectionAddress.jsx](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/src/components/enrollment/SectionAddress.jsx)
- [src/components/enrollment/SectionAcademic.jsx](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/src/components/enrollment/SectionAcademic.jsx)
- [src/components/enrollment/SectionGuardian.jsx](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/src/components/enrollment/SectionGuardian.jsx)
- [src/components/enrollment/SectionAttachments.jsx](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/src/components/enrollment/SectionAttachments.jsx)

### Gestao de usuarios

- [src/components/usermanagement/ProfileCard.jsx](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/src/components/usermanagement/ProfileCard.jsx)
- [src/components/usermanagement/UserRoleDialog.jsx](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/src/components/usermanagement/UserRoleDialog.jsx)
- [src/components/usermanagement/PermissionPanel.jsx](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/src/components/usermanagement/PermissionPanel.jsx)

### Professor

- [src/components/teacher/TeacherAnalytics.jsx](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/src/components/teacher/TeacherAnalytics.jsx)
- [src/components/teacher/StudentPerformance.jsx](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/src/components/teacher/StudentPerformance.jsx)
- [src/components/teacher/EngagementMetrics.jsx](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/src/components/teacher/EngagementMetrics.jsx)
- [src/components/teacher/CommunicationCenter.jsx](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/src/components/teacher/CommunicationCenter.jsx)

### Chat e desktop

- [src/components/chat/ChatHub.jsx](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/src/components/chat/ChatHub.jsx)
- [src/components/chat/ChatWindow.jsx](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/src/components/chat/ChatWindow.jsx)
- [src/components/desktop/Window.jsx](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/src/components/desktop/Window.jsx)
- [src/components/desktop/Taskbar.jsx](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/src/components/desktop/Taskbar.jsx)

## Regras de acesso no frontend

As regras centrais estao em:

- [src/App.jsx](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/src/App.jsx)
- [src/pages/Desktop.jsx](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/src/pages/Desktop.jsx)

Essas regras controlam:

- paginas roteadas;
- apps exibidos na area de trabalho;
- atalhos e janelas persistidas;
- redirecionamento para `Desktop` quando o perfil nao pode acessar a pagina.

## Ponto de atencao

Controle visual nao substitui seguranca. O filtro por pagina/app melhora UX, mas a protecao real depende das policies de banco descritas em [banco-de-dados.md](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/docs/banco-de-dados.md).
