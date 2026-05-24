<!-- Bu proje tamamen Whykthor GSV taraf─▒ndan yap─▒lm─▒┼ƒt─▒r. -->
# Módulo de Horários Escolares

## Arquitetura ideal do módulo

O módulo foi implementado como um app próprio do desktop, integrado ao stack atual `React + TanStack Query + Supabase + serverless APIs`. A arquitetura ficou dividida em quatro camadas:

1. Produto/UI
- Página [SchedulePlanner.jsx](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/Nova%20pasta/src/pages/SchedulePlanner.jsx) concentra o fluxo administrativo e a visão do professor.
- O frontend trata cadastro estrutural, questionários, visualização da grade, pendências, sugestões e pesos de otimização.

2. Contratos e domínio
- [schedulePlanner.js](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/Nova%20pasta/src/lib/contracts/schedulePlanner.js) define estados, tipos de conflito, tipos de sugestão, payloads e pesos padrão.

3. Motor de geração
- [engine.js](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/Nova%20pasta/src/lib/scheduling/engine.js) executa validação, alocação inicial, detecção de conflitos, sugestões e score heurístico.
- A estrutura já está preparada para trocar a heurística por solver mais avançado sem reescrever a UI nem a modelagem principal.

4. Backend administrativo
- [questionnaires.js](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/Nova%20pasta/api/admin/schedule-planner/questionnaires.js) orquestra disparo de questionários.
- [generate.js](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/Nova%20pasta/api/admin/schedule-planner/generate.js) cria uma geração, processa o motor e persiste entradas, conflitos e sugestões.
- [schedulePlannerServer.js](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/Nova%20pasta/server/schedulePlannerServer.js) concentra carga de contexto e preparação dos formulários.

## Modelagem de dados proposta

Migração criada: [migration_schedule_planner_module.sql](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/Nova%20pasta/supabase/migration_schedule_planner_module.sql)

Tabelas principais:

- `school_schedule_settings`: cabeçalho do planejamento por ano/período.
- `school_shifts`: turnos com início, fim e quantidade de aulas.
- `school_environments`: laboratórios, quadra, vídeo e demais espaços.
- `curriculum_matrix`: vínculo turma-disciplina-professor com carga semanal e preferências.
- `teacher_availability_forms`: formulário individual por professor e planejamento.
- `teacher_availability_slots`: grade fina de disponibilidade por dia/turno/aula.
- `teacher_preferences`: preferências pedagógicas e limite diário.
- `schedule_generations`: versão de cada execução do motor.
- `schedule_entries`: aulas efetivamente alocadas na grade.
- `schedule_conflicts`: pendências e impossibilidades registradas.
- `schedule_suggestions`: rearranjos sugeridos pelo sistema.
- `optimization_settings`: pesos da função de qualidade.

## Fluxo de telas

Fluxos administrativos:

1. Dashboard do módulo
- status do processo
- quantidade de professores
- pendências e sugestões
- criação de novo planejamento

2. Estrutura
- turnos e horários
- ambientes
- matriz curricular

3. Questionários
- seleção de professores
- prazo e mensagem
- envio do questionário interno

4. Geração
- disparo do motor automático
- visualização da grade por turma

5. Pendências
- lista explicada de conflitos

6. Sugestões
- aplicação ou rejeição de rearranjos

7. Otimização
- pesos configuráveis de qualidade

Fluxos do professor:

1. Questionário individual
- disponibilidade por slot
- preferências pedagógicas
- observações

2. Minha grade
- leitura da grade mais recente vinculada ao docente

## Regras de negócio implementadas

Restrições obrigatórias:

- professor não pode ter choque de horário
- turma não pode ter duas aulas no mesmo slot
- ambiente especial não pode ser duplicado no mesmo slot
- carga semanal da disciplina deve ser perseguida integralmente
- indisponibilidade do professor não pode ser ignorada
- limite máximo diário do professor é respeitado quando configurado

Preferências e qualidade:

- geminação ou separação de aulas
- aceitação de janelas
- evitar ida do professor para apenas uma aula
- distribuir aulas ao longo da semana
- reduzir concentração excessiva em um único dia
- melhorar uso de ambientes especiais

## Motor atual

Fases implementadas:

1. Validação de dados mínimos
2. Alocação inicial heurística
3. Detecção de conflitos
4. Geração de sugestões de rearranjo
5. Cálculo de score de qualidade

Estado atual:

- suficiente para MVP profissional e evolução incremental
- preparado para futura troca por OR-Tools, CP-SAT ou ILP
- persistência versionada por geração para auditoria e comparação

## Melhorias futuras recomendadas

- solver matemático com backtracking/CP-SAT
- bloqueio e pinagem manual de aulas
- publicação formal de uma geração como grade oficial
- comparação entre gerações
- visão por professor, turma, ambiente e unidade
- explicabilidade de score por critério
- simulação de cenários “e se”
- importação em lote da matriz curricular
- exportação PDF/Excel
- suporte multiunidade com deslocamento real entre campi
