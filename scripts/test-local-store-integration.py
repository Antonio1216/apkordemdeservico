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
assert html.count('src="local-first-run.js"') == 1, 'Cadastro inicial local ausente ou duplicado'
assert (assets / 'local-first-run.js').is_file(), 'Script de primeiro acesso não foi copiado'
assert html.count('src="local-login-ui.js"') == 1, 'Controlador da interface local ausente ou duplicado'
assert (assets / 'local-login-ui.js').is_file(), 'Controlador da interface não foi copiado'
assert html.count('id="local-auth-panel"') == 1, 'Painel de login local ausente ou duplicado'
assert html.count('id="local-auth-setup"') == 1, 'Formulário de primeiro cadastro ausente'
assert html.count('id="local-auth-login"') == 1, 'Formulário de autenticação local ausente'
assert html.count('id="local-auth-message"') == 1, 'Mensagem acessível do login local ausente'
assert 'type="password"' in html and 'autocomplete="new-password"' in html, 'Senha local deve usar campo protegido'
assert html.count('src="local-session.js"') == 1, 'Sessão local ausente ou duplicada'
assert (assets / 'local-session.js').is_file(), 'Módulo de sessão não foi copiado'
assert html.count('src="local-permissions.js"') == 1, 'Autorização local ausente ou duplicada'
assert (assets / 'local-permissions.js').is_file(), 'Módulo de permissões não foi copiado'
assert 'src="auth.js"' in html, "Fluxo de autenticação original ausente"
assert html.index('src="local-store.js"') < html.index('src="local-modules.js"') < html.index('src="senha-local.js"') < html.index('src="local-first-run.js"') < html.index('src="local-auth-prototype.js"') < html.index('src="local-session.js"') < html.index('src="local-permissions.js"') < html.index('src="local-login-ui.js"') < html.index('src="auth.js"'), "Armazenamento local precisa iniciar antes do login"
prototype = (assets / 'local-auth-prototype.js').read_text(encoding='utf-8')
assert "Provisionamento bloqueado" in prototype, "Provisionamento inseguro não pode ser liberado"
assert 'indexedDB.open' in js, "Persistência IndexedDB ausente"
assert "db.transaction(STORE, mode)" in js, "Transações ausentes"
assert "tx.oncomplete" in js, "Confirmação de gravação ausente"
assert "tx.onabort" in js, "Tratamento de rollback ausente"
assert "BACKUP_FORMAT" in js and "importBackup" in js and "exportBackup" in js
assert "onrender.com" not in js.lower(), "Camada local não pode depender do Render"
print("PASSOU: camada local e verificador de senhas carregados antes do login; transações verificadas.")
print("PENDENTE: integração do login e APIs, testes funcionais e assinatura do APK.")
