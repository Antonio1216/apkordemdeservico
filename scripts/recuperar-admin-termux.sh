#!/usr/bin/env bash
# Recuperação privada do administrador ACR OS Pro (executar no Termux).
# Nunca cole ADMIN_KEY, token de recuperação ou senha em conversas/prints.
set -euo pipefail
umask 077
trap 'unset ADMIN_KEY RESET_TOKEN NOVA_SENHA CONFIRMACAO DADOS RESPOSTA' EXIT
for ferramenta in curl jq; do
  if ! command -v "$ferramenta" >/dev/null 2>&1; then
    echo "Instale primeiro: pkg install curl jq"
    exit 1
  fi
done
printf '%s\n' 'ACR OS Pro - Recuperação de senha do administrador'
read -r -p "Login [antonio1216]: " LOGIN
LOGIN="${LOGIN:-antonio1216}"
if [[ -s "$HOME/acr-admin-key.txt" ]]; then
  ADMIN_KEY=$(< "$HOME/acr-admin-key.txt")
  printf '%s\n' 'ADMIN_KEY carregada do arquivo privado do Termux.'
else
  read -r -s -p "ADMIN_KEY atual do Render: " ADMIN_KEY; printf '\n'
fi
if [[ -s "$HOME/acr-reset-token.txt" ]]; then
  RESET_TOKEN=$(< "$HOME/acr-reset-token.txt")
  printf '%s\n' 'TOKEN de recuperação carregado do arquivo privado do Termux.'
else
  read -r -s -p "PASSWORD_RESET_TOKEN do Render: " RESET_TOKEN; printf '\n'
fi
read -r -s -p "Nova senha (12 a 128 caracteres): " NOVA_SENHA; printf '\n'
read -r -s -p "Repita a nova senha: " CONFIRMACAO; printf '\n'
if [[ ${#ADMIN_KEY} -lt 24 || ! "$RESET_TOKEN" =~ ^[A-Fa-f0-9]{64}$ ]]; then
  echo 'Chave administrativa ou token inválido. Verifique os valores no Render.'
  exit 1
fi
if [[ ${#NOVA_SENHA} -lt 12 || ${#NOVA_SENHA} -gt 128 || "$NOVA_SENHA" != "$CONFIRMACAO" ]]; then
  echo 'A senha precisa ter 12 a 128 caracteres e as duas digitações devem coincidir.'
  exit 1
fi
DADOS=$(jq -n --arg login "$LOGIN" --arg senha "$NOVA_SENHA" '{login:$login,senha:$senha}')
RESPOSTA=$(printf '%s' "$DADOS" | curl -sS --max-time 30 \
  -X POST 'https://acr-os-pro-backend.onrender.com/api/team/recover-admin-password' \
  -H 'Content-Type: application/json' \
  -H "X-API-Key: $ADMIN_KEY" \
  -H "X-Password-Reset-Token: $RESET_TOKEN" \
  --data-binary @-)
if printf '%s' "$RESPOSTA" | jq -e '.ok == true' >/dev/null 2>&1; then
  printf '%s\n' 'Senha atualizada! Entre no APK com o login e a nova senha.'
  printf '%s\n' 'IMPORTANTE: remova PASSWORD_RESET_TOKEN do Render após concluir.'
else
  printf 'Não foi possível recuperar: '
  printf '%s' "$RESPOSTA" | jq -r '.error // "Resposta inesperada"' || true
fi
