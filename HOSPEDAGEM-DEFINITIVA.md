# ACR OS Pro — Hospedagem HTTPS definitiva

## Objetivo
Substituir o link aleatório `trycloudflare.com` do Termux por URL HTTPS estável no Render, por exemplo `https://<nome-real-do-servico>.onrender.com`.

**Este repositório apenas prepara a implantação. O serviço e a URL não são criados até a autorização do proprietário na Render.**

## Requisitos
- Uma conta Render conectada ao seu GitHub `Antonio1216/apkordemdeservico`.
- Plano **pago** Render Starter com **disco persistente** (definido em `render.yaml`). Conferir o custo antes de aprovar.
- `ADMIN_KEY` como variável secreta no Render (NUNCA enviar a chave para o GitHub ou outras pessoas).
- Migração dos dados do servidor Termux antes de trocar o endereço usado pelos técnicos.

## Arquivos preparados
- `render.yaml`: serviço Node.js, HTTPS automático, armazenamento em `/var/data`, verificações de saúde.
- `backend/server.js`, `backend/team-api.js`, `backend/pdf.js` e `backend/public`: servidor Node com cadastro, autenticação de equipe e assinatura remota.
- `backend/package.json`: inicialização via `npm start`.

## Criar o serviço
1. Render → New → Blueprint.
2. Conecte o repositório `Antonio1216/apkordemdeservico`, branch `main`; use `render.yaml`.
3. Confira que o plano `starter` e o disco persistente (1 GB) foram selecionados; autorize o custo **somente se concordar**.
4. No campo privado `ADMIN_KEY`, informe sua chave já usada no Termux (somente no painel Render).
5. Ao finalizar, o Render criará uma URL `https://...onrender.com`. Teste `<URL>/health` e `<URL>/api/team/status`.

## Antes de migrar dados
Seu servidor atual do Termux contém `~/ospro-dados/team.json`, `requests.json` e `pdf-clientes/`.
O novo servidor inicia com armazenamento vazio caso os arquivos não sejam migrados.

Faça backup privado no Termux (**sem enviar para este chat ou GitHub**):
```bash
umask 077
mkdir -p "$HOME/ospro-backups"
tar -czf "$HOME/ospro-backups/backup-acr-$(date +%Y%m%d-%H%M%S).tgz" -C "$HOME/ospro-dados" .
ls -lh "$HOME/ospro-backups"/backup-acr-*.tgz
```

O backup contém informações pessoais dos clientes, usuários e assinaturas. Deve ser transferido somente por método autenticado e seguro à unidade persistente do novo serviço, preservando estrutura `team.json`, `requests.json`, `pdf-clientes/`. A migração deve acontecer **antes de cadastrar novos dados no Render**, para evitar conflitos. Não descarte o servidor antigo antes de verificar no Render o login do administrador e os links existentes. Se tiver dúvidas sobre como transferir arquivos ao disco, solicite orientação para seu plano Render.

## Após migração
- Testar login de administrador e técnico em celulares diferentes.
- Testar um link de assinatura, visualizar documento e baixar PDF do cliente.
- Atualizar a URL de equipe e URL de assinaturas do APK para o endereço Render.
- Confirmar retenção, backup e permissões conforme LGPD.
- Usar domínio próprio opcional, se desejar `api.suaempresa.com.br`.

## Cuidados de produção
- O atual backend grava JSON em disco; execute uma **única instância**. Instâncias múltiplas podem corromper ou sobrescrever informações.
- Assinatura por desenho e localização autorizada não são assinatura digital GOV.BR.
- Não colocar `ADMIN_KEY` em frontend, GitHub ou mensagens.
- O armazenamento em disco não substitui backups externos.
