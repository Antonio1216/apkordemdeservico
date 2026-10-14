# Atualizações seguras do ACR OS Pro (Android)

## Por que aparecia "App não instalado"?

O fluxo anterior publicava `app-debug.apk` gerado em runners descartáveis do GitHub Actions.
Cada execução pode gerar outra chave de depuração. O Android recusa uma atualização
com o mesmo `applicationId` caso a chave/certificado seja diferente da versão instalada.
**Um backup não resolve incompatibilidade de assinatura.**

## Correção implementada

- Push e Pull Request **apenas testam** a compilação Android; não publicam `app-debug.apk`.
- Para gerar um APK instalável use **Actions → ACR OS Pro - Compilacao segura... → Run workflow** no branch **main**.
- A publicação manual compila **release**, alinha, assina com **a MESMA chave original**, valida criptograficamente o APK e exige que o SHA-256 do certificado seja exatamente o configurado.
- Se a chave não estiver configurada, a senha estiver incorreta, o certificado não coincidir ou o package ID for diferente, **a execução falha antes de publicar APK**.
- O arquivo da chave é restaurado somente em diretório temporário privado no runner; nunca é adicionado ao ZIP do código-fonte.

## Preparação uma única vez (administrador do repositório)

Em **GitHub → Repositório → Settings → Secrets and variables → Actions**:

Em **Repository secrets**, guardar:
- `ACR_KEYSTORE_B64`: conteúdo Base64 da chave ORIGINAL (arquivo `.jks`/`.keystore`, sem quebras de linha);
- `ACR_KEYSTORE_PASSWORD`: senha da keystore;
- `ACR_KEY_ALIAS`: alias da chave de assinatura;
- `ACR_KEY_PASSWORD`: senha da chave.

Em **Repository variables**, guardar:
- `ACR_SIGNER_SHA256`: SHA-256 do **certificado do APK que já está instalado no aparelho** (64 caracteres hexadecimais). A chave original fornecida acima precisa ter o mesmo certificado.

Um APK antigo pode fornecer o fingerprint com `apksigner verify --print-certs aplicativo-antigo.apk`, mas **não permite recuperar a chave privada**. O fingerprint (público) é diferente do segredo da chave de assinatura. Para atualizar sem desinstalar, você precisa do arquivo de keystore ORIGINAL e suas senhas, ou de outro mecanismo de assinatura/rotação de chave previamente autorizado e suportado pelo aplicativo.

**NUNCA** gere uma keystore nova achando que ela poderá atualizar a instalada. Uma chave nova serve apenas para iniciar outra identidade de assinatura, não para substituir sem consentimento e migração. Se a keystore original foi perdida, **não há garantia de atualização por cima do app**. Não desinstale o app e não apague dados enquanto não houver plano de recuperação verificado.

### Como copiar a keystore para o GitHub

Execute localmente em equipamento **seguro** (sem publicar o arquivo em repositório):
```bash
base64 -w 0 /caminho/da/sua-chave-original.jks
```

Copie a saída para o secret `ACR_KEYSTORE_B64` no GitHub. Em algumas versões do macOS, use `base64 < arquivo.jks | tr -d '\n'`.

Crie ainda um backup **seguro e criptografado** da keystore original e das senhas, em local diferente do GitHub; sem isso atualizações futuras poderão ser bloqueadas.

## Conferir antes de instalar

1. Certificar que o backup JSON do aplicativo e PDFs importantes foram guardados.
2. Não utilizar artefatos antigos `app-debug.apk`, mesmo que tenham passado na compilação.
3. Baixar apenas o artefato chamado `ACR-OS-Pro-v1.7.9-Atualizacao-Assinada` gerado pelo workflow manual após todas as validações.
4. Confirmar que o certificado é o mesmo do app instalado e que `versionCode` do novo aplicativo é maior.
5. Atualizar sobre o aplicativo existente **sem desinstalar**.

Se a assinatura não puder ser recuperada, interromper o processo e analisar os dados e métodos de migração, sem desinstalação automática.

## Diagnóstico

- `ACR_KEYSTORE_B64` ausente: execução **falha**, sem publicar atualização.
- Chave ou senha incorreta: `apksigner sign` falha, sem publicar.
- `ACR_SIGNER_SHA256` incorreto: verificação falha, sem publicar.
- Pacote Android diferente: verificação falha, sem publicar.
- Código apenas compilado em PR: não é um APK de atualização instalável.
