# Portal_Aluno

## Descrição
Portal do aluno no sistema [[KYRONIX S.E.N.O - Visão Geral]].

## Funcionalidades
- **Notas** — Consulta de notas e boletim
- **Frequência** — Histórico de presença
- **Grade** — Grade de horários
- **Atividades** — Tarefas e entregas
- **Documentos** — Documentos pessoais
- **Comunicados** — Mensagens da escola
- **Estágio** — Acompanhamento do estágio
- **TCC** — Acompanhamento do TCC
- **Metas** — Metas acadêmicas

## Arquivos

### Frontend
| Arquivo | Função |
|---------|--------|
| `frontend/src/pages/StudentInternship.jsx` | Meu Estágio |
| `frontend/src/pages/StudentTCC.jsx` | Meu TCC |
| `frontend/src/pages/StudentSchedule.jsx` | Minha Grade |
| `frontend/src/pages/StudentAttendance.jsx` | Minha Frequência |
| `frontend/src/pages/StudentHomework.jsx` | Minhas Tarefas |
| `frontend/src/pages/StudentGoals.jsx` | Minhas Metas |

## Permissões Necessárias
- `students.read.self`
- `grades.read`
- `attendance.read`
- `internships.read.self`
- `tcc.read.self`

## Relacionamentos
- Visualiza [[Notas]]
- Visualiza [[Frequencia]]
- Visualiza [[Horarios]]
- Visualiza [[Estagio_Supervisionado]]
- Visualiza [[TCC_Projeto_Integrador]]
- Visualiza [[Certificados]]
- Recebe [[Comunicados]]

## Ver Também
- [[Alunos]] — Dados do aluno
- [[Portal_Responsavel]] — Portal do responsável

