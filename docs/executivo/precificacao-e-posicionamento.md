# Precificação e Posicionamento Comercial

## 1. O que o sistema já entrega

O sistema atual não é um CRUD escolar básico. Ele já cobre uma faixa ampla de operação acadêmica, administrativa e pedagógica, com diferenciais técnicos relevantes:

- autenticação e perfis por papel;
- gestão de alunos, professores, turmas e disciplinas;
- notas, frequência, diário, plano de aula e tarefas;
- mensagens, comunicados e calendário;
- portal de responsáveis e materiais/documentos;
- biblioteca, metas, relatórios e exportação;
- desktop-like shell com janelas, taskbar e menu;
- storage privado com controle de acesso;
- proxy serverless para rotas sensíveis;
- auditoria, rate limiting e bloqueio por IP;
- endurecimento contra SQL dinâmico em pontos genéricos de acesso a dados.

Base funcional consolidada em:

- [docs/modulos.md](../modulos.md)
- [docs/arquitetura.md](../arquitetura.md)
- [docs/security-http-map.md](../security-http-map.md)

## 2. Leitura de mercado

As referências de mercado mais próximas, usando páginas públicas oficiais, mostram três faixas claras:

- entrada barata: eDuck com planos em torno de R$ 89,90, R$ 189,90 e R$ 289,90 por mês;
- faixa intermediária: SIG Escolas com planos em R$ 149, R$ 299, R$ 599 e R$ 999 por mês;
- faixa por aluno / SaaS escalável: MultiEscola com R$ 5,00 por aluno/mês e Nortear com R$ 299, R$ 599 e R$ 999 por mês.

Fontes:

- [eDuck Gestão Escolar](https://www.educkgestaoescolar.com.br/)
- [SIG Escolas](https://e-escolas.com/)
- [MultiEscola](https://multiescola.app/)
- [Nortear](https://nortear.net/)

## 3. Posicionamento recomendado

O produto deve ser posicionado como:

**plataforma escolar completa para operação acadêmica, administrativa e pedagógica, com arquitetura moderna, segurança reforçada e suporte para crescimento multi-tenant.**

Isso significa:

- não vender como sistema “barato de secretaria”;
- não tentar competir diretamente com ERP financeiro pesado sem ter esse módulo como núcleo;
- vender como solução mais madura que o plano de entrada, mas ainda mais acessível que suites corporativas muito pesadas.

## 4. Tabela de preços sugerida

### Plano por porte

| Plano | Público-alvo | Preço sugerido | Justificativa |
|---|---|---:|---|
| Start | escola pequena, piloto, unidade única | R$ 299/mês | fica acima do mercado de entrada muito barato, mas ainda competitivo para o conjunto de módulos entregue |
| Growth | escola em expansão | R$ 599/mês | acompanha a faixa intermediária de mercado e valoriza os módulos de gestão + comunicação + auditoria |
| Pro | escola maior ou operação com mais usuários | R$ 999/mês | conversa com a faixa de sistemas mais completos do mercado |
| Enterprise | rede, franquia, multi-unidade | R$ 4,90 a R$ 6,90/aluno/mês | aproxima o modelo por uso adotado por SaaS escalável, com mínimo mensal negociado |

### Implantação

| Serviço | Faixa sugerida | Observação |
|---|---:|---|
| Implantação e onboarding | R$ 2.000 a R$ 6.000 | cobre importação de dados, configuração, treinamento e go-live |
| Migração assistida | sob proposta | útil quando a escola vem de outro sistema e precisa de saneamento de dados |
| Customizações / integrações | sob proposta | cobrança separada para evitar “escopo infinito” |

## 5. Estratégia comercial

### 5.1 Estratégia de entrada

- oferecer piloto de 7 a 14 dias com escopo controlado;
- vender implantação rápida como argumento de confiança;
- destacar ganho operacional, não apenas tecnologia;
- usar a segurança e a auditoria como diferencial, principalmente para coordenação e secretaria.

### 5.2 Estratégia de conversão

- começar por escola pequena ou unidade piloto;
- expandir para mais perfis e módulos dentro da mesma instituição;
- usar onboarding e treinamento como ponte para retenção;
- converter a escola para plano anual com desconto.

### 5.3 Estratégia de retenção

- reuniões curtas de sucesso do cliente;
- revisão mensal de uso dos módulos;
- relatórios de engajamento e adoção;
- suporte com SLA melhor em planos maiores.

### 5.4 Estratégia de upsell

- Start -> Growth quando a escola sair do piloto;
- Growth -> Pro quando o volume de usuários, turmas e operações aumentar;
- Pro -> Enterprise quando houver multi-unidade, integrações e SLA mais exigente.

## 6. Segmentação por porte de escola

### Escola pequena

- até 100 alunos
- necessidade: organização, cadastro, frequência, notas, comunicação básica
- preço recomendado: R$ 299/mês
- foco comercial: simplicidade e implantação rápida

### Escola média

- 101 a 300 alunos
- necessidade: mais usuários, relatórios, comunicação escola-família, mais disciplina operacional
- preço recomendado: R$ 599/mês
- foco comercial: rotina bem organizada e ganho de tempo

### Escola grande

- 301 a 800 alunos
- necessidade: escala, auditoria, segregação de perfis, governança e visibilidade
- preço recomendado: R$ 999/mês
- foco comercial: robustez operacional e previsibilidade

### Rede / múltiplas unidades

- acima de 800 alunos
- necessidade: multi-tenant, governança, onboarding assistido e SLA
- preço recomendado: R$ 4,90 a R$ 6,90 por aluno/mês
- foco comercial: padronização, segurança e escala

## 7. Leitura final

Se o objetivo for entrar no mercado com chance real de venda, o melhor posicionamento hoje é:

- **R$ 299/mês** como porta de entrada;
- **R$ 599/mês** como faixa principal de conversão;
- **R$ 999/mês** como camada premium operacional;
- **preço por aluno** para redes e operações maiores.

Esse desenho é coerente com o que o sistema já entrega hoje e fica alinhado com o mercado brasileiro de gestão escolar.
