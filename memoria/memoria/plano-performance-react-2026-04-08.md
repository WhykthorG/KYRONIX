<!-- ßâ×ßâáßâØßâößâÑßâóßâÿ ßâößâÑßâíßâÖßâÜßâúßâûßâÿßâúßâáßâÉßâô Whykthor GSV-ßâÿßâí ßâøßâÿßâößâá ßâ¿ßâößâÿßâÑßâøßâ£ßâÉ. -->
# Plano de Execucao - Performance React

Data: 2026-04-08

## Objetivo

Reduzir re-renders desnecessarios, trabalho pesado em render e custo de interacoes no shell desktop e nas telas com listas maiores.

## Ja executado

- [x] Remover o relogio do estado quente de `Desktop.jsx`
- [x] Mover atualizacao de hora para componentes locais com `src/hooks/useNow.js`
- [x] Estabilizar callbacks de `GlobalSearchBar.jsx`
- [x] Memoizar agregacoes do `Dashboard.jsx`
- [x] Trocar `find/filter` repetidos por mapas memoizados em `Assignments.jsx`
- [x] Memoizar derivados principais em `Attendance.jsx`
- [x] Virtualizar a lista de alunos em `Attendance.jsx`
- [x] Virtualizar tabelas grandes em `Grades.jsx`
- [x] Virtualizar notas e frequencia em `AcademicRecord.jsx`
- [x] Extrair a camada de janelas em `Desktop.jsx`
- [x] Isolar previews e notificacoes em subcomponentes memoizados de `Taskbar.jsx`
- [x] Adicionar instrumentacao de medicao em DEV com `src/components/common/RenderProfiler.jsx`
- [x] Criar tabela virtualizada reutilizavel em `src/components/common/VirtualizedTable.jsx`
- [x] Validar bundle com `npm run build`

## Fase 1 - Medicao

- [x] Preparar instrumentacao de profile em DEV
- [ ] Registrar baseline no React DevTools Profiler ou via `RenderProfiler`
- [ ] Medir abertura de janela no desktop
- [ ] Medir digitacao na busca global
- [ ] Medir scroll e interacao em `Attendance`
- [ ] Medir renderizacao de `Assignments`

## Fase 2 - Shell Desktop

- [x] Reduzir custo de persistencia do workspace em `src/pages/Desktop.jsx`
- [x] Aplicar throttle/debounce no `ResizeObserver` do desktop
- [x] Revisar criacao de arrays/objetos derivados por render no shell
- [x] Extrair subarvores grandes do desktop para componentes menores memoizados

## Fase 3 - Preview de Janelas

- [x] Reduzir custo de `MutationObserver` em `src/components/desktop/Window.jsx`
- [x] Reduzir custo de `ResizeObserver` em `src/components/desktop/Window.jsx`
- [x] Evitar snapshots frequentes com `html2canvas` quando nao houver mudanca relevante
- [x] Revisar cache e refresh de thumbnails em `src/components/desktop/Taskbar.jsx`

## Fase 4 - Listas Grandes

- [x] Implementar virtualizacao em `src/pages/Attendance.jsx`
- [x] Implementar virtualizacao em `src/pages/Grades.jsx`
- [x] Implementar virtualizacao em `src/pages/AcademicRecord.jsx`
- [ ] Revisar tabelas e grids com muitos itens no portal do professor e telas administrativas

## Fase 5 - Componentes de Dados

- [ ] Revisar `Assignments.jsx` para separar filtro, cards e modal em subcomponentes menores
- [x] Revisar `Attendance.jsx` para separar toolbar, calendario, resumo e lista
- [x] Revisar `Dashboard.jsx` para manter graficos e cards estaveis entre updates nao relacionados

## Fase 6 - Revalidacao

- [ ] Repetir o mesmo profile do baseline
- [ ] Comparar quantidade de renders por interacao
- [ ] Comparar tempo de commit e render nas telas principais
- [ ] Registrar o ganho medido antes de encerrar a etapa

## Como medir agora

1. Abra a aplicacao em modo desenvolvimento.
2. No console do navegador, execute:
   `localStorage.setItem('debug:render-profiler', '1')`
3. Recarregue a pagina.
4. Execute os fluxos:
   - abrir/fechar janelas no desktop
   - digitar na busca global
   - rolar e marcar itens em `Attendance`
   - navegar em `Assignments`
   - abrir turmas grandes em `Grades` e `AcademicRecord`
5. Leia os logs `[render-profiler] ...` no console ou inspecione `window.__PROJECT_WG_RENDER_PROFILER__`.
6. Para desligar:
   `localStorage.removeItem('debug:render-profiler')`

## Hotspots atuais prioritarios

1. `src/pages/Assignments.jsx`
2. `src/components/desktop/GlobalSearchBar.jsx`
3. `src/pages/TeacherPortal.jsx`
4. `src/pages/UserManagement.jsx`
5. `src/pages/Messages.jsx`
6. `src/pages/LibraryPage.jsx`

## Criterio de aceite

- Desktop nao deve rerenderizar inteiro por atualizacao de hora
- Busca global deve permanecer fluida durante digitacao
- Lista de chamada deve continuar responsiva com turmas grandes
- Hover em janelas nao deve gerar custo excessivo por thumbnail
- Nenhuma regressao visual ou funcional nos modulos ajustados
