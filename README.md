# NimaiBank

Protótipo de um banco digital simples, feito para fins de estudo/teste. Permite criar conta, fazer login, ver saldo, movimentar conta corrente e poupança, transferir entre usuários, ativar/desativar cada tipo de conta e consultar extratos.

## Sumário

- [Tecnologias usadas](#tecnologias-usadas)
- [Como rodar o projeto](#como-rodar-o-projeto)
- [Funcionalidades](#funcionalidades)
  - [1. Cadastro de conta](#1-cadastro-de-conta)
  - [2. Login](#2-login)
  - [3. Tela inicial (boas-vindas)](#3-tela-inicial-boas-vindas)
  - [4. Conta corrente e extrato](#4-conta-corrente-e-extrato)
  - [5. Conta poupança](#5-conta-poupança)
  - [6. Rendimento da poupança](#6-rendimento-da-poupança)
  - [7. Extrato da poupança (com paginação)](#7-extrato-da-poupança-com-paginação)
  - [8. Meu perfil (ativar/desativar tipos de conta)](#8-meu-perfil-ativardesativar-tipos-de-conta)
  - [9. Transferências](#9-transferências)
  - [10. Sair (logout)](#10-sair-logout)

> Para a documentação dos endpoints do backend, veja [API.md](API.md).

## Tecnologias usadas

- **Backend:** Node.js + [Express](https://expressjs.com/)
- **Banco de dados:** SQLite, via [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
- **Frontend:** HTML, CSS e JavaScript puro (sem frameworks), tudo em uma única página (`index.html`) que troca telas mostrando/escondendo `div`s.

## Como rodar o projeto

```bash
npm install
npm start
```

O servidor sobe em `http://localhost:3001`. O próprio Express também serve os arquivos estáticos (`index.html`, `script.js`, `style.css`), então basta abrir essa URL no navegador.

Para desenvolvimento com reinício automático ao salvar arquivos, use `npm run dev` (usa `nodemon`).

## Funcionalidades

### 1. Cadastro de conta

Tela onde o usuário cria uma conta nova, informando:

- **Usuário** (nome de login)
- **Senha**
- **Idade**
- **Tipo de conta**: pode marcar conta corrente, conta poupança, ou as duas

Regras de validação:

- Todos os campos são obrigatórios.
- É preciso marcar ao menos um tipo de conta.
- Conta corrente só pode ser aberta por maiores de 18 anos.
- Usuário e senha têm limite de 6 caracteres (o botão de criar conta fica desabilitado se ultrapassar).
- Idade deve estar entre 0 e 120.
- Não pode haver dois usuários com o mesmo nome (contas duplicadas são rejeitadas).

Ao criar uma conta corrente, o banco dá um "presente de boas-vindas" de **R$ 5,00** de saldo inicial, que já aparece registrado no extrato.

### 2. Login

Tela inicial do sistema. O usuário informa usuário e senha; se estiverem corretos, é levado para a tela de boas-vindas. Caso contrário, exibe a mensagem "Usuario ou senha invalidos."

### 3. Tela inicial (boas-vindas)

Depois do login, mostra:

- Mensagem de boas-vindas com o nome do usuário.
- Saldo da conta corrente e os formulários de saque/depósito (só aparecem se a conta corrente estiver habilitada **e** ativa).
- Botão **Extrato** (só aparece nas mesmas condições da conta corrente).
- Botão **Conta poupança** (só aparece se a poupança estiver habilitada **e** ativa).
- Botão **Transferir** (só aparece se a conta corrente estiver habilitada e ativa — é a "porta de entrada" das transferências, veja [Transferências](#9-transferências)).
- Botão **Meu perfil**, para ativar/desativar cada tipo de conta.
- Botão **Sair**.

Se nenhum tipo de conta estiver ativo, é exibido um aviso orientando o usuário a ativar uma conta em "Meu perfil". Um tipo de conta desativado (veja [Meu perfil](#8-meu-perfil-ativardesativar-tipos-de-conta)) fica com seu botão/tela de acesso correspondente ocultado na tela inicial, como se o usuário não tivesse esse tipo de conta.

### 4. Conta corrente e extrato

A tela de Extrato lista todas as movimentações da conta corrente (entradas e saídas), com data/hora e valor formatado em reais. Se não houver nenhuma movimentação, mostra "Nenhuma movimentacao ainda."

### 5. Conta poupança

Tela exclusiva para quem tem conta poupança habilitada. Permite:

- **Ver o saldo** atual da poupança.
- **Sacar** um valor (não pode ser maior que o saldo disponível).
- **Depositar** um valor.
- Acessar o **extrato** da poupança.

Cada saque/depósito é validado (valor precisa ser um número positivo) e gera um registro de movimentação.

### 6. Rendimento da poupança

Toda vez que a tela da conta poupança é aberta, o sistema calcula automaticamente o rendimento acumulado desde a última vez que foi calculado, usando uma taxa fixa de **1% ao mês** (proporcional aos dias corridos). Não existe um processo rodando em segundo plano — o cálculo só acontece "sob demanda", quando o usuário entra na tela.

O valor do rendimento é somado ao saldo e também aparece como uma entrada no extrato da poupança.

### 7. Extrato da poupança (com paginação)

Assim como o extrato da conta corrente, mas com paginação: mostra até 10 movimentações por página, com botões "Anterior" e "Próxima" quando há mais registros do que cabem em uma página.

### 8. Meu perfil (ativar/desativar tipos de conta)

Tela acessada pelo botão "Meu perfil" na tela inicial. Mostra, para cada tipo de conta (corrente e poupança), um botão que alterna entre "Ativar" e "Desativar" conforme o estado atual:

- **Ativar** cobre dois casos: habilitar um tipo que o usuário ainda não possui (aplicando a regra de idade mínima de 18 anos para conta corrente) ou reativar um tipo já habilitado que havia sido desativado.
- **Desativar** só é permitido se o saldo desse tipo de conta estiver zerado. Uma conta desativada continua existindo (histórico preservado), mas deixa de poder enviar ou receber dinheiro até ser reativada.

Enquanto um tipo de conta estiver desativado, o botão/tela correspondente desaparece da tela inicial (veja [Tela inicial](#3-tela-inicial-boas-vindas)).

### 9. Transferências

Tela acessada pelo botão "Transferir" na tela inicial (disponível apenas com conta corrente habilitada e ativa). Permite transferir um valor da conta corrente ou poupança do usuário logado para a conta corrente ou poupança de outro usuário já cadastrado, com débito e crédito aplicados na mesma operação.

### 10. Sair (logout)

Limpa os dados da sessão (usuário logado, campos de login, extratos em cache) e volta para a tela de login.
