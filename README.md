# Assistente financeiro de estudos — Diego

Laboratório acadêmico em português, no formato de um chat. A página calcula com regras locais sobre uma amostra pequena e fictícia em dólares. Não é um banco, não movimenta dinheiro e não está ligada a Plaid, Pluggy, MCP ou a um modelo generativo.

Isto é a **Etapa 1** apenas: dados locais, sem credenciais. A Etapa 2 (backend que consultaria um sandbox) **não foi construída**. Esta entrega é uma alternativa em código. Não houve uso nem exportação do Lovable, e o prompt de referência deste repositório **não foi enviado** ao Lovable. A aceitação externa do trabalho, no curso ou em outro lugar, não está garantida. A publicação da página está **pendente**. Este texto não afirma que o desafio esteja completo nem que exista integração pronta.

## Como executar

Requer Node.js 20 ou superior. Não há serviço externo.

```bash
npm install
npm test
npm run build
npm run check:dist
npm run test:ui
npm run dev
```

`npm run dev` sobe a página em `http://127.0.0.1:5173/`.

O build gera `dist/` com caminhos relativos (`./assets/...`, `./favicon.svg`). Para ver o mesmo artefato no prefixo de um site de projeto:

```bash
npm run build
node scripts/serve-subpath.mjs
```

A página fica em `http://127.0.0.1:4173/assistente-financeiro-mcp/`. Esse endereço é só o preview local. Não é uma URL pública.

Os testes de interface instalam o Chromium do Playwright na primeira vez (`npx playwright install chromium`) e repetem o build antes de abrir o navegador.

## Marca

O material do curso deixa o nome desfocado e sugere um verde profundo, fundo claro e um monograma. Aqui a marca é autoral: **Assistente financeiro de estudos — Diego**, monograma **D**. Não é a marca de uma instituição financeira e não herda um monograma de banco. O verde (`#0e3b32`) e o papel (`#f3f0e8`) são uma escolha editorial deste repositório. Não há fonte nem ícone baixado de terceiros; a página usa a pilha de fontes do sistema.

## O que a página responde

O chat interpreta a frase com regras explícitas e calcula em código, em centavos inteiros. Não há espera artificial. Uma pergunta fora das regras recebe um esclarecimento ou uma recusa, sem número inventado.

Pedidos cobertos pelos botões e por frases próximas:

- contas da amostra
- saldos, com dinheiro, dívida e limite em separado
- últimas transações (cinco, se a frase não disser outro número de 1 a 50)
- uma categoria: alimentação, transporte, lazer, saúde, renda ou escritório
- transferências
- pendências
- resumo do recorte
- filtros por conta e por período, quando a frase é clara

Exemplos que funcionam: `Saldos`, `saldo da poupança`, `saldo do cartão empresarial`, `Alimentação`, `transações de alimentação da conta corrente em outubro de 2026`, `Últimas transações`, `transações dos últimos 7 dias`, `pendências`, `Transferências`, `Resumo`.

A data de referência da amostra é **01/11/2026**, fuso civil `America/Sao_Paulo`. “Hoje”, “este mês” e “últimos N dias” usam essa data, não o relógio do computador. “Últimos N dias” inclui o dia de referência e os N−1 dias anteriores.

Períodos aceitos: um mês (`outubro de 2026`), um dia (`no dia 03/10/2026`), um intervalo inclusivo (`entre 01/10/2026 e 05/10/2026`) e as expressões acima. Duas indicações de período, data impossível ou intervalo invertido não geram extrato.

Enter envia. Shift+Enter quebra a linha. Texto vazio ou só com espaços não é enviado. “Nova conversa” arquiva a atual e abre outra. O histórico, quando o navegador permite, fica em `localStorage` no esquema `afs-diego-v1`. Dá para apagar só esse histórico. A amostra não muda.

## Origem de cada dado

Arquivo único: `src/data/fixture.js`, identificador `fixture-autoral-diego-v1`.

### Saldos — transcrição do guia, página 26

Quatro contas de exemplo, em USD. Os nomes “Plaid” são os rótulos dessa página do guia. Não há Item, `access_token` nem consulta à API. “First Platypus Bank” não foi usado: o material analisado não confirma esse nome na página 17 do guia.

| Registro | Nome no guia | Papel nesta página | Atual | Disponível |
| --- | --- | --- | --- | --- |
| `acc_checking` | Plaid Checking | dinheiro em conta | US$ 110,00 (11000 centavos) | US$ 100,00 (10000), dinheiro |
| `acc_saving` | Plaid Saving | dinheiro em conta | US$ 210,00 (21000) | US$ 200,00 (20000), dinheiro |
| `acc_credit` | Plaid Credit Card | dívida de cartão | US$ 410,00 (41000) | não informado (`null`) |
| `acc_business_credit` | Plaid Business Credit Card | dívida de cartão | US$ 5.020,00 (502000) | US$ 4.980,00 (498000), crédito restante |

Dinheiro (saldo atual) = 11000 + 21000 = **32000** centavos (US$ 320,00).  
Dinheiro disponível = 10000 + 20000 = **30000** (US$ 300,00).  
Dívida = 41000 + 502000 = **543000** (US$ 5.430,00).  
A dívida não entra no dinheiro. Somar tudo em um “patrimônio” de US$ 5.750,00 seria um erro e a página não faz isso.  
O crédito disponível informado é só o do cartão empresarial (498000). O cartão pessoal continua nulo. Não há soma fechada de limites.  
O limite implícito do cartão empresarial é 502000 + 498000 = **1000000** (US$ 10.000,00). É uma conta sobre os dois campos preenchidos, não um quinto dado do guia. No cartão pessoal o limite implícito fica “Não informado”.

A diferença entre saldo atual e disponível (US$ 10,00 na corrente e na poupança) vem do guia. Os lançamentos abaixo **não explicam** essa diferença e **não fecham** o saldo.

### Lançamentos — fixture autoral

O guia, na página 29, deixa claro que o PDF não traz os 48 registros individuais. As páginas 20–22 mostram outra escala (14 contas, cinco movimentos recentes e agregados de 28/06/2026 a 25/09/2026). Nada disso foi reconstruído. Não houve download Plaid.

Estes 16 lançamentos foram escritos para este repositório. São fictícios, posteriores àquela janela (03/10/2026 a 01/11/2026) e marcados `origin: "fixture-autoral"`. Valor positivo, no jeito Plaid, é saída; valor negativo é entrada. Pendência não entra na soma confirmada. Transferência e pagamento de cartão não são consumo.

| Registro | Data civil | Conta | Centavos | Situação | Natureza | Categoria | Descrição |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `txn_fx_01` | 2026-10-03 | corrente | −250000 | confirmada | renda | renda | Depósito salarial fictício — Estúdio Aurora |
| `txn_fx_02` | 2026-10-05 | corrente | 1860 | confirmada | consumo | alimentação | Padaria Solar — pão e café |
| `txn_fx_03` | 2026-10-11 | corrente | 2500 | confirmada | consumo | lazer | Livraria da Praça — caderno |
| `txn_fx_04` | 2026-10-12 | corrente | 450 | confirmada | consumo | transporte | Metrô Linha Verde — bilhete |
| `txn_fx_05` | 2026-10-15 | corrente | 5000 | confirmada | transferência | transferência | para a poupança, par `par_fx_01` |
| `txn_fx_06` | 2026-10-15 | poupança | −5000 | confirmada | transferência | transferência | vinda da corrente, par `par_fx_01` |
| `txn_fx_07` | 2026-10-18 | cartão pessoal | 4290 | confirmada | consumo | alimentação | Restaurante Vila Nova — almoço |
| `txn_fx_08` | 2026-10-20 | poupança | −75 | confirmada | renda | renda | Rendimento fictício da poupança |
| `txn_fx_09` | 2026-10-22 | cartão pessoal | 6400 | confirmada | consumo | saúde | Farmácia Norte — item fictício |
| `txn_fx_10` | 2026-10-22 | corrente | 10000 | confirmada | pagamento de cartão | pagamento de cartão | par `par_fx_02` |
| `txn_fx_11` | 2026-10-22 | cartão pessoal | −10000 | confirmada | pagamento de cartão | pagamento de cartão | par `par_fx_02` |
| `txn_fx_12` | 2026-10-28 | corrente | 7320 | confirmada | consumo | alimentação | Mercado Limoeiro |
| `txn_fx_13` | 2026-10-09 | cartão empresarial | 12840 | confirmada | consumo | escritório | Papelaria Oficina — material fictício |
| `txn_fx_14` | 2026-10-25 | cartão empresarial | 3100 | confirmada | consumo | alimentação | Cantina do Porto — almoço de equipe fictício |
| `txn_fx_15` | 2026-11-01 | corrente | 1590 | pendente | consumo | alimentação | Lanchonete do Campus — autorização pendente |
| `txn_fx_16` | 2026-11-01 | cartão empresarial | 2200 | pendente | consumo | escritório | Revista de Estudos — assinatura ainda pendente |

Contas conferidas pelos testes, sempre a partir desses registros:

- consumo confirmado da amostra inteira: **38760** centavos (US$ 387,60)
- alimentação confirmada: `txn_fx_02`, `txn_fx_07`, `txn_fx_12`, `txn_fx_14` = **16570** (US$ 165,70); pendência à parte `txn_fx_15` = **1590** (US$ 15,90)
- alimentação da corrente em outubro de 2026: `txn_fx_02` + `txn_fx_12` = **9180** (US$ 91,80)
- cinco mais recentes, data descendente e id descendente no empate: `txn_fx_16`, `txn_fx_15`, `txn_fx_12`, `txn_fx_14`, `txn_fx_11`
- transferências: `txn_fx_05` + `txn_fx_06` = **0**, e não entram no consumo
- pendências: `txn_fx_15` + `txn_fx_16` = **3790** (US$ 37,90)
- últimos 7 dias civis até 01/11/2026: `txn_fx_12`, `txn_fx_15`, `txn_fx_16`

Não há conversão para real. “Não informado” é o texto de `null`. Não existe valor em BRL na amostra.

## Memória de cálculo

Toda resposta numérica mostra a fonte (`src/data/fixture.js`), o identificador da fixture, a data de referência, o período, os filtros, a quantidade na amostra, a quantidade após o filtro, os ids incluídos na soma, os ids de fora com o motivo, e a fórmula em centavos. A soma exibida é a soma desses ids, não um total paralelo. Saldos de conta citam os ids `acc_*` e declaram que nenhum lançamento entrou na conta.

O objeto da fixture é congelado. Não há função de pagamento, transferência ou alteração de saldo. Pedidos como “transferir” ou “pagar” são recusados e a assinatura dos valores permanece a mesma.

## O que a página não faz

- não inventa saldo, data, categoria ou lançamento para preencher um filtro vazio
- não trata “saldo não” como pedido de saldo; a negativa pede esclarecimento e não mostra valor
- não escolhe um cartão quando a frase diz só “cartão”: há dois, e a página pergunta qual
- não responde conta ausente, previsão, câmbio, “tempo real” ou pedido de conexão
- não guarda no histórico frase com a palavra senha, CPF, CVV ou uma sequência de 13 a 19 dígitos
- não interpreta HTML da pergunta: o texto entra com `textContent`
- não chama `fetch`, não abre WebSocket e não contém URL da Plaid ou da Pluggy no código da interface

O conjunto vazio é uma resposta válida: “Nenhuma transação da amostra cai nesse filtro.” O erro de cálculo, se ocorrer, diz que a amostra não foi alterada. Não há indicador de espera longa porque a conta é síncrona.

## Arquitetura desta página

```text
pergunta
  → src/engine/parse.js        (intenção, conta, categoria, período)
  → src/engine/answer.js       (texto e memória)
  → src/engine/ledger.js       (filtro, ordenação, somas)
  → src/engine/money.js        (centavos inteiros)
  → src/data/fixture.js
  → src/ui/render.js           (DOM, sem HTML da pessoa)
```

Nada disso sai do navegador. O histórico opcional usa `localStorage` e é validado de novo ao reabrir (`src/engine/storage.js`). Esquema diferente, JSON ilegível ou chave proibida (`__proto__`, `prototype`, `constructor`) faz o histórico ser descartado. A amostra não depende dele.

## Caminho futuro, não percorrido

O material do curso separa a Etapa 1 da Etapa 2. A Etapa 2, descrita no guia na página 27, seria: o backend entende a intenção, consulta a Plaid, calcula e o frontend apresenta. Segredos ficariam só no servidor (`PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ACCESS_TOKEN`), nunca no navegador, em variável pública ou no chat. Esse backend **não existe neste repositório**. Um MCP configurado no editor de código **não se liga sozinho** a esta página.

Também não foi executado nenhum servidor MCP, `uvx` ou pacote `mcp-server-plaid`. As notas abaixo são configuração para uma pessoa ler mais tarde. Não são o estado desta aplicação.

### Pluggy — MCP de documentação

Fonte: slide 12 e guia, páginas 5 a 10. Transporte remoto Streamable HTTP, sem chave e sem cabeçalho, só para a documentação:

```text
https://mcp.pluggy.ai/mcp
```

Credenciais da API de dados da Pluggy são outra coisa e não são usadas aqui. O guia lembra salvar, reiniciar e abrir conversa nova no cliente MCP, além de conferir o caminho `/mcp`, antes de tratar uma chamada como feita. Isso não foi feito nesta entrega.

No modelo do material, um Item (uma conexão) tem contas, e contas têm transações. São objetos de API, não um extrato entregue a esta página. Pluggy não envia dados à Plaid. Pluggy não é o produtor dos números do chat.

### Plaid — MCP local, só documentado

Fonte: slides 17 e 18 e guia, páginas 11 a 19. Transporte stdio. O comando deve ser o caminho absoluto que `command -v uvx` devolver na máquina de quem for executar. O argumento é `mcp-server-plaid`. Não copiamos um caminho de Mac do material.

O slide 17 coloca as chaves em flags `--client-id` e `--secret`. O guia, páginas 14 e 15, coloca as mesmas chaves em variável de ambiente. **Este repositório documenta o modo do guia, por ambiente.** Flag entra em histórico de shell e em lista de processos. Ambiente, ainda assim, só deveria existir fora do git e fora do navegador. O guia cita `startup_timeout_sec = 60` como opcional.

Exemplo de forma, sem valores:

```json
{
  "mcpServers": {
    "pluggy-docs": {
      "url": "https://mcp.pluggy.ai/mcp"
    },
    "plaid-sandbox": {
      "command": "uvx",
      "args": ["mcp-server-plaid"],
      "env": {
        "PLAID_CLIENT_ID": "",
        "PLAID_SECRET": ""
      }
    }
  }
}
```

Substituir `uvx` pelo caminho absoluto local, se o cliente MCP exigir. Deixar as variáveis vazias até existir uma etapa de servidor. O arquivo [`.env.example`](.env.example) repete os nomes, vazios. `.env` está no `.gitignore`. Não há exemplo de token com aparência de segredo.

Se um dia esse processo existisse, o caminho esperado no material (guia, página 19) seria HTTPS só em `https://sandbox.plaid.com`, com `POST /accounts/get` e `POST /transactions/get`, janela inclusiva de até 90 dias, datas explícitas, paginação `count` / `offset` / `total_transactions`, todas as contas, e no máximo algumas observações fundadas no que voltou. `/accounts/get` não promete tempo real. Plaid, nesse laboratório, é um sandbox internacional, não Open Finance brasileiro. `item_id` não é `access_token`. Nenhum desses pedidos foi feito daqui.

### Etapa 2, se alguém for construí-la depois

```text
navegador → backend próprio (segredos só no servidor) → sandbox.plaid.com → cálculo → navegador
```

Continua valendo: sandbox, paginação, falha com poucas tentativas, sem webhook no começo, e avaliar `/transactions/sync` só para uso contínuo. A página não deve dizer “Conectado” sem essa integração existir. Este repositório não a tem.

### Notas de erro do material, para essa etapa futura

O guia, página 23, lista situações de ambiente MCP: `uv` ou `uvx` ausente, cliente sem ferramentas até reiniciar, filtro Pluggy no singular `Transaction`, TOML com aspas ou seção duplicada, chave de sandbox recusada, `PRODUCT_NOT_READY` com espera curta e no máximo três tentativas, falha de rede, token perdido. Nada disso ocorreu aqui, porque o pacote não foi executado. Se ocorrer no futuro, a mensagem para a pessoa deve ser sanitizada e não pode ser substituída por um extrato imaginado.

## Especificação e prompt

- [docs/openspec.md](docs/openspec.md) — especificação do que este repositório implementa, escrita aqui.
- [docs/prompt-referencia.md](docs/prompt-referencia.md) — prompt de referência, também escrito aqui. Não foi enviado ao Lovable e não houve exportação de lá.

O guia, páginas 25 e 28, orienta escrever a especificação no Lovable e revisar sem publicação automática. O PDF não comprova que isso tenha sido feito. Este repositório segue outro caminho, em código, e declara a divergência.

## O que foi além do mínimo da Etapa 1

- filtros combináveis de conta, categoria e período, com a lista de ids que de fato entraram na soma
- pendência, transferência e pagamento de cartão fora do consumo
- centavos inteiros e datas civis que não dependem do fuso do computador
- recusa de negativa ambígua (“saldo não”) em vez de um gatilho por substring
- histórico local com esquema versionado e validação
- texto da pessoa inserido só como texto, sem HTML

## Testes desta implementação

Executados neste ambiente em 8 de novembro de 2026:

| Comando | Resultado |
| --- | --- |
| `npm test` | 5 arquivos, 38 testes, todos passaram |
| `TZ=America/Sao_Paulo npm test` | os mesmos 38 passaram |
| `TZ=Pacific/Kiritimati npm test` | os mesmos 38 passaram |
| `npm run build` e `npm run check:dist` | `dist/index.html` com `./assets/...` e `./favicon.svg`; nenhuma URL da Plaid, da Pluggy ou de analytics |
| `npm run test:ui` | 7 testes Playwright passaram |

Os testes de unidade cobrem soma em centavos, sinal Plaid, `null`, separação de dinheiro e dívida, limite implícito só quando os dois campos existem, pendência, transferência, filtros, datas inclusivas, ordenação das cinco mais recentes, agrupamento por categoria, fallback, negativa, conta ambígua, ausência de mutação e rejeição de histórico inválido.

Os testes de navegador cobrem os avisos permanentes, Enter, Shift+Enter, pergunta vazia, sugestão, nova conversa, HTML inerte, ausência de pedido de rede fora de `127.0.0.1`, fuso `Pacific/Kiritimati` sem mudar `01/11/2026`, e largura sem rolagem horizontal em 320, 390 e 1440 px.

O axe-core, no estado com a lista de contas aberta, não apontou violação de impacto `serious` ou `critical`. Isso é uma checagem automática de uma tela, não uma certificação de acessibilidade.

Imagens geradas por esse Playwright, a partir do build servido em `/assistente-financeiro-mcp/`:

- [docs/imagens/desktop-saldos.png](docs/imagens/desktop-saldos.png) — 1440 px, saldos e memória
- [docs/imagens/desktop-transacoes.png](docs/imagens/desktop-transacoes.png) — 1440 px, últimas transações depois dos saldos
- [docs/imagens/mobile-chat.png](docs/imagens/mobile-chat.png) — 390 px, a mesma conversa

## Publicação

A página está pronta para um hospedeiro estático. O `base` do Vite é `./`, então os arquivos de `dist/` funcionam na raiz ou em `/assistente-financeiro-mcp/`, que seria o prefixo de um GitHub Pages de projeto com este nome de repositório.

Nesta execução **não** houve alteração de configuração do repositório, **não** houve ativação de GitHub Pages e **não** há URL pública da aplicação para informar. Publicação: pendente.

## Limitações

- o parser entende frases previstas, não paráfrase livre; na dúvida, ele recusa
- a interface está em português
- dezesseis lançamentos fictícios não são um extrato e não conciliam com os saldos do guia
- não há as 14 contas nem os 48 registros do outro ensaio do material
- o histórico local pode ser apagado pelo navegador e não é backup
- a checagem de acessibilidade não substitui um laudo
- a Etapa 2 e qualquer MCP real continuam fora deste código
