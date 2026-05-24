<!-- ðƒÐÇð¥ðÁð║Ðé ð┐ð¥ð╗ð¢ð¥ÐüÐéÐîÐÄ ÐÇð░ðÀÐÇð░ð▒ð¥Ðéð░ð¢ ðúð©ð║Ðéð¥ÐÇð¥ð╝ ðôðíðÆ. -->
# Setup e Operacao

## Requisitos

- Node.js 20+
- npm
- Projeto Supabase configurado
- Opcional: Docker Desktop

## Variaveis de ambiente

Copie `.env.example` para `.env.local`.

Variaveis principais:

| Variavel | Obrigatoria | Uso |
|---|---|---|
| `VITE_SUPABASE_URL` | sim | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | sim | chave publica usada pelo frontend |
| `VITE_APP_NAME` | nao | nome exibido na interface |
| `VITE_STORAGE_BUCKET` | nao | bucket do Storage |
| `VITE_ADMIN_API_BASE_URL` | nao | base URL da API administrativa, util em desenvolvimento |
| `SUPABASE_SERVICE_ROLE_KEY` | condicional | chave usada apenas no servidor/serverless para gestao de usuarios |

## Desenvolvimento local

```bash
npm install
npm run dev
```

Servidor padrao:

- `http://localhost:5173`

## Build de producao

```bash
npm run build
```

Artefato gerado:

- `frontend/dist/`

## Lint

```bash
npm run lint
```

## Docker

O projeto inclui:

- [infra/Dockerfile](/C:/Users/Home/Desktop/TCC/infra/Dockerfile)
- [infra/docker-compose.yml](/C:/Users/Home/Desktop/TCC/infra/docker-compose.yml)
- [infra/nginx.conf](/C:/Users/Home/Desktop/TCC/infra/nginx.conf)

Uso:

```bash
docker compose up --build
```

A aplicacao fica exposta em:

- `http://localhost:3000`

## Provisionamento do Supabase

Ordem recomendada:

1. Criar o projeto Supabase.
2. Criar bucket de storage.
3. Aplicar [supabase/schema.sql](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/supabase/schema.sql) com ajuste descrito abaixo.
4. Aplicar [supabase/migration_improvements.sql](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/supabase/migration_improvements.sql).
5. Aplicar [supabase/migration_permissions_hardening.sql](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/supabase/migration_permissions_hardening.sql).
6. Aplicar [supabase/fix_coordinator_fk.sql](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/supabase/fix_coordinator_fk.sql) se coordenadores forem geridos apenas por `user_profiles`.
7. Inserir perfis iniciais em `user_profiles`.

## Observacao sobre o schema

O arquivo [supabase/schema.sql](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/supabase/schema.sql) foi ajustado para remover as policies residuais de `payments`, permitindo provisionamento limpo em banco novo.

## Perfis de teste

O script [scripts/create_test_profiles.js](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/scripts/create_test_profiles.js) cria usuarios e perfis de teste usando `service_role`.

Perfis criados:

- `admin@teste.com`
- `coordenador@teste.com`
- `professor@teste.com`
- `aluno@teste.com`
- `secretario@teste.com`

Senha padrao do script:

- `123456`

## Deploy

### Vercel

- Publicar como SPA.
- Configurar as variaveis de ambiente no painel.
- Garantir rewrite para `index.html` com [infra/vercel.json](/C:/Users/Home/Desktop/TCC/infra/vercel.json).

### Netlify

- O arquivo operacional continua em [netlify.toml](/C:/Users/Home/Desktop/TCC/netlify.toml) na raiz.
- As functions ficam em `infra/netlify/functions/`.
- O rewrite preserva `/api/*` apontando para `/.netlify/functions/api/:splat`.

### Consideracoes operacionais

- `VITE_` e embutido no bundle pelo Vite.
- `SUPABASE_SERVICE_ROLE_KEY` deve existir apenas no ambiente serverless/backend.
- O frontend consome `/api/admin`; em desenvolvimento, se necessario, configure `VITE_ADMIN_API_BASE_URL`.
- Em OAuth Google, ajuste as redirect URLs no Supabase para o dominio final.
