# Matriz de Risco de SQL Injection

## Visão Geral

SQL injection acontece quando dado não confiável é incorporado em uma query dinâmica e o banco passa a interpretar esse dado como código.

## Matriz

| Tipo | Probabilidade | Impacto | Como detectar no código | Como corrigir | Prioridade |
|---|---|---:|---|---|---:|
| In-band SQL Injection | Média/Alta | Alta | Concatenação de strings em queries que retornam dados na própria resposta | Prepared statements, queries parametrizadas, menor privilégio | Alta |
| Error-Based SQLi | Média | Alta | Erros do banco ou stack trace voltando para o usuário | Mensagens genéricas, logs internos controlados, parametrização | Alta |
| Union-Based SQLi | Média | Alta | UNION em pontos que refletem o resultado da query | Parametrização, evitar SQL dinâmico, limitar exposição de resposta | Alta |
| Blind SQL Injection | Média | Alta | Query montada por concatenação, mas sem vazamento direto no payload de resposta | Parametrização, respostas homogêneas, menor privilégio | Alta |
| Boolean-Based SQLi | Média | Alta | Diferença visível entre true e false na resposta | Parametrização, uniformizar respostas, validar lógica de filtros | Alta |
| Time-Based SQLi | Média | Alta | Consultas com atraso observável por tempo de resposta | Parametrização, restringir funções perigosas, monitorar latência | Alta |
| OOB SQL Injection | Baixa/Média | Muito alta | Código que permite saída de rede do banco ou consultas com callbacks externos | Bloquear saída do banco, parametrizar, monitorar DNS/HTTP anômalos | Média/Alta |
| Second-Order SQL Injection | Média | Muito alta | Dado salvo hoje e reutilizado depois em outra query sem reparametrização | Parametrizar em todos os pontos de uso, inclusive leitura posterior | Alta |
| Stored Procedure Injection | Média | Alta | Procedures que montam SQL com concatenação ou EXEC dinâmico | Parametrizar dentro da procedure, evitar SQL dinâmico inseguro | Alta |
| ORM Injection | Alta | Alta | Raw SQL, where/orderBy dinâmicos, fragments interpolados | APIs seguras do ORM, allowlist para colunas e operadores | Alta |

## Leitura Rápida

- In-band, Error-Based e Union-Based descrevem principalmente o canal de observação.
- Blind, Boolean-Based, Time-Based e OOB descrevem como o atacante infere ou extrai informação.
- Second-Order, Stored Procedure e ORM Injection descrevem contextos onde a falha aparece.

## O Que Mais Merece Atenção

1. ORM Injection
- Muito comum em aplicações modernas.
- O risco aparece em raw SQL, ORDER BY dinâmico, filtros montados por string e aliases vindos do usuário.

2. Second-Order SQL Injection
- O payload entra aparentemente limpo e só executa depois.
- É comum em perfis, logs, comentários, metadados e workflows assíncronos.

3. Blind, Boolean-Based e Time-Based
- São formas difíceis de notar em testes superficiais.
- Normalmente aparecem quando a resposta não mostra erro nem conteúdo útil.

4. Stored Procedure Injection
- Stored procedure não é proteção automática.
- Se a procedure monta SQL dinamicamente, a vulnerabilidade continua.

## Regra de Severidade

- Alta: quando existe qualquer concatenação de input em SQL.
- Muito alta: quando o dado pode ser reutilizado depois, ou quando o banco tem capacidade de saída de rede.
- Média: quando o risco depende de caminhos específicos, como procedures ou rede externa do banco.

## Fontes Primárias

- OWASP SQL Injection Prevention Cheat Sheet
  - https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html
- OWASP Injection Prevention Cheat Sheet
  - https://cheatsheetseries.owasp.org/cheatsheets/Injection_Prevention_Cheat_Sheet.html
- OWASP Web Security Testing Guide, SQL Injection
  - https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/07-Input_Validation_Testing/05-Testing_for_SQL_Injection
- OWASP SQL Injection
  - https://owasp.org/www-community/attacks/SQL_Injection
- PortSwigger SQL injection learning path
  - https://portswigger.net/web-security/learning-paths/sql-injection
- PortSwigger blind SQLi guidance
  - https://portswigger.net/support/using-burp-to-detect-blind-sql-injection-bugs
- PortSwigger second-order SQL injection
  - https://portswigger.net/kb/issues/00100210_sql-injection-second-order
