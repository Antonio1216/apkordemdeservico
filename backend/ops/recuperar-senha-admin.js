'use strict';
// Recuperacao operacional para o proprietario com acesso ao Render Web Shell.
// Nao e rota HTTP. Nao solicita ADMIN_KEY, nao imprime senhas, exige TTY.
const fs = require('node:fs');
const crypto = require('node:crypto');
const file = process.env.TEAM_DATA_FILE || '/var/data/team.json';
const login = 'antonio1216';

function secretInput(message) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
      reject(new Error('Execute diretamente no Web Shell interativo do Render.'));
      return;
    }
    let value = '';
    let finished = false;
    const finish = (err) => {
      if (finished) return;
      finished = true;
      process.stdin.removeListener('data', onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
      if (err) reject(err); else resolve(value);
    };
    function onData(chunk) {
      for (const char of chunk) {
        if (char === '\u0003' || char === '\u0004') return finish(new Error('Operacao cancelada.'));
        if (char === '\r' || char === '\n') return finish(null);
        if (char === '\u007f' || char === '\b') {
          value = value.slice(0, -1);
        } else if (char >= ' ' && char !== '\u007f' && value.length < 128) {
          value += char;
        }
      }
    }
    process.stdout.write(message);
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', onData);
    process.stdin.setRawMode(true);
    process.stdin.resume();
  });
}

async function main() {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(data.accounts)) throw new Error('Cadastro de contas invalido.');
  const matching = data.accounts.filter(a => a.login === login && a.perfil === 'Administrador' && a.active !== false);
  if (matching.length !== 1) throw new Error('Administrador ativo nao encontrado ou duplicado. Nada foi alterado.');
  console.log('Recuperacao local da conta ' + login + '.');
  console.log('Sua senha nao aparecera no terminal. Digite e pressione Enter.');
  const password = await secretInput('Nova senha (12 a 128 caracteres): ');
  if (password.length < 12 || password.length > 128) throw new Error('Senha precisa ter entre 12 e 128 caracteres. Nada foi alterado.');
  const confirm = await secretInput('Repita a nova senha: ');
  if (password !== confirm) throw new Error('As senhas nao coincidem. Nada foi alterado.');
  const current = JSON.parse(fs.readFileSync(file, 'utf8'));
  const matches = current.accounts.filter(a => a.login === login && a.perfil === 'Administrador' && a.active !== false);
  if (matches.length !== 1) throw new Error('Os dados de usuarios mudaram; tente novamente.');
  const acc = matches[0];
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, Buffer.from(salt, 'hex'), 64, {N: 16384, r: 8, p: 1}).toString('hex');
  const backup = file + '.pre-recuperacao-' + new Date().toISOString().replace(/[^0-9]/g, '') + '.bak';
  fs.copyFileSync(file, backup, fs.constants.COPYFILE_EXCL);
  fs.chmodSync(backup, 0o600);
  acc.salt = salt;
  acc.hash = hash;
  acc.rev = (Number.isInteger(acc.rev) ? acc.rev : 0) + 1;
  delete acc.emailReset;
  current.audit ||= [];
  current.audit.push({action: 'admin-password-recovery-shell', actor: acc.id, at: new Date().toISOString()});
  if (current.audit.length > 500) current.audit = current.audit.slice(-500);
  const temp = file + '.' + process.pid + '.tmp';
  try {
    fs.writeFileSync(temp, JSON.stringify(current), {mode: 0o600, flag: 'wx'});
    fs.renameSync(temp, file);
  } finally {
    try { fs.unlinkSync(temp); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  console.log('SENHA ALTERADA NO ARQUIVO. Reinicie agora o servico Render antes de tentar entrar.');
}

main().catch(err => { console.error('NAO CONCLUIDO: ' + err.message); process.exitCode = 1; });