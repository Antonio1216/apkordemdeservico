#!/usr/bin/env bash
# Repara somente o modulo local de PDF no servidor ACR OS Pro v1.7.
# NAO altera configuracoes, registros, chave administrativa, usuarios nem PDFs existentes.
set -Eeuo pipefail
TARGET="${OSPRO_SERVER_DIR:-$HOME/ospro-servidor/ospro-eletrica-software/server}"
PATCH_URL="https://raw.githubusercontent.com/Antonio1216/apkordemdeservico/main/scripts/v1.3-server-patch.tgz.b64"
SHA256="2ccafcebdc351173157ae0aba81a35fcb822ef095cc5be2989e0fa3db01445ae"

if [[ ! -f "$TARGET/server.js" ]]; then
  echo "ERRO: nao encontrei $TARGET/server.js"
  exit 1
fi
for tool in curl base64 tar sha256sum node; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "ERRO: falta instalar $tool no Termux."
    exit 1
  fi
done

temp="$(mktemp -d)"
trap 'rm -rf "$temp"' EXIT
umask 077
echo "Baixando modulo de PDF do ACR OS Pro..."
curl --fail --location --silent --show-error "$PATCH_URL" -o "$temp/server.b64"
base64 -d "$temp/server.b64" > "$temp/server.tgz"
echo "$SHA256  $temp/server.tgz" | sha256sum -c -
tar -xOzf "$temp/server.tgz" server/pdf.js > "$temp/pdf.js"
test -s "$temp/pdf.js"
node --check "$temp/pdf.js"
if [[ -f "$TARGET/pdf.js" ]]; then
  mkdir -p "$HOME/ospro-backups"
  cp -p "$TARGET/pdf.js" "$HOME/ospro-backups/pdf.js.$(date +%Y%m%d-%H%M%S)"
fi
cp "$temp/pdf.js" "$TARGET/pdf.js"
chmod 600 "$TARGET/pdf.js"
node --check "$TARGET/server.js"
node -e "const mod=require(process.argv[1]); if(typeof mod.makePdf!=='function') process.exit(1); console.log('Modulo PDF funcionando.')" "$TARGET/pdf.js"
echo "REPARO CONCLUIDO: servidor tem pdf.js e team-api.js:"
ls -l "$TARGET"/pdf.js "$TARGET"/team-api.js
echo "Agora execute: bash ~/iniciar-ospro.sh"
