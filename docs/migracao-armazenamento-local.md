# Migração do ACR OS Pro para armazenamento local (Android)

## Estado da análise (2026-11-21)

Este documento registra o início da migração, sem alterar o aplicativo em produção.

### Código existente
- `backend/server.js`: servidor Node.js; armazena solicitações de assinatura em JSON usando `DATA_FILE`, por padrão `backend/data/requests.json`; grava com arquivo temporário e rename.
- `TEAM_DATA_FILE`: dados da equipe em JSON, gerenciados por `team-api.js`.
- `PDF_DIR`: PDFs de assinaturas.
- `render.yaml`: atualmente configura `/var/data/requests.json`, `/var/data/team.json` e `/var/data/pdf-clientes` em disco persistente do Render.
- `PUBLIC_BASE_URL`: servidor exige HTTPS público ou localhost para teste. Links remotos de assinatura dependem de endereço acessível por quem assina.
- `ADMIN_KEY`: obrigatória com pelo menos 24 caracteres; nunca incluir chaves reais no repositório.

### Estratégia segura
1. Identificar o código-fonte do aplicativo Android dentro do ZIP versionado e sua configuração de API antes de alterar endpoints.
2. Separar dados que podem funcionar 100% offline (cadastros, OS, inventário, licenças e relatórios) de serviços externos (RHiD, consulta de CNPJ, links de assinatura remota, recuperação por e-mail).
3. Implementar armazenamento privado no Android com migração de esquema, operações transacionais e exportação/importação JSON. Não tratar o GitHub como banco de dados de produção.
4. Preservar a versão existente e a assinatura do APK. Não remover o Render nem desinstalar o app antes de validar importação e integridade dos dados.
5. Adicionar testes automatizados para persistência, reinicialização, dados inválidos e exportação/restauração; depois gerar APK de teste via Actions.

### Atenção
A presença dos arquivos no GitHub **não significa** que os dados do disco do Render também estejam no GitHub. É necessário exportá-los do serviço antes do desligamento caso se deseje preservar o histórico.

**Situação:** análise iniciada; implementação e APK local ainda pendentes.
