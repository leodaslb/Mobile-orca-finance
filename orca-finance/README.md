# Orca Finance Mobile

React Native/Expo Router. Cadastro/login, sessão, perfil ativo, transações, edição/reversão e dashboard usam a API REST real. Planejamento mensal, cota de gastos livres, limites, metas/aportes, relatórios e exportação CSV/XLSX também usam a API real.

## Executar com o backend local

1. Em `backend/`, mantenha o ambiente existente e execute `npm run start:dev`.
2. Em `orca-finance/`, copie `.env.example` para `.env` se ainda não existir. Para Android Emulator, use `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000`. Em dispositivo físico, use o IP da máquina na mesma rede.
3. Execute `npm start` e abra no Android/Expo Go. Reinicie o Metro após mudar variáveis de ambiente.
4. Entre com uma conta real já cadastrada ou crie uma conta pela tela de entrada. Não existe fallback para as credenciais mock.

A API local escuta em `0.0.0.0`. Sessão fica em memória: reiniciar o app exige novo login, sem refresh token. PIN/biometria protegem o acesso local separadamente: PIN com salt/hash no SecureStore e biometria pelo Android. Falha ou cancelamento não desbloqueiam o app. Expo Web ainda depende de configuração CORS no backend.

## Verificações

```sh
npm run check
npm test
npx expo export --platform android --output-dir .expo/integration-build
```

Para testar os services contra o Neon já configurado, prepare o backend com `npm run prisma:generate` e `npm run build`, depois execute no mobile:

```sh
npm run test:api:neon
npm run test:integration2:neon
```

O teste inicia uma API temporária com schedulers desativados, cria contas exclusivas e limpa somente suas fixtures. Não usa a conta Leonardo nem apaga os dados de demonstração populados para ela.

O mobile ainda não tem configuração de ESLint. A rastreabilidade por US, endpoints, arquivos, testes, diferenças de contrato e pendências estão em [INTEGRACAO_API.md](INTEGRACAO_API.md).

Exportação Android salva o arquivo real pelo seletor de pasta do sistema. CSV e XLSX mantêm os bytes devolvidos pelo backend; não há exportação PDF nesta US. O módulo `expo-file-system` já instalado pelo Expo passou a ser uma dependência direta para esse uso.

Orçamento, cota, regras e relatórios respeitam o calendário UTC do contrato atual. Metas usam DATE puro; aportes enviam timestamp convertido do dia local. Limites percentuais/base de renda e histórico individual de aportes ainda não têm contrato HTTP nesta versão. Consulte [INTEGRACAO_BLOCO2.md](INTEGRACAO_BLOCO2.md) para detalhes.

## Fechamento da Sprint 1

Consulte [STATUS_FINAL_SPRINT1.md](STATUS_FINAL_SPRINT1.md) para o status das 18 histórias, rastreabilidade, evidências, pendências e roteiro de apresentação. Subcategorias permitem criar/editar/desativar/reativar. Perfil e configurações dá acesso à lista de recorrências e lembretes: frequência semanal/mensal/anual, término, edição futura e cancelamento. Recibos são fotografados ou escolhidos da galeria e enviados como JPEG/PNG até 5 MiB. Anexos antigos continuam disponíveis; criação por URL foi removida. O upload real depende da configuração privada do Cloudinary no backend.

Os PNGs de `../docs/telas/` orientam a apresentação, preservando Manrope/tokens/cores planas e as RN consolidadas. Mocks estão separados em services explícitos de teste e não são alcançados pelas rotas do app. `npm test` inclui verificações de persistência local, mutações e respostas atrasadas. O projeto mobile não tem ESLint configurado; o script padrão `lint` não constitui validação executada.

Ainda não estão completos: conversão/finalização de reflexão, upload físico e entrega remota de notificações. A validação de biometria deve distinguir sucesso em hardware real de testes dos adapters nativos substituídos. A conta e os dados existentes no Neon foram preservados; os testes usam somente suas próprias fixtures.

Correções finais: [recuperação após interrupção](RECUPERACAO_INTERRUPCAO.md), [registro do bloco anterior](FECHAMENTO_MOBILE.md) e [decisões](../docs/Orca_Finance_Fechamento_Mobile.md). Histórico de aportes usa GET/POST sob a meta; Gastos por categoria permite trocar o mês; ícones das sete categorias usam um mapper central. US12 permite confirmar após espera, preenchendo novamente a compra com apenas a descrição reaproveitada, ou desistir sem lançamento.
