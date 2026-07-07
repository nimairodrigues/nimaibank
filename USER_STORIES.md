# Histórias de Usuário — NimaiBank

Histórias de usuário de cada funcionalidade do sistema, escritas na dupla visão de **PO** (valor de negócio e regras) e **Analista de Testes** (critérios de aceite testáveis e cenários de borda). Referências: [README.md](README.md) e [API.md](API.md).

## Sumário

- [1. Cadastro de conta](#1-cadastro-de-conta)
- [2. Login](#2-login)
- [3. Tela inicial (boas-vindas)](#3-tela-inicial-boas-vindas)
- [4. Conta corrente (depósito, saque e extrato)](#4-conta-corrente-depósito-saque-e-extrato)
- [5. Conta poupança (depósito e saque)](#5-conta-poupança-depósito-e-saque)
- [6. Rendimento da poupança](#6-rendimento-da-poupança)
- [7. Extrato da poupança com paginação](#7-extrato-da-poupança-com-paginação)
- [8. Meu perfil — ativar/desativar tipos de conta](#8-meu-perfil--ativardesativar-tipos-de-conta)
- [9. Transferências entre contas](#9-transferências-entre-contas)
- [10. Atualizar dados da conta](#10-atualizar-dados-da-conta)
- [11. Excluir conta](#11-excluir-conta)
- [12. Sair (logout)](#12-sair-logout)

---

## 1. Cadastro de conta

**Como** visitante do site,
**quero** criar uma conta informando usuário, senha, idade e o(s) tipo(s) de conta desejado(s),
**para que** eu possa acessar o banco e movimentar meu dinheiro.

### Regras de negócio (visão PO)

- Usuário, senha e idade são obrigatórios; usuário e senha têm limite de 6 caracteres.
- Usuário e senha só podem conter letras, números, `_` e `.` — espaços e outros caracteres especiais são bloqueados.
- É necessário marcar ao menos um tipo de conta (corrente e/ou poupança).
- Conta corrente exige idade mínima de 18 anos.
- Idade deve estar entre 0 e 120.
- Não é permitido `username` duplicado, mesmo diferindo apenas em maiúsculas/minúsculas (`"joao"` e `"JOAO"` são o mesmo usuário).
- Toda conta corrente aberta recebe um bônus de boas-vindas de R$ 5,00, já lançado no extrato.

### Critérios de aceite (visão QA)

- [ ] Dado que preencho todos os campos corretamente e marco "conta corrente", ao confirmar recebo status `201` e vejo `saldoCorrente = 5`.
- [ ] Dado que marco apenas "conta poupança", ao confirmar recebo status `201` com `saldoCorrente = 0` (bônus não se aplica).
- [ ] Dado que deixo usuário, senha ou idade em branco, o sistema bloqueia o envio e/ou retorna `400` com mensagem "Preencha todos os campos.".
- [ ] Dado que não marco nenhum tipo de conta, recebo `400` "Selecione ao menos um tipo de conta.".
- [ ] Dado que informo idade menor que 18 e marco conta corrente, recebo `400` "Conta corrente exige idade minima de 18 anos." (poupança sozinha com idade < 18 deve ser aceita).
- [ ] Dado que informo idade negativa, igual a 0, igual a 120 ou maior que 120, validar limite (0 e 120 aceitos, fora disso rejeitado).
- [ ] Dado que informo idade não numérica, recebo `400`.
- [ ] Dado que tento cadastrar um `username` já existente, recebo `409` "Usuario ja existe.".
- [ ] Dado que tento cadastrar um `username` já existente em outra variação de caixa (ex.: "JOAO" quando "joao" já existe), recebo `409` "Usuario ja existe.".
- [ ] Dado que usuário ou senha ultrapassam 6 caracteres, o botão de criar conta permanece desabilitado no front-end.
- [ ] Dado que informo usuário ou senha com espaço ou caractere especial (ex.: `#`, `<`, `>`, `'`, `"`, ` `), o botão de criar conta permanece desabilitado no front-end e/ou recebo `400` do back-end.
- [ ] Dado que informo usuário e senha usando apenas letras, números, `_` e `.`, o cadastro é aceito normalmente.
- [ ] Verificar que o bônus de R$ 5,00 aparece corretamente registrado no extrato como entrada "Presente de boas-vindas do banco" logo após o cadastro.

---

## 2. Login

**Como** usuário cadastrado,
**quero** entrar no sistema informando meu usuário e senha,
**para que** eu acesse minha conta e minhas funcionalidades bancárias.

### Regras de negócio (visão PO)

- Autenticação por `username` + `senha`; a comparação do `username` não diferencia maiúsculas de minúsculas (`"joao"`, `"JOAO"` e `"Joao"` autenticam a mesma conta), a `senha` continua sendo comparada exatamente.
- Login incorreto não deve revelar se o erro é no usuário ou na senha (mensagem genérica).
- Login bem-sucedido leva à tela de boas-vindas.

### Critérios de aceite (visão QA)

- [ ] Dado usuário e senha corretos, sou redirecionado à tela de boas-vindas com meu nome exibido.
- [ ] Dado usuário inexistente, vejo a mensagem "Usuario ou senha invalidos." (não "Usuario nao encontrado", para não vazar informação).
- [ ] Dado usuário existente com senha incorreta, vejo a mesma mensagem genérica "Usuario ou senha invalidos.".
- [ ] Dado campos em branco, o sistema impede o envio ou retorna erro apropriado.
- [ ] Verificar que a senha não é exposta na resposta da API (`GET /api/contas/:username`) — apenas o campo `senhaConfere` (booleano) é usado pelo front-end.
- [ ] Dado que cadastro a conta como "joao" e faço login informando "JOAO" (ou qualquer variação de caixa) com a senha correta, o login é bem-sucedido.

---

## 3. Tela inicial (boas-vindas)

**Como** usuário autenticado,
**quero** ver um painel inicial que reflita exatamente os tipos de conta que tenho ativos,
**para que** eu só veja as opções que realmente posso usar.

### Regras de negócio (visão PO)

- Exibe saudação com o nome do usuário.
- Mostra saldo e formulários de saque/depósito da conta corrente apenas se ela estiver habilitada **e** ativa.
- Botão "Extrato" segue a mesma condição da conta corrente.
- Botão "Conta poupança" aparece apenas se poupança estiver habilitada e ativa.
- Botão "Transferir" aparece apenas se a conta corrente estiver habilitada e ativa.
- Botão "Meu perfil" e "Sair" sempre visíveis.
- Se nenhum tipo de conta estiver ativo, exibe aviso orientando a ativar uma conta em "Meu perfil".

### Critérios de aceite (visão QA)

- [ ] Usuário com corrente e poupança ativas vê todos os botões (Extrato, Conta poupança, Transferir, Meu perfil, Sair).
- [ ] Usuário só com poupança ativa (corrente nunca habilitada) não vê Extrato nem Transferir, mas vê Conta poupança.
- [ ] Usuário com conta corrente desativada (mas antes habilitada) deixa de ver Extrato e Transferir, mesmo tendo saldo zerado.
- [ ] Usuário sem nenhum tipo de conta ativo vê a mensagem de aviso para ativar uma conta em "Meu perfil".
- [ ] Validar que o nome exibido na saudação corresponde exatamente ao `username` logado.
- [ ] Testar a tela logo após desativar/ativar um tipo de conta em "Meu perfil" e voltar à tela inicial — os botões devem refletir o novo estado sem precisar de novo login.

---

## 4. Conta corrente (depósito, saque e extrato)

**Como** usuário com conta corrente ativa,
**quero** depositar, sacar e consultar o extrato da minha conta corrente,
**para que** eu possa movimentar meu dinheiro no dia a dia e acompanhar meu histórico.

### Regras de negócio (visão PO)

- Depósito e saque exigem conta corrente habilitada e ativa.
- Valor de depósito/saque deve ser numérico e maior que zero.
- Saque não pode ultrapassar o saldo disponível.
- Extrato lista entradas e saídas com data/hora e valor formatado em reais, mais recentes primeiro.
- Extrato vazio exibe "Nenhuma movimentacao ainda.".

### Critérios de aceite (visão QA)

- [ ] Depósito de valor positivo válido soma corretamente ao saldo e gera entrada no extrato com descrição "Deposito".
- [ ] Depósito com valor zero, negativo, não numérico ou vazio é rejeitado com `400`.
- [ ] Saque de valor válido e igual ou menor ao saldo disponível é debitado corretamente e gera saída no extrato com descrição "Saque".
- [ ] Saque de valor maior que o saldo disponível é rejeitado com "Saldo insuficiente.".
- [ ] Saque de valor zero, negativo ou não numérico é rejeitado.
- [ ] Tentar depositar/sacar em conta sem conta corrente habilitada retorna `400` "Conta nao possui conta corrente habilitada.".
- [ ] Tentar depositar/sacar com conta corrente desativada retorna `400` com a mensagem específica de conta desativada.
- [ ] Extrato reflete corretamente múltiplas movimentações em ordem cronológica decrescente.
- [ ] Extrato de conta recém-criada com bônus de boas-vindas mostra a movimentação inicial de R$ 5,00.
- [ ] Testar precisão de arredondamento com valores decimais (ex.: depósito de R$ 10,555).

---

## 5. Conta poupança (depósito e saque)

**Como** usuário com poupança ativa,
**quero** depositar e sacar valores na minha conta poupança,
**para que** eu possa guardar e resgatar meu dinheiro separadamente da conta corrente.

### Regras de negócio (visão PO)

- Depósito e saque exigem poupança habilitada e ativa.
- Mesmas regras de valor (numérico, positivo) e saldo suficiente para saque, análogas à conta corrente.
- Tela de poupança é exclusiva para quem tem esse tipo de conta habilitado.

### Critérios de aceite (visão QA)

- [ ] Depósito válido soma ao saldo da poupança e gera entrada no extrato com descrição "Deposito".
- [ ] Saque válido debita corretamente e gera saída com descrição "Saque".
- [ ] Saque maior que o saldo disponível é rejeitado com "Saldo insuficiente.".
- [ ] Valor inválido (zero, negativo, não numérico, ausente) é rejeitado em ambas operações.
- [ ] Usuário sem poupança habilitada não consegue acessar a tela/endpoint (retorno `400` "Conta nao possui poupanca habilitada.").
- [ ] Usuário com poupança desativada não consegue depositar nem sacar (mensagens específicas de conta desativada).
- [ ] Verificar que operações na poupança não afetam o saldo da conta corrente e vice-versa.

---

## 6. Rendimento da poupança

**Como** usuário com poupança ativa,
**quero** que meu saldo renda automaticamente com o passar do tempo,
**para que** meu dinheiro guardado gere retorno sem que eu precise fazer nada manualmente.

### Regras de negócio (visão PO)

- Taxa fixa de 1% ao mês, aplicada proporcionalmente aos dias corridos desde o último cálculo.
- Cálculo é "sob demanda": só ocorre quando a tela da conta poupança é aberta (não há job em background).
- Se não houver dias passados ou o saldo for zero, nenhum rendimento é aplicado.
- Rendimento aplicado é somado ao saldo e registrado no extrato com descrição "Rendimento".

### Critérios de aceite (visão QA)

- [ ] Abrir a tela de poupança após dias corridos com saldo positivo aplica rendimento proporcional (validar fórmula: saldo × (0,01/30) × dias).
- [ ] Abrir a tela de poupança no mesmo dia do último cálculo não aplica rendimento algum (0 dias passados).
- [ ] Conta poupança com saldo zero não gera rendimento, mesmo com dias passados.
- [ ] Rendimento aplicado aparece corretamente no extrato com descrição "Rendimento" e valor coerente com o cálculo.
- [ ] Abrir a tela de poupança múltiplas vezes no mesmo dia não duplica o rendimento (idempotência dentro do mesmo período).
- [ ] Tentar acionar rendimento em conta sem poupança habilitada retorna `400`.
- [ ] Validar arredondamento do rendimento para 2 casas decimais.
- [ ] Testar cenário de longo período sem acesso (ex.: 60 dias) e conferir se o rendimento acumulado está correto.

---

## 7. Extrato da poupança (com paginação)

**Como** usuário com poupança ativa,
**quero** consultar o histórico de movimentações da poupança paginado,
**para que** eu consiga navegar por um extrato extenso sem sobrecarregar a tela.

### Regras de negócio (visão PO)

- Lista até 10 movimentações por página.
- Botões "Anterior" e "Próxima" aparecem apenas quando há mais registros do que cabem em uma página.
- Ordenação mais recente primeiro.

### Critérios de aceite (visão QA)

- [ ] Conta com menos de 10 movimentações não exibe botões de paginação.
- [ ] Conta com exatamente 10 movimentações não exibe botão "Próxima" (não há próxima página).
- [ ] Conta com 11 ou mais movimentações exibe botão "Próxima" na primeira página.
- [ ] Navegar para a última página desabilita/oculta o botão "Próxima"; voltar à primeira desabilita/oculta "Anterior".
- [ ] Cada página exibe as movimentações na ordem cronológica decrescente correta, sem duplicar ou pular registros entre páginas.
- [ ] Extrato vazio (poupança recém-criada, sem movimentações) exibe "Nenhuma movimentacao ainda.".

---

## 8. Meu perfil — ativar/desativar tipos de conta

**Como** usuário autenticado,
**quero** ativar ou desativar cada tipo de conta (corrente e poupança) individualmente,
**para que** eu controle quais produtos bancários uso, sem perder meu histórico.

### Regras de negócio (visão PO)

- "Ativar" cobre dois casos: habilitar um tipo nunca aberto (reaplicando a regra de idade mínima para conta corrente) ou reativar um tipo já habilitado que foi desativado.
- "Desativar" só é permitido com saldo zerado no tipo de conta.
- Conta desativada continua existindo (histórico preservado), mas não pode enviar nem receber dinheiro.
- Tipo de conta desativado oculta o botão/tela correspondente na tela inicial.

### Critérios de aceite (visão QA)

- [ ] Ativar um tipo de conta nunca habilitado o torna habilitado e ativo.
- [ ] Tentar habilitar conta corrente pela primeira vez com idade < 18 é bloqueado com `400`.
- [ ] Reativar um tipo já habilitado e desativado anteriormente não repete a validação de idade mínima.
- [ ] Tentar ativar um tipo que já está habilitado e ativo retorna `400` "Conta ja possui esse tipo de conta ativo.".
- [ ] Desativar um tipo de conta com saldo zero é bem-sucedido.
- [ ] Tentar desativar um tipo de conta com saldo maior que zero é bloqueado com "Nao e possivel desativar uma conta com saldo. Zere o saldo antes de desativar.".
- [ ] Tentar desativar um tipo já desativado retorna `400` "Essa conta ja esta desativada.".
- [ ] Tentar desativar um tipo nunca habilitado retorna `400` "Conta nao possui [tipo] habilitada.".
- [ ] Após desativar a conta corrente, verificar que depósito, saque e transferência (mesmo com origem na poupança) ficam bloqueados.
- [ ] Após desativar a poupança, verificar que ela não recebe depósitos/transferências e não permite saque, mas a conta corrente continua funcionando normalmente.
- [ ] Após reativar um tipo de conta, o histórico de movimentações anterior à desativação continua acessível no extrato.
- [ ] Validar que, na tela inicial, o botão/tela do tipo desativado desaparece imediatamente após a ação, sem exigir novo login.

---

## 9. Transferências entre contas

**Como** usuário com conta corrente habilitada e ativa,
**quero** transferir valores da minha conta corrente ou poupança para a conta corrente ou poupança de outro usuário,
**para que** eu consiga movimentar dinheiro entre contas do banco.

### Regras de negócio (visão PO)

- Exige conta corrente habilitada e ativa como "porta de entrada", mesmo transferindo a partir do saldo da poupança.
- `contaOrigem` e `contaDestino` devem ser "corrente" ou "poupanca".
- Destinatário deve existir, ser diferente do próprio usuário, e ter o tipo de conta de destino habilitado e ativo.
- Valor deve ser numérico, positivo e não superior ao saldo disponível na origem.
- Débito na origem e crédito no destino ocorrem na mesma transação atômica.
- Geram duas movimentações: saída ("Transferencia para X") na origem e entrada ("Transferencia de Y") no destino.

### Critérios de aceite (visão QA)

- [ ] Transferência válida de corrente para corrente debita a origem, credita o destino e retorna `saldoCorrente` atualizado do remetente.
- [ ] Transferência de poupança (origem) para corrente (destino) de outro usuário: debita poupança do remetente, credita corrente do destinatário, resposta traz `saldoPoupanca`.
- [ ] Usuário sem conta corrente habilitada não consegue transferir, mesmo tendo poupança com saldo (`400` "Transferencias disponiveis apenas para contas com conta corrente habilitada.").
- [ ] Usuário com conta corrente desativada não consegue transferir, mesmo escolhendo `contaOrigem = poupanca` com poupança ativa.
- [ ] Transferir usando `contaOrigem` desativada (ex.: poupança desativada, mesmo com corrente ativa) é bloqueado.
- [ ] Transferir para si mesmo é bloqueado com `400`.
- [ ] Transferir para destinatário inexistente retorna `404` "Conta destinataria nao encontrada.".
- [ ] Transferir para tipo de conta do destinatário não habilitado ou desativado é bloqueado com mensagem específica.
- [ ] Transferir valor maior que o saldo disponível na origem é bloqueado com "Saldo insuficiente.".
- [ ] Transferir valor zero, negativo ou não numérico é bloqueado.
- [ ] Verificar atomicidade: simular falha no meio da operação e confirmar que nem o débito nem o crédito são persistidos (sem estado parcial).
- [ ] Conferir que ambas as movimentações (saída na origem, entrada no destino) aparecem corretamente nos respectivos extratos, com as descrições esperadas contendo os `username`s corretos.
- [ ] Testar transferência simultânea (concorrência) para garantir que o saldo não fica inconsistente.

---

## 10. Atualizar dados da conta

**Como** usuário cadastrado,
**quero** atualizar minha senha e/ou minha idade,
**para que** eu mantenha meus dados corretos e minha conta segura.

### Regras de negócio (visão PO)

- Ao menos um dos campos (senha ou idade) deve ser enviado.
- Senha deve respeitar o limite de 6 caracteres.
- Idade deve estar entre 0 e 120 e ser numérica.

### Critérios de aceite (visão QA)

- [ ] Atualizar apenas a senha, mantendo a idade, é bem-sucedido (`{ ok: true }`).
- [ ] Atualizar apenas a idade, mantendo a senha, é bem-sucedido.
- [ ] Atualizar ambos os campos ao mesmo tempo é bem-sucedido.
- [ ] Enviar requisição sem nenhum dos dois campos retorna `400` "Informe senha e/ou idade para atualizar.".
- [ ] Enviar senha com 6 ou mais caracteres retorna `400`.
- [ ] Enviar idade fora do intervalo 0–120 ou não numérica retorna `400`.
- [ ] Atualizar conta inexistente retorna `404`.
- [ ] Após atualizar a senha, validar que o login antigo deixa de funcionar e o novo funciona.
- [ ] Após atualizar a idade para menor que 18, verificar impacto (ou ausência dele) sobre uma conta corrente já habilitada — regra de idade mínima só é reaplicada ao habilitar, não à conta já existente.

---

## 11. Excluir conta

**Como** usuário cadastrado,
**quero** poder excluir minha conta,
**para que** meus dados sejam removidos do sistema quando eu não quiser mais utilizá-lo.

### Regras de negócio (visão PO)

- Remove a conta e todo o seu histórico de movimentações.
- Só é permitido excluir se o saldo da conta corrente e o saldo da poupança estiverem zerados — mesma exigência usada em "Desativar conta" (US 8).
- Disponível pelo botão "Excluir conta" na tela "Meu perfil", com confirmação explícita do usuário antes de excluir (ação irreversível).
- Ao concluir com sucesso, o usuário é deslogado automaticamente e volta para a tela de login.

### Critérios de aceite (visão QA)

- [ ] Excluir conta com saldo corrente e poupança zerados retorna `{ ok: true }` e remove a conta e suas movimentações do banco.
- [ ] Excluir conta com saldo positivo na conta corrente e/ou na poupança retorna `400` "Nao e possivel excluir uma conta com saldo. Zere o saldo antes de excluir." e não remove a conta.
- [ ] Excluir conta inexistente retorna `404` "Conta nao encontrada.".
- [ ] Após excluir, tentar logar com as mesmas credenciais falha.
- [ ] Após excluir, o `username` volta a ficar disponível para novo cadastro.
- [ ] Na tela "Meu perfil", ao clicar em "Excluir conta" é exibida uma confirmação explícita antes da exclusão; cancelando a confirmação, nada é excluído.
- [ ] Ao excluir com sucesso pela UI, o usuário é deslogado e retorna à tela de login.
- [ ] Ao tentar excluir pela UI com saldo positivo, a mensagem de erro do back-end é exibida na tela.

---

## 12. Sair (logout)

**Como** usuário autenticado,
**quero** sair da minha sessão,
**para que** meus dados não fiquem expostos em um dispositivo compartilhado.

### Regras de negócio (visão PO)

- Limpa dados da sessão: usuário logado, campos de login preenchidos e extratos em cache.
- Retorna à tela de login.

### Critérios de aceite (visão QA)

- [ ] Ao clicar em "Sair", sou redirecionado à tela de login.
- [ ] Após logout, os campos de usuário/senha da tela de login aparecem vazios (não reaproveitam o que foi digitado antes).
- [ ] Após logout, tentar voltar à tela inicial (ex.: botão "voltar" do navegador) não deve expor dados da conta sem novo login.
- [ ] Extratos e saldos vistos anteriormente não devem aparecer em cache para o próximo usuário que logar no mesmo navegador.
