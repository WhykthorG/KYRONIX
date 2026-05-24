# Prioridades Futuras de Implementacao

Documento de priorizacao das lacunas identificadas na comparacao entre o texto do NSA e o sistema atual do projeto.

## Prioridade 1 - Mais critica


### 2. Menções escolares no padrao MB/B/R/I
- Status atual: ausente.
- Impacto: alto.
- Motivo: o texto descreve o modelo pedagógico do Centro Paula Souza com menções, nao notas numericas.
- O que implementar: adaptar o modulo de notas para trabalhar com menções, conversao, calculo de situacao e boletim no padrao institucional.

### 3. PTD com aprovacao e bloqueio pos-deferimento
- Status atual: ausente.
- Impacto: alto.
- Motivo: o texto trata o PTD como documento formal, com analise do coordenador e imutabilidade apos aprovado.
- O que implementar: criar fluxo de envio, analise, aprovacao, historico de alteracoes e bloqueio de edicao apos deferimento.

### 4. Rematricula com regra institucional
- Status atual: ausente/parcial.
- Impacto: alto.
- Motivo: o texto descreve rematricula automatizada, com liberacao por perfil e restricoes para menores.
- O que implementar: criar fluxo de rematricula semestral/anual com janela de acesso, validacoes e aprovacao por responsavel quando necessario.

### 5. Historico escolar, diploma e documentos oficiais
- Status atual: ausente.
- Impacto: alto.
- Motivo: o texto coloca a secretaria como responsavel por escritura e emissao documental formal.
- O que implementar: geracao de historico, declaracao, certificado e fluxo de expedição com status e prazos.

## Prioridade 2 - Importante

### 6. Controle de chamada com trava de horario e justificativa
- Status atual: parcial.
- Impacto: medio-alto.
- Motivo: existe chamada diaria, mas nao a regra de horario institucional com justificativa obrigatoria fora do prazo.
- O que implementar: validar chamada por horario da grade e exigir justificativa em edicoes tardias.

### 7. Portal do responsavel mais completo
- Status atual: parcial.
- Impacto: medio-alto.
- Motivo: o portal ja existe, mas ainda e mais simples do que o descrito no NSA.
- O que implementar: avisos da direcao, pesquisas institucionais, alertas mais ricos, indicadores de risco e mais recursos de acompanhamento.

### 8. Diario de classe com PTD e vinculo pedagógico formal
- Status atual: parcial.
- Impacto: medio-alto.
- Motivo: existe diario, plano de aula e anexos, mas faltam os fluxos institucionais e a amarra com o PTD.
- O que implementar: associar aulas ao PTD, registrar vinculo entre planejamento e execucao e melhorar auditoria do fluxo docente.

### 9. Secretaria academica com lista piloto
- Status atual: ausente.
- Impacto: medio-alto.
- Motivo: o texto destaca a lista piloto como base para enturmação oficial.
- O que implementar: modulo administrativo para consolidar turmas, remanejamentos, vagas e lista oficial de alunos por classe.

### 10. Integracoes externas oficiais
- Status atual: ausente.
- Impacto: medio-alto.
- Motivo: o texto cita Teams, Outlook, CPS Carreiras e SED SC/Visto Confere.
- O que implementar: conectar o sistema a APIs externas ou criar adaptadores de integracao, com filas, logs e monitoramento.

## Prioridade 3 - Evolutivo

### 11. Pesquisa institucional e comunicacao ampliada para responsaveis
- Status atual: parcial.
- Impacto: medio.
- Motivo: o sistema ja tem mensagens, mas nao toda a camada de feedback institucional.
- O que implementar: pesquisas de satisfacao, comunicados segmentados e painel de alertas para familia.

### 12. Emissao de relatorios academicos mais institucionais
- Status atual: parcial.
- Impacto: medio.
- Motivo: existem PDFs e boletins, mas nao um pacote documental completo.
- O que implementar: relatórios de frequencia, desempenho, ocorrencias, acompanhamento e fechamento de periodo.

### 13. Melhor alinhamento com o ecossistema da secretaria
- Status atual: ausente/parcial.
- Impacto: medio.
- Motivo: a descricao do NSA inclui a secretaria como nucleo de governanca operacional.
- O que implementar: dashboards operacionais, rotina de conferência, auditoria de dados e validacoes administrativas.

### 14. Modo mobile mais focado em consulta rapida
- Status atual: parcial.
- Impacto: medio.
- Motivo: o projeto ja tem mobile shell, mas pode ficar mais alinhado ao uso rapido descrito no texto.
- O que implementar: simplificar o mobile para consultas, notificacoes e ações essenciais.

## Prioridade 4 - Complementar

### 15. Perfil de gestor com regras mais finas
- Status atual: parcial.
- Impacto: baixo-medio.
- Motivo: ja existe RBAC, mas pode ser refinado para refletir melhor a hierarquia escolar.
- O que implementar: separar melhor coordenador, secretario e administrador em regras de acesso e operação.

### 16. Fluxos de monitoria, estágio e projetos academicos
- Status atual: parcial/ausente.
- Impacto: baixo-medio.
- Motivo: o texto menciona funções extras que o projeto ainda nao cobre de forma completa.
- O que implementar: modulos opcionais para estagio, monitoria e projetos integradores.

### 17. Integração pedagógica com calendarios e planejadores
- Status atual: parcial.
- Impacto: baixo-medio.
- Motivo: ja existem calendario e planejador, mas eles podem conversar melhor com as rotinas do professor e da secretaria.
- O que implementar: vincular calendarios, planos, diário e relatórios em um fluxo único.

## Sugestao de ordem de execucao

2. Menções escolares.
3. PTD e aprovacao.
4. Rematricula com regra institucional.
5. Documentos oficiais.
6. Trava de chamada e justificativa.
7. Portal do responsavel completo.
8. Diario de classe formal.
9. Lista piloto e secretaria.
10. Integracoes externas.

## Observacao final

Essa ordem prioriza primeiro o que mais aproxima o sistema do NSA descrito no texto e o que tem maior valor funcional e institucional para o projeto.
