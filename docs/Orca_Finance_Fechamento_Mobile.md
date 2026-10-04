# Correções finais mobile — 03/10/2026

Este bloco usa a implementação REST existente e as decisões consolidadas. Não altera schema, migrations, catálogo global, limites financeiros, autenticação remota ou segurança local. Não houve commit/push. O relatório de execução e a lista completa dos arquivos estão em `../orca-finance/FECHAMENTO_MOBILE.md`.

## Decisão expressa do aluno: histórico de aportes

RF04 → US10 → RN-META-01/02 → **decisão deste pedido**: exibir os aportes no detalhe da meta. A lista histórica não era um critério explícito original de RF04/US10. Reutiliza `AporteMeta` e seus valores/data/hora, sem entidade adicional e sem transformar aporte em `Transacao`.

Contrato mínimo: `GET /profiles/:profileId/goals/:goalId/contributions`, resposta array de `{ id, metaId, valor, dataHora }`. Valor monetário permanece string decimal e instante ISO com fuso. Lista ordenada por `dataHora DESC`, com desempate por `createdAt DESC` e UUID. JWT → ownership do perfil → meta pertencente ao perfil → aportes. Perfil alheio: 403; meta ausente/de outro perfil: 404; sem aportes: `[]`.

O mobile carrega meta e histórico juntos. Tem loading, vazio, erro/retry, pull refresh e recarregamento após aporte. Indicadores continuam vindo do backend; o frontend apenas adapta os valores para apresentação.

## RF03 + RF24 → US06 → RN-ORC-01/02

Catálogo vigente e API auditados: Moradia, Transporte, Alimentação, Lazer e Estilo de Vida, Saúde e Autocuidado, Educação e Carreira, Rendas e Investimentos. O seed mantém somente essas categorias principais. Subcategorias são personalizadas por perfil (RN-CAT-01), não um catálogo digital predefinido.

A representação usa categoria existente escolhida conforme a finalidade da despesa. Exemplo: uma assinatura de filmes pertence a **Lazer e Estilo de Vida**, e o usuário pode criar **Streaming** como subcategoria em Categorias. **Aplicativos** e **Serviços online** também podem ser subcategorias criadas manualmente na categoria apropriada à sua finalidade; a implementação não atribui automaticamente todo serviço online a lazer.

Em Planejamento → configurar orçamento, o usuário define o valor mensal para essa categoria exatamente como para as demais. A despesa digital efetivada integra o realizado da categoria; a subcategoria identifica o serviço, mas não possui limite independente. O limite é compartilhado com outros gastos da categoria. A tela explica esse uso em linguagem de produto.

Não foi criada categoria global, subcategoria automática, regra financeira digital ou enum `INCLUSAO_DIGITAL`. Não existe cadastro digital predefinido nem limite exclusivo por subcategoria; esses seriam outras decisões de produto. Fixtures de teste criam suas próprias subcategorias e são removidas ao final. Limites preservados: abaixo de 75% NORMAL, 75–100% PRÓXIMO DO LIMITE, acima de 100% EXCEDIDO.

## RF08 → US15 e apresentação de categorias

Gastos por categoria reutiliza `MonthSelector` e consulta `reports/expenses` com o mês escolhido. Mudança de período/perfil esconde os dados anteriores e descarta respostas atrasadas. Loading, refresh, vazio, retry e retorno ao mês atual são explícitos. O resumo do dashboard continua indicando o mês atual. Não há soma financeira local.

Uma única apresentação por nome normalizado centraliza ícone Tabler outline e cores das sete categorias. Categoria futura recebe `IconTag` neutro. Dashboard, categorias, lista/formulário/detalhe de transações, filtros, reflexão, orçamento, comparação e relatórios usam esse mapeamento. Nenhum campo de ícone foi persistido. O olho de ocultação do saldo foi removido; US37 foi preservada.

## RF12 → US19, sem RN específica

O mobile seleciona imagem da galeria ou fotografa, mostra prévia e envia `multipart/form-data` com um `file`, JWT e perfil ativo. Não define manualmente Content-Type/boundary. JPEG/PNG, até 5 MiB inclusive; demais formatos, arquivo ilegível e tamanho excessivo recebem mensagens claras. Câmera exige permissão, com orientação para configurações quando bloqueada. Galeria usa o seletor do sistema, com acesso à imagem escolhida, conforme [Expo ImagePicker SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/).

No Expo SDK 57, o fetch global usa a implementação do Expo. O envio nativo usa `File` de `expo-file-system` no FormData; o objeto legado `{ uri, name, type }` é rejeitado antes da requisição. Essa incompatibilidade foi encontrada durante o teste Android e corrigida. Referências: [fetch do Expo](https://docs.expo.dev/versions/v57.0.0/sdk/expo/) e [upload com File/FormData](https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/).

A captura está disponível no cadastro da despesa e no detalhe. O detalhe aceita novas adições independentes e recarrega os anexos após sucesso. O modal conserva a seleção após erro e permite reenviar. Se o cadastro financeiro teve sucesso e o upload falhou, o cliente informa gravação parcial e abre a transação salva; não repete a criação financeira. O usuário pode adicionar o comprovante pelo detalhe.

Criação por URL foi removida do runtime. Leitura de anexos antigos, inclusive PDF, continua disponível. O backend já implementa Cloudinary → metadados no Neon e compensação por falha de persistência. Credenciais só pertencem ao backend. Faltando configuração externa, US19 permanece parcial na validação real de armazenamento, mesmo com código mobile/backend implementado.

Pendências técnicas já existentes: remoção física no Cloudinary após reversão e política de acesso às URLs públicas. A reversão mantém CASCADE dos metadados; snapshots de auditoria permanecem escalares, sem tags ou anexos.

## RF05 + RF70 → US12 → RN-CAT-02, RN-REF-01/03

Preservado: só DESPESA explicitamente NÃO ESSENCIAL recebe pergunta antes da conclusão. As três escolhas permanecem: finalizar mesmo assim, colocar em reflexão, voltar/revisar. Aguardar usa padrão 48h configurável. O mobile passa a consumir o POST existente para guardar **somente descrição e duração**, informando essa limitação antes da escolha. Não registra despesa ao colocar em espera.

### Saída do período: decisão confirmada e implementada na recuperação

`ItemReflexao` tem perfil, descrição, entrada, duração e timestamps. `liberaEm`/`liberado` são derivados. Não há valor, categoria/subcategoria, essencialidade, pagamento, anotação, tags, arquivo, vínculo com transação ou estado de encerramento. A lista não gera compra quando o tempo termina.

**Decisão expressa do aluno recebida em 03/10/2026, depois da implementação inicial deste bloco:** após a liberação, oferecer **Confirmar decisão** e **Desistir**. Confirmar abre o formulário existente com **somente a descrição preenchida**; todos os demais campos são informados novamente. A transação só é criada no novo envio do formulário, como **EFETIVADA**. Após criação bem-sucedida, o item sai da lista ativa. Desistir encerra/remove o item sem criar transação ou afetar cálculos. O término das 48h nunca cria uma transação automaticamente.

Essa decisão substitui a recomendação anterior de guardar/retomar o formulário completo. **Não é necessário snapshot do formulário.** O modelo atual já guarda a descrição e permite a alternativa autorizada de remover o item. Não há necessidade demonstrada de migration para uma implementação mínima.

Antes da recuperação, a auditoria encontrara estas lacunas, agora completadas:

- **Backend:** comando de desistência e coordenação da criação financeira com a remoção do item somente após sucesso; validar ownership e liberação no servidor e evitar duplicação/estado parcial em concorrência ou retry.
- **Endpoints:** completar o contrato de desistir/consumir o item. Hoje existem apenas POST/lista/detalhe/PATCH; abrir o formulário não deve consumir o item nem criar transação.
- **Mobile:** ações após liberação, navegação identificando o item, carregar sua descrição no formulário existente, manter demais campos vazios e atualizar a lista após sucesso/desistência. Voltar ou falhar no cadastro deve conservar o item.
- **Testes:** antes/depois da liberação, ownership, descrição reaproveitada, outros campos vazios, cancelamento/falha conservando item, criação EFETIVADA/removendo item e desistência sem efeito financeiro; incluir proteção contra envio duplicado.

A recuperação confirmou que a nova saída ainda não havia sido implementada. Implementação atual: `DELETE /profiles/:profileId/reflection-items/:itemId` retorna 204 para desistência; `POST /profiles/:profileId/reflection-items/:itemId/transactions` recebe o DTO existente de nova transação e retorna 201. Ambos exigem JWT, ownership e liberação no relógio do servidor; item de outro perfil/ausente retorna 404, espera retorna 409. O POST aceita somente DESPESA/EFETIVADA. Abrir o formulário usa GET, sem consumir item.

O service trava a linha do item e compartilha a mesma transação Prisma entre criação financeira, auditoria escalar e remoção. Erro desfaz todas as alterações; conclusão concorrente/desistência/retry encontram item já consumido e não criam outra compra. Nenhum campo novo ou migration. Sem vínculo persistido, um retry após perda da resposta encontra 404: evita duplicar, mas não reenvia o recibo da confirmação anterior. A compra já salva continua na lista normal de transações.

O mobile reutiliza o formulário existente com `initialDescription`; valor, data, hora, categoria, pagamento, essencialidade, tags, recibo e recorrência continuam vazios/defaults do cadastro. A compra é despesa e o novo POST sempre envia EFETIVADA. A pergunta continua ocorrendo se o usuário marcar explicitamente não essencial; finalizar/revisar permanecem disponíveis. Um segundo período pode ser iniciado pelo cadastro comum, sem criar automaticamente outro item a partir da confirmação já liberada. Voltar/falhar conserva o item; sucesso financeiro o consome, mesmo se upload/associação complementar depois falhar, preservando o tratamento de gravação parcial existente.

Testes em `reflection-exit.spec.ts`, `reflection-exit.e2e.ts` e `verify-reflection-exit.cjs` cobrem liberação exata, ownership, dados novos, EFETIVADA, desistência sem efeito financeiro, rollback de FK/auditoria/remoção, concorrência, retry, formulário vazio, voltar/erro e atualização da lista. Resultado e evidências em `../orca-finance/RECUPERACAO_INTERRUPCAO.md`.

Divergência documental anterior: o fluxo de telas descrevia a lista como pendência apenas de UX, embora faltassem também comandos de backend. A decisão expressa de 03/10 e este contrato complementam aquela fonte; não exigem snapshot de formulário.
