# API do NimaiBank

Documentação dos endpoints do backend (`server.js`). Todas as rotas recebem e devolvem JSON e ficam sob o prefixo `/api`.

> Para a visão geral das funcionalidades do projeto, veja [README.md](README.md).

## Sumário

- [Contas](#contas)
  - [Criar conta](#criar-conta)
  - [Listar contas](#listar-contas)
  - [Buscar uma conta (login)](#buscar-uma-conta-login)
  - [Ativar tipo de conta](#ativar-tipo-de-conta)
  - [Desativar tipo de conta](#desativar-tipo-de-conta)
  - [Atualizar conta](#atualizar-conta)
  - [Excluir conta](#excluir-conta)
- [Movimentações](#movimentações)
  - [Listar movimentações de uma conta](#listar-movimentações-de-uma-conta)
- [Conta corrente](#conta-corrente)
  - [Depositar na conta corrente](#depositar-na-conta-corrente)
  - [Sacar da conta corrente](#sacar-da-conta-corrente)
- [Conta poupança](#conta-poupança)
  - [Sacar da poupança](#sacar-da-poupança)
  - [Depositar na poupança](#depositar-na-poupança)
  - [Aplicar rendimento da poupança](#aplicar-rendimento-da-poupança)
- [Transferências](#transferências)
  - [Transferir para outra conta](#transferir-para-outra-conta)
  - [Transferir entre as próprias contas](#transferir-entre-as-próprias-contas)

## Contas

### Criar conta

`POST /api/contas`

Cria uma nova conta.

**Corpo da requisição:**

```json
{
  "username": "joao",
  "senha": "123456",
  "idade": 25,
  "contaCorrente": true,
  "contaPoupanca": false
}
```

**Regras:**

- `username`, `senha` e `idade` são obrigatórios.
- `username` e `senha` só podem conter letras, números, `_` e `.` (sem espaços nem outros símbolos).
- `idade` precisa ser numérica e estar entre 0 e 120.
- É preciso marcar ao menos um tipo de conta (`contaCorrente` ou `contaPoupanca`).
- Conta corrente exige idade mínima de 18 anos.
- Não pode haver dois usuários com o mesmo `username` — a comparação **não diferencia maiúsculas de minúsculas** (`"joao"` e `"JOAO"` são o mesmo usuário).
- Se `contaCorrente` for `true`, a conta já nasce com saldo de R$ 5,00 (registrado como uma movimentação de entrada).

**Resposta de sucesso** (`201`):

```json
{
  "username": "joao",
  "idade": 25,
  "contaCorrente": true,
  "contaPoupanca": false,
  "saldoCorrente": 5
}
```

**Possíveis erros:**

| Status | Motivo |
|---|---|
| `400` | Campos obrigatórios faltando |
| `400` | `username` ou `senha` com caractere não permitido (fora de letras, números, `_` e `.`) |
| `400` | `idade` fora do intervalo permitido (0 a 120) ou não numérica |
| `400` | Nenhum tipo de conta selecionado |
| `400` | Conta corrente com idade menor que 18 anos |
| `409` | Já existe um usuário com esse `username` (comparação sem diferenciar maiúsculas/minúsculas) |

### Listar contas

`GET /api/contas`

Retorna todas as contas cadastradas (sem a senha).

**Resposta:**

```json
[
  {
    "username": "joao",
    "idade": 25,
    "conta_corrente": 1,
    "conta_poupanca": 0,
    "criado_em": "2026-07-06 12:00:00"
  }
]
```

### Buscar uma conta (login)

`GET /api/contas/:username?senha=...`

Busca os dados de uma conta pelo `username`. O parâmetro `senha` (query string) é opcional; se informado, o backend confere se a senha bate e devolve isso no campo `senhaConfere`. É essa rota que a tela de login usa para autenticar.

A busca por `username` não diferencia maiúsculas de minúsculas: `"joao"`, `"JOAO"` e `"Joao"` encontram a mesma conta.

**Resposta:**

```json
{
  "username": "joao",
  "idade": 25,
  "contaCorrente": true,
  "contaPoupanca": false,
  "saldoCorrente": 5,
  "saldoPoupanca": 0,
  "contaCorrenteAtiva": true,
  "contaPoupancaAtiva": true,
  "senhaConfere": true
}
```

`contaCorrenteAtiva`/`contaPoupancaAtiva` indicam se o tipo de conta, quando habilitado, está ativo ou foi desativado (veja [Desativar tipo de conta](#desativar-tipo-de-conta)). Uma conta nunca habilitada é reportada como não ativa.

**Erros:**

| Status | Motivo |
|---|---|
| `404` | Conta não encontrada |

### Ativar tipo de conta

`PUT /api/contas/:username/ativar-conta`

Ativa um tipo de conta (corrente ou poupança). Cobre dois casos com a mesma rota:

- **Habilitar** um tipo que o usuário ainda não possui — reaproveita as mesmas validações usadas na criação da conta (idade mínima para conta corrente).
- **Reativar** um tipo que já é habilitado mas está desativado (veja [Desativar tipo de conta](#desativar-tipo-de-conta)).

**Corpo da requisição:**

```json
{ "tipo": "poupanca" }
```

**Regras:**

- `tipo` deve ser `"corrente"` ou `"poupanca"`.
- O tipo informado não pode já estar habilitado **e** ativo ao mesmo tempo (nesse caso não há nada a fazer).
- Conta corrente exige idade mínima de 18 anos — validação aplicada apenas ao habilitar um tipo pela primeira vez (reativar um tipo já habilitado não repete essa checagem).

**Resposta:**

```json
{ "contaCorrente": true, "contaPoupanca": true, "contaCorrenteAtiva": true, "contaPoupancaAtiva": true }
```

**Erros:**

| Status | Motivo |
|---|---|
| `400` | `tipo` ausente ou inválido |
| `400` | Tipo de conta já habilitado e ativo |
| `400` | Conta corrente com idade menor que 18 anos (apenas ao habilitar pela primeira vez) |
| `404` | Conta não encontrada |

### Desativar tipo de conta

`PUT /api/contas/:username/desativar-conta`

Desativa um tipo de conta (corrente ou poupança) já habilitado. Uma conta desativada deixa de poder enviar ou receber dinheiro, mas continua existindo (o histórico de movimentações é preservado e o tipo pode ser consultado normalmente).

**Corpo da requisição:**

```json
{ "tipo": "corrente" }
```

**Regras:**

- `tipo` deve ser `"corrente"` ou `"poupanca"`.
- A conta precisa ter esse tipo habilitado.
- O tipo informado não pode já estar desativado.
- **O saldo desse tipo de conta precisa estar zerado** — não é possível desativar uma conta corrente ou poupança com saldo maior que zero.
- Depois de desativada, essa conta:
  - não pode **receber** depósitos (`deposito-corrente`/`deposito-poupanca`) nem transferências como destinatária;
  - não pode **enviar** dinheiro: saques (`saque-corrente`/`saque-poupanca`) e transferências ficam bloqueados enquanto a conta estiver desativada. No caso da conta corrente, como ela é a "porta de entrada" para transferências (veja [Transferir para outra conta](#transferir-para-outra-conta)), desativá-la bloqueia qualquer transferência de saída, mesmo com origem na poupança.

**Resposta:**

```json
{ "contaCorrenteAtiva": false, "contaPoupancaAtiva": true }
```

**Erros:**

| Status | Motivo |
|---|---|
| `400` | `tipo` ausente ou inválido |
| `400` | Tipo de conta não habilitado |
| `400` | Tipo de conta já desativado |
| `400` | Saldo maior que zero nesse tipo de conta |
| `404` | Conta não encontrada |

### Atualizar conta

`PUT /api/contas/:username`

Atualiza a senha e/ou a idade de uma conta existente.

**Corpo da requisição:**

```json
{
  "senha": "novasenha",
  "idade": 26
}
```

Pelo menos um dos dois campos deve ser enviado.

**Regras:**

- Se `senha` for enviada, precisa ter menos de 6 caracteres (mesmo limite usado no cadastro).
- Se `idade` for enviada, precisa ser numérica e estar entre 0 e 120.

**Resposta:** `{ "ok": true }`

**Erros:**

| Status | Motivo |
|---|---|
| `400` | Nenhum campo (`senha` ou `idade`) informado |
| `400` | `senha` atingiu o limite máximo de caracteres |
| `400` | `idade` fora do intervalo permitido (0 a 120) ou não numérica |
| `404` | Conta não encontrada |

### Excluir conta

`DELETE /api/contas/:username`

Remove a conta com o `username` informado, junto com todo o histórico de movimentações. É a rota usada pelo botão "Excluir conta" na tela [Meu perfil](README.md#8-meu-perfil-ativardesativar-tipos-de-conta-e-excluir-conta).

**Regras:**

- **O saldo da conta corrente e o saldo da poupança precisam estar zerados** — mesma exigência da rota [Desativar tipo de conta](#desativar-tipo-de-conta). Não é possível excluir uma conta com saldo positivo em qualquer um dos dois tipos.

**Resposta:** `{ "ok": true }`

**Erros:**

| Status | Motivo |
|---|---|
| `400` | Saldo maior que zero na conta corrente ou na poupança |
| `404` | Conta não encontrada |

## Movimentações

### Listar movimentações de uma conta

`GET /api/contas/:username/movimentacoes`

Retorna o histórico de movimentações (entradas e saídas) da conta corrente e da poupança, mais recentes primeiro.

**Resposta:**

```json
[
  {
    "conta_tipo": "poupanca",
    "tipo": "entrada",
    "valor": 10,
    "descricao": "Deposito",
    "criado_em": "2026-07-06 12:30:00"
  }
]
```

**Erros:**

| Status | Motivo |
|---|---|
| `404` | Conta não encontrada |

## Conta corrente

### Depositar na conta corrente

`POST /api/contas/:username/deposito-corrente`

Deposita um valor no saldo da conta corrente.

**Corpo da requisição:**

```json
{ "valor": 100 }
```

**Regras:**

- A conta precisa ter conta corrente habilitada.
- A conta corrente não pode estar desativada (veja [Desativar tipo de conta](#desativar-tipo-de-conta)) — uma conta desativada não recebe depósitos.
- `valor` precisa ser um número maior que zero.

**Resposta:**

```json
{ "saldoCorrente": 105 }
```

**Erros:**

| Status | Motivo |
|---|---|
| `400` | Conta sem conta corrente habilitada |
| `400` | Conta corrente desativada |
| `400` | Valor inválido (ausente, não numérico ou ≤ 0) |
| `404` | Conta não encontrada |

### Sacar da conta corrente

`POST /api/contas/:username/saque-corrente`

Saca um valor do saldo da conta corrente.

**Corpo da requisição:**

```json
{ "valor": 50 }
```

**Regras:**

- A conta precisa ter conta corrente habilitada.
- A conta corrente não pode estar desativada — uma conta desativada não pode enviar dinheiro.
- `valor` precisa ser um número maior que zero.
- `valor` não pode ser maior que o saldo disponível.

**Resposta:**

```json
{ "saldoCorrente": 55 }
```

**Erros:**

| Status | Motivo |
|---|---|
| `400` | Conta sem conta corrente habilitada |
| `400` | Conta corrente desativada |
| `400` | Valor inválido (ausente, não numérico ou ≤ 0) |
| `400` | Saldo insuficiente |
| `404` | Conta não encontrada |

## Conta poupança

### Sacar da poupança

`POST /api/contas/:username/saque-poupanca`

Saca um valor do saldo da poupança.

**Corpo da requisição:**

```json
{ "valor": 50 }
```

**Regras:**

- A conta precisa ter poupança habilitada.
- A poupança não pode estar desativada — uma conta desativada não pode enviar dinheiro.
- `valor` precisa ser um número maior que zero.
- `valor` não pode ser maior que o saldo disponível.

**Resposta:**

```json
{ "saldoPoupanca": 150 }
```

**Erros:**

| Status | Motivo |
|---|---|
| `400` | Conta sem poupança habilitada |
| `400` | Poupança desativada |
| `400` | Valor inválido (ausente, não numérico ou ≤ 0) |
| `400` | Saldo insuficiente |
| `404` | Conta não encontrada |

### Depositar na poupança

`POST /api/contas/:username/deposito-poupanca`

Deposita um valor no saldo da poupança.

**Corpo da requisição:**

```json
{ "valor": 100 }
```

**Regras:**

- A conta precisa ter poupança habilitada.
- A poupança não pode estar desativada — uma conta desativada não recebe depósitos.
- `valor` precisa ser um número maior que zero.

**Resposta:**

```json
{ "saldoPoupanca": 250 }
```

**Erros:**

| Status | Motivo |
|---|---|
| `400` | Conta sem poupança habilitada |
| `400` | Poupança desativada |
| `400` | Valor inválido (ausente, não numérico ou ≤ 0) |
| `404` | Conta não encontrada |

### Aplicar rendimento da poupança

`POST /api/contas/:username/render-poupanca`

Calcula e aplica o rendimento pendente da poupança desde o último cálculo, usando uma taxa fixa de 1% ao mês (proporcional aos dias corridos). É chamado automaticamente pelo frontend sempre que a tela da conta poupança é aberta.

- Se não houver dias passados ou o saldo for zero, nenhum rendimento é aplicado.
- Quando há rendimento a aplicar, ele é somado ao saldo e registrado como uma movimentação de entrada com a descrição "Rendimento".

**Resposta:**

```json
{ "saldoPoupanca": 252.5 }
```

**Erros:**

| Status | Motivo |
|---|---|
| `400` | Conta sem poupança habilitada |
| `404` | Conta não encontrada |

## Transferências

### Transferir para outra conta

`POST /api/contas/:username/transferencia`

Transfere um valor da conta de `:username` (conta corrente ou poupança, à escolha) para a conta corrente ou poupança (à escolha) de outro usuário já cadastrado. O débito na origem e o crédito no destino acontecem na mesma transação: se algo falhar no meio, nada é persistido.

**Corpo da requisição:**

```json
{
  "destinatario": "maria",
  "valor": 100,
  "contaOrigem": "corrente",
  "contaDestino": "poupanca"
}
```

**Regras:**

- A conta de `:username` precisa ter conta corrente habilitada para poder transferir — essa exigência vale mesmo que `contaOrigem` seja `"poupanca"` (ter poupança sozinha não dá acesso à funcionalidade de transferir). Já como destinatário, essa exigência não se aplica: quem tem só poupança pode receber normalmente.
- A conta corrente de `:username` não pode estar desativada — como ela é a "porta de entrada" da funcionalidade de transferir, desativá-la bloqueia qualquer envio, mesmo com `contaOrigem` `"poupanca"`.
- `contaOrigem` deve ser `"corrente"` ou `"poupanca"`: define de qual saldo do remetente o valor sai.
- A conta de `:username` precisa ter o tipo de conta informado em `contaOrigem` habilitado e ativo (não desativado).
- `contaDestino` deve ser `"corrente"` ou `"poupanca"`: define em qual saldo do destinatário o valor entra.
- `destinatario` é obrigatório e não pode ser o próprio `:username`.
- A conta `destinatario` precisa existir e ter o tipo de conta informado em `contaDestino` habilitado e ativo (uma conta desativada não recebe transferências).
- `valor` precisa ser um número maior que zero.
- `valor` não pode ser maior que o saldo disponível na conta de origem.
- São registradas duas movimentações: uma saída na conta de origem (descrição "Transferencia para `<destinatario>`") e uma entrada no tipo de conta escolhido do destinatário (descrição "Transferencia de `<username>`").

**Resposta:**

```json
{ "saldoCorrente": 400 }
```

Se `contaOrigem` for `"poupanca"`, a resposta traz `saldoPoupanca` em vez de `saldoCorrente`. A resposta sempre reflete o saldo restante da conta de origem do remetente, independente de `contaDestino`.

**Erros:**

| Status | Motivo |
|---|---|
| `400` | Conta de origem (`:username`) sem conta corrente habilitada (transferências exigem conta corrente, mesmo debitando da poupança) |
| `400` | Conta corrente de origem (`:username`) desativada |
| `400` | `contaOrigem` ausente ou diferente de `"corrente"`/`"poupanca"` |
| `400` | Conta de origem sem o tipo de conta informado em `contaOrigem` habilitado |
| `400` | Conta de origem com o tipo de conta informado em `contaOrigem` desativado |
| `400` | `contaDestino` ausente ou diferente de `"corrente"`/`"poupanca"` |
| `400` | Conta destinatária sem o tipo de conta informado em `contaDestino` habilitado |
| `400` | Conta destinatária com o tipo de conta informado em `contaDestino` desativado |
| `400` | `destinatario` ausente ou igual ao próprio `:username` |
| `400` | Valor inválido (ausente, não numérico ou ≤ 0) |
| `400` | Saldo insuficiente |
| `404` | Conta de origem (`:username`) não encontrada |
| `404` | Conta destinatária não encontrada |

### Transferir entre as próprias contas

`POST /api/contas/:username/transferencia-interna`

Transfere um valor entre a conta corrente e a poupança do **mesmo** usuário (`:username`). Diferente da transferência para outra conta, aqui não existe destinatário: o destino é sempre o outro tipo de conta do próprio usuário, deduzido automaticamente a partir de `contaOrigem`.

**Corpo da requisição:**

```json
{
  "contaOrigem": "corrente",
  "valor": 100
}
```

**Regras:**

- `contaOrigem` deve ser `"corrente"` ou `"poupanca"` — define de qual saldo o valor sai; o destino é sempre o outro tipo.
- Só é permitida se o usuário tiver **os dois tipos de conta** (corrente e poupança) habilitados **e** ativos. Ter apenas um dos dois tipos bloqueia a funcionalidade inteira (não há para onde, ou de onde, mover o dinheiro).
- `valor` precisa ser um número maior que zero.
- `valor` não pode ser maior que o saldo disponível na conta de origem.
- Débito na origem e crédito no destino ocorrem na mesma transação atômica.
- São registradas duas movimentações: uma saída na origem (descrição "Transferencia interna para conta corrente"/"Transferencia interna para conta poupanca") e uma entrada no destino (descrição "Transferencia interna de conta corrente"/"Transferencia interna de conta poupanca").

**Resposta:**

```json
{ "saldoCorrente": 400, "saldoPoupanca": 600 }
```

Ao contrário da transferência para outra conta, a resposta sempre traz os dois saldos atualizados, já que ambos pertencem ao mesmo usuário e mudam juntos.

**Erros:**

| Status | Motivo |
|---|---|
| `400` | `contaOrigem` ausente ou diferente de `"corrente"`/`"poupanca"` |
| `400` | Usuário não possui os dois tipos de conta habilitados e ativos |
| `400` | Valor inválido (ausente, não numérico ou ≤ 0) |
| `400` | Saldo insuficiente |
| `404` | Conta não encontrada |
