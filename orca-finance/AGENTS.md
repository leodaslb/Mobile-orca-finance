# AGENTS.md — Orca Finance Mobile

## Projeto

Orca Finance Mobile é um projeto acadêmico FATEC desenvolvido com:

- React Native
- Expo
- TypeScript
- Expo Router
- Android como plataforma prioritária

Atue como engenheiro de software mantendo o projeto simples,
rastreável e explicável tecnicamente.

## Antes de alterar código

Sempre:

1. inspecione o código atual;
2. consulte os documentos do domínio afetado;
3. verifique RN/US/RF vigentes;
4. confira PNG de referência quando houver UI;
5. procure componentes, types, services e testes existentes antes de criar novos.

Não confie em resumos antigos se o repositório/documentação atual disser outra coisa.

## Fontes de verdade

Para regra funcional, consulte nesta ordem:

1. `docs/RequisitosMobile.txt`
2. `docs/Orca_Finance_Backlog_Revisado_Final_RF_US.xlsx`
   - principalmente `Backlog Revisado` e `RN sincronizadas`
3. `docs/Orca_Finance_Regras_de_Negocio_Revisadas_Consolidada_ok.xlsx`

Para fluxo/UX:

1. RN e backlog vigentes
2. `docs/Orca_Finance_Fluxo_de_Telas_Sprint1.md`
3. `docs/Orca_Finance_Design_System_Atualizado.md`
4. PNG em `references/`

Para arquitetura:

- `docs/Orca_Finance_Arquitetura_Frontend.md`

Decisões consolidadas mais novas prevalecem sobre propostas/documentos antigos.

## Regra principal

Não invente requisito ou regra de negócio.

Se algo não estiver definido:

- implemente somente o que não estiver bloqueado;
- mantenha a solução reversível;
- registre a pendência no relatório.

Não transforme recomendação de UX em regra obrigatória.

## Rastreabilidade

Preserve:

RF → US → RN → implementação → teste

Ao implementar uma funcionalidade, identifique primeiro seus RF/US/RN.

## Arquitetura

Arquitetura atual:

Screen / Route
→ Service
→ Mock Data Source

Regras:

- telas não importam mocks diretamente;
- regra de negócio não fica em componente puramente visual;
- `src/app` deve permanecer focado em rota/composição;
- estado local é a primeira opção;
- não criar store global sem necessidade real;
- não duplicar datasets;
- adaptar código existente antes de criar arquitetura paralela.

## Simplicidade

Evite overengineering.

Não introduza sem necessidade concreta:

- Redux/Zustand;
- Clean Architecture completa;
- Repository/ViewModel/DTO em cadeia;
- wrappers genéricos;
- hooks/helpers usados uma única vez sem ganho claro;
- dependências novas.

Prefira a solução mínima que preserve a arquitetura atual.

## Domínio

Valores monetários usam centavos inteiros quando o modelo atual assim definir.

Use IDs estáveis para entidades e rotas.

Não localizar entidade por texto visível ou posição no array.

Dados relacionados devem vir do mesmo dataset/service.

## UI

Use:

- tokens de `src/theme`;
- Manrope;
- Tabler Icons;
- Design System existente.

Não hardcode valor financeiro que possa ser derivado do dataset.

Quando houver PNG, preserve sua linguagem visual sem contrariar regra de negócio vigente.

## Autonomia

Pode decidir sozinho decisões técnicas locais e reversíveis, como:

- nomes privados;
- helpers;
- tipos auxiliares;
- organização interna;
- pequenas refatorações;
- scripts de teste.

Peça decisão somente quando houver mudança de produto,
regra de negócio, arquitetura relevante ou dependência externa importante.

Se uma parte estiver bloqueada, continue as demais.

## Testes

Após mudanças relevantes, execute quando aplicável:

npx tsc --noEmit
node scripts de verificação relacionados
git diff --check

Use `npm run lint` somente se o lint estiver configurado.

Android Emulator é a referência final de validação visual.
Não declare teste não executado como aprovado.

## Regressões

Ao alterar service, type ou mock compartilhado,
verifique todos os consumidores relevantes.

Não faça limpeza/refatoração fora do escopo sem necessidade.

## Git

Preserve alterações existentes do usuário.

Não faça reset destrutivo, descarte de mudanças,
force push ou atualização de dependências sem solicitação.

## Relatório final

Informe objetivamente:

- concluído;
- parcial/bloqueado;
- arquivos criados/modificados;
- RF → US → RN → implementação → teste;
- testes executados;
- regressões verificadas;
- pendências atuais;
- divergências documentais.

Não liste como pendente algo que a fonte vigente já consolidou.
