const express = require('express');
const db = require('./db');

const app = express();

app.use(express.json());
app.use(express.static(__dirname));

// Limites compartilhados por validacoes de cadastro/atualizacao de conta.
// LIMITE_CARACTERES_SENHA espelha o LIMITE_CARACTERES do frontend (script.js).
const IDADE_MINIMA = 0;
const IDADE_MAXIMA = 120;
const IDADE_MINIMA_CONTA_CORRENTE = 18;
const LIMITE_CARACTERES_SENHA = 6;

// Apenas letras, numeros, "_" e "." — sem espacos e sem simbolos.
const CARACTERES_PERMITIDOS = /^[A-Za-z0-9_.]+$/;

function idadeValida(idade) {
  return typeof idade === 'number' && idade >= IDADE_MINIMA && idade <= IDADE_MAXIMA;
}

function valorValido(valor) {
  return typeof valor === 'number' && valor > 0;
}

function nomeTipoConta(tipo) {
  return tipo === 'corrente' ? 'conta corrente' : 'conta poupanca';
}

// Busca uma conta pelo username e ja responde 404 se nao encontrar. Retorna
// null nesse caso (o chamador deve dar `return` em seguida).
function buscarContaOu404(sql, username, res, msgNaoEncontrada = 'Conta nao encontrada.') {
  const conta = db.prepare(sql).get(username);
  if (!conta) {
    res.status(404).json({ erro: msgNaoEncontrada });
    return null;
  }
  return conta;
}

// Valida se um tipo de conta esta habilitado e ativo, respondendo com 400 e
// a mensagem apropriada caso nao esteja. Retorna true quando pode prosseguir.
function tipoContaAtivaOuErro(res, habilitada, ativa, msgNaoHabilitada, msgDesativada) {
  if (!habilitada) {
    res.status(400).json({ erro: msgNaoHabilitada });
    return false;
  }
  if (!ativa) {
    res.status(400).json({ erro: msgDesativada });
    return false;
  }
  return true;
}

function registrarMovimentacao(contaId, contaTipo, tipo, valor, descricao) {
  db.prepare(
    'INSERT INTO movimentacoes (conta_id, conta_tipo, tipo, valor, descricao) VALUES (?, ?, ?, ?, ?)'
  ).run(contaId, contaTipo, tipo, valor, descricao);
}

// Create
app.post('/api/contas', (req, res) => {
  const { username, senha, idade, contaCorrente, contaPoupanca } = req.body || {};
  if (!username || !senha || !idade) {
    return res.status(400).json({ erro: 'Preencha todos os campos.' });
  }
  if (!CARACTERES_PERMITIDOS.test(username)) {
    return res.status(400).json({ erro: 'O usuario deve conter apenas letras, numeros, "_" e ".", sem espacos.' });
  }
  if (!CARACTERES_PERMITIDOS.test(senha)) {
    return res.status(400).json({ erro: 'A senha deve conter apenas letras, numeros, "_" e ".", sem espacos.' });
  }
  if (!idadeValida(idade)) {
    return res.status(400).json({ erro: `A idade deve estar entre ${IDADE_MINIMA} e ${IDADE_MAXIMA}.` });
  }
  if (!contaCorrente && !contaPoupanca) {
    return res.status(400).json({ erro: 'Selecione ao menos um tipo de conta.' });
  }
  if (contaCorrente && idade < IDADE_MINIMA_CONTA_CORRENTE) {
    return res.status(400).json({ erro: 'Conta corrente exige idade minima de 18 anos.' });
  }

  const existente = db.prepare('SELECT id FROM contas WHERE username = ? COLLATE NOCASE').get(username);
  if (existente) {
    return res.status(409).json({ erro: 'Usuario ja existe.' });
  }

  const saldoInicial = contaCorrente ? 5 : 0;

  const resultado = db.prepare(
    'INSERT INTO contas (username, senha, idade, conta_corrente, conta_poupanca, saldo_corrente) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(username, senha, idade, contaCorrente ? 1 : 0, contaPoupanca ? 1 : 0, saldoInicial);

  if (contaCorrente) {
    registrarMovimentacao(resultado.lastInsertRowid, 'corrente', 'entrada', saldoInicial, 'Presente de boas-vindas do banco');
  }

  res.status(201).json({ username, idade, contaCorrente: !!contaCorrente, contaPoupanca: !!contaPoupanca, saldoCorrente: saldoInicial });
});

// Read (listar)
app.get('/api/contas', (_req, res) => {
  const contas = db.prepare('SELECT username, idade, conta_corrente, conta_poupanca, criado_em FROM contas').all();
  res.json(contas);
});

// Read (uma conta) — tambem usado para validar login
app.get('/api/contas/:username', (req, res) => {
  const conta = buscarContaOu404(
    'SELECT username, senha, idade, conta_corrente, conta_poupanca, saldo_corrente, saldo_poupanca, conta_corrente_ativa, conta_poupanca_ativa FROM contas WHERE username = ? COLLATE NOCASE',
    req.params.username, res
  );
  if (!conta) return;

  const senhaConfere = req.query.senha ? req.query.senha === conta.senha : undefined;
  res.json({
    username: conta.username,
    idade: conta.idade,
    contaCorrente: !!conta.conta_corrente,
    contaPoupanca: !!conta.conta_poupanca,
    saldoCorrente: conta.saldo_corrente,
    saldoPoupanca: conta.saldo_poupanca,
    contaCorrenteAtiva: !!conta.conta_corrente_ativa,
    contaPoupancaAtiva: !!conta.conta_poupanca_ativa,
    senhaConfere
  });
});

// Read (movimentacoes de uma conta)
app.get('/api/contas/:username/movimentacoes', (req, res) => {
  const conta = buscarContaOu404('SELECT id FROM contas WHERE username = ? COLLATE NOCASE', req.params.username, res);
  if (!conta) return;

  const movimentacoes = db.prepare(
    'SELECT conta_tipo, tipo, valor, descricao, criado_em FROM movimentacoes WHERE conta_id = ? ORDER BY criado_em DESC, id DESC'
  ).all(conta.id);

  res.json(movimentacoes);
});

// Deposito na conta corrente
app.post('/api/contas/:username/deposito-corrente', (req, res) => {
  const conta = buscarContaOu404('SELECT id, conta_corrente, conta_corrente_ativa, saldo_corrente FROM contas WHERE username = ? COLLATE NOCASE', req.params.username, res);
  if (!conta) return;

  if (!tipoContaAtivaOuErro(res, conta.conta_corrente, conta.conta_corrente_ativa,
    'Conta nao possui conta corrente habilitada.',
    'Conta corrente esta desativada e nao pode receber depositos.')) return;

  const { valor } = req.body || {};
  if (!valorValido(valor)) {
    return res.status(400).json({ erro: 'Informe um valor valido para deposito.' });
  }

  const novoSaldo = conta.saldo_corrente + valor;
  db.prepare('UPDATE contas SET saldo_corrente = ? WHERE id = ?').run(novoSaldo, conta.id);
  registrarMovimentacao(conta.id, 'corrente', 'entrada', valor, 'Deposito');

  res.json({ saldoCorrente: novoSaldo });
});

// Saque na conta corrente
app.post('/api/contas/:username/saque-corrente', (req, res) => {
  const conta = buscarContaOu404('SELECT id, conta_corrente, conta_corrente_ativa, saldo_corrente FROM contas WHERE username = ? COLLATE NOCASE', req.params.username, res);
  if (!conta) return;

  if (!tipoContaAtivaOuErro(res, conta.conta_corrente, conta.conta_corrente_ativa,
    'Conta nao possui conta corrente habilitada.',
    'Conta corrente esta desativada e nao pode enviar dinheiro.')) return;

  const { valor } = req.body || {};
  if (!valorValido(valor)) {
    return res.status(400).json({ erro: 'Informe um valor valido para saque.' });
  }
  if (valor > conta.saldo_corrente) {
    return res.status(400).json({ erro: 'Saldo insuficiente.' });
  }

  const novoSaldo = conta.saldo_corrente - valor;
  db.prepare('UPDATE contas SET saldo_corrente = ? WHERE id = ?').run(novoSaldo, conta.id);
  registrarMovimentacao(conta.id, 'corrente', 'saida', valor, 'Saque');

  res.json({ saldoCorrente: novoSaldo });
});

// Saque na conta poupanca
app.post('/api/contas/:username/saque-poupanca', (req, res) => {
  const conta = buscarContaOu404('SELECT id, conta_poupanca, conta_poupanca_ativa, saldo_poupanca FROM contas WHERE username = ? COLLATE NOCASE', req.params.username, res);
  if (!conta) return;

  if (!tipoContaAtivaOuErro(res, conta.conta_poupanca, conta.conta_poupanca_ativa,
    'Conta nao possui poupanca habilitada.',
    'Conta poupanca esta desativada e nao pode enviar dinheiro.')) return;

  const { valor } = req.body || {};
  if (!valorValido(valor)) {
    return res.status(400).json({ erro: 'Informe um valor valido para saque.' });
  }
  if (valor > conta.saldo_poupanca) {
    return res.status(400).json({ erro: 'Saldo insuficiente.' });
  }

  const novoSaldo = conta.saldo_poupanca - valor;
  db.prepare('UPDATE contas SET saldo_poupanca = ? WHERE id = ?').run(novoSaldo, conta.id);
  registrarMovimentacao(conta.id, 'poupanca', 'saida', valor, 'Saque');

  res.json({ saldoPoupanca: novoSaldo });
});

// Deposito na conta poupanca
app.post('/api/contas/:username/deposito-poupanca', (req, res) => {
  const conta = buscarContaOu404('SELECT id, conta_poupanca, conta_poupanca_ativa, saldo_poupanca FROM contas WHERE username = ? COLLATE NOCASE', req.params.username, res);
  if (!conta) return;

  if (!tipoContaAtivaOuErro(res, conta.conta_poupanca, conta.conta_poupanca_ativa,
    'Conta nao possui poupanca habilitada.',
    'Conta poupanca esta desativada e nao pode receber depositos.')) return;

  const { valor } = req.body || {};
  if (!valorValido(valor)) {
    return res.status(400).json({ erro: 'Informe um valor valido para deposito.' });
  }

  const novoSaldo = conta.saldo_poupanca + valor;
  db.prepare('UPDATE contas SET saldo_poupanca = ? WHERE id = ?').run(novoSaldo, conta.id);
  registrarMovimentacao(conta.id, 'poupanca', 'entrada', valor, 'Deposito');

  res.json({ saldoPoupanca: novoSaldo });
});

// Rendimento da poupanca (calculado sob demanda ao abrir a tela, sem job em
// background): taxa mensal fixa aplicada proporcionalmente aos dias corridos
// desde o ultimo rendimento aplicado.
const TAXA_MENSAL_POUPANCA = 0.01; // 1% ao mes
const TAXA_DIARIA_POUPANCA = TAXA_MENSAL_POUPANCA / 30;

// Aplica o rendimento pendente da poupanca (chamado ao abrir a tela de conta poupanca)
app.post('/api/contas/:username/render-poupanca', (req, res) => {
  const conta = buscarContaOu404(
    'SELECT id, conta_poupanca, saldo_poupanca, poupanca_ultimo_rendimento FROM contas WHERE username = ? COLLATE NOCASE',
    req.params.username, res
  );
  if (!conta) return;

  if (!conta.conta_poupanca) {
    return res.status(400).json({ erro: 'Conta nao possui poupanca habilitada.' });
  }

  const ultimoRendimento = new Date(conta.poupanca_ultimo_rendimento.replace(' ', 'T') + 'Z');
  const diasPassados = Math.floor((Date.now() - ultimoRendimento.getTime()) / 86400000);

  if (conta.saldo_poupanca > 0 && diasPassados > 0) {
    const rendimento = Math.round(conta.saldo_poupanca * TAXA_DIARIA_POUPANCA * diasPassados * 100) / 100;

    if (rendimento > 0) {
      const novoSaldo = conta.saldo_poupanca + rendimento;
      db.prepare(
        "UPDATE contas SET saldo_poupanca = ?, poupanca_ultimo_rendimento = datetime('now') WHERE id = ?"
      ).run(novoSaldo, conta.id);
      registrarMovimentacao(conta.id, 'poupanca', 'entrada', rendimento, 'Rendimento');

      return res.json({ saldoPoupanca: novoSaldo });
    }
  }

  res.json({ saldoPoupanca: conta.saldo_poupanca });
});

// Transferencia entre contas: debita a conta de origem (do usuario logado) e
// credita o tipo de conta escolhido (contaDestino) do destinatario, na mesma transacao.
const executarTransferencia = db.transaction((origemId, destinoId, campoSaldoOrigem, novoSaldoOrigem, contaTipoOrigem, campoSaldoDestino, contaTipoDestino, valor, destinatario, username) => {
  db.prepare(`UPDATE contas SET ${campoSaldoOrigem} = ? WHERE id = ?`).run(novoSaldoOrigem, origemId);
  db.prepare(`UPDATE contas SET ${campoSaldoDestino} = ${campoSaldoDestino} + ? WHERE id = ?`).run(valor, destinoId);
  registrarMovimentacao(origemId, contaTipoOrigem, 'saida', valor, `Transferencia para ${destinatario}`);
  registrarMovimentacao(destinoId, contaTipoDestino, 'entrada', valor, `Transferencia de ${username}`);
});

app.post('/api/contas/:username/transferencia', (req, res) => {
  const { destinatario, valor, contaOrigem, contaDestino } = req.body || {};

  if (contaOrigem !== 'corrente' && contaOrigem !== 'poupanca') {
    return res.status(400).json({ erro: 'Informe uma conta de origem valida ("corrente" ou "poupanca").' });
  }

  if (contaDestino !== 'corrente' && contaDestino !== 'poupanca') {
    return res.status(400).json({ erro: 'Informe uma conta de destino valida ("corrente" ou "poupanca").' });
  }

  const conta = buscarContaOu404(
    'SELECT id, conta_corrente, conta_poupanca, saldo_corrente, saldo_poupanca, conta_corrente_ativa, conta_poupanca_ativa FROM contas WHERE username = ? COLLATE NOCASE',
    req.params.username, res
  );
  if (!conta) return;

  if (!tipoContaAtivaOuErro(res, conta.conta_corrente, conta.conta_corrente_ativa,
    'Transferencias disponiveis apenas para contas com conta corrente habilitada.',
    'Conta corrente esta desativada e nao pode enviar dinheiro.')) return;

  const contaHabilitada = contaOrigem === 'corrente' ? conta.conta_corrente : conta.conta_poupanca;
  const origemAtiva = contaOrigem === 'corrente' ? conta.conta_corrente_ativa : conta.conta_poupanca_ativa;
  if (!tipoContaAtivaOuErro(res, contaHabilitada, origemAtiva,
    `Conta nao possui ${contaOrigem === 'corrente' ? 'conta corrente' : 'poupanca'} habilitada.`,
    `Conta ${contaOrigem === 'corrente' ? 'corrente' : 'poupanca'} esta desativada e nao pode enviar dinheiro.`)) return;

  if (!destinatario || destinatario === req.params.username) {
    return res.status(400).json({ erro: 'Informe uma conta destinataria valida, diferente da sua.' });
  }

  if (!valorValido(valor)) {
    return res.status(400).json({ erro: 'Informe um valor valido para transferencia.' });
  }

  const contaDestinoRow = buscarContaOu404(
    'SELECT id, conta_corrente, conta_poupanca, conta_corrente_ativa, conta_poupanca_ativa FROM contas WHERE username = ? COLLATE NOCASE',
    destinatario, res, 'Conta destinataria nao encontrada.'
  );
  if (!contaDestinoRow) return;

  const destinoHabilitado = contaDestino === 'corrente' ? contaDestinoRow.conta_corrente : contaDestinoRow.conta_poupanca;
  const destinoAtivo = contaDestino === 'corrente' ? contaDestinoRow.conta_corrente_ativa : contaDestinoRow.conta_poupanca_ativa;
  if (!tipoContaAtivaOuErro(res, destinoHabilitado, destinoAtivo,
    'Conta destinataria nao possui esse tipo de conta habilitado.',
    'Conta destinataria com esse tipo de conta desativada nao pode receber transferencias.')) return;

  const campoSaldo = contaOrigem === 'corrente' ? 'saldo_corrente' : 'saldo_poupanca';
  const saldoAtual = conta[campoSaldo];
  if (valor > saldoAtual) {
    return res.status(400).json({ erro: 'Saldo insuficiente.' });
  }

  const campoSaldoDestino = contaDestino === 'corrente' ? 'saldo_corrente' : 'saldo_poupanca';
  const novoSaldo = saldoAtual - valor;
  executarTransferencia(conta.id, contaDestinoRow.id, campoSaldo, novoSaldo, contaOrigem, campoSaldoDestino, contaDestino, valor, destinatario, req.params.username);

  res.json(contaOrigem === 'corrente' ? { saldoCorrente: novoSaldo } : { saldoPoupanca: novoSaldo });
});

// Transferencia entre as contas do proprio usuario (corrente <-> poupanca).
// Diferente da transferencia para outro usuario, aqui so existe um destino
// possivel: o outro tipo de conta do mesmo dono. Por isso a rota recebe
// apenas a origem, nao um par origem/destino.
const executarTransferenciaInterna = db.transaction((contaId, campoSaldoOrigem, novoSaldoOrigem, contaTipoOrigem, campoSaldoDestino, contaTipoDestino, valor) => {
  db.prepare(`UPDATE contas SET ${campoSaldoOrigem} = ? WHERE id = ?`).run(novoSaldoOrigem, contaId);
  db.prepare(`UPDATE contas SET ${campoSaldoDestino} = ${campoSaldoDestino} + ? WHERE id = ?`).run(valor, contaId);
  registrarMovimentacao(contaId, contaTipoOrigem, 'saida', valor, `Transferencia interna para ${nomeTipoConta(contaTipoDestino)}`);
  registrarMovimentacao(contaId, contaTipoDestino, 'entrada', valor, `Transferencia interna de ${nomeTipoConta(contaTipoOrigem)}`);
});

app.post('/api/contas/:username/transferencia-interna', (req, res) => {
  const { contaOrigem, valor } = req.body || {};

  if (contaOrigem !== 'corrente' && contaOrigem !== 'poupanca') {
    return res.status(400).json({ erro: 'Informe uma conta de origem valida ("corrente" ou "poupanca").' });
  }

  const conta = buscarContaOu404(
    'SELECT id, conta_corrente, conta_poupanca, saldo_corrente, saldo_poupanca, conta_corrente_ativa, conta_poupanca_ativa FROM contas WHERE username = ? COLLATE NOCASE',
    req.params.username, res
  );
  if (!conta) return;

  // So e permitido transferir entre as proprias contas se os DOIS tipos
  // estiverem habilitados e ativos — com apenas um tipo de conta nao ha
  // para onde (ou de onde) mover o dinheiro.
  const ambosHabilitadosEAtivos = conta.conta_corrente && conta.conta_corrente_ativa && conta.conta_poupanca && conta.conta_poupanca_ativa;
  if (!ambosHabilitadosEAtivos) {
    return res.status(400).json({ erro: 'Transferencia entre suas contas exige conta corrente e poupanca habilitadas e ativas.' });
  }

  if (!valorValido(valor)) {
    return res.status(400).json({ erro: 'Informe um valor valido para transferencia.' });
  }

  const campoSaldoOrigem = contaOrigem === 'corrente' ? 'saldo_corrente' : 'saldo_poupanca';
  const saldoAtual = conta[campoSaldoOrigem];
  if (valor > saldoAtual) {
    return res.status(400).json({ erro: 'Saldo insuficiente.' });
  }

  const contaDestino = contaOrigem === 'corrente' ? 'poupanca' : 'corrente';
  const campoSaldoDestino = contaDestino === 'corrente' ? 'saldo_corrente' : 'saldo_poupanca';
  const novoSaldoOrigem = saldoAtual - valor;

  executarTransferenciaInterna(conta.id, campoSaldoOrigem, novoSaldoOrigem, contaOrigem, campoSaldoDestino, contaDestino, valor);

  res.json({
    saldoCorrente: contaOrigem === 'corrente' ? novoSaldoOrigem : conta.saldo_corrente + valor,
    saldoPoupanca: contaOrigem === 'poupanca' ? novoSaldoOrigem : conta.saldo_poupanca + valor
  });
});

// Ativa um tipo de conta: tanto habilita um tipo que o usuario ainda nao
// possui (reaproveitando as mesmas validacoes da criacao de conta, como a
// idade minima para conta corrente) quanto reativa um tipo ja habilitado
// que havia sido desativado anteriormente. So recusa se o tipo ja estiver
// habilitado e ativo (nada a fazer).
app.put('/api/contas/:username/ativar-conta', (req, res) => {
  const { tipo } = req.body || {};
  if (tipo !== 'corrente' && tipo !== 'poupanca') {
    return res.status(400).json({ erro: 'Informe um tipo de conta valido ("corrente" ou "poupanca").' });
  }

  const conta = buscarContaOu404(
    'SELECT id, idade, conta_corrente, conta_poupanca, conta_corrente_ativa, conta_poupanca_ativa FROM contas WHERE username = ? COLLATE NOCASE',
    req.params.username, res
  );
  if (!conta) return;

  const habilitada = tipo === 'corrente' ? conta.conta_corrente : conta.conta_poupanca;
  const ativa = tipo === 'corrente' ? conta.conta_corrente_ativa : conta.conta_poupanca_ativa;
  if (habilitada && ativa) {
    return res.status(400).json({ erro: 'Conta ja possui esse tipo de conta ativo.' });
  }

  if (!habilitada && tipo === 'corrente' && conta.idade < IDADE_MINIMA_CONTA_CORRENTE) {
    return res.status(400).json({ erro: 'Conta corrente exige idade minima de 18 anos.' });
  }

  const colunaHabilitada = tipo === 'corrente' ? 'conta_corrente' : 'conta_poupanca';
  const colunaAtiva = tipo === 'corrente' ? 'conta_corrente_ativa' : 'conta_poupanca_ativa';
  db.prepare(`UPDATE contas SET ${colunaHabilitada} = 1, ${colunaAtiva} = 1 WHERE id = ?`).run(conta.id);

  res.json({
    contaCorrente: tipo === 'corrente' ? true : !!conta.conta_corrente,
    contaPoupanca: tipo === 'poupanca' ? true : !!conta.conta_poupanca,
    contaCorrenteAtiva: tipo === 'corrente' ? true : !!conta.conta_corrente_ativa,
    contaPoupancaAtiva: tipo === 'poupanca' ? true : !!conta.conta_poupanca_ativa
  });
});

// Desativa um tipo de conta ja habilitado. So e permitido quando o saldo
// desse tipo de conta esta zerado; uma conta desativada deixa de poder
// enviar ou receber dinheiro (validado nas rotas de deposito/saque/transferencia).
app.put('/api/contas/:username/desativar-conta', (req, res) => {
  const { tipo } = req.body || {};
  if (tipo !== 'corrente' && tipo !== 'poupanca') {
    return res.status(400).json({ erro: 'Informe um tipo de conta valido ("corrente" ou "poupanca").' });
  }

  const conta = buscarContaOu404(
    'SELECT id, conta_corrente, conta_poupanca, conta_corrente_ativa, conta_poupanca_ativa, saldo_corrente, saldo_poupanca FROM contas WHERE username = ? COLLATE NOCASE',
    req.params.username, res
  );
  if (!conta) return;

  const habilitada = tipo === 'corrente' ? conta.conta_corrente : conta.conta_poupanca;
  const jaAtiva = tipo === 'corrente' ? conta.conta_corrente_ativa : conta.conta_poupanca_ativa;
  if (!tipoContaAtivaOuErro(res, habilitada, jaAtiva,
    `Conta nao possui ${tipo === 'corrente' ? 'conta corrente' : 'poupanca'} habilitada.`,
    'Essa conta ja esta desativada.')) return;

  const saldo = tipo === 'corrente' ? conta.saldo_corrente : conta.saldo_poupanca;
  if (saldo > 0) {
    return res.status(400).json({ erro: 'Nao e possivel desativar uma conta com saldo. Zere o saldo antes de desativar.' });
  }

  const coluna = tipo === 'corrente' ? 'conta_corrente_ativa' : 'conta_poupanca_ativa';
  db.prepare(`UPDATE contas SET ${coluna} = 0 WHERE id = ?`).run(conta.id);

  res.json({
    contaCorrenteAtiva: tipo === 'corrente' ? false : !!conta.conta_corrente_ativa,
    contaPoupancaAtiva: tipo === 'poupanca' ? false : !!conta.conta_poupanca_ativa
  });
});

// Update
app.put('/api/contas/:username', (req, res) => {
  const conta = buscarContaOu404('SELECT id FROM contas WHERE username = ? COLLATE NOCASE', req.params.username, res);
  if (!conta) return;

  const { senha, idade } = req.body || {};
  if (!senha && !idade) {
    return res.status(400).json({ erro: 'Informe senha e/ou idade para atualizar.' });
  }

  if (senha && senha.length >= LIMITE_CARACTERES_SENHA) {
    return res.status(400).json({ erro: 'O campo de senha atingiu o limite maximo de caracteres.' });
  }

  if (idade && !idadeValida(idade)) {
    return res.status(400).json({ erro: `A idade deve estar entre ${IDADE_MINIMA} e ${IDADE_MAXIMA}.` });
  }

  if (senha) db.prepare('UPDATE contas SET senha = ? WHERE id = ?').run(senha, conta.id);
  if (idade) db.prepare('UPDATE contas SET idade = ? WHERE id = ?').run(idade, conta.id);

  res.json({ ok: true });
});

// Delete — mesma regra do desativar: so exclui com saldo zerado, para nao
// apagar dinheiro do usuario sem aviso.
const excluirConta = db.transaction((contaId) => {
  db.prepare('DELETE FROM movimentacoes WHERE conta_id = ?').run(contaId);
  db.prepare('DELETE FROM contas WHERE id = ?').run(contaId);
});

app.delete('/api/contas/:username', (req, res) => {
  const conta = buscarContaOu404(
    'SELECT id, saldo_corrente, saldo_poupanca FROM contas WHERE username = ? COLLATE NOCASE',
    req.params.username, res
  );
  if (!conta) return;

  if (conta.saldo_corrente > 0 || conta.saldo_poupanca > 0) {
    return res.status(400).json({ erro: 'Nao e possivel excluir uma conta com saldo. Zere o saldo antes de excluir.' });
  }

  excluirConta(conta.id);
  res.json({ ok: true });
});

app.listen(3001, () => console.log('Servidor rodando em http://localhost:3001'));
