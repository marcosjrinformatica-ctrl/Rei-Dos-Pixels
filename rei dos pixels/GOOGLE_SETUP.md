> ARQUIVADO: o login Google foi removido do site. As instruções abaixo são uma referência para uma futura implementação; preencher credenciais não reativa o acesso.

# Ativar login Google

O cadastro por e-mail e o banco já funcionam sem credenciais externas. O login Google usa o fluxo OAuth de servidor e a biblioteca oficial `google-auth-library`. O segredo fica no servidor.

1. No projeto do [Google Cloud](https://console.cloud.google.com/auth/clients), crie um cliente OAuth de tipo **Aplicativo da Web**.
2. Configure a marca/tela de consentimento. Se o aplicativo estiver em teste, adicione sua conta Google à lista de usuários de teste.
3. Nos **URIs de redirecionamento autorizados**, adicione exatamente:

   ```text
   http://localhost:3000/api/auth/google/callback
   ```

4. Copie o **ID do cliente** e o **segredo do cliente** para o arquivo `.env` desta pasta:

   ```dotenv
   GOOGLE_CLIENT_ID=ID_DO_SEU_CLIENTE.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=SEGREDO_DO_SEU_CLIENTE
   ```

5. Salve o arquivo e reinicie o servidor com `node server.js` (ou `npm start`). Abra **http://localhost:3000** e use **Continuar com Google**. O botão fica disponível quando ambos os valores estão preenchidos.

Não use `file:///` para autenticação. Não envie o segredo para o código do navegador nem publique `.env`. As credenciais ficam excluídas do controle de versão e não são servidas pelo site.

Quando houver um domínio público, altere `PUBLIC_ORIGIN` para a origem HTTPS desse domínio, cadastre o callback correspondente no Google e coloque o banco em armazenamento persistente. O banco SQLite deve ser compartilhado por um único processo de servidor nesta versão; não use múltiplas instâncias sem migrar o armazenamento para um banco compartilhado.

Para uma conta já criada com senha, entre primeiro usando e-mail e senha e selecione **Vincular Google** no perfil. Escolha a conta Google com o mesmo e-mail. O sistema identifica o Google pelo `sub` verificado e não une contas automaticamente por coincidência de e-mail.

Documentação oficial: [OAuth para servidores web](https://developers.google.com/identity/protocols/oauth2/web-server), [validação de identidade Google](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).

## Se aparecer `redirect_uri_mismatch`

Abra o **mesmo cliente OAuth cujo ID está no `.env`** e adicione `http://localhost:3000/api/auth/google/callback` em **URIs de redirecionamento autorizados**. Cadastre a URL completa, com `/api/auth/google/callback`, sem barra extra no final. Cadastrar apenas `http://localhost:3000` nas origens JavaScript não autoriza esse retorno. Salve e tente novamente. Não é necessário trocar o segredo ou criar outra conta.

No primeiro acesso com uma identidade Google verificada, o servidor cria automaticamente o jogador e seu progresso no banco. Nos acessos seguintes, usa a mesma conta Google.
