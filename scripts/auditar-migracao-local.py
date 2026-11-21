#!/usr/bin/env python3
"""Audita dependências de servidor antes de liberar o ACR OS Pro offline."""
from pathlib import Path
import re
import sys

root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("ospro-eletrica-software")
assets = root / "app/src/main/assets"
if not assets.is_dir():
    raise SystemExit(f"Diretório Android não encontrado: {assets}")
patterns = {
    "Render": re.compile(r"onrender\.com", re.I),
    "HTTPS remoto": re.compile(r"https?://[^\s\x22\x27<>]+", re.I),
    "API da equipe": re.compile(r"/api/team/"),
    "Requisição de rede": re.compile(r"\bfetch\s*\("),
}
count = 0
for file in sorted(assets.rglob("*")):
    if not file.is_file() or file.suffix.lower() not in {".js", ".html", ".json", ".kt"}:
        continue
    lines = file.read_text(encoding="utf-8", errors="replace").splitlines()
    for number, line in enumerate(lines, 1):
        hits = [name for name, pattern in patterns.items() if pattern.search(line)]
        if hits:
            count += 1
            print(f"{file.relative_to(root)}:{number}: {', '.join(hits)}")
print(f"Total de linhas que exigem revisão: {count}")
print("Relatório de diagnóstico: NÃO significa que o APK já funciona offline.")
print("STATUS OFFLINE: NÃO VALIDADO — autenticação, API e fluxos de dados ainda precisam de testes funcionais.")
