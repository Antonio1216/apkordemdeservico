#!/usr/bin/env bash
set -Eeuo pipefail
# Atualiza somente o servidor instalado no Termux. Nao altera requests.json nem a chave ADMIN_KEY.
TARGET="${OSPRO_SERVER_DIR:-$HOME/ospro-servidor/ospro-eletrica-software/server}"
URL="https://raw.githubusercontent.com/Antonio1216/apkordemdeservico/main/scripts/ospro-v1.7-overlay.tgz.b64"
PDF_URL="https://raw.githubusercontent.com/Antonio1216/apkordemdeservico/main/scripts/v1.3-server-patch.tgz.b64"
if [[ ! -f "$TARGET/server.js" ]]; then
  echo "Servidor OS Pro nao encontrado em: $TARGET"
  exit 1
fi
for x in curl base64 tar sha256sum node;do
  if ! command -v "$x" >/dev/null 2>&1;then
    echo "Instale o utilitario $x no Termux."
    exit 1
  fi
done
temp=$(mktemp -d)
trap 'rm -rf "$temp"' EXIT
mkdir -p "$temp/work" "$temp/backup"
echo "Baixando alteracao segura ACR OS Pro 1.7..."
curl --fail --location --silent --show-error "$URL" > "$temp/patch.b64"
base64 -d "$temp/patch.b64" > "$temp/patch.tgz"
echo "4d9776c030443ce84ca5fced0794319846e27588b37107a6926e71feca6998d8  $temp/patch.tgz" | sha256sum -c -
tar -xzf "$temp/patch.tgz" -C "$temp/work" server/server.js server/team-api.js server/tests/team.test.js
node --check "$temp/work/server/server.js"
node --check "$temp/work/server/team-api.js"
echo "Restaurando o modulo de geracao de PDF do servidor..."
curl --fail --location --silent --show-error "$PDF_URL" > "$temp/pdf.b64"
base64 -d "$temp/pdf.b64" > "$temp/pdf.tgz"
echo "2ccafcebdc351173157ae0aba81a35fcb822ef095cc5be2989e0fa3db01445ae  $temp/pdf.tgz" | sha256sum -c -
tar -xzf "$temp/pdf.tgz" -C "$temp/work" server/pdf.js
node --check "$temp/work/server/pdf.js"
cp "$TARGET/server.js" "$temp/backup/server.js"
if [[ -f "$TARGET/pdf.js" ]];then cp "$TARGET/pdf.js" "$temp/backup/pdf.js";fi
if [[ -f "$TARGET/team-api.js" ]];then cp "$TARGET/team-api.js" "$temp/backup/team-api.js";fi
mkdir -p "$TARGET/tests" "$HOME/ospro-backups"
stamp=$(date '+%Y%m%d-%H%M%S')
cp -a "$temp/backup" "$HOME/ospro-backups/servidor-$stamp"
cp "$temp/work/server/server.js" "$TARGET/server.js"
cp "$temp/work/server/team-api.js" "$TARGET/team-api.js"
cp "$temp/work/server/pdf.js" "$TARGET/pdf.js"
cp "$temp/work/server/tests/team.test.js" "$TARGET/tests/team.test.js"
echo "Servidor v1.7 corrigido: pdf.js instalado. Chave, PDFs e registros existentes foram preservados."
echo "Seu banco de equipe sera gravado ao lado do requests.json em team.json."
echo "Pare o servidor antigo (CTRL+C) e reinicie: bash ~/iniciar-ospro.sh"
