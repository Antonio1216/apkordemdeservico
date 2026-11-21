# ACR OS Pro Local — nova versão

Este é o espaço de desenvolvimento da nova versão Android do ACR OS Pro, baseada no código-fonte existente neste repositório.

## Objetivo
Preservar a aparência e os recursos da versão 1.7.11, substituindo gradualmente a dependência do Render por persistência local e autenticação offline.

## Limites importantes
- **GitHub:** armazena código-fonte, histórico, testes e artefatos de compilação; não é banco operacional nem sincronização automática de usuários.
- **Dados:** devem permanecer no dispositivo e ter backup/restauração explícitos.
- **App antigo:** não desinstalar, substituir nem sobrescrever até migração e testes concluídos.
- **Identificador Android:** a versão nova deverá usar identificador de pacote independente antes de distribuir APK para testes.
- **Segurança:** não criar conta administrativa padrão, não copiar senhas em texto puro e não desativar verificações de autenticação.

## Situação atual
- [x] Branch independente criada: `acr-os-pro-novo-local`.
- [x] Código-fonte existente preservado como ponto de partida.
- [x] Definir identificador Android independente: `br.com.ospro.ordens.local` (via `scripts/configure-new-local-app.py`).
- [ ] Implementar login offline com provisionamento autorizado.
- [ ] Migrar todos os módulos para armazenamento local.
- [ ] Implementar exportação/importação de dados e backups.
- [ ] Validar funcionalidades e gerar APK de teste independente.

## Compilação
O workflow existente `.github/workflows/build-photo-fixed-apk.yml` foi herdado. **Uma compilação verde não comprova funcionamento offline.** Não instalar APK DEBUG sobre o aplicativo original.

## Execução de testes
O GitHub Actions compila esta branch e executa os testes estáticos e de segurança. O APK gerado continua sendo **DEBUG e não homologado**. A nova identidade permite instalação separada, mas não migra automaticamente contas ou dados.
