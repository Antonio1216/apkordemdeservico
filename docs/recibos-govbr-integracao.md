# Integração de recibos GOV.BR — ACR OS Pro

## Fluxo funcional planejado
1. Confirmar pagamento no Financeiro (não marcar como assinado automaticamente).
2. Gerar PDF de recibo com logo oficial ACR, valor, pagador, descrição, data/hora local e identificador único.
3. Oferecer botão "Assinar com GOV.BR" que abre https://assinador.iti.br/ (não solicitar credenciais dentro do app).
4. Permitir importar o PDF assinado pelo seletor de arquivos do Android, preservando os bytes originais e a assinatura PAdES.
5. Guardar o documento associado ao recebimento, com nome, MIME application/pdf e data de importação; permitir abrir e compartilhar pelo Android ACTION_SEND com FileProvider e URI temporária.
6. Após importação, oferecer WhatsApp ou e-mail; envio requer confirmação do usuário no aplicativo de destino. Envio sem intervenção exigiria integrações oficiais e consentimento específico.

## Segurança e validação
- Nunca inserir imagem de assinatura fingindo ser assinatura GOV.BR.
- Não converter, recomprimir, imprimir ou regravar o PDF já assinado.
- Validar extensão, cabeçalho PDF, limite de tamanho e vínculo com o recibo.
- Preferir validação de assinatura via serviço oficial https://validar.iti.gov.br/; não afirmar validade só porque um PDF foi importado.
- Proteger documentos financeiros em armazenamento privado e compartilhar somente via URI com permissão temporária.
- Preservar recibos e registros existentes; não mudar a confirmação financeira durante a migração.

## Identidade visual
- Usar logo ACR existente e paleta azul #102D4E, dourado #E3A82E, branco #FFFFFF.
- Se houver assinatura manuscrita autorizada da empresa, apresentá-la separadamente da assinatura eletrônica pessoal GOV.BR.

## Estado
Especificação técnica registrada. Ainda requer integração ao código Android efetivamente usado no workflow de compilação, testes e nova APK. Não representa implementação concluída.
