# Prompt de referência

**Este texto foi escrito neste repositório, como registro do que a Etapa 1 pede em código. Não foi enviado ao Lovable. Não houve exportação do Lovable. Não é a mensagem que produziu esta página: a página foi implementada diretamente no código.**

A aceitação desse caminho por um curso ou por outra avaliação externa não está garantida.

---

Construa uma página web em português, centrada num chat, para um laboratório acadêmico chamado “Assistente financeiro de estudos — Diego”. Não faça uma landing page. Use verde profundo, papel claro e o monograma D, e declare que a marca é autoral, sem vínculo bancário.

Aviso permanente, visível o tempo todo: “Demonstração · Dados fictícios locais”. Mostre a data de referência fixa 01/11/2026 (America/São Paulo) e a frase “Respostas por regras locais. Sem IA generativa ou MCP conectado.”

Não peça login, senha, cartão, CPF ou contato. Não execute pagamento nem transferência. Não chame rede, Plaid, Pluggy, MCP ou modelo generativo. Não simule demora de IA. Não converta dólar para real. Não invente saldo, data ou lançamento.

Use só quatro contas, transcritas do exemplo do guia (página 26), em centavos:

- Plaid Checking: atual 11000, disponível 10000, dinheiro
- Plaid Saving: atual 21000, disponível 20000, dinheiro
- Plaid Credit Card: dívida 41000, disponível nulo
- Plaid Business Credit Card: dívida 502000, disponível 498000 como crédito restante, não como dinheiro

Não some dívida com dinheiro. Nulo aparece como “Não informado”, nunca como zero. O limite implícito só é calculado quando os dois campos do cartão existem.

Crie uma fixture pequena, fictícia e autoral, de cerca de 16 lançamentos, com ids estáveis. Não baixe a Plaid e não reconstrua os 48 registros que o PDF não contém. Valor positivo é saída; negativo é entrada. Pendência fica fora do total confirmado. Transferência não é consumo. As transações não precisam fechar o saldo do guia; diga isso.

O chat entende, por regras, contas, saldos, últimas cinco transações, categoria, período, conta, pendências, transferências e resumo. “Saldo não” não pode disparar o saldo por substring. Cartão sem qualificativo pede qual dos dois. Cada número mostra arquivo, ids, período, quantidade e a fórmula em centavos, batendo com as linhas filtradas.

Enter envia, Shift+Enter quebra linha, vazio não envia. Nova conversa e histórico funcionam. Se houver persistência, é só local, com esquema versionado e validação. Renderize texto da pessoa como texto. A página deve caber em 320, 390 e 1440 px sem rolagem horizontal.

Entregue uma página estática com caminhos relativos, pronta para um hospedeiro, sem declarar URL pública antes de publicar. Documente a configuração MCP da Pluggy (`https://mcp.pluggy.ai/mcp`, sem chave) e da Plaid (`uvx mcp-server-plaid`, segredos em ambiente, não em flag) como passo futuro não executado. Não coloque segredo no repositório. Deixe claro que MCP no editor não conecta esta interface e que o backend da Etapa 2 não foi feito.

---

O código correspondente está na raiz deste repositório. O comportamento verificável está em [openspec.md](openspec.md).
