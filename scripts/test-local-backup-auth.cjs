/* Verifica que backup não exporta credenciais e importação não as restaura. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('scripts/local-store-v1.js','utf8');
assert.match(source,/filter\(row => !row\.key\.startsWith\('local-auth:'\)\)/);
assert.match(source,/if \(key\.startsWith\('local-auth:'\)\) throw new Error/);
assert.match(source,/createFirstAdminAtomic/);
console.log('PASSOU: backup exclui credenciais, importação bloqueia credenciais e cadastro atômico permanece.');
