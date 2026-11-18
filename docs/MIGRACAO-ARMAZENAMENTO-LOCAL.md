# Migração ACR OS Pro 1.7.11 para armazenamento local

**Estado:** em desenvolvimento. Não distribuir APK offline antes de validar todas as funções e a atualização de dados.

## Requisitos de aceitação
- Preservar interface, logo, menus, permissões, relatórios, assinaturas, anexos, ordens, clientes, inventário, licenças, despesas e chamados.
- Todas as gravações e leituras operacionais devem funcionar sem internet e sem Render; persistência durável no armazenamento privado do app Android.
- Exportação e restauração verificadas, com versão de esquema, integridade e tratamento de falhas.
- A atualização deve preservar o package/applicationId e usar **o certificado de assinatura original**. Não instalar por cima se a assinatura divergir; nunca orientar desinstalação sem backup verificável.
- Antes da migração, investigar se há dados recuperáveis do servidor antigo e do app atual. GitHub contém código, não é backup dos registros do Render.
- RHiD e integrações de terceiros exigem conexão para consulta em tempo real; mostrar estado indisponível/offline sem inventar dados.
- Autenticação e permissões locais não devem depender de chamadas HTTP, e segredos não devem ser armazenados em texto puro.
- Testar inicialização sem rede, CRUD de cada módulo, anexos, exportação PDF/Excel/CSV, reinício do Android, restauração, migração de dados e atualização sobre a versão instalada.

## Diagnóstico automatizado
O workflow `.github/workflows/build-photo-fixed-apk.yml` executa `scripts/auditar-migracao-local.py` e publica o artefato `diagnostico-acr-os-pro-local` na ramificação `acr-os-pro-local`.

**Importante:** essa auditoria é apenas um levantamento estático. Ela não transforma o aplicativo em offline e não certifica a preservação de dados.

## Próxima implementação
1. Inventariar os contratos do `auth.js`, `app.js` e módulos que chamam `/api/team/`.
2. Criar camada local de dados nativa, com transações e migração de esquema.
3. Adaptar autenticação e chamadas da UI para armazenamento local mantendo a interface.
4. Integrar backup/restauração e testes instrumentados de persistência.
5. Compilar APK com certificado original e validar atualização em dispositivo de teste.
