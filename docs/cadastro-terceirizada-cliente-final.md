# ACR OS Pro — Cadastro vinculado de terceirizada e cliente final

## Exemplo de estrutura de contratação

ACR Suporte em T.I. → Empresa terceirizada contratante → Cliente final atendido.

No Painel Administrativo Web, seção 1 Empresas cadastradas, use **Cadastrar terceirizada e cliente final juntos**.

Selecione uma empresa terceirizada já cadastrada ou **Cadastrar nova terceirizada**. Em seguida selecione o cliente final cadastrado (por exemplo, Instituto Stef) ou **Cadastrar novo cliente final**. Clique **Salvar terceirizada + cliente final**. O vínculo aparecerá na lista abaixo.

Cada entidade é um cadastro real separado, vinculado no banco do Render; a mesma terceirizada pode ter vários clientes finais. Ao vincular empresa existente, preservam-se seus IDs, contatos, ordens de serviço, aparelhos, licenças e chamados.

O backend armazena o mapa companyLinks separadamente de workspace.clients. Isso evita perder o vínculo quando uma versão anterior do APK sincronizar dados. A API antiga de workspace rejeita tentativas de excluir empresas que mantêm vínculos.

O técnico deve ser delegado à **empresa do cliente final**, não à terceirizada. O cliente final recebe um link privado próprio para criar chamados. O portal identifica cliente final e terceirizada, mas a terceirizada não vê automaticamente os chamados de todos os clientes associados. A seleção de técnicos e o isolamento de tickets continuam pelo ID do cliente final.

Empresas usadas como terceirizada deixam de poder ter um link próprio de cliente; links anteriores emitidos para elas são revogados quando passam a atuar como prestadoras. Os clientes finais existentes preservam links próprios e atendimento.

A atualização é destinada ao Render/painel web; não é necessário reinstalar o Android para cadastrar vínculos. Para que o app Android exiba o vínculo em outras áreas locais, será necessária uma atualização assinada com a chave original do aplicativo.

## Segurança e limites

Somente a conta Administrador pode criar ou alterar vínculos. Não permite associar empresa a ela mesma, duplicar empresas com nomes já registrados ou transformar um cliente final em terceirizada de outra empresa sem revisar o cadastro. Contas comuns não recebem a lista completa de vínculos via API. A empresa final continua com escopo próprio de chamados e técnico delegado.
