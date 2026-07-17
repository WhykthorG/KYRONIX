# Guia_de_Instalacao

## Descrição
Guia de instalação e configuração do sistema [[KYRONIX S.E.N.O - Visão Geral]].

## Requisitos
- Node.js 20+
- npm
- Projeto Supabase configurado
- Opcional: Docker Desktop

## Variaveis de ambiente

| Variavel | Obrigatoria | Uso |
|---|---|---|
| `VITE_SUPABASE_URL` | sim | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | sim | chave publica usada pelo frontend |
| `VITE_APP_NAME` | nao | nome exibido na interface |
| `VITE_STORAGE_BUCKET` | nao | bucket do Storage |
| `VITE_ADMIN_API_BASE_URL` | nao | base URL da API administrativa |
| `SUPABASE_SERVICE_ROLE_KEY` | condicional | chave server-side para operacoes privilegiadas |

## Instalacao

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deploy
- Vercel: publicar como SPA com rewrite para `index.html`
- Docker: usar `docker compose up --build` na porta `3000`

## Ver Também
- [[setup-operacao]] — Setup e operação detalhada
- [[arquitetura]] — Arquitetura do sistema
