#!/usr/bin/env bash
# OS Pro - Termux (Android): servidor de assinaturas e endereco HTTPS temporario
set -Eeuo pipefail

DIR="${OSPRO_DIR:-$HOME/ospro-servidor/ospro-eletrica-software/server}"
PORT="${OSPRO_PORT:-3000}"
KEY_FILE="${OSPRO_KEY_FILE:-$HOME/.ospro-admin-key}"
DATA_FILE="${OSPRO_DATA_FILE:-$HOME/ospro-dados/requests.json}"
LOG_FILE="${OSPRO_LOG_FILE:-$HOME/ospro-cloudflare.log}"
URL_FILE="${OSPRO_URL_FILE:-$HOME/ospro-endereco.txt}"

server_pid=''
tunnel_pid=''
cleanup() {
  trap - EXIT INT TERM
  [[ -z "$server_pid" ]] || kill "$server_pid" 2>/dev/null || true
  [[ -z "$tunnel_pid" ]] || kill "$tunnel_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

for prog in node cloudflared curl openssl; do
  if ! command -v "$prog" >/dev/null 2>&1; then
    echo "ERRO: '$prog' nao foi encontrado no Termux."
    exit 1
  fi
done
if [[ ! -f "$DIR/server.js" ]]; then
  echo "ERRO: servidor nao encontrado em: $DIR"
  echo "Extraia o ZIP do OS Pro conforme as etapas anteriores."
  exit 1
fi
if curl -fsS --max-time 2 "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then
  echo "ATENCAO: o servidor OS Pro antigo ja esta ativo na porta $PORT."
  echo "Volte a primeira sessao do Termux e pressione Ctrl+C."
  echo "Pare tambem o cloudflared anterior na segunda sessao com Ctrl+C."
  echo "Depois execute este script novamente."
  exit 2
fi
mkdir -p "$(dirname "$KEY_FILE")" "$(dirname "$DATA_FILE")" "$(dirname "$LOG_FILE")" "$(dirname "$URL_FILE")"
umask 077
if [[ ! -s "$KEY_FILE" ]]; then
  openssl rand -hex 32 > "$KEY_FILE"
fi
ADMIN_KEY="$(cat "$KEY_FILE")"
if (( ${#ADMIN_KEY} < 24 )); then
  echo "ERRO: chave administrativa invalida (menos de 24 caracteres)."
  exit 1
fi

cd "$DIR"
echo "Preparando endereco HTTPS para assinatura remota..."
cloudflared tunnel --url "http://127.0.0.1:$PORT" >"$LOG_FILE" 2>&1 &
tunnel_pid=$!
BASE=''
for ((attempt=0; attempt<90; attempt++)); do
  BASE="$(grep -Eo 'https://[a-zA-Z0-9-]+[.]trycloudflare[.]com' "$LOG_FILE" 2>/dev/null | head -1 || true)"
  [[ -z "$BASE" ]] || break
  if ! kill -0 "$tunnel_pid" 2>/dev/null; then
    echo "ERRO: Cloudflare encerrou antes de criar o endereco."
    tail -n 15 "$LOG_FILE"
    exit 1
  fi
  sleep 1
done
if [[ -z "$BASE" ]]; then
  echo "ERRO: endereco HTTPS nao apareceu em 90 segundos."
  tail -n 15 "$LOG_FILE"
  exit 1
fi
printf '%s\n' "$BASE" > "$URL_FILE"
export PORT ADMIN_KEY DATA_FILE
export PUBLIC_BASE_URL="$BASE"
node server.js &
server_pid=$!

healthy=0
for ((attempt=0; attempt<25; attempt++)); do
  if curl -fsS --max-time 2 "http://127.0.0.1:$PORT/health" | grep -q '"ok":true'; then
    healthy=1
    break
  fi
  if ! kill -0 "$server_pid" 2>/dev/null; then
    echo "ERRO: servidor parou. Confira o texto acima."
    exit 1
  fi
  sleep 1
done
if (( ! healthy )); then
  echo "ERRO: servidor nao respondeu na porta $PORT."
  exit 1
fi

echo
echo '============================================='
echo '  OS PRO - SERVIDOR LOCAL ATIVO'
echo '============================================='
echo "URL HTTPS: $BASE"
echo 'Teste no Chrome: '
echo "  $BASE/health"
echo
printf 'URL salva em: %s\n' "$URL_FILE"
echo 'No app OS Pro > Configuracoes, informe:'
echo "  URL HTTPS = $BASE"
echo '  Chave = conteudo do arquivo ~/.ospro-admin-key'
echo 'NAO compartilhe a chave administrativa com clientes.'
echo 'Deixe esta sessao aberta enquanto receber assinaturas.'
echo 'Para interromper: Ctrl+C.'
echo '============================================='
echo
wait "$server_pid"
