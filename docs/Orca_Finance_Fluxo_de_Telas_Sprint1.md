# Orca Finance — Fluxo de Telas da Sprint 1

> Documento de navegação e rastreabilidade visual/funcional da Sprint 1 atual, composta por 18 User Stories. Objetivo: deixar explícito **qual tela leva a qual**, quais ações abrem novas telas, quais ações abrem modal/bottom sheet e quais pontos restantes são apenas decisões de UX. As regras de negócio bloqueantes da Sprint 1 estão consolidadas.

---

## 1. Convenções do fluxo

- `→` abre uma nova tela.
- `↳` abre um modal/bottom sheet/estado sobre a tela atual.
- `↔` representa alternância de estado dentro da mesma tela.
- **Confirmado** = suportado pelos requisitos, backlog, regras ou decisão já tomada no projeto.
- **Decisão UX** = solução escolhida para navegação, sem estar explicitamente definida no requisito original.
- **Pendente** = não deve ser implementado como regra definitiva até decisão formal.

### Bottom navigation oficial

**Início | Transações | + | Planejamento | Relatórios**

- **Início** → Dashboard.
- **Transações** → Lista de transações.
- **+** → Nova transação.
- **Planejamento** → Hub/área de orçamento, metas e controles de planejamento.
- **Relatórios** → Relatórios gráficos e exportação.

**Perfil/Configurações** não fica na bottom navigation. O acesso recomendado é pelo avatar/atalho no topo.

### User Stories da Sprint 1 vigente

`US01, US02, US03, US05, US06, US10, US12, US13, US14, US15, US19, US24, US29, US37, US40, US44, US45 e US60`.

---

# 2. Fluxo de entrada e autenticação

## 2.1 Boas-vindas / conta

**Tela:** `14_auth_boas_vindas.png`

**US principal:** US60 — Cadastro/autenticação de conta.

**Rastreabilidade:** a US60 foi adicionada posteriormente e não possui RF original explícito entre RF01–RF71. Está vinculada às RN-ID-01, RN-ID-02, RN-ID-03 e RN-ID-04 e impacta RF11, RF16 e RF48.

Fluxo:

- **Entrar** ↳ abre **Login** em bottom sheet;
- **Criar conta** ↳ abre **Cadastro de usuário** em bottom sheet.

### Login

**Estado complementar:** `tela-login.png`

Campos mínimos:
- e-mail;
- senha.

Regras:
- e-mail é o identificador da conta;
- autenticação da conta é diferente do bloqueio local por PIN/biometria.

Fluxo:
- preencher credenciais → autenticar;
- conta com um perfil → perfil selecionado automaticamente → **Início**;
- conta com mais de um perfil → **Seleção de perfil** → **Início**.

### Cadastro

**Estado complementar:** `tela_criar_conta.png`

Campos obrigatórios:
- nome;
- e-mail;
- senha.

Regras:
- e-mail será usado como login e deve ser único entre contas;
- tentativa de cadastrar e-mail já existente deve ser recusada;
- recuperação de acesso, alteração de credenciais e exclusão de conta ficam fora do escopo desta versão.

Após cadastro válido:
1. criar conta;
2. criar automaticamente o primeiro perfil usando inicialmente o nome da conta/usuário;
3. perfil inicia sem dados financeiros, saldo `R$ 0` e moeda-base `BRL`;
4. tornar esse perfil ativo;
5. abrir **Início / Dashboard**.

O usuário poderá renomear o perfil e criar outros perfis quando a funcionalidade de múltiplos perfis for implementada.

---

## 2.2 Bloqueio local

**Tela:** `15_auth_bloqueio_biometria.png`

Este fluxo é diferente de login de conta.

Fluxo recomendado:

- app bloqueado → tentar **biometria**;
- falha/alternativa → **Usar PIN**;
- PIN ativo ↔ ação alternativa passa a ser **Usar biometria**;
- autenticação local válida → abrir área autenticada do app.

**US principal:** US37.

---

# 3. Início / Dashboard

## 3.1 Dashboard

**Tela:** `01_dashboard_inicio.png`

**US principal:** US15.

Entradas:
- bottom nav → **Início**.

Saídas principais:
- tocar em transação recente → **Detalhe da transação**;
- tocar em meta exibida → **Detalhe da meta**;
- avatar → **Perfil/Configurações** (decisão de navegação já adotada no projeto);
- bottom nav permite navegar para Transações, Nova Transação, Planejamento e Relatórios.

**Observação:** o Dashboard é tela-resumo. Ele não deve duplicar fluxos completos de configuração.

---

# 4. Transações

## 4.1 Lista de transações

**Tela:** `02_transacoes_lista.png`

**US principal:** US03.

Entradas:
- bottom nav → **Transações**.

Saídas:
- tocar em uma transação → **Detalhe da transação**;
- tocar no filtro ↳ **Filtros avançados**;
- busca textual atua sobre a própria lista;
- bottom nav `+` → **Nova transação**.

### Filtros avançados

**Estado complementar:** `tela_filtro_transacoes.png`

Fluxo:
- Lista de transações → filtro ↳ bottom sheet;
- **Aplicar filtros** → fecha bottom sheet e atualiza lista;
- **Limpar** → remove filtros;
- **Cancelar/fechar** → retorna sem alteração.

Filtros previstos na Sprint 1:
- data;
- categoria;
- valor;
- método de pagamento;
- descrição permanece na busca textual principal.

---

## 4.2 Nova transação

**Tela:** `03_transacao_cadastro.png`

**US principais:** US01, US02, US19, US24 e integração com US12.

Entrada principal:
- botão central `+` da bottom navigation.

Ações/saídas:
- **Salvar transação** → valida campos e registra;
- campos obrigatórios no cadastro manual: tipo, valor, data, hora, descrição e categoria quando aplicável; a descrição é a identificação principal e não existe campo separado de título;
- **Anotação** é um campo textual complementar e opcional, vinculado à transação conforme RF36/US02; pode registrar contexto adicional sem substituir a descrição;
- despesa pode ser marcada explicitamente como **Contabilizar como gasto livre**; nesse caso pode permanecer sem categoria e consome a cota mensal de gastos livres;
- essencialidade pode ser Essencial, Não essencial ou Não classificada;
- se for despesa marcada como Não essencial → antes de concluir ↳ **Reflexão antes da compra**;
- **Adicionar comprovante** → câmera/seleção de imagem;
- ativar **recorrência** → **Configurar recorrência**;
- ativar **lembrete de vencimento** → mesma configuração de recorrência/vencimento ou seção associada.

Após salvar com sucesso:
- retorno recomendado → **Lista de transações** ou **Detalhe da transação**.

**Decisão UX recomendada:** retornar para **Detalhe da transação**, pois confirma visualmente o registro e oferece continuidade para editar/reverter. Essa decisão não é exigida pelo requisito.

---

## 4.3 Detalhe da transação

**Tela:** `04_transacao_detalhe.png`

Entradas:
- Lista de transações → item;
- Dashboard → transação recente;
- opcionalmente após criar/salvar uma transação.

Conteúdo exibido:
- dados principais da transação;
- **Anotação**, quando preenchida, como informação complementar separada da descrição;
- tags, método de pagamento, classificação, recibo e recorrência/lembrete quando aplicáveis.

Saídas:
- **Editar** → estado de edição;
- **Reverter transação** ↳ modal de confirmação;
- **Ver recibo** → visualização do comprovante, quando houver;
- voltar → tela anterior.

### Edição da transação

**Decisão UX recomendada:** não criar uma tela visual paralela.

Fluxo:
- Detalhe → **Editar** ↔ a própria tela passa para estado editável, OU reutiliza o mesmo formulário da tela de cadastro já preenchido;
- os campos complementares da US02, incluindo **Anotação**, devem ser carregados com o valor atual e permitir inclusão, alteração ou remoção;
- ação principal muda para **Salvar alterações**;
- cancelar → volta ao modo de leitura.

**Pendente de formalização:** escolher definitivamente entre:
1. edição inline no detalhe; ou
2. reutilização da tela/formulário de cadastro em modo edição.

Para implementação, a opção 2 costuma reduzir duplicação de componentes.

### Reversão

**Estado complementar:** `tela_reverter_transacao.png`

Fluxo:
- Detalhe → **Reverter transação** ↳ confirmação;
- cancelar → volta ao detalhe;
- confirmar → antes da remoção, registra snapshot integral do estado persistido da transação com tipo de operação e data/hora; depois remove a transação dos registros financeiros ativos e atualiza os cálculos.

**Regra:** não criar transação inversa de estorno e não oferecer restauração enquanto isso não existir como requisito.

---

# 5. Categorias e subcategorias

## 5.1 Categorias

**Tela:** `05_categoria_subcategorias.png`

**US principal:** US05.

Entrada recomendada:
- Transações → acesso a categorias/organização;
- alternativamente Perfil/Configurações pode oferecer atalho administrativo.

Fluxo:
- categoria principal → expandir/recolher subcategorias;
- **+ Nova subcategoria** ↳ modal/bottom sheet de criação;
- subcategoria existente → editar/remover, se a implementação incluir essas ações.

**Regra:** categorias principais são predefinidas; usuário cria subcategorias personalizadas.

**Pendente:** tela/modal específico de criar/editar subcategoria ainda precisa de definição visual final.

---

# 6. Planejamento

## 6.1 Entrada do módulo Planejamento

A bottom navigation aponta para **Planejamento**.

A organização definida para este módulo é:

- Orçamento mensal;
- Metas;
- Limites e alertas;
- Gastos livres;
- Planejado x realizado.

A tela `06_orcamento.png` pode funcionar como tela principal/hub operacional do Planejamento, desde que contenha acessos claros para os itens acima.

---

## 6.2 Orçamento mensal

**Tela:** `06_orcamento.png`

**US principal:** US06.

Entradas:
- bottom nav → Planejamento → Orçamento;
- ou Planejamento abrir diretamente essa visão.

Saídas:
- **Limites e alertas** → `07_planejamento_limites_alertas.png`;
- **Gastos livres** → `08_planejamento_gastos_livres.png`;
- **Planejado x realizado** → `09_planejamento_planejado_realizado.png`;
- **Metas** → `10_metas_lista.png`.

**Regra de estado do orçamento por categoria:**
- abaixo de 75% → normal;
- de 75% até 100% → próximo do limite;
- acima de 100% → limite excedido.

---

## 6.3 Limites e alertas

**Tela:** `07_planejamento_limites_alertas.png`

**US principal:** US29.

Entrada:
- Planejamento/Orçamento → **Limites e alertas**.

Fluxo:
- configurar limite diário;
- configurar limites por categoria;
- selecionar canal Push/E-mail;
- **Salvar configurações** → retorna ao Planejamento/Orçamento.

**Regras confirmadas:**
- limite diário reinicia diariamente;
- limites/regras de categoria são dinâmicos e definidos pelo usuário;
- cada regra deve registrar explicitamente valor/percentual, período e, quando aplicável, base de renda;
- para RF54, usuário pode escolher Push, E-mail ou ambos.

---

## 6.4 Gastos livres

**Tela:** `08_planejamento_gastos_livres.png`

**US principal:** US45.

Entrada:
- Planejamento/Orçamento → **Gastos livres**.

Fluxo:
- visualizar cota mensal;
- visualizar utilizado/restante;
- alterar valor da cota;
- **Salvar cota** → retorna ao Planejamento.

**Regra confirmada:**
- uma despesa só consome a cota quando o usuário marca explicitamente **Contabilizar como gasto livre** no cadastro/edição;
- ela pode permanecer sem categoria;
- continua sendo despesa normal para saldo e totais gerais;
- despesa sem categoria que não foi marcada como gasto livre não consome essa cota.

---

## 6.5 Planejado x realizado

**Tela:** `09_planejamento_planejado_realizado.png`

**US principal:** US40.

Entrada:
- Planejamento/Orçamento → **Planejado x realizado**.

Fluxo:
- selecionar período;
- visualizar total planejado;
- visualizar realizado;
- visualizar diferença;
- visualizar contribuição por categoria;
- voltar → Planejamento/Orçamento.

Esta tela é de **análise do orçamento**, por isso permanece dentro de Planejamento e não como destino principal da aba Relatórios.

---

# 7. Metas

## 7.1 Lista de metas

**Tela:** `10_metas_lista.png`

**US principal:** US10.

Entrada:
- Planejamento → **Metas**.

Saídas:
- tocar em uma meta → **Detalhe da meta**;
- **+ Nova meta** → **Criar meta**.

---

## 7.2 Criar meta

**Tela:** `11_meta_criar.png`

Fluxo:
- Metas → **Nova meta**;
- preencher nome, valor-alvo, data-limite e frequência da sugestão;
- sistema calcula sugestão diária/semanal;
- **Criar meta** → recomendado retornar para **Detalhe da meta criada**.

**Regra:** sugestão é calculada com base no valor restante e tempo restante; não deve ser valor fixo de mock na implementação real.

---

## 7.3 Detalhe da meta

**Tela:** `12_meta_detalhes.png`

Entrada:
- Lista de metas → meta;
- opcionalmente após criação.

Saídas:
- **Registrar aporte** ↳ bottom sheet;
- **Editar meta** → modo/formulário de edição;
- voltar → lista de metas.

### Registrar aporte

**Estado complementar:** `tela-aporte-meta.png`

Fluxo:
- Detalhe da meta → Registrar aporte ↳ bottom sheet;
- informar valor/data;
- confirmar → atualiza progresso da meta e retorna ao detalhe.

**Regras:**
- aportes pertencem ao módulo de metas e não são automaticamente despesas/transações comuns;
- sugestão diária/semanal = valor restante ÷ dias/semanas restantes;
- se a data-limite expirar sem atingir a meta, informar que não foi cumprida e o valor faltante;
- o usuário pode alterar a data-limite para continuar, e a sugestão é recalculada.

---

# 8. Reflexão antes da compra

## 8.1 Reflexão

**Tela:** `17_reflexao_compra.png`

**US principal:** US12.

Entrada:
- Nova transação → salvar uma compra/despesa classificada como não essencial.

Saídas:
- **Finalizar mesmo assim** → registra a transação;
- **Colocar em reflexão** → envia item para lista/período de espera;
- **Voltar e revisar** → retorna ao cadastro da transação.

**Regras confirmadas:**
- somente despesa explicitamente classificada como Não essencial dispara esse fluxo;
- duração padrão do período de reflexão = 48 horas;
- usuário pode alterar a duração;
- a opção de compra permanece indisponível até o horário de liberação.

**Pendente apenas de UX:** uma tela/lista de itens em reflexão ainda não foi finalizada.

---

# 9. Recorrência e lembretes

## 9.1 Configuração de recorrência

**Tela:** `18_recorrencia_configuracao.png`

**US principal:** US24.

Entrada:
- Nova/Editar transação → ativar recorrência ou lembrete.

Fluxo:
- configurar frequência;
- configurar próxima ocorrência;
- configurar término, quando aplicável;
- configurar lembrete/vencimento;
- **Salvar configuração** → retorna ao formulário da transação.

Depois, ao salvar a transação:
- ocorrência futura aparece como prevista;
- antes da data prevista não afeta saldo atual;
- cada recorrência gera uma ocorrência uma única vez na data configurada;
- na data configurada a ocorrência passa a compor o extrato/cálculos;
- editar ou cancelar a recorrência afeta somente ocorrências futuras;
- ocorrências já efetivadas permanecem no histórico.

---

# 10. Relatórios

## 10.1 Relatórios

**Tela:** `13_relatorios.png`

**US principais:** US13 e US14.

Entrada:
- bottom nav → **Relatórios**.

Fluxo:
- selecionar período;
- visualizar gráficos por categoria/período;
- **Exportar dados** ↳ bottom sheet de exportação.

### Exportação

**Estado complementar:** `tela_exportar_relatorio.png`

Fluxo:
- Relatórios → Exportar dados ↳ bottom sheet;
- selecionar CSV ou formato compatível com Excel;
- selecionar/confirmar período;
- **Exportar** → gerar arquivo;
- fechar → retorna a Relatórios.

---

# 11. Segurança e configurações

## 11.1 Configurações de segurança

**Tela:** `16_seguranca_config.png`

**US principal:** US37.

Entrada recomendada:
- avatar → Perfil/Configurações → Segurança.

Fluxo:
- ativar/desativar biometria;
- configurar/alterar PIN;
- escolher preferência de desbloqueio;
- salvar ou aplicar imediatamente, conforme implementação.

Saída:
- voltar → Perfil/Configurações.

**Importante:** esta tela configura proteção local. Não substitui login/autenticação da conta.

---

# 12. Mapa resumido de navegação

```text
ABERTURA
└── Boas-vindas (US60)
    ├── Entrar ↳ Login por e-mail + senha
    │   ├── [múltiplos perfis] → Seleção de perfil → Início
    │   └── [perfil único] → Início
    └── Criar conta ↳ Nome + e-mail único + senha
        └── Criar primeiro perfil automaticamente (BRL / R$0) → Início

BLOQUEIO LOCAL
└── Biometria ↔ PIN
    └── Início

BOTTOM NAV
├── Início
│   └── Dashboard
│       ├── Transação recente → Detalhe da transação
│       ├── Meta → Detalhe da meta
│       └── Avatar → Perfil/Configurações
│
├── Transações
│   └── Lista
│       ├── Item → Detalhe
│       │   ├── Editar → Estado/Formulário de edição
│       │   └── Reverter ↳ Confirmação de reversão
│       └── Filtro ↳ Filtros avançados
│
├── +
│   └── Nova transação
│       ├── [gasto livre] → marcar explicitamente para consumir cota
│       ├── Recorrência → Configurar recorrência
│       ├── Comprovante → Câmera/arquivo
│       └── Compra não essencial → Reflexão
│
├── Planejamento
│   ├── Orçamento
│   ├── Limites e alertas
│   ├── Gastos livres
│   ├── Planejado x realizado
│   └── Metas
│       ├── Nova meta
│       └── Detalhe da meta
│           └── Registrar aporte ↳ Bottom sheet
│
└── Relatórios
    └── Relatórios gráficos
        └── Exportar ↳ CSV / Excel

PERFIL / CONFIGURAÇÕES
└── Segurança
    ├── Biometria
    └── PIN
```

---

# 13. Decisões de UX ainda pendentes

As regras de negócio da Sprint 1 estão consolidadas. Permanecem somente decisões de experiência/navegação que podem ser fechadas durante o refinamento da respectiva US:

1. **Edição de transação:** confirmar se será inline no detalhe ou reutilização do formulário de cadastro em modo edição.
2. **Após criar transação:** confirmar se retorna para lista ou abre detalhe; recomendação atual: detalhe.
3. **Após criar meta:** confirmar retorno; recomendação atual: detalhe da meta criada.
4. **Itens em reflexão:** definir a tela/lista de espera e o ponto de acesso até ela.
5. **Perfil/Configurações:** definir a tela-hub formal para concentrar Segurança e futuras configurações.
6. **Subcategorias:** finalizar a apresentação visual do modal/tela de criar/editar subcategoria.

Nenhum desses itens deve ser transformado em nova regra de negócio sem necessidade.

---

# 14. Regra para desenvolvimento

Ao implementar uma tela, a navegação deve respeitar:

**Requisito → User Story → Tela de entrada → Ação → Tela/estado de destino → Regra de negócio → Teste de navegação.**

Exemplo:

```text
RF13
→ US03
→ Lista de transações
→ tocar em filtro
→ Bottom sheet de filtros
→ aplicar filtros
→ lista atualizada
→ teste: somente transações que atendem aos critérios permanecem visíveis
```

Esse documento deve ser atualizado sempre que uma decisão de navegação for alterada.
