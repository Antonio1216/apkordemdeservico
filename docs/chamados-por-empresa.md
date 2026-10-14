# Chamados e técnicos por empresa — ACR OS Pro

## Delegação pelo Administrador

No app atualizado, abra Usuários → Delegação de técnicos e acesso do cliente.

Selecione técnico e a empresa em que poderá trabalhar. O backend revoga sessões anteriores e vincula o técnico ao ID da empresa. Também é possível escolher Sem empresa (acesso bloqueado).

Técnicos vinculados veem dados e ordens somente da empresa delegada. O servidor impõe esse limite; não é um simples filtro de interface. Nas alterações de OS, preserva os registros de outras empresas. O cadastro de clientes, catálogo e licenças permanece gerenciado pelo administrador. O acesso à API antiga de assinatura remota de um técnico delegado fica bloqueado enquanto não houver identificação confiável da empresa.

Contas técnicas existentes sem delegação continuam temporariamente no modo legado. O administrador deve delegar cada técnico. Ordens antigas sem identificação inequívoca da empresa ficam indisponíveis aos técnicos delegados até corrigir os vínculos.

## Portal do cliente

No painel de Usuários, o Administrador seleciona uma empresa e toca Gerar / renovar link. Compartilhe somente com o responsável autorizado pela empresa. O link usa uma credencial aleatória de 256 bits no fragmento da URL, expira em 90 dias e é revogado quando outro link é gerado. Quem possuir o link poderá consultar e criar chamados daquela empresa; não publique o link.

Na página responsiva, o cliente pode:

- Abrir chamado informando tipo de problema, descrição, equipamento e local físico onde está instalado.
- Selecionar exclusivamente um técnico que esteja delegado à empresa.
- Autorizar opcionalmente a coleta de geolocalização pelo navegador.
- Anexar até duas fotos ou PDFs por chamado, limite de 500 KB por arquivo. Fotos maiores podem ser reduzidas automaticamente.
- Acompanhar andamento (Aberto, Em atendimento, Aguardando cliente, Concluído) e consultar evidências.

Os arquivos são salvos em diretório privado no armazenamento do backend Render, fora do repositório. A API verifica as permissões da empresa antes de entregar imagens ou PDFs. Há limite de 15 chamados por hora por empresa.

## Alertas na tela do aplicativo

A aba Chamados consulta a API a cada 30 segundos enquanto o app estiver visível. Os novos chamados da empresa aparecem ao Administrador, e o técnico só vê os endereçados à própria conta. O menu indica a quantidade de novos chamados e uma faixa de aviso aparece na tela. O usuário pode marcar como visualizado e atualizar status.

Não é notificação push: o app precisa estar aberto ou visível.

## Instalação

A versão do servidor deve ser mesclada e colocada como Live no Render. O aplicativo Android instalado só exibirá os novos painéis após receber uma atualização assinada com o certificado original da versão já instalada. A chave original de assinatura continua pendente. Não desinstale o ACR OS Pro nem apague dados.
