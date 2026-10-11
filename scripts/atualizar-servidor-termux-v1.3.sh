#!/usr/bin/env bash
# OS Pro v1.3 - atualizador seguro para Android/Termux
set -Eeuo pipefail
APP="$HOME/ospro-servidor/ospro-eletrica-software"
URL="https://raw.githubusercontent.com/Antonio1216/apkordemdeservico/main/scripts/v1.3-server-patch.tgz.b64"
SHA="2ccafcebdc351173157ae0aba81a35fcb822ef095cc5be2989e0fa3db01445ae"
if [[ ! -f "$APP/server/server.js" ]]; then
  echo "Nao encontrei o servidor em: $APP/server"
  exit 1
fi
if curl -fsS --max-time 2 http://127.0.0.1:3000/health >/dev/null 2>&1; then
  echo "O servidor ainda esta ligado. Volte a tela dele e aperte Ctrl+C."
  echo "Depois rode novamente este comando."
  exit 2
fi
mkdir -p "$HOME/.ospro-backups"
stamp="$(date +%Y%m%d-%H%M%S)"
backup="$HOME/.ospro-backups/servidor-$stamp.tar.gz"
tar -czf "$backup" -C "$APP" server/server.js server/public/sign.html server/public/sign.js
echo "Backup do codigo antigo: $backup"
tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT
echo "Baixando versao v1.3 de seu GitHub..."
curl --fail --location --silent --show-error "$URL" | base64 -d > "$tmp"
printf "%s  %s\n" "$SHA" "$tmp" | sha256sum -c -
tar -tzf "$tmp" >/dev/null
tar -xzf "$tmp" -C "$APP"
rm -f "$APP/patch_app.py"
node --check "$APP/server/server.js"
node --check "$APP/server/public/sign.js"
echo "Servidor v1.3 atualizado. Os arquivos de assinatura e a chave nao foram apagados."
echo "Agora rode: bash ~/iniciar-ospro.sh"
echo "O Cloudflare pode gerar outra URL; atualize Configuracoes do app se ela mudar."
