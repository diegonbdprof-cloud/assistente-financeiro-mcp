# OpenSpec — Assistente financeiro de estudos, Etapa 1

Este arquivo descreve o comportamento implementado neste repositório. Foi escrito aqui, junto com o código. Não é um export do Lovable e não substitui o PDF do curso. A Etapa 2 não faz parte desta especificação.

## Objetivo

Uma página estática, em português, centrada num chat. Ela responde perguntas sobre uma amostra local e fictícia, com cálculo determinístico, e deixa visível de onde cada número saiu.

## Fora de escopo

- credencial, login, formulário de cartão, senha ou dado pessoal
- pagamento, transferência executada ou qualquer escrita financeira
- chamada de rede a banco, Plaid, Pluggy ou MCP
- modelo generativo e atraso que imite um modelo
- conversão cambial
- publicação automática
- reconstrução dos 48 lançamentos ou das 14 contas citados no material

## Dados

### REQ-DADO-01 — Saldos do guia

A página expõe só estas quatro contas, com os centavos abaixo, origem “guia, página 26”:

- `acc_checking`: atual 11000, disponível 10000, papel dinheiro
- `acc_saving`: atual 21000, disponível 20000, papel dinheiro
- `acc_credit`: atual 41000, disponível nulo, papel dívida
- `acc_business_credit`: atual 502000, disponível 498000, papel dívida; o disponível é crédito restante

#### Cenário: leitura fiel

- Dado a amostra congelada
- Quando a pessoa pede os saldos
- Então a corrente mostra US$ 110,00 e US$ 100,00
- E o cartão pessoal mostra dívida US$ 410,00 e crédito disponível “Não informado”
- E o cartão empresarial mostra dívida US$ 5.020,00 e crédito disponível US$ 4.980,00

### REQ-DADO-02 — Lançamentos autorais

Há 16 lançamentos em `src/data/fixture.js`, ids `txn_fx_01` a `txn_fx_16`, datas civis de 2026-10-03 a 2026-11-01, todos com `origin` `fixture-autoral`. Nenhum pertence à janela 2026-06-28 a 2026-09-25.

### REQ-DADO-03 — Data de referência

A data de referência é 2026-11-01 no fuso civil `America/Sao_Paulo`. O relógio do dispositivo não altera período, ordenação nem saldo.

## Dinheiro

### REQ-DIM-01 — Centavos inteiros

Todo valor monetário persistido é inteiro, em centavos, ou `null`. A formatação pt-BR de USD usa `US$` e vírgula decimal. `null` vira “Não informado”, nunca zero.

### REQ-DIM-02 — Sinal

Centavo positivo é saída. Centavo negativo é entrada. A interface mostra a palavra Saída ou Entrada e o módulo, e a memória mostra o inteiro com sinal.

### REQ-DIM-03 — Papéis separados

A soma de dinheiro usa só contas de depósito. A soma de dívida usa só cartões. Crédito disponível não é dinheiro. Limite implícito só existe quando dívida e crédito disponível são ambos inteiros: a soma dos dois. Nulo não entra como zero.

#### Cenário: não somar dívida ao caixa

- Quando a pessoa pede os saldos de todas as contas
- Então o dinheiro atual é US$ 320,00
- E a dívida é US$ 5.430,00
- E a resposta não contém US$ 5.750,00 nem US$ 5.280,00

## Lançamentos e filtros

### REQ-MOV-01 — Consumo

Consumo confirmado é lançamento `spend`, valor positivo, não pendente. Transferência, pagamento de cartão, renda e pendência ficam de fora dessa soma e aparecem com motivo.

### REQ-MOV-02 — Ordenação

A lista recente ordena por data civil descendente e, na mesma data, por id descendente. O padrão é cinco itens. A soma dessa resposta usa só as linhas exibidas que entram na regra do título, e a memória diz que a amostra é maior.

#### Cenário: cinco mais recentes

- Quando a pessoa pede as últimas transações
- Então os ids exibidos, nesta ordem, são `txn_fx_16`, `txn_fx_15`, `txn_fx_12`, `txn_fx_14`, `txn_fx_11`

### REQ-MOV-03 — Filtros

Conta, categoria e período podem ser combinados quando a frase identifica cada um. O período é inclusivo nas duas pontas. “Cartão” sem pessoal ou empresarial não escolhe conta. Conta desconhecida não ganha saldo inventado.

### REQ-MOV-04 — Memória

Para cada soma, os ids incluídos mais os ids excluídos cobrem a população daquela conta (contas `acc_*` ou lançamentos `txn_fx_*`). A fórmula em centavos, refeita sobre os incluídos, é igual ao total mostrado.

## Conversa

### REQ-CHAT-01 — Avisos permanentes

A página mostra, o tempo todo:

- `Demonstração · Dados fictícios locais`
- a data de referência
- `Respostas por regras locais. Sem IA generativa ou MCP conectado.`

### REQ-CHAT-02 — Envio

Enter envia. Shift+Enter insere nova linha. Conteúdo vazio não cria mensagem e explica o motivo. Há estado de conjunto vazio e estado de erro sem alterar a amostra.

### REQ-CHAT-03 — Histórico

Nova conversa preserva a anterior na lista local. O armazenamento, se existir, usa o esquema `afs-diego-v1`. Estado inválido é descartado com um aviso. A amostra não é lida desse armazenamento.

### REQ-CHAT-04 — Texto seguro

Pergunta e resposta entram no DOM como texto. Não há `innerHTML` no código da interface. Sequência longa de dígitos ou menção a senha, CPF ou CVV não é gravada no histórico.

### REQ-CHAT-05 — Recusa honesta

Negação não aplicada, previsão, câmbio, conexão, mutação e frase sem regra caem em esclarecimento ou recusa, sem `US$` e sem `R$`.

#### Cenário: saldo não

- Quando a pessoa envia `saldo não`
- Então a resposta não contém valor em dólares
- E os centavos das contas continuam os da fixture

## Interface

### REQ-UI-01 — Chat, não landing

A primeira vista é o fio da conversa, com campo e sugestões que disparam as mesmas regras. As sugestões iniciais são Contas, Saldos, Últimas transações, Alimentação e Resumo.

### REQ-UI-02 — Largura

Em 320, 390 e 1440 px de largura, depois de uma resposta longa, a página não ganha rolagem horizontal.

### REQ-UI-03 — Build

O build usa `base` relativo. Os assets de `dist/index.html` resolvem dentro de `dist/` e também quando o diretório é servido em `/assistente-financeiro-mcp/`.

## Verificação

Os cenários numéricos têm teste automático em `tests/unit`. Os cenários de teclado, largura, HTML, fuso e build têm teste em `tests/ui`. A checagem axe registrada no teste de interface não é certificação.
