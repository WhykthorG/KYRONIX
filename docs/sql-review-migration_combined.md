# Revisão Técnica de `supabase/migration_combined.sql`

Dialeto identificado: PostgreSQL com extensões e objetos específicos do Supabase.
Evidências: uso de `auth.jwt()`, `auth.uid()`, `storage.objects`, `storage.buckets`, RLS e funções `SECURITY DEFINER`.

Escopo da revisão: análise estrutural, sintática, de integridade, performance, segurança e idempotência do arquivo combinado.

## Sumário Executivo

O arquivo `supabase/migration_combined.sql` não é seguro para execução em um banco vazio como script único. Ele possui falhas críticas de ordenação, dependências ausentes, duplicação de DDL/RLS e inconsistência de identidade em colunas usadas pelas políticas.

Para corrigir isso, foi gerada uma versão consolidada estável em:

- [migration_combined_corrected.sql](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/supabase/migration_combined_corrected.sql)

Essa versão foi baseada em [schema.sql](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/supabase/schema.sql), que está significativamente mais consistente que o combinado original.

Status atual da versão corrigida:

- os problemas críticos de ordem de criação, dependências ausentes e FK fora de sequência foram eliminados
- o isolamento multi-tenant foi endurecido com `tenant_id NOT NULL`, default por `require_current_tenant_id()` e policies estritas por tenant
- comparações de identidade por e-mail foram normalizadas com `auth_user_email()` e índices case-insensitive
- relacionamentos legados em `UUID[]` ganharam tabelas canônicas de junção com sincronização bidirecional para compatibilidade
- `library_loans.borrower_id` passou a ser validado por trigger conforme o `borrower_type`, mitigando a ausência de FK polimórfica
- índices, triggers e policies principais foram ajustados para rerun mais seguro com `IF NOT EXISTS`, `DROP ... IF EXISTS` e limpeza prévia de policies legadas

---

## 1. CRÍTICO

### Problema
Uso de `uuid_generate_v4()` sem garantir a extensão `uuid-ossp`.

### Causa raiz
O script usa `uuid_generate_v4()` em praticamente todas as tabelas, mas no cabeçalho só habilita `pg_trgm`, não `uuid-ossp`.

### Impacto
Em uma instância limpa, a primeira `CREATE TABLE` com `uuid_generate_v4()` falha e interrompe toda a execução.

### Correção recomendada
Adicionar `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";` antes de qualquer DDL que use UUID default.

### Código corrigido
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
```

Referências:
- [migration_combined.sql](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/supabase/migration_combined.sql:10)
- [migration_combined_corrected.sql](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/supabase/migration_combined_corrected.sql:8)

---

### Problema
O script combinado altera e protege tabelas que ele ainda não criou, ou sequer cria localmente.

### Causa raiz
O arquivo foi montado por concatenação de migrations em ordem incompatível para execução única. Exemplos:

- `notifications` é alterada em [migration_combined.sql:1340](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/supabase/migration_combined.sql:1340), mas só é criada em [migration_combined.sql:2131](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/supabase/migration_combined.sql:2131).
- `observability_logs` é alterada em [migration_combined.sql:1888](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/supabase/migration_combined.sql:1888), mas só é criada em [migration_combined.sql:2180](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/supabase/migration_combined.sql:2180).
- `messages`, `direct_messages`, `homework` e `homework_completions` recebem `ALTER TABLE`, `ENABLE ROW LEVEL SECURITY` e `CREATE POLICY`, mas não têm `CREATE TABLE` nesse arquivo.

### Impacto
O script falha em banco vazio com erro `relation does not exist`, deixando o ambiente parcialmente aplicado.

### Correção recomendada
Reorganizar o arquivo por dependência real:

1. extensões e helpers
2. tabelas-base
3. FKs
4. índices
5. triggers
6. funções de autorização
7. policies

Na prática, a correção mais segura foi substituir o combinado por uma versão consolidada estável.

### Código corrigido
```sql
CREATE TABLE IF NOT EXISTS notifications (...);
CREATE TABLE IF NOT EXISTS observability_logs (...);
CREATE TABLE IF NOT EXISTS messages (...);
CREATE TABLE IF NOT EXISTS direct_messages (...);
CREATE TABLE IF NOT EXISTS homework (...);
CREATE TABLE IF NOT EXISTS homework_completions (...);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE observability_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE homework ENABLE ROW LEVEL SECURITY;
ALTER TABLE homework_completions ENABLE ROW LEVEL SECURITY;
```

Referências:
- [migration_combined.sql](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/supabase/migration_combined.sql:1340)
- [migration_combined.sql](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/supabase/migration_combined.sql:1888)
- [migration_combined.sql](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/supabase/migration_combined.sql:1922)
- [migration_combined.sql](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/supabase/migration_combined.sql:2131)
- [migration_combined_corrected.sql](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/supabase/migration_combined_corrected.sql:641)
- [migration_combined_corrected.sql](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/supabase/migration_combined_corrected.sql:988)
- [migration_combined_corrected.sql](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/supabase/migration_combined_corrected.sql:1150)
- [migration_combined_corrected.sql](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/supabase/migration_combined_corrected.sql:2164)

---

### Problema
FK de `grades.assignment_id` é criada antes da tabela `assignments`.

### Causa raiz
O bloco de `ALTER TABLE grades ADD CONSTRAINT fk_grades_assignment` aparece antes do `CREATE TABLE assignments`.

### Impacto
Em banco vazio a migration falha ao tentar referenciar uma tabela ainda inexistente.

### Correção recomendada
Mover a criação da FK para depois de `assignments`, preferencialmente com guarda por `pg_constraint` para permitir rerun controlado.

### Código corrigido
```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_grades_assignment'
  ) THEN
    ALTER TABLE grades
      ADD CONSTRAINT fk_grades_assignment
      FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE SET NULL;
  END IF;
END;
$$;
```

Referências:
- [migration_combined.sql](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/supabase/migration_combined.sql:686)
- [migration_combined.sql](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/supabase/migration_combined.sql:697)
- [migration_combined_corrected.sql](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/supabase/migration_combined_corrected.sql:629)

---

## 2. ALTO

### Problema
Deriva de políticas RLS com nomes diferentes para o mesmo propósito, sem limpeza completa das versões antigas.

### Causa raiz
O script mistura nomes com underscore e com espaço:

- `admin_manage_profiles` em [migration_combined.sql:181](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/supabase/migration_combined.sql:181)
- `admin manage profiles` em [migration_combined.sql:2544](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/supabase/migration_combined.sql:2544)
- `staff_read_app_settings` em [migration_combined.sql:190](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/supabase/migration_combined.sql:190)
- `staff read app settings` em [migration_combined.sql:2550](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/supabase/migration_combined.sql:2550)

### Impacto
No PostgreSQL, múltiplas policies do mesmo comando são combinadas com `OR`. Isso pode ampliar acesso de forma não intencional, dificultar auditoria e tornar o comportamento dependente da ordem histórica de execução.

### Correção recomendada
Padronizar nomes de policies e remover explicitamente todas as variantes legadas antes de recriar a policy final.

### Código corrigido
```sql
DROP POLICY IF EXISTS "admin_manage_profiles" ON user_profiles;
DROP POLICY IF EXISTS "admin manage profiles" ON user_profiles;

CREATE POLICY "admin_manage_profiles" ON user_profiles
  FOR ALL
  USING (auth_has_permission('users.manage.administrative'))
  WITH CHECK (auth_has_permission('users.manage.administrative'));
```

Referências:
- [migration_combined.sql](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/supabase/migration_combined.sql:181)
- [migration_combined.sql](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/supabase/migration_combined.sql:2544)

---

### Problema
Colunas de e-mail usadas para autenticação e RLS não têm unicidade case-insensitive consistente.

### Causa raiz

- `user_profiles.user_email` é `UNIQUE`, mas case-sensitive em [migration_combined.sql:75](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/supabase/migration_combined.sql:75).
- `auth_profile_type()` faz comparação literal em [migration_combined.sql:138](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/supabase/migration_combined.sql:138).
- `students.email` e `teachers.email` são usados em policies, mas são opcionais e não únicos em [migration_combined.sql:468](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/supabase/migration_combined.sql:468) e [migration_combined.sql:525](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/supabase/migration_combined.sql:525).

### Impacto
Dois registros podem compartilhar o mesmo e-mail variando caixa, ou o mesmo e-mail pode existir em múltiplos alunos/professores. Isso quebra ownership, leitura própria, vínculo com mensagens e portal do responsável.

### Correção recomendada
Criar índices únicos por `lower(email)` e padronizar as funções de auth para comparação case-insensitive.

### Código corrigido
```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_user_email_ci
  ON user_profiles (lower(user_email));

CREATE UNIQUE INDEX IF NOT EXISTS idx_students_email_ci
  ON students (lower(email))
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_teachers_email_ci
  ON teachers (lower(email))
  WHERE email IS NOT NULL;
```

Referências:
- [migration_combined_corrected.sql](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/supabase/migration_combined_corrected.sql:81)
- [migration_combined_corrected.sql](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/supabase/migration_combined_corrected.sql:140)
- [migration_combined_corrected.sql](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/supabase/migration_combined_corrected.sql:200)

---

### Problema
Idempotência inconsistente: parte do script usa `IF NOT EXISTS` e `DROP IF EXISTS`, parte não.

### Causa raiz
Há `CREATE INDEX` e `CREATE TRIGGER` puros em um arquivo que claramente tenta ser reexecutável. Exemplos:

- [migration_combined.sql:785](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/supabase/migration_combined.sql:785)
- [migration_combined.sql:809](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/supabase/migration_combined.sql:809)
- [migration_combined.sql:842](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/supabase/migration_combined.sql:842)
- [migration_combined.sql:905](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/supabase/migration_combined.sql:905)

### Impacto
Reexecuções falham no meio do arquivo e deixam o banco em estado parcialmente mutado.

### Correção recomendada
Padronizar o arquivo como:

- script bootstrap para banco vazio, executado uma única vez
ou
- migration incremental idempotente, com guards em todos os objetos

### Código corrigido
```sql
DROP TRIGGER IF EXISTS trg_events_updated_at ON events;
CREATE TRIGGER trg_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_events_start ON events(start_date);
```

---

## 3. MÉDIO

### Problema
Relacionamentos críticos modelados com arrays UUID (`teacher_ids`, `subject_ids`) em vez de tabelas de junção.

### Causa raiz
`classes` e `teachers` usam colunas `UUID[]` em [migration_combined.sql:533](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/supabase/migration_combined.sql:533), [migration_combined.sql:590](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/supabase/migration_combined.sql:590) e [migration_combined.sql:591](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/supabase/migration_combined.sql:591).

### Impacto
Não há FK por elemento do array, joins ficam ruins, filtros custam mais, e a integridade relacional depende da aplicação.

### Correção recomendada
Manter arrays apenas como compatibilidade legada e introduzir tabelas canônicas de relação.

### Código corrigido
```sql
CREATE TABLE IF NOT EXISTS teacher_subject_links (
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (teacher_id, subject_id)
);

CREATE TABLE IF NOT EXISTS class_teacher_links (
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (class_id, teacher_id)
);

CREATE TABLE IF NOT EXISTS class_subject_links (
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (class_id, subject_id)
);
```

Referências:
- [migration_combined_corrected.sql](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/supabase/migration_combined_corrected.sql:265)

---

### Problema
Regras de negócio importantes não eram protegidas por `CHECK`.

### Causa raiz
Campos quantitativos sensíveis ficaram sem faixa válida no combinado original: bolsa, lotação, notas, penalidade, cópias, progresso, revisão.

### Impacto
O banco aceita estados impossíveis, como bolsa `-10`, cópias disponíveis maiores que o total, nota acima da pontuação máxima ou `current_students > max_students`.

### Correção recomendada
Adicionar constraints explícitas no DDL.

### Código corrigido
```sql
scholarship_percentage NUMERIC(5,2) DEFAULT 0
  CHECK (scholarship_percentage BETWEEN 0 AND 100),

max_students INTEGER DEFAULT 40 CHECK (max_students > 0),
current_students INTEGER DEFAULT 0 CHECK (current_students >= 0),
CONSTRAINT classes_current_students_within_capacity_check
  CHECK (current_students <= max_students),

max_score NUMERIC(5,2) DEFAULT 10 CHECK (max_score > 0),
weight NUMERIC(4,2) DEFAULT 1 CHECK (weight > 0),
CONSTRAINT grades_score_range_check
  CHECK (score IS NULL OR (score >= 0 AND score <= max_score))
```

Referências:
- [migration_combined_corrected.sql](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/supabase/migration_combined_corrected.sql:124)
- [migration_combined_corrected.sql](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/supabase/migration_combined_corrected.sql:242)
- [migration_combined_corrected.sql](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/supabase/migration_combined_corrected.sql:574)

---

### Problema
Política multi-tenant permissiva demais via `tenant_id IS NULL OR tenant_id = current_tenant_id()`.

### Causa raiz
As policies tratam `NULL` como visível a qualquer tenant em várias tabelas enterprise.

### Impacto
Se uma linha tenant-scoped for inserida com `tenant_id = NULL`, ela pode ficar globalmente visível para múltiplos tenants.

### Correção recomendada
Separar explicitamente dados globais de dados tenant-scoped. Para tabelas tenant-scoped, usar `tenant_id NOT NULL` e policy estrita.

### Código corrigido
```sql
ALTER TABLE notifications
  ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE notifications
  ALTER COLUMN tenant_id SET DEFAULT require_current_tenant_id();

CREATE POLICY "users read own notifications" ON notifications
  FOR SELECT USING (
    lower(recipient_email) = auth_user_email()
    AND tenant_id = current_tenant_id()
  );
```

Referências:
- [migration_combined.sql](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/supabase/migration_combined.sql:1486)
- [migration_combined.sql](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/supabase/migration_combined.sql:1906)

---

### Problema
`library_loans.borrower_id` é polimórfico, sem FK real.

### Causa raiz
O modelo tenta representar múltiplos tipos de tomador (`aluno`, `professor`, `funcionario`) numa única coluna UUID sem tabela-pai.

### Impacto
Não há integridade referencial. É possível registrar empréstimo para um UUID inexistente.

### Correção recomendada
Modelar uma entidade canônica de pessoa/borrower continua sendo a solução ideal. Como correção pragmática e compatível com o schema atual, a versão corrigida adiciona validação transacional por trigger conforme `borrower_type`.

### Código corrigido
```sql
CREATE OR REPLACE FUNCTION validate_library_loan_borrower()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.borrower_type = 'aluno'
     AND NOT EXISTS (SELECT 1 FROM students WHERE id = NEW.borrower_id) THEN
    RAISE EXCEPTION 'borrower_id inválido para borrower_type=aluno';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_library_loans_validate_borrower
  BEFORE INSERT OR UPDATE ON library_loans
  FOR EACH ROW EXECUTE FUNCTION validate_library_loan_borrower();
```

Referência:
- [migration_combined.sql](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/supabase/migration_combined.sql:917)

---

## 4. BAIXO

### Problema
Muitas funções/helpers e tabelas-base são redefinidas várias vezes no mesmo arquivo.

### Causa raiz
Concatenação mecânica de migrations:

- `set_updated_at()` aparece 2 vezes
- `auth_profile_type()` aparece 3 vezes
- `create_audit_log_entry()` aparece 3 vezes
- `app_settings` aparece 2 vezes
- `audit_logs` aparece 2 vezes

### Impacto
Leitura difícil, risco de drift semântico, troubleshooting caro e auditoria quase inviável.

### Correção recomendada
Ter uma única fonte canônica por objeto, com ordem declarativa estável.

---

### Problema
O arquivo não é atomicamente transacional.

### Causa raiz
Parte relevante do DDL está fora de transação, e o restante foi fragmentado em vários `BEGIN/COMMIT`.

### Impacto
Falhas intermediárias deixam o schema parcialmente aplicado.

### Correção recomendada
Ou transformar o combinado em bootstrap único consistente, ou manter migrations realmente incrementais e pequenas.

---

## Lista Completa de Erros Encontrados

### CRÍTICO
- Falta de `uuid-ossp` com uso intensivo de `uuid_generate_v4()`.
- Alterações/policies sobre tabelas ainda não criadas ou inexistentes no arquivo combinado.
- FK para `assignments` criada antes da própria tabela `assignments`.

### ALTO
- Drift de nomes de policy e coexistência de policies antigas e novas.
- Colunas de e-mail usadas por RLS sem unicidade case-insensitive consistente.
- Idempotência inconsistente em índices, triggers e constraints.

### MÉDIO
- Relacionamentos importantes modelados como arrays UUID.
- Falta de `CHECK` para regras de negócio centrais.
- Tenant isolation permissiva demais quando `tenant_id` é `NULL`.
- `library_loans.borrower_id` sem FK real.

### BAIXO
- Redefinições excessivas de funções/tabelas no mesmo arquivo.
- Organização transacional ruim para manutenção e rollback.

## Melhorias Arquiteturais Recomendadas

- Substituir o uso de arrays UUID por tabelas de junção canônicas.
- Parar de usar e-mail como chave relacional implícita e migrar ownership para UUID/FK.
- Separar claramente:
  - schema bootstrap
  - migrations incrementais
  - seeds
  - políticas RLS
  - funções `SECURITY DEFINER`
- Formalizar domínio multi-tenant:
  - `tenant_id NOT NULL` nas tabelas tenant-scoped
  - dados globais em tabelas próprias
- Criar padrões obrigatórios para:
  - nomes de policy
  - `DROP IF EXISTS`/`IF NOT EXISTS`
  - `WITH CHECK` em policies mutáveis
  - índices em todas as FKs consultadas

## Boas Práticas Adicionais

- Padronizar `TEXT` com `NULLIF(BTRIM(...), '')` quando vazio não faz sentido.
- Criar índices funcionais `lower(email)` para todo fluxo autenticado por e-mail.
- Usar `NOT VALID` apenas em migração incremental pesada; para bootstrap, prefira constraint validada de saída.
- Documentar no cabeçalho do arquivo:
  - versão
  - compatibilidade do dialeto
  - pré-requisitos
  - se o script é bootstrap único ou rerunnable
- Se o alvo for produção, validar o schema com pipeline automatizado antes de aplicar:
  - parse/lint SQL
  - banco efêmero
  - smoke test de RLS
  - verificação de grants/policies

## Estado Atual da Versão Corrigida

Na versão [migration_combined_corrected.sql](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/supabase/migration_combined_corrected.sql), os itens críticos e altos desta revisão foram corrigidos. Os pontos que permanecem como dívida arquitetural, e não mais como erro de execução imediata, são:

- o domínio ainda depende de e-mail em partes relevantes das regras de acesso, embora agora de forma normalizada e indexada
- arrays legados foram mantidos por compatibilidade, mesmo com tabelas de junção já introduzidas como fonte canônica
- `library_loans` continua sem uma entidade-pai única para tomadores; a integridade hoje é garantida por trigger, não por FK nativa
