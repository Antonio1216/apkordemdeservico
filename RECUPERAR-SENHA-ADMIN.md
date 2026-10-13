# Recuperar senha do administrador ACR OS Pro (sem apagar dados)

Este procedimento foi preparado para quem perdeu a senha da conta centralizada.
O usuário `antonio1216` já existe no Render, portanto **não execute bootstrap novamente**.

## Proteções

- A rota `POST /api/team/recover-admin-password` fica **desativada** quando `PASSWORD_RESET_TOKEN` não está definido.
- Exige simultaneamente a **ADMIN_KEY** atual e um **PASSWORD_RESET_TOKEN** novo, aleatório, hexadecimal de 64 caracteres.
- Aceita apenas contas ativas com perfil **Administrador**; exige senha nova de 12 a 128 caracteres.
- O token só pode ser usado **uma vez**, inclusive após reinicialização: o banco guarda somente o SHA-256 do token usado.
- Faz uma cópia privada de `TEAM_DATA_FILE` ao lado do original, com sufixo `.pre-password-reset-<timestamp>.bak`, **antes** de modificar o usuário.
- Modifica apenas `salt`, `hash`, `rev` da conta, a auditoria e o registro de token consumido. Mantém clientes, ordens, financeiro, outros usuários e PDFs.
- Revoga sessões antigas do administrador ao incrementar `rev`. Usa scrypt e salt aleatório como no login atual.
- Nenhuma senha ou chave é colocada no GitHub.

## Passo 1 — Publicar código

Revisar e mesclar a PR desta correção na branch `main`. Aguardar o serviço `acr-os-pro-backend` ficar **Live** no Render.

## Passo 2 — Ativar temporariamente

No Termux, gerar o token com `openssl rand -hex 32` e copiá-lo **sem fotografar ou enviar em conversa**.
No painel **Render → acr-os-pro-backend → Environment**, cadastrar `PASSWORD_RESET_TOKEN` com esse valor e salvar com implantação. Reutilizar a `ADMIN_KEY` atual *somente se ainda for privada*; se ela apareceu em capturas anteriores, trocá-la por uma nova chave forte e guardá-la antes de recuperar.
Não adicionar `PASSWORD_RESET_TOKEN` a `render.yaml`, arquivos versionados ou chat. Esperar **Live**.

## Passo 3 — Redefinir no Termux

Instalar ferramentas, se necessário: `pkg install curl jq -y`.

Baixar e executar o script da branch principal após mesclar:

```bash
curl -fsSLo recuperar-admin-termux.sh https://raw.githubusercontent.com/Antonio1216/apkordemdeservico/main/scripts/recuperar-admin-termux.sh
bash recuperar-admin-termux.sh
```

No terminal, digitar o login `antonio1216`, a `ADMIN_KEY`, o token de recuperação e a nova senha **apenas nas perguntas ocultas**. Não enviar fotos com valores secretos.

Quando aparecer `Senha atualizada!`, abrir o APK e fazer login com `antonio1216` e a **nova senha**.

## Passo 4 — Desativar

Imediatamente depois de recuperar, remover `PASSWORD_RESET_TOKEN` das variáveis do Render e salvar com nova implantação. Confirmar que está **Live**. Remover o script baixado do tablet se desejar (`rm recuperar-admin-termux.sh`). O próprio servidor já impede reutilização do token consumido.

> Não exclua `team.json`, não refaça o `bootstrap` e não recrie o disco persistente do Render. O Shell do Render não é necessário para este procedimento.
