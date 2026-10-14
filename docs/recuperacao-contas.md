# Recuperação de contas — ACR OS Pro

## Usuários comuns: link por e-mail

O botão Esqueci minha senha permite solicitar a redefinição de senha por e-mail para contas Técnico e Atendimento. A conta Administrador nunca pode ter a senha redefinida pelo e-mail.

No Render, em acr-os-pro-backend → Environment, configure privadamente:

- RESEND_API_KEY — API key do serviço Resend; o domínio de envio precisa ser validado.
- PASSWORD_RESET_FROM_EMAIL — remetente verificado, exemplo: seguranca@dominio-verificado.com.
- PUBLIC_BASE_URL — já configurado no Render, endereço público HTTPS da API.

Sem a configuração do serviço de e-mail, o recurso não consegue enviar mensagens. A página de recuperação está em https://acr-os-pro-backend.onrender.com/password-reset.

Cadastro dos usuários: forneça o e-mail no campo E-mail para permitir o envio. Contas já cadastradas com e-mail como login poderão utilizá-lo. Apenas administradores podem alterar o e-mail de recuperação de outra conta. Links são de uso único, válidos por 15 minutos; a nova senha deve ter 12 a 128 caracteres. A API retorna uma resposta genérica para não revelar a existência de usuários. O token só fica armazenado como hash SHA-256.

## Administrador: Microsoft Authenticator

O painel de Usuários no APK atualizado terá a opção Microsoft Authenticator — Administrador.

1. Entre como Administrador e confirme sua senha atual para começar a configuração.
2. No Microsoft Authenticator, adicione uma nova conta por chave manual e digite a chave de configuração apresentada.
3. Digite um código válido de seis dígitos para concluir a ativação.
4. Se esquecer a senha, use Esqueci minha senha → Microsoft Authenticator (administrador) e informe o login, código válido e uma senha nova.

Importante: o recurso deve ser ativado ANTES da perda da senha. Não constitui login sem senha; é um mecanismo separado de recuperação de senha. O servidor valida TOTP compatível com RFC 6238 (SHA1, 30 segundos, 6 dígitos), protege contra repetição de código e limita tentativas. Segredos TOTP ficam criptografados com AES-256-GCM derivado de ADMIN_KEY.

Não altere ADMIN_KEY sem planejar a migração da chave de criptografia, pois a chave de autenticação de dois fatores deixaria de ser decifrável. Em caso de perda do telefone autenticador, use o procedimento administrativo já existente em RECUPERAR-SENHA-ADMIN.md, sem apagar dados.

## Publicação e segurança

- As contas, clientes, OS, PDFs e finanças não são apagados por esta alteração.
- Tokens, senhas e códigos não devem ser enviados para o chat nem colocados no GitHub.
- Servidor: mesclar PR e aguardar Render Live.
- A distribuição de um APK atualizado ainda requer assinatura com a chave original; não desinstale o aplicativo existente.
