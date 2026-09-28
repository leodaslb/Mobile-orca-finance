# AGENTS.md — Orca Finance

## Escopo

Este repositório contém o Orca Finance, projeto acadêmico da FATEC, dividido em:

```text
/
├── AGENTS.md
├── docs/
├── backend/
│   └── AGENTS.md
└── orca-finance/
    └── AGENTS.md
```

- `docs/`: fontes compartilhadas de produto, regras, arquitetura, modelo de dados e UX.
- `backend/`: API e persistência.
- `orca-finance/`: aplicativo mobile.

Este arquivo contém regras comuns ao repositório inteiro.
Os `AGENTS.md` das subpastas complementam estas instruções no seu próprio escopo.

## Antes de alterar código

Sempre:

1. inspecione o estado atual do repositório;
2. leia este arquivo;
3. leia o `AGENTS.md` da área em que vai trabalhar;
4. consulte em `docs/` as fontes relevantes da funcionalidade;
5. identifique RF, User Story e RN aplicáveis;
6. procure implementação e testes existentes antes de criar estruturas novas.

Não assuma que resumos antigos de sessão representam o estado atual.

## Fontes de verdade

Não duplique regras de negócio neste arquivo. Consulte os documentos vigentes em `docs/`.

Fontes principais:

- `RequisitosMobile.txt`
- `Orca_Finance_Backlog_Revisado_Final_RF_US.xlsx`
- `Orca_Finance_Regras_de_Negocio_Revisadas_Consolidada_ok.xlsx`
- `Orca_Finance_Prioridades_Sprints.xlsx`
- `Orca_Finance_Modelo_de_Dados.md`
- `Orca_Finance_Arquitetura_Frontend.md`
- `Orca_Finance_Arquitetura_Backend.md`
- `Orca_Finance_Fluxo_de_Telas_Sprint1.md`
- `Orca_Finance_Design_System_Atualizado.md`

Para comportamento funcional, prevalecem requisitos e decisões/RN consolidadas vigentes.
Backlog mantém a rastreabilidade RF ↔ US.
Arquitetura define como implementar, não cria regra de negócio.
Fluxo, Design System e referências visuais definem UX/apresentação sem poder contrariar regra consolidada.

Se duas fontes vigentes realmente conflitarem, não escolha silenciosamente:
registre a divergência e peça decisão quando ela bloquear o trabalho.

## Regra principal

Não invente requisitos, regras, campos, cálculos ou políticas para “fechar” uma funcionalidade.

Quando algo continuar indefinido:

- implemente somente a parte não bloqueada;
- mantenha a solução reversível;
- registre a decisão pendente;
- não transforme sugestão técnica ou visual em regra de produto.

## Rastreabilidade

Preserve:

```text
RF → User Story → RN/decisão → Task → Implementação → Teste
```

Toda mudança funcional relevante deve ser explicável por essa cadeia.

## Separação Frontend / Backend

O frontend e o backend são projetos distintos dentro do mesmo produto.

Contrato de integração:

```text
orca-finance
    ↓ REST / JSON
backend
    ↓
PostgreSQL
```

Regras:

- frontend não conhece Prisma/PostgreSQL;
- backend não conhece componentes/estado de UI;
- mudanças de contrato devem considerar os dois lados;
- não alterar silenciosamente o modelo de domínio para facilitar apenas uma camada;
- dados financeiros devem manter isolamento por perfil em ambas as camadas.

Se uma tarefa tocar os dois projetos, leia os dois `AGENTS.md` específicos antes de implementar.

## Simplicidade

Prefira a solução mínima que respeite as decisões existentes.

Não introduza sem necessidade concreta:

- arquitetura paralela;
- abstrações genéricas sem uso real;
- novas dependências;
- refatoração ampla fora do escopo;
- tecnologia “para o futuro”.

Antes de alterar arquitetura, consulte o documento correspondente em `docs/` e apresente trade-offs quando houver alternativas relevantes.

## Git e alterações existentes

Preserve trabalho já presente no repositório.

Não faça sem solicitação explícita:

- reset destrutivo;
- descarte de alterações;
- force push;
- atualização ampla de dependências;
- reestruturação geral do projeto.

## Qualidade

Para cada mudança relevante:

- valide tipos/build da área;
- rode os testes/scripts aplicáveis;
- verifique regressões dos consumidores afetados;
- execute `git diff --check` quando aplicável;
- não declare teste não executado como aprovado.

## Relatório final

Ao concluir um bloco relevante, informe de forma objetiva:

- concluído;
- parcial/bloqueado;
- arquivos criados/modificados;
- RF → US → RN → implementação → teste;
- testes executados e resultado;
- regressões verificadas;
- pendências reais;
- divergências documentais encontradas.
