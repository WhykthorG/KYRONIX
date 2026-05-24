<!-- ð¡ð¢Ðì ð▒Ê»ÐéÐìÐìð│ð┤ÐìÐàÊ»Ê»ð¢ð©ð╣ð│ ð▒Ê»ÐàÐìð╗ð┤ ð¢Ðî Whyktor GSV Ê»ð╣ð╗ð┤ð▓ÐìÐÇð╗Ðìð┤Ðìð│. -->
# Documentacao do Projeto

Este diretorio e a base canonica de documentacao do EduGest.

## Entrada principal

- [DOCUMENTACAO_COMPLETA_DO_SISTEMA.md](DOCUMENTACAO_COMPLETA_DO_SISTEMA.md)

O documento mestre consolida arquitetura, modulos, dados, seguranca, operacao, deploy, testes e referencias academicas a partir do codigo atual do repositorio.

## Guias complementares

### Base tecnica

- [arquitetura.md](arquitetura.md)
- [setup-operacao.md](setup-operacao.md)
- [banco-de-dados.md](banco-de-dados.md)
- [modulos.md](modulos.md)
- [fluxo.md](fluxo.md)
- [rota.md](rota.md)

### Pacote executivo

- [executivo/README.md](executivo/README.md)
- [executivo/resumo-executivo.md](executivo/resumo-executivo.md)
- [executivo/modulos-e-indicadores.md](executivo/modulos-e-indicadores.md)
- [executivo/precificacao-e-posicionamento.md](executivo/precificacao-e-posicionamento.md)

### Manuais por perfil

- [manuais/README.md](manuais/README.md)
- [manuais/administrador.md](manuais/administrador.md)
- [manuais/coordenador.md](manuais/coordenador.md)
- [manuais/secretario.md](manuais/secretario.md)
- [manuais/professor.md](manuais/professor.md)
- [manuais/aluno.md](manuais/aluno.md)

### Base academica e TCC

- [tcc/README.md](tcc/README.md)
- [tcc/visao-academica.md](tcc/visao-academica.md)
- [tcc/arquitetura-e-modelagem.md](tcc/arquitetura-e-modelagem.md)
- [tcc/seguranca-validacao-e-limitacoes.md](tcc/seguranca-validacao-e-limitacoes.md)

## Resumo rapido

- SPA em React + Vite com shell desktop-like.
- Persistencia, autenticacao e seguranca principal no Supabase.
- Handlers administrativos em `api/admin/*` para operacoes com `service_role`.
- Deploy suportado em Vercel ou Docker + Nginx.
