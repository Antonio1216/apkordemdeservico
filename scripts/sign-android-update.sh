#!/usr/bin/env bash
# Publica SOMENTE atualização de APK assinada com chave permanente.
# Nunca cria keystore novo. Se qualquer segredo estiver ausente, falha.
set -euo pipefail

: "${ANDROID_HOME:?ANDROID_HOME não configurado}"
: "${ACR_KEYSTORE_B64:?Configure ACR_KEYSTORE_B64 nos Secrets do GitHub}"
: "${ACR_KEYSTORE_PASSWORD:?Configure ACR_KEYSTORE_PASSWORD nos Secrets do GitHub}"
: "${ACR_KEY_ALIAS:?Configure ACR_KEY_ALIAS nos Secrets do GitHub}"
: "${ACR_KEY_PASSWORD:?Configure ACR_KEY_PASSWORD nos Secrets do GitHub}"
: "${ACR_SIGNER_SHA256:?Configure ACR_SIGNER_SHA256 com o fingerprint ORIGINAL do app instalado}"

ROOT="${1:-ospro-eletrica-software}"
UNSIGNED="$ROOT/app/build/outputs/apk/release/app-release-unsigned.apk"
OUT="${2:-ACR-OS-Pro-Atualizacao-Assinada.apk}"
TOOLS="$ANDROID_HOME/build-tools/35.0.0"
APK_SIGNER="$TOOLS/apksigner"
ZIPALIGN="$TOOLS/zipalign"
AAPT="$TOOLS/aapt"

[[ -s "$UNSIGNED" ]] || { echo "::error::Release não assinada ausente."; exit 1; }
for tool in "$APK_SIGNER" "$ZIPALIGN" "$AAPT"; do
  [[ -x "$tool" ]] || { echo "::error::Android SDK incompleto."; exit 1; }
done
[[ "$OUT" != "$UNSIGNED" ]] || { echo "::error::Saída não pode sobrescrever o release original."; exit 1; }
expected="$(printf '%s' "$ACR_SIGNER_SHA256" | tr -cd '[:xdigit:]' | tr '[:upper:]' '[:lower:]')"
[[ "${#expected}" -eq 64 ]] || { echo "::error::Fingerprint esperado SHA-256 deve conter exatamente 64 dígitos hexadecimais."; exit 1; }

# O diretório privado não entra nos artefatos de build ou no repositório.
umask 077
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
printf '%s' "$ACR_KEYSTORE_B64" | base64 --decode > "$tmp/signing.jks"
[[ -s "$tmp/signing.jks" ]] || { echo "::error::Keystore inválido."; exit 1; }

"$ZIPALIGN" -f -p 4 "$UNSIGNED" "$tmp/aligned.apk"
"$APK_SIGNER" sign \
  --ks "$tmp/signing.jks" --ks-key-alias "$ACR_KEY_ALIAS" \
  --ks-pass env:ACR_KEYSTORE_PASSWORD --key-pass env:ACR_KEY_PASSWORD \
  --out "$tmp/signed.apk" "$tmp/aligned.apk"
"$APK_SIGNER" verify --verbose "$tmp/signed.apk" > "$tmp/verify.log"
actual="$("$APK_SIGNER" verify --print-certs "$tmp/signed.apk" \
  | sed -n 's/^Signer #1 certificate SHA-256 digest: //p' \
  | head -n 1 | tr -cd '[:xdigit:]' | tr '[:upper:]' '[:lower:]')"
[[ "${#actual}" -eq 64 ]] || { echo "::error::Não foi possível identificar a assinatura do APK."; exit 1; }
if [[ "$actual" != "$expected" ]]; then
  echo "::error::Certificado de assinatura incompatível com o aplicativo original. Nenhum APK será publicado."
  exit 1
fi

if ! "$AAPT" dump badging "$tmp/signed.apk" | grep -q "^package: name='br.com.ospro.ordens' "; then
  echo "::error::Package ID do aplicativo é diferente do original."
  exit 1
fi
"$ZIPALIGN" -c -v 4 "$tmp/signed.apk" > /dev/null
mkdir -p "$(dirname "$OUT")"
mv "$tmp/signed.apk" "$OUT"
echo "Atualização assinada validada (fingerprint e package id coincidem)."
echo "SHA-256 do certificado: $actual"
