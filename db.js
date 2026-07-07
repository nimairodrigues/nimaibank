const path = require('path');
const Database = require('better-sqlite3');

const db = new Database(path.join(__dirname, 'nimaibank.db'));

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS contas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    senha TEXT NOT NULL,
    idade INTEGER NOT NULL,
    conta_corrente INTEGER NOT NULL DEFAULT 0,
    conta_poupanca INTEGER NOT NULL DEFAULT 0,
    saldo_corrente REAL NOT NULL DEFAULT 0,
    saldo_poupanca REAL NOT NULL DEFAULT 0,
    conta_corrente_ativa INTEGER NOT NULL DEFAULT 1,
    conta_poupanca_ativa INTEGER NOT NULL DEFAULT 1,
    poupanca_ultimo_rendimento TEXT NOT NULL DEFAULT (datetime('now')),
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS movimentacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conta_id INTEGER NOT NULL REFERENCES contas(id),
    conta_tipo TEXT NOT NULL DEFAULT 'corrente',
    tipo TEXT NOT NULL,
    valor REAL NOT NULL,
    descricao TEXT,
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// Migracao leve: bancos criados antes destas colunas existirem nao sao
// alterados pelo CREATE TABLE IF NOT EXISTS acima, entao adicionamos aqui
// caso ainda nao existam.
const colunas = db.prepare('PRAGMA table_info(contas)').all().map((c) => c.name);
if (!colunas.includes('conta_corrente')) {
  db.exec('ALTER TABLE contas ADD COLUMN conta_corrente INTEGER NOT NULL DEFAULT 0');
}
if (!colunas.includes('conta_poupanca')) {
  db.exec('ALTER TABLE contas ADD COLUMN conta_poupanca INTEGER NOT NULL DEFAULT 0');
}
if (!colunas.includes('saldo_corrente')) {
  db.exec('ALTER TABLE contas ADD COLUMN saldo_corrente REAL NOT NULL DEFAULT 0');
}
if (!colunas.includes('saldo_poupanca')) {
  db.exec('ALTER TABLE contas ADD COLUMN saldo_poupanca REAL NOT NULL DEFAULT 0');
}
if (!colunas.includes('conta_corrente_ativa')) {
  db.exec('ALTER TABLE contas ADD COLUMN conta_corrente_ativa INTEGER NOT NULL DEFAULT 1');
}
if (!colunas.includes('conta_poupanca_ativa')) {
  db.exec('ALTER TABLE contas ADD COLUMN conta_poupanca_ativa INTEGER NOT NULL DEFAULT 1');
}
if (!colunas.includes('poupanca_ultimo_rendimento')) {
  // SQLite nao aceita default nao-constante em ALTER TABLE ADD COLUMN, entao
  // a coluna e criada sem default e populada logo em seguida.
  db.exec('ALTER TABLE contas ADD COLUMN poupanca_ultimo_rendimento TEXT');
  // Contas ja existentes comecam a contar rendimento a partir de agora, e nao
  // desde a criacao (evita creditar de uma vez um rendimento retroativo grande).
  db.exec("UPDATE contas SET poupanca_ultimo_rendimento = datetime('now')");
}

const colunasMovimentacoes = db.prepare('PRAGMA table_info(movimentacoes)').all().map((c) => c.name);
if (!colunasMovimentacoes.includes('conta_tipo')) {
  db.exec("ALTER TABLE movimentacoes ADD COLUMN conta_tipo TEXT NOT NULL DEFAULT 'corrente'");
}

// Extrato/movimentacoes sao sempre buscados por conta_id e ordenados por
// criado_em DESC (ver GET /api/contas/:username/movimentacoes em server.js).
db.exec('CREATE INDEX IF NOT EXISTS idx_movimentacoes_conta ON movimentacoes(conta_id, criado_em DESC)');

module.exports = db;
