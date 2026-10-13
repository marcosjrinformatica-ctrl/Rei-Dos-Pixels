# Rei dos Pixels

Dez jogos autorais em 3D voxel, com renderização WebGL de malhas, perspectiva, iluminação e câmera aérea opcional. A identidade do salão mantém a arte neon original.

No Windows, dê dois cliques em `INICIAR FLIPERAMA.cmd`: ele seleciona Node.js 24 ou superior e abre o navegador quando o serviço de contas estiver pronto. Mantenha a janela do servidor aberta enquanto joga.

Inicie também com `node server.js` ou execute `iniciar.ps1` e abra **http://localhost:3000**. É necessário Node.js 24 ou superior. As dependências já estão instaladas nesta pasta; em uma cópia nova, use `npm install`. Os arquivos de jogo são locais; a tipografia via Google Fonts é opcional. Use um navegador com WebGL e aceleração gráfica.

O servidor oferece cadastro e login por e-mail e senha. Copie `.env.example` para `.env` em uma instalação nova. Abrir `index.html` diretamente oferece somente o modo visitante. O acesso Google foi removido e poderá ser desenvolvido novamente no futuro.

## Jogos

- Pixel Serpent: cristais, labirinto, crescimento e portais.
- Ghost Byte: coleta, perseguição e impulso de energia.
- Neon Invaders: ondas, tiros, melhorias e chefe.
- Brick Kingdom: bola, plataforma, muralha e chefe.
- Turbo Pixel 99: trânsito, moedas e nitro.
- Bomb Maze: bombas, paredes destrutíveis, guardas e relíquia.
- Dungeon Fighter 2000: combate, combos, evolução e chefe.
- Pixel Crossing: trânsito, troncos e três travessias.
- Cyber Arena: duelo contra IA, bola de energia e poderes.
- King of Pixels: desafio final de múltiplas fases, liberado ao obter os nove fragmentos.

As instruções e o objetivo de cada jogo aparecem antes da partida. WASD/setas movem, Espaço faz a ação e P pausa. Há direcional e botão de ação para touchscreen. Fechar uma partida em andamento não registra vitória ou recompensa.

## Dados reais

O catálogo e o Hall dos Reis começam sem partidas. Somente partidas terminadas registram recordes, moedas, XP e histórico. Cada vitória inédita nas nove máquinas dá um fragmento. Nenhum jogador ou placar é pré-carregado.

Visitantes guardam o progresso neste navegador, em `rei-dos-pixels:v2`; o progresso legítimo da primeira versão é migrado. Contas têm progresso próprio no SQLite (`data/rei-dos-pixels.sqlite` por padrão), com perfil, loja, ranking de contas e resultados que sobrevivem ao reinício do servidor. As partidas de visitante não são importadas ao cadastrar. Resultados da conta aguardam sincronização se a rede falhar, sem premiar duas vezes. O banco e as credenciais nunca são servidos como arquivos públicos.

Senhas usam scrypt com salt individual. Sessões usam cookies HttpOnly, proteção de origem/CSRF e prazo de expiração. Para publicar, configure HTTPS, origem e banco persistente e cópias de segurança. Esta versão usa um único processo SQLite e ainda não inclui verificação de e-mail ou recuperação de senha. O servidor valida posse, limites e duplicatas de partidas; os jogos executados no navegador não oferecem proteção completa contra adulteração de placares.

Código separado em `engine3d.js` (renderização e ciclo de vida), `games-maze.js`, `games-action.js`, `app.js` (perfil, loja e progresso), `auth.js` (interface de acesso), `server.js` (HTTP e autenticação) e `server/` (banco e segurança). A arte original e o PDF de conceito foram preservados.

## Verificação

- `node verify-maze.cjs`: vitórias e derrotas dos quatro jogos de labirinto/travessia, conexão dos mapas e geometrias válidas.
- `node verify-action-games.cjs`: seis vitórias, seis derrotas, chefes, melhorias, três faixas e geometrias válidas.
- `node tests/browser-verify.cjs`: cenas WebGL, teclado/touch, pausa, recorde real, fragmento, persistência, bloqueio do jogo final e layout mobile. Requer Playwright e Microsoft Edge no ambiente de teste.
- `node --test tests/server.test.cjs`: cadastro, login, autorização, remoção do acesso externo, banco em disco, recompensas e loja. Usa bancos isolados dos dados reais.
- `node tests/auth-browser.cjs`: cadastro/login pela interface, partida 3D, recuperação de falha de rede, separação de contas, ranking e layout mobile. Requer Playwright e Microsoft Edge.

As simulações usam entradas de jogo em sessões isoladas. Elas não inserem placares ou jogadores no site.
