# Integração Control iD RHiD — ACR OS Pro 1.7.9

A seção Monitoramento RHiD usa a API oficial RHiD v2, em modo SOMENTE LEITURA.
Referência: https://www.rhid.com.br/v2/swagger.svc/ (Device, GET /device).

## O que o painel exibe

Nome, série, versão, status Online/Offline/Não identificado, última conexão e última sincronização.
Filtros por empresa e situação, destaque para offline, histórico de alterações observadas e relatório PDF por empresa.
Atualização automática a cada 5 minutos enquanto app visível; o Render reutiliza a resposta por 60 segundos.

## Configuração no Render (administrador)

1. Confirme com a Control iD que a conta RHiD escolhida possui permissão para consultar GET /device. Preferencialmente use uma conta de integração com acesso mínimo, em vez da sua conta administrativa principal.
2. Em Render → acr-os-pro-backend → Environment, configure variáveis privadas:
   - RHID_LOGIN_EMAIL: e-mail da conta RHiD autorizada.
   - RHID_LOGIN_PASSWORD: senha da conta RHiD. Preencha diretamente no Render; **não** envie no ChatGPT, Swagger ou GitHub.
   - RHID_LOGIN_DOMAIN: somente se seu ambiente RHiD usa domínio específico (opcional).
3. RHID_DEVICE_URL (opcional): padrão https://www.rhid.com.br/v2/api.svc/device conforme Swagger oficial. Só o domínio HTTPS oficial e o caminho /v2/api.svc/device são permitidos.
4. Para login automático não é preciso RHID_API_TOKEN. Se você criou essa variável em branco, apague-a. Se já existir token válido, a dupla RHID_LOGIN_EMAIL + RHID_LOGIN_PASSWORD tem prioridade.
5. Salve e faça redeploy. No app atualizado, faça login como Administrador; para técnicos habilite a permissão Monitoramento RHiD.

**Como funciona:** no primeiro acesso, o Render faz POST /v2/api.svc/login com email/password (system = rhid); recebe accessToken e guarda apenas em memória. O app consulta GET /v2/api.svc/device sem jamais receber o token. O servidor reutiliza o token enquanto válido, e renova automaticamente em resposta ao HTTP 401 de expiração. O token não fica salvo no banco, no ZIP nem no GitHub.

Se sua conta exigir troca de senha, MFA ou outro fluxo incompatível com POST /login, essa integração precisa de credenciais específicas autorizadas pela Control iD. O painel exibirá erro de conexão, não equipamentos fictícios. Guarde e rotacione a senha no Render conforme as práticas da sua organização.

Nunca cole credenciais, prints com secrets ou tokens no app, chat ou código do GitHub.
A API é consultada sem armazenar biometria, CPF, registros de ponto ou chave de licença.

## Segurança e limites

A rota GET /api/team/rhid-monitor exige sessão e permissão rhid.
O cliente Android não controla URL nem token do RHiD: somente as variáveis de ambiente privadas do servidor.
O servidor valida HTTPS, domínio oficial e caminho /device, recusa redirects e limita tamanho de resposta.
O patrimônio é associado à empresa **apenas por número de série** de equipamento cadastrado no ACR OS Pro e não modifica o RHiD.
Status desconhecido aparece como Não identificado, não é inferido das datas.
Histórico máximo de 500 mudanças observadas; não é monitoramento ininterrupto nem alerta push.
Sem credenciais, mostra Aguardando configuração, sem dados fictícios.

## Atenção à atualização Android

O GitHub testa e compila a versão 1.7.9, mas não distribui APK debug instalável.
A instalação por cima da versão existente exige o certificado/chave original de assinatura compatível.
Não desinstale o ACR OS Pro nem limpe seus dados. Veja docs/atualizacao-apk-segura.md.

## Seleção automática de domínios (v1.7.10)

Após autenticar com RHID_LOGIN_EMAIL e RHID_LOGIN_PASSWORD, o backend consulta POST /login sem domínio e lê listCustomer (id, domain, name). Apenas administradores ACR OS Pro recebem a lista saneada, sem tokens e sem senhas, por GET /api/team/rhid-domains.

Ao escolher um cliente, GET /api/team/rhid-domains/:domain/devices verifica a associação na lista autorizada e então autentica separadamente no domínio para consultar GET /device. Não é necessário configurar RHID_LOGIN_DOMAIN para esse fluxo. A lista expira em 60 segundos e os JWTs específicos de cada domínio são guardados apenas na memória do backend.

Se o login do fornecedor não devolver listCustomer, a seleção automática mostra um erro e requer diagnóstico com o suporte da Control iD. Não é criada uma lista fictícia nem exposto o JSON completo do login. O aplicativo deve ser atualizado com APK assinado 1.7.10 para mostrar o seletor.
