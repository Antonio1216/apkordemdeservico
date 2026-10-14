# Integração Control iD RHiD — ACR OS Pro 1.7.9

A seção Monitoramento RHiD usa a API oficial RHiD v2, em modo SOMENTE LEITURA.
Referência: https://www.rhid.com.br/v2/swagger.svc/ (Device, GET /device).

## O que o painel exibe

Nome, série, versão, status Online/Offline/Não identificado, última conexão e última sincronização.
Filtros por empresa e situação, destaque para offline, histórico de alterações observadas e relatório PDF por empresa.
Atualização automática a cada 5 minutos enquanto app visível; o Render reutiliza a resposta por 60 segundos.

## Configuração no Render (administrador)

1. Confirme com o suporte RHiD que seu plano e token podem usar GET /device.
2. Obtenha o token Bearer da API RHiD v2, preferencialmente de integração somente leitura.
3. Abra o serviço acr-os-pro-backend no Render > Environment.
4. Defina RHID_API_TOKEN: coloque somente o token, sem o prefixo Bearer.
5. RHID_DEVICE_URL (opcional): endereço HTTPS da API documentado para sua conta. O padrão técnico é https://www.rhid.com.br/v2/api.svc/device; confirme com o RHiD qual é o endpoint exato de sua instância. O conector aceita somente rhid.com.br via HTTPS e caminho exato /v2/api.svc/device.
6. Salve, redeploy, e abra o aplicativo atualizado com usuário Administrador. Para técnicos, habilite a permissão Monitoramento RHiD no cadastro de usuários.

Nunca cole senhas ou tokens no app, no chat ou no código do GitHub. Se expirar, atualize o token no Render.
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
