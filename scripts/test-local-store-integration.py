#!/usr/bin/env python3
"""Testes estáticos da camada local; não substituem testes em Android."""
from pathlib import Path
import sys

root = Path(sys.argv[1] if len(sys.argv)>1 else "ospro-eletrica-software")
assets = root / "app/src/main/assets"
html = (assets / "index.html").read_text(encoding="utf-8")
js = (assets / "local-store.js").read_text(encoding="utf-8")
assert html.count('src="local-store.js"') == 1, "Script local não carregado exatamente uma vez"
assert 'src="auth.js"' in html, "Fluxo de autenticação original ausente"
assert html.index('src="local-store.js"') < html.index('src="local-modules.js"') < html.index('src="auth.js"'), "Armazenamento local precisa iniciar antes do login"
assert 'indexedDB.open' in js, "Persistência IndexedDB ausente"
assert "db.transaction(STORE, mode)" in js, "Transações ausentes"
assert "tx.oncomplete" in js, "Confirmação de gravação ausente"
assert "tx.onabort" in js, "Tratamento de rollback ausente"
assert "BACKUP_FORMAT" in js and "importBackup" in js and "exportBackup" in js
assert "onrender.com" not in js.lower(), "Camada local não pode depender do Render"
print("PASSOU: camada local instalada e estrutura de transações verificada.")
print("PENDENTE: integração do login e APIs, testes funcionais e assinatura do APK.")
