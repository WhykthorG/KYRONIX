# KYRONIX S.E.N.O — Visão Geral do Sistema

## Descrição
Sistema de gestão escolar completo desenvolvido com React, Node.js e Supabase.

## Arquitetura
- **Frontend:** React 18 + Vite + Tailwind CSS
- **Backend:** Node.js Serverless (Netlify/Vercel)
- **Banco:** Supabase (PostgreSQL com RLS)
- **Autenticação:** Supabase Auth (JWT)

## Módulos Principais

### Gestão Acadêmica
- [[Alunos]] — Cadastro e gestão de alunos
- [[Professores]] — Gestão de docentes
- [[Turmas]] — Organização de turmas
- [[Disciplinas]] — Gestão de disciplinas
- [[Notas]] — Lançamento e consulta de notas
- [[Frequencia]] — Controle de presença
- [[Diario]] — Diário de classe

### Organização
- [[Calendario_Escolar]] — Eventos e datas importantes
- [[Calendario_Provas]] — Agendamento de avaliações
- [[Horarios]] — Geração e gestão de horários

### Módulos Novos
- [[Estagio_Supervisionado]] — Gestão de estágios
- [[TCC_Projeto_Integrador]] — Projetos de TCC
- [[Laboratorios]] — Gestão de laboratórios
- [[Biblioteca]] — Gestão da biblioteca
- [[Cursos]] — Cursos e séries
- [[Certificados]] — Emissão de certificados

### Portais
- [[Portal_Aluno]] — Portal do aluno
- [[Portal_Professor]] — Portal do professor
- [[Portal_Responsavel]] — Portal do responsável

### Infraestrutura
- [[Seguranca]] — Sistema de segurança
- [[Idiomas]] — Sistema de internacionalização
- [[Configuracoes]] — Configurações do sistema
- [[Relatorios]] — Relatórios e indicadores

## Fluxo de Dados
```
Aluno → [[Matricula]] → [[Turma]] → [[Disciplina]] → [[Notas]] + [[Frequencia]]
                                    ↓
                              [[Diario]] → [[Relatorios]]
                                    ↓
                              [[Certificados]]
```

## Ver Mais
- [[Guia_de_Instalacao]] — Como instalar o sistema
- [[API_Reference]] — Referência da API
- [[Changelog]] — Histórico de versões
