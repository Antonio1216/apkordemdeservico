#!/usr/bin/env python3
"""Testes estáticos da camada local; não substituem testes em Android."""
from pathlib import Path
import sys

root = Path(sys.argv[1] if len(sys.argv)>1 else "ospro-eletrica-software")
assets = root / "app/src/main/assets"
html = (assets / "index.html").read_text(encoding="utf-8")
js = (assets / "local-store.js").read_text(encoding="utf-8")
assert html.count('src="local-store.js"') == 1, "Script local não carregado exatamente uma vez"
assert html.count('src="senha-local.js"') == 1, "Verificador local não carregado exatamente uma vez"
assert (assets / 'senha-local.js').is_file(), "Arquivo de senha local ausente"
assert html.count('src="local-auth-prototype.js"') == 1, "Protótipo de autenticação local deve carregar exatamente uma vez"
assert (assets / 'local-auth-prototype.js').is_file(), "Protótipo de autenticação local ausente"
assert 'src="auth.js"' in html, "Fluxo de autenticação original ausente"
assert html.count('src="local-session.js"') == 1, "Sessão local deve carregar exatamente uma vez"
assert (assets / 'local-session.js').is_file(), "Módulo de sessão local ausente"
assert html.index('src="local-store.js"') < html.index('src="local-modules.js"') < html.index('src="senha-local.js"') < html.index('src="local-auth-prototype.js"') < html.index('src="local-session.js"') < html.index('src="auth.js"'), "Armazenamento local precisa iniciar antes do login"
prototype = (assets / 'local-auth-prototype.js').read_text(encoding='utf-8')
assert "Provisionamento bloqueado" in prototype, "Provisionamento inseguro não pode ser liberado"
session = (assets / 'local-session.js').read_text(encoding='utf-8')
assert 'ACRLocalAuthPrototype' in session and 'ACRLocalSession' in session, "Sessão local não está conectada ao protótipo"
assert 'onrender.com' not in session.lower() and 'fetch(' not in session, "Sessão local não pode depender de rede"
assert 'indexedDB.open' in js, "Persistência IndexedDB ausente"
assert "db.transaction(STORE, mode)" in js, "Transações ausentes"
assert "tx.oncomplete" in js, "Confirmação de gravação ausente"
assert "tx.onabort" in js, "Tratamento de rollback ausente"
assert "BACKUP_FORMAT" in js and "importBackup" in js and "exportBackup" in js
assert "onrender.com" not in js.lower(), "Camada local não pode depender do Render"
print("PASSOU: camada local e verificador de senhas carregados antes do login; transações verificadas.")
print("PENDENTE: integração do login e APIs, testes funcionais e assinatura do APK.")
