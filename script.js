let contaCorrenteHabilitada = false;
let contaPoupancaHabilitada = false;
let contaCorrenteAtiva = true;
let contaPoupancaAtiva = true;
let idadeLogada = null;

// Helpers de visibilidade: aceitam um id (string) ou um elemento ja
// resolvido, para reaproveitar variaveis que ja tem o elemento em maos.
function definirVisivel(elementoOuId, visivel) {
  const elemento = typeof elementoOuId === 'string' ? document.getElementById(elementoOuId) : elementoOuId;
  elemento.style.display = visivel ? 'block' : 'none';
}

function mostrar(elementoOuId) {
  definirVisivel(elementoOuId, true);
}

function esconder(elementoOuId) {
  definirVisivel(elementoOuId, false);
}

// Centraliza fetch + parse do JSON de resposta + captura de erro de rede
// para as chamadas da API que enviam corpo JSON (POST/PUT). O chamador
// decide como reagir a partir do retorno: { ok, dados, erroConexao }.
async function postJSON(url, body, method = 'POST') {
  try {
    const resposta = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const dados = await resposta.json();
    return { ok: resposta.ok, dados };
  } catch (e) {
    return { ok: false, dados: null, erroConexao: true };
  }
}

// Validacao compartilhada pelos formularios de saque/deposito: o campo
// precisa estar preenchido e o valor numerico precisa ser positivo.
function valorFormularioValido(valorTexto, valor) {
  return !!valorTexto && valor > 0;
}

// Exibe o saldo formatado em pt-BR no texto do elemento e mantem o valor cru
// em data-saldo, para automacao nao precisar fazer parsing de string formatada.
const formatadorSaldo = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function exibirSaldo(id, rotulo, valor) {
  const elemento = document.getElementById(id);
  elemento.textContent = rotulo + formatadorSaldo.format(valor);
  elemento.setAttribute('data-saldo', valor);
}

async function logar() {
  const username = document.getElementById('username').value.trim();
  const senha    = document.getElementById('senha').value.trim();
  const erro     = document.getElementById('erro');

  if (!username || !senha) {
    erro.textContent = 'Preencha todos os campos.';
    mostrar(erro);
    return;
  }

  try {
    const resposta = await fetch('/api/contas/' + encodeURIComponent(username) + '?senha=' + encodeURIComponent(senha));

    if (resposta.status === 404) {
      erro.textContent = 'Usuario ou senha invalidos.';
      mostrar(erro);
      return;
    }

    const conta = await resposta.json();
    if (!conta.senhaConfere) {
      erro.textContent = 'Usuario ou senha invalidos.';
      mostrar(erro);
      return;
    }

    esconder(erro);
    esconder('tela-login');
    document.getElementById('mensagem').textContent = 'Bem vindo ' + username;

    if (conta.contaCorrente) {
      exibirSaldo('saldo-corrente', 'Saldo conta corrente: ', conta.saldoCorrente);
    }

    if (conta.contaPoupanca) {
      exibirSaldo('saldo-poupanca', 'Saldo conta poupanca: ', conta.saldoPoupanca);
    }

    mostrar('tela-boas-vindas');

    usuarioLogado = username;
    idadeLogada = conta.idade;
    contaCorrenteHabilitada = !!conta.contaCorrente;
    contaPoupancaHabilitada = !!conta.contaPoupanca;
    contaCorrenteAtiva = !!conta.contaCorrenteAtiva;
    contaPoupancaAtiva = !!conta.contaPoupancaAtiva;

    atualizarAcessoBoasVindas();
  } catch (e) {
    erro.textContent = 'Erro ao conectar com o servidor.';
    mostrar(erro);
  }
}

async function sacarCorrente() {
  const input = document.getElementById('valor-saque-corrente');
  const erro = document.getElementById('erro-saque-corrente');
  const valor = Number(input.value);

  if (!valorFormularioValido(input.value, valor)) {
    erro.textContent = 'Informe um valor valido para saque.';
    mostrar(erro);
    return;
  }

  const { ok, dados, erroConexao } = await postJSON('/api/contas/' + encodeURIComponent(usuarioLogado) + '/saque-corrente', { valor });

  if (erroConexao) {
    erro.textContent = 'Erro ao conectar com o servidor.';
    mostrar(erro);
    return;
  }

  if (!ok) {
    erro.textContent = dados.erro || 'Nao foi possivel realizar o saque.';
    mostrar(erro);
    return;
  }

  esconder(erro);
  input.value = '';

  exibirSaldo('saldo-corrente', 'Saldo conta corrente: ', dados.saldoCorrente);

  await carregarMovimentacoes(usuarioLogado);
  renderizarExtrato();
}

document.getElementById('saque-corrente-form').addEventListener('submit', function(e) {
  e.preventDefault();
  sacarCorrente();
});

async function depositarCorrente() {
  const input = document.getElementById('valor-deposito-corrente');
  const erro = document.getElementById('erro-deposito-corrente');
  const valor = Number(input.value);

  if (!valorFormularioValido(input.value, valor)) {
    erro.textContent = 'Informe um valor valido para deposito.';
    mostrar(erro);
    return;
  }

  const { ok, dados, erroConexao } = await postJSON('/api/contas/' + encodeURIComponent(usuarioLogado) + '/deposito-corrente', { valor });

  if (erroConexao) {
    erro.textContent = 'Erro ao conectar com o servidor.';
    mostrar(erro);
    return;
  }

  if (!ok) {
    erro.textContent = dados.erro || 'Nao foi possivel realizar o deposito.';
    mostrar(erro);
    return;
  }

  esconder(erro);
  input.value = '';

  exibirSaldo('saldo-corrente', 'Saldo conta corrente: ', dados.saldoCorrente);

  await carregarMovimentacoes(usuarioLogado);
  renderizarExtrato();
}

document.getElementById('deposito-corrente-form').addEventListener('submit', function(e) {
  e.preventDefault();
  depositarCorrente();
});

// Todas as movimentacoes (corrente + poupanca) ficam guardadas aqui apos o
// fetch; cada tela apenas filtra pelo seu tipo de conta e redesenha sua lista.
let movimentacoesCache = [];
let usuarioLogado = '';

function renderizarExtratoLista(tipoConta, idLista, idVazio) {
  const lista = document.getElementById(idLista);
  const vazio = document.getElementById(idVazio);
  lista.innerHTML = '';

  const movimentacoes = movimentacoesCache.filter(mov => mov.conta_tipo === tipoConta);
  definirVisivel(vazio, movimentacoes.length === 0);

  const formatadorValor = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  movimentacoes.forEach((mov) => {
    const item = document.createElement('li');
    item.setAttribute('data-testid', `movimentacao-${mov.id}`);
    const data = new Date(mov.criado_em.replace(' ', 'T') + 'Z').toLocaleString('pt-BR');
    const sinal = mov.tipo === 'entrada' ? '+' : '-';
    item.textContent = `${data} - ${mov.descricao || mov.tipo} (${sinal}${formatadorValor.format(mov.valor)})`;
    lista.appendChild(item);
  });
}

function renderizarExtrato() {
  renderizarExtratoLista('corrente', 'extrato-lista', 'extrato-vazio');
}

const REGISTROS_POR_PAGINA_EXTRATO_POUPANCA = 10;
let paginaAtualExtratoPoupanca = 1;

function renderizarExtratoPoupanca() {
  const lista = document.getElementById('extrato-poupanca-lista');
  const vazio = document.getElementById('extrato-poupanca-vazio');
  const paginacao = document.getElementById('extrato-poupanca-paginacao');
  const paginaAtualEl = document.getElementById('extrato-poupanca-pagina-atual');
  const btnAnterior = document.getElementById('btn-extrato-poupanca-anterior');
  const btnProxima = document.getElementById('btn-extrato-poupanca-proxima');
  lista.innerHTML = '';

  const movimentacoes = movimentacoesCache.filter(mov => mov.conta_tipo === 'poupanca');
  definirVisivel(vazio, movimentacoes.length === 0);

  const totalPaginas = Math.max(1, Math.ceil(movimentacoes.length / REGISTROS_POR_PAGINA_EXTRATO_POUPANCA));
  if (paginaAtualExtratoPoupanca > totalPaginas) {
    paginaAtualExtratoPoupanca = totalPaginas;
  }

  definirVisivel(paginacao, movimentacoes.length > REGISTROS_POR_PAGINA_EXTRATO_POUPANCA);
  paginaAtualEl.textContent = `Pagina ${paginaAtualExtratoPoupanca} de ${totalPaginas}`;
  paginaAtualEl.setAttribute('data-pagina-atual', paginaAtualExtratoPoupanca);
  paginaAtualEl.setAttribute('data-total-paginas', totalPaginas);
  btnAnterior.disabled = paginaAtualExtratoPoupanca <= 1;
  btnProxima.disabled = paginaAtualExtratoPoupanca >= totalPaginas;

  const inicio = (paginaAtualExtratoPoupanca - 1) * REGISTROS_POR_PAGINA_EXTRATO_POUPANCA;
  const movimentacoesDaPagina = movimentacoes.slice(inicio, inicio + REGISTROS_POR_PAGINA_EXTRATO_POUPANCA);

  const formatadorValor = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  movimentacoesDaPagina.forEach((mov) => {
    const item = document.createElement('li');
    item.setAttribute('data-testid', `movimentacao-${mov.id}`);
    const data = new Date(mov.criado_em.replace(' ', 'T') + 'Z').toLocaleString('pt-BR');
    const sinal = mov.tipo === 'entrada' ? '+' : '-';
    item.textContent = `${data} - ${mov.descricao || mov.tipo} (${sinal}${formatadorValor.format(mov.valor)})`;
    lista.appendChild(item);
  });
}

async function carregarMovimentacoes(username) {
  try {
    const resposta = await fetch('/api/contas/' + encodeURIComponent(username) + '/movimentacoes');
    if (!resposta.ok) return;

    movimentacoesCache = await resposta.json();
  } catch (e) {
    // Extrato e um complemento do dashboard; falha ao buscar nao deve
    // impedir o restante da tela correspondente de funcionar.
  }
}

async function abrirExtrato() {
  esconder('tela-boas-vindas');
  mostrar('tela-extrato');
  await carregarMovimentacoes(usuarioLogado);
  renderizarExtrato();
}

function fecharExtrato() {
  esconder('tela-extrato');
  mostrar('tela-boas-vindas');
}

document.getElementById('btn-extrato').addEventListener('click', abrirExtrato);
document.getElementById('btn-voltar-extrato').addEventListener('click', fecharExtrato);

// Atualiza os textos de status e o botao de ativacao do tipo de conta que
// ainda nao esta habilitado (so existe um tipo inativo por vez, ja que a
// criacao de conta exige pelo menos um tipo marcado).
function statusConta(habilitada, ativa) {
  if (!habilitada) return 'nao ativada';
  return ativa ? 'ativada' : 'desativada';
}

// Atualiza a tela inicial conforme os tipos de conta habilitados/ativos.
// Cada bloco (corrente/poupanca) so aparece se o respectivo tipo estiver
// ativo; sem nenhum tipo de conta ativo, a tela inicial mostra apenas o
// botao de perfil (unico jeito de reativar uma conta) e um aviso.
function atualizarAcessoBoasVindas() {
  const contaCorrenteOk = contaCorrenteHabilitada && contaCorrenteAtiva;
  const contaPoupancaOk = contaPoupancaHabilitada && contaPoupancaAtiva;
  const semContaAtiva = !contaCorrenteOk && !contaPoupancaOk;

  definirVisivel('aviso-sem-conta-ativa', semContaAtiva);
  definirVisivel('saldo-corrente', contaCorrenteOk);
  definirVisivel('saldo-poupanca', contaPoupancaOk);
  definirVisivel('saque-corrente-form', contaCorrenteOk);
  definirVisivel('deposito-corrente-form', contaCorrenteOk);
  definirVisivel('btn-extrato', contaCorrenteOk);
  definirVisivel('btn-conta-poupanca', contaPoupancaOk);

  // Transferencias exigem conta corrente habilitada e ativa (mesmo que a
  // origem escolhida na tela seja a poupanca), entao a opcao so aparece
  // pra quem tem conta corrente utilizavel.
  definirVisivel('btn-transferencia', contaCorrenteOk);

  // Transferencia entre as proprias contas so faz sentido (e so e aceita
  // pelo backend) quando os DOIS tipos de conta estao habilitados e ativos.
  definirVisivel('btn-transferencia-interna', contaCorrenteOk && contaPoupancaOk);
}

// Preenche o toggle de um tipo de conta: o mesmo botao vira "Ativar" ou
// "Desativar" conforme o estado atual, permitindo ligar/desligar cada tipo
// de conta individualmente (inclusive reativar um tipo antes desativado).
function atualizarToggleConta(idBotao, nomeTipo, ativa) {
  const botao = document.getElementById(idBotao);
  botao.textContent = (ativa ? 'Desativar ' : 'Ativar ') + nomeTipo;
}

function atualizarPerfilUI() {
  document.getElementById('perfil-usuario').textContent = 'Usuario: ' + usuarioLogado;
  document.getElementById('perfil-status-corrente').textContent = 'Conta corrente: ' + statusConta(contaCorrenteHabilitada, contaCorrenteAtiva);
  document.getElementById('perfil-status-poupanca').textContent = 'Conta poupanca: ' + statusConta(contaPoupancaHabilitada, contaPoupancaAtiva);
  esconder('erro-perfil');

  atualizarToggleConta('btn-toggle-corrente', 'conta corrente', contaCorrenteHabilitada && contaCorrenteAtiva);
  atualizarToggleConta('btn-toggle-poupanca', 'conta poupanca', contaPoupancaHabilitada && contaPoupancaAtiva);
}

function abrirPerfil() {
  atualizarPerfilUI();
  esconder('tela-boas-vindas');
  mostrar('tela-perfil');
}

function fecharPerfil() {
  esconder('tela-perfil');
  mostrar('tela-boas-vindas');
}

// Ativa um tipo de conta: habilita (se ainda nao existia) ou reativa (se
// havia sido desativado). Reaproveita a mesma regra de idade minima
// aplicada na criacao de conta (exibida antes de chamar a API, que tambem
// valida no servidor).
async function ativarConta(tipo) {
  const erro = document.getElementById('erro-perfil');

  erro.setAttribute('data-error-context', 'ativar-conta');

  if (tipo === 'corrente' && !contaCorrenteHabilitada && idadeLogada < IDADE_MINIMA_CONTA_CORRENTE) {
    erro.textContent = 'Conta corrente exige idade minima de 18 anos.';
    mostrar(erro);
    return;
  }

  const { ok, dados, erroConexao } = await postJSON('/api/contas/' + encodeURIComponent(usuarioLogado) + '/ativar-conta', { tipo }, 'PUT');

  if (erroConexao) {
    erro.textContent = 'Erro ao conectar com o servidor.';
    mostrar(erro);
    return;
  }

  if (!ok) {
    erro.textContent = dados.erro || 'Nao foi possivel ativar a conta.';
    mostrar(erro);
    return;
  }

  contaCorrenteHabilitada = dados.contaCorrente;
  contaPoupancaHabilitada = dados.contaPoupanca;
  contaCorrenteAtiva = dados.contaCorrenteAtiva;
  contaPoupancaAtiva = dados.contaPoupancaAtiva;
  atualizarAcessoBoasVindas();
  atualizarPerfilUI();
}

// Desativa um tipo de conta ja habilitado. O backend recusa a desativacao
// caso o saldo desse tipo de conta nao esteja zerado.
async function desativarConta(tipo) {
  const erro = document.getElementById('erro-perfil');
  erro.setAttribute('data-error-context', 'desativar-conta');

  const { ok, dados, erroConexao } = await postJSON('/api/contas/' + encodeURIComponent(usuarioLogado) + '/desativar-conta', { tipo }, 'PUT');

  if (erroConexao) {
    erro.textContent = 'Erro ao conectar com o servidor.';
    mostrar(erro);
    return;
  }

  if (!ok) {
    erro.textContent = dados.erro || 'Nao foi possivel desativar a conta.';
    mostrar(erro);
    return;
  }

  contaCorrenteAtiva = dados.contaCorrenteAtiva;
  contaPoupancaAtiva = dados.contaPoupancaAtiva;
  atualizarAcessoBoasVindas();
  atualizarPerfilUI();
}

// Toggle individual por tipo de conta: chama ativar ou desativar conforme
// o estado atual (habilitada e ativa) daquele tipo especifico.
function toggleConta(tipo) {
  const ativa = tipo === 'corrente' ? (contaCorrenteHabilitada && contaCorrenteAtiva) : (contaPoupancaHabilitada && contaPoupancaAtiva);
  return ativa ? desativarConta(tipo) : ativarConta(tipo);
}

// Exclui a conta do usuario logado. O backend recusa a exclusao caso o
// saldo corrente ou poupanca nao esteja zerado, para nao apagar dinheiro
// sem aviso. Acao irreversivel: exige confirmacao explicita antes de chamar a API.
async function excluirContaUsuario() {
  // Dialogo nativo do browser: automacao (Selenium/Playwright/Cypress) precisa
  // interceptar/tratar esse confirm() antes do clique, ou o fluxo trava aqui.
  const confirmado = confirm('Tem certeza que deseja excluir sua conta? Essa acao e irreversivel e remove todo o historico.');
  if (!confirmado) return;

  const erro = document.getElementById('erro-perfil');
  erro.setAttribute('data-error-context', 'excluir-conta');

  const resposta = await fetch('/api/contas/' + encodeURIComponent(usuarioLogado), { method: 'DELETE' });
  const dados = await resposta.json();

  if (!resposta.ok) {
    erro.textContent = dados.erro || 'Nao foi possivel excluir a conta.';
    mostrar(erro);
    return;
  }

  esconder('tela-perfil');
  sair();
}

document.getElementById('btn-perfil').addEventListener('click', abrirPerfil);
document.getElementById('btn-voltar-perfil').addEventListener('click', fecharPerfil);
document.getElementById('btn-toggle-corrente').addEventListener('click', () => toggleConta('corrente'));
document.getElementById('btn-toggle-poupanca').addEventListener('click', () => toggleConta('poupanca'));
document.getElementById('btn-excluir-conta').addEventListener('click', excluirContaUsuario);

async function aplicarRendimentoPoupanca() {
  try {
    const resposta = await fetch('/api/contas/' + encodeURIComponent(usuarioLogado) + '/render-poupanca', {
      method: 'POST'
    });
    if (!resposta.ok) return;

    const dados = await resposta.json();
    exibirSaldo('saldo-poupanca', 'Saldo conta poupanca: ', dados.saldoPoupanca);
  } catch (e) {
    // Rendimento e um complemento do saldo; falha ao aplicar nao deve
    // impedir o restante da tela de poupanca de funcionar.
  }
}

async function abrirContaPoupanca() {
  esconder('tela-boas-vindas');
  mostrar('tela-conta-poupanca');
  await aplicarRendimentoPoupanca();
  await carregarMovimentacoes(usuarioLogado);
}

function fecharContaPoupanca() {
  esconder('tela-conta-poupanca');
  mostrar('tela-boas-vindas');
}

document.getElementById('btn-conta-poupanca').addEventListener('click', abrirContaPoupanca);
document.getElementById('btn-voltar-conta-poupanca').addEventListener('click', fecharContaPoupanca);

async function abrirExtratoPoupanca() {
  esconder('tela-conta-poupanca');
  mostrar('tela-extrato-poupanca');
  paginaAtualExtratoPoupanca = 1;
  await carregarMovimentacoes(usuarioLogado);
  renderizarExtratoPoupanca();
}

function fecharExtratoPoupanca() {
  esconder('tela-extrato-poupanca');
  mostrar('tela-conta-poupanca');
}

document.getElementById('btn-extrato-poupanca').addEventListener('click', abrirExtratoPoupanca);
document.getElementById('btn-voltar-extrato-poupanca').addEventListener('click', fecharExtratoPoupanca);

document.getElementById('btn-extrato-poupanca-anterior').addEventListener('click', function() {
  paginaAtualExtratoPoupanca--;
  renderizarExtratoPoupanca();
});

document.getElementById('btn-extrato-poupanca-proxima').addEventListener('click', function() {
  paginaAtualExtratoPoupanca++;
  renderizarExtratoPoupanca();
});

async function sacarPoupanca() {
  const input = document.getElementById('valor-saque-poupanca');
  const erro = document.getElementById('erro-saque-poupanca');
  const valor = Number(input.value);

  if (!valorFormularioValido(input.value, valor)) {
    erro.textContent = 'Informe um valor valido para saque.';
    mostrar(erro);
    return;
  }

  const { ok, dados, erroConexao } = await postJSON('/api/contas/' + encodeURIComponent(usuarioLogado) + '/saque-poupanca', { valor });

  if (erroConexao) {
    erro.textContent = 'Erro ao conectar com o servidor.';
    mostrar(erro);
    return;
  }

  if (!ok) {
    erro.textContent = dados.erro || 'Nao foi possivel realizar o saque.';
    mostrar(erro);
    return;
  }

  esconder(erro);
  input.value = '';

  exibirSaldo('saldo-poupanca', 'Saldo conta poupanca: ', dados.saldoPoupanca);

  await carregarMovimentacoes(usuarioLogado);
  renderizarExtratoPoupanca();
}

document.getElementById('saque-poupanca-form').addEventListener('submit', function(e) {
  e.preventDefault();
  sacarPoupanca();
});

async function depositarPoupanca() {
  const input = document.getElementById('valor-deposito-poupanca');
  const erro = document.getElementById('erro-deposito-poupanca');
  const valor = Number(input.value);

  if (!valorFormularioValido(input.value, valor)) {
    erro.textContent = 'Informe um valor valido para deposito.';
    mostrar(erro);
    return;
  }

  const { ok, dados, erroConexao } = await postJSON('/api/contas/' + encodeURIComponent(usuarioLogado) + '/deposito-poupanca', { valor });

  if (erroConexao) {
    erro.textContent = 'Erro ao conectar com o servidor.';
    mostrar(erro);
    return;
  }

  if (!ok) {
    erro.textContent = dados.erro || 'Nao foi possivel realizar o deposito.';
    mostrar(erro);
    return;
  }

  esconder(erro);
  input.value = '';

  exibirSaldo('saldo-poupanca', 'Saldo conta poupanca: ', dados.saldoPoupanca);

  await carregarMovimentacoes(usuarioLogado);
  renderizarExtratoPoupanca();
}

document.getElementById('deposito-poupanca-form').addEventListener('submit', function(e) {
  e.preventDefault();
  depositarPoupanca();
});

function abrirTransferencia() {
  // Transferencias exigem conta corrente habilitada e ativa; sem isso a tela nem abre.
  if (!contaCorrenteHabilitada || !contaCorrenteAtiva) return;

  esconder('tela-boas-vindas');
  mostrar('tela-transferencia');

  const selectOrigem = document.getElementById('transferencia-conta-origem');
  selectOrigem.innerHTML = '';

  if (contaCorrenteHabilitada) {
    const opcao = document.createElement('option');
    opcao.value = 'corrente';
    opcao.textContent = 'Conta corrente';
    selectOrigem.appendChild(opcao);
  }

  if (contaPoupancaHabilitada) {
    const opcao = document.createElement('option');
    opcao.value = 'poupanca';
    opcao.textContent = 'Conta poupanca';
    selectOrigem.appendChild(opcao);
  }
}

function fecharTransferencia() {
  esconder('tela-transferencia');
  mostrar('tela-boas-vindas');
  document.getElementById('transferencia-destinatario').value = '';
  document.getElementById('valor-transferencia').value = '';
  esconder('erro-transferencia');
  esconder('sucesso-transferencia');
}

document.getElementById('btn-transferencia').addEventListener('click', abrirTransferencia);
document.getElementById('btn-voltar-transferencia').addEventListener('click', fecharTransferencia);

async function transferir() {
  const destinatario = document.getElementById('transferencia-destinatario').value.trim();
  const contaOrigem = document.getElementById('transferencia-conta-origem').value;
  const contaDestino = document.getElementById('transferencia-conta-destino').value;
  const input = document.getElementById('valor-transferencia');
  const valor = Number(input.value);
  const erro = document.getElementById('erro-transferencia');
  const sucesso = document.getElementById('sucesso-transferencia');

  esconder(sucesso);

  if (!destinatario || !valorFormularioValido(input.value, valor)) {
    erro.textContent = 'Informe o usuario destinatario e um valor valido.';
    mostrar(erro);
    return;
  }

  const { ok, dados, erroConexao } = await postJSON('/api/contas/' + encodeURIComponent(usuarioLogado) + '/transferencia', { destinatario, valor, contaOrigem, contaDestino });

  if (erroConexao) {
    erro.textContent = 'Erro ao conectar com o servidor.';
    mostrar(erro);
    return;
  }

  if (!ok) {
    erro.textContent = dados.erro || 'Nao foi possivel realizar a transferencia.';
    mostrar(erro);
    return;
  }

  esconder(erro);
  input.value = '';
  document.getElementById('transferencia-destinatario').value = '';

  if (contaOrigem === 'corrente') {
    exibirSaldo('saldo-corrente', 'Saldo conta corrente: ', dados.saldoCorrente);
  } else {
    exibirSaldo('saldo-poupanca', 'Saldo conta poupanca: ', dados.saldoPoupanca);
  }

  sucesso.textContent = 'Transferencia realizada com sucesso.';
  mostrar(sucesso);

  await carregarMovimentacoes(usuarioLogado);
  renderizarExtrato();
  renderizarExtratoPoupanca();
}

document.getElementById('transferencia-form').addEventListener('submit', function(e) {
  e.preventDefault();
  transferir();
});

function abrirTransferenciaInterna() {
  // So abre com os dois tipos de conta habilitados e ativos (mesma regra
  // que controla a visibilidade do botao); protege contra acesso direto.
  if (!(contaCorrenteHabilitada && contaCorrenteAtiva && contaPoupancaHabilitada && contaPoupancaAtiva)) return;

  esconder('tela-boas-vindas');
  mostrar('tela-transferencia-interna');
}

function fecharTransferenciaInterna() {
  esconder('tela-transferencia-interna');
  mostrar('tela-boas-vindas');
  document.getElementById('valor-transferencia-interna').value = '';
  esconder('erro-transferencia-interna');
  esconder('sucesso-transferencia-interna');
}

document.getElementById('btn-transferencia-interna').addEventListener('click', abrirTransferenciaInterna);
document.getElementById('btn-voltar-transferencia-interna').addEventListener('click', fecharTransferenciaInterna);

async function transferirEntreMinhasContas() {
  const contaOrigem = document.getElementById('transferencia-interna-conta-origem').value;
  const input = document.getElementById('valor-transferencia-interna');
  const valor = Number(input.value);
  const erro = document.getElementById('erro-transferencia-interna');
  const sucesso = document.getElementById('sucesso-transferencia-interna');

  esconder(sucesso);

  if (!valorFormularioValido(input.value, valor)) {
    erro.textContent = 'Informe um valor valido para transferencia.';
    mostrar(erro);
    return;
  }

  const { ok, dados, erroConexao } = await postJSON('/api/contas/' + encodeURIComponent(usuarioLogado) + '/transferencia-interna', { contaOrigem, valor });

  if (erroConexao) {
    erro.textContent = 'Erro ao conectar com o servidor.';
    mostrar(erro);
    return;
  }

  if (!ok) {
    erro.textContent = dados.erro || 'Nao foi possivel realizar a transferencia.';
    mostrar(erro);
    return;
  }

  esconder(erro);
  input.value = '';

  exibirSaldo('saldo-corrente', 'Saldo conta corrente: ', dados.saldoCorrente);
  exibirSaldo('saldo-poupanca', 'Saldo conta poupanca: ', dados.saldoPoupanca);

  sucesso.textContent = 'Transferencia realizada com sucesso.';
  mostrar(sucesso);

  await carregarMovimentacoes(usuarioLogado);
  renderizarExtrato();
  renderizarExtratoPoupanca();
}

document.getElementById('transferencia-interna-form').addEventListener('submit', function(e) {
  e.preventDefault();
  transferirEntreMinhasContas();
});

function sair() {
  document.getElementById('username').value = '';
  document.getElementById('senha').value = '';
  esconder('tela-extrato');
  esconder('tela-conta-poupanca');
  esconder('tela-extrato-poupanca');
  esconder('tela-transferencia');
  esconder('tela-transferencia-interna');
  esconder('tela-boas-vindas');
  mostrar('tela-login');

  usuarioLogado = '';
  idadeLogada = null;
  contaCorrenteHabilitada = false;
  contaPoupancaHabilitada = false;
  contaCorrenteAtiva = true;
  contaPoupancaAtiva = true;
  esconder('btn-transferencia');
  esconder('btn-transferencia-interna');
  movimentacoesCache = [];
  document.getElementById('extrato-lista').innerHTML = '';
  esconder('extrato-vazio');
  document.getElementById('extrato-poupanca-lista').innerHTML = '';
  esconder('extrato-poupanca-vazio');
  esconder('extrato-poupanca-paginacao');
  paginaAtualExtratoPoupanca = 1;
}

document.getElementById('login-form').addEventListener('submit', function(e) {
  e.preventDefault();
  logar();
});

document.getElementById('btn-sair').addEventListener('click', sair);

function irParaCadastro() {
  esconder('tela-login');
  mostrar('tela-cadastro');
}

const LIMITE_CARACTERES = 6;
// Apenas letras, numeros, "_" e "." — sem espacos e sem simbolos. Espelha
// CARACTERES_PERMITIDOS do backend (server.js).
const CARACTERES_PERMITIDOS = /^[A-Za-z0-9_.]*$/;
const IDADE_MINIMA = 0;
const IDADE_MAXIMA = 120;
const IDADE_MINIMA_CONTA_CORRENTE = 18;

// Padrao de validacao por campo desta tela: cada input relevante tem um
// span de erro proprio (id "erro-campo-<id-do-input>") logo abaixo dele no HTML.
// exibirErroCampo/ocultarErroCampo populam/escondem esse span especifico.
// Futuras validacoes de campo nesta tela devem seguir o mesmo formato.
function exibirErroCampo(idInput, mensagem) {
  const spanErro = document.getElementById(`erro-campo-${idInput}`);
  spanErro.textContent = mensagem;
  mostrar(spanErro);
}

function ocultarErroCampo(idInput) {
  esconder(`erro-campo-${idInput}`);
}

// So exibimos a mensagem de erro do tipo de conta depois que o usuario
// interagir com esse campo (ou tentar enviar o formulario). Sem isso, a
// mensagem aparecia assim que qualquer outro campo era digitado, pois
// nenhum checkbox de tipo de conta esta marcado no inicio.
let tipoContaTocado = false;

function validarLimiteCadastro() {
  const username = document.getElementById('cad-username').value;
  const senha = document.getElementById('cad-senha').value;
  const idade = document.getElementById('cad-idade').value;
  const btnCriarConta = document.getElementById('btn-criar-conta');

  const contaCorrente = document.getElementById('cad-tipo-conta-corrente').checked;
  const contaPoupanca = document.getElementById('cad-tipo-conta-poupanca').checked;

  const usernameCaractereInvalido = !CARACTERES_PERMITIDOS.test(username);
  const senhaCaractereInvalida = !CARACTERES_PERMITIDOS.test(senha);
  const usernameInvalido = username.length >= LIMITE_CARACTERES || usernameCaractereInvalido;
  const senhaInvalida = senha.length >= LIMITE_CARACTERES || senhaCaractereInvalida;
  const idadeInvalida = idade !== '' && (idade < IDADE_MINIMA || idade > IDADE_MAXIMA);
  const contaCorrenteMenorIdade = contaCorrente && idade !== '' && idade < IDADE_MINIMA_CONTA_CORRENTE;
  const tipoContaInvalido = (!contaCorrente && !contaPoupanca) || contaCorrenteMenorIdade;

  if (usernameCaractereInvalido) {
    exibirErroCampo('cad-username', 'Use apenas letras, numeros, "_" e ".", sem espacos.');
  } else if (usernameInvalido) {
    exibirErroCampo('cad-username', 'O campo de usuario atingiu o limite maximo de caracteres.');
  } else {
    ocultarErroCampo('cad-username');
  }

  if (senhaCaractereInvalida) {
    exibirErroCampo('cad-senha', 'Use apenas letras, numeros, "_" e ".", sem espacos.');
  } else if (senhaInvalida) {
    exibirErroCampo('cad-senha', 'O campo de senha atingiu o limite maximo de caracteres.');
  } else {
    ocultarErroCampo('cad-senha');
  }

  if (idadeInvalida) {
    exibirErroCampo('cad-idade', `A idade deve estar entre ${IDADE_MINIMA} e ${IDADE_MAXIMA}.`);
  } else {
    ocultarErroCampo('cad-idade');
  }

  let tipoContaErroVisivel = false;

  if (!tipoContaTocado) {
    ocultarErroCampo('cad-tipo-conta');
  } else if (contaCorrenteMenorIdade) {
    exibirErroCampo('cad-tipo-conta', 'Conta corrente exige idade minima de 18 anos.');
    tipoContaErroVisivel = true;
  } else if (tipoContaInvalido) {
    exibirErroCampo('cad-tipo-conta', 'Selecione ao menos um tipo de conta.');
    tipoContaErroVisivel = true;
  } else {
    ocultarErroCampo('cad-tipo-conta');
  }

  btnCriarConta.disabled = usernameInvalido || senhaInvalida || idadeInvalida || tipoContaErroVisivel;
}

document.getElementById('cad-username').addEventListener('input', validarLimiteCadastro);
document.getElementById('cad-senha').addEventListener('input', validarLimiteCadastro);
document.getElementById('cad-idade').addEventListener('input', validarLimiteCadastro);
function marcarTipoContaTocadoEValidar() {
  tipoContaTocado = true;
  validarLimiteCadastro();
}

document.getElementById('cad-tipo-conta-corrente').addEventListener('change', marcarTipoContaTocadoEValidar);
document.getElementById('cad-tipo-conta-poupanca').addEventListener('change', marcarTipoContaTocadoEValidar);

async function cadastrar() {
  // Ao tentar enviar o formulario, a mensagem de tipo de conta passa a
  // valer mesmo que o usuario ainda nao tenha clicado nos checkboxes.
  tipoContaTocado = true;
  validarLimiteCadastro();

  const username = document.getElementById('cad-username').value.trim();
  const senha = document.getElementById('cad-senha').value.trim();
  const idade = document.getElementById('cad-idade').value;
  const contaCorrente = document.getElementById('cad-tipo-conta-corrente').checked;
  const contaPoupanca = document.getElementById('cad-tipo-conta-poupanca').checked;
  const erro = document.getElementById('erro-cadastro');

  if (!username || !senha || !idade) {
    erro.textContent = 'Preencha todos os campos.';
    mostrar(erro);
    return;
  }

  if (!contaCorrente && !contaPoupanca) {
    erro.textContent = 'Selecione ao menos um tipo de conta.';
    mostrar(erro);
    return;
  }

  try {
    const resposta = await fetch('/api/contas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, senha, idade: Number(idade), contaCorrente, contaPoupanca })
    });

    if (!resposta.ok) {
      const dados = await resposta.json();
      erro.textContent = dados.erro || 'Nao foi possivel criar a conta.';
      mostrar(erro);
      return;
    }

    esconder(erro);
    esconder('cadastro-form');
    mostrar('cadastro-sucesso');
  } catch (e) {
    erro.textContent = 'Erro ao conectar com o servidor.';
    mostrar(erro);
  }
}

function voltarParaLogin() {
  tipoContaTocado = false;
  document.getElementById('cad-username').value = '';
  document.getElementById('cad-senha').value = '';
  document.getElementById('cad-idade').value = '';
  document.getElementById('cad-tipo-conta-corrente').checked = false;
  document.getElementById('cad-tipo-conta-poupanca').checked = false;
  esconder('erro-cadastro');
  ocultarErroCampo('cad-username');
  ocultarErroCampo('cad-senha');
  ocultarErroCampo('cad-idade');
  ocultarErroCampo('cad-tipo-conta');
  document.getElementById('btn-criar-conta').disabled = false;
  esconder('cadastro-sucesso');
  mostrar('cadastro-form');
  esconder('tela-cadastro');
  mostrar('tela-login');
}

document.getElementById('btn-ir-cadastro').addEventListener('click', irParaCadastro);

document.getElementById('cadastro-form').addEventListener('submit', function(e) {
  e.preventDefault();
  cadastrar();
});

document.getElementById('btn-voltar-login').addEventListener('click', voltarParaLogin);
