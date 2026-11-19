# Cartograph
Stack: TypeScript + Vite · SVG · perfect-freehand · File System Access API (Chrome/Edge)

Fase 1 — Base do projeto
[x] Criar projeto com Vite + TypeScript
[x] Estrutura de pastas inicial (src/, src/core/, src/tools/, src/ui/)
[x] Layout da tela: barra de ferramentas, área do mapa (SVG) e painel lateral
[x] Zoom com a roda do mouse (centrado no cursor)
[x] Arrastar o mapa (pan) com botão do meio ou espaço + arrastar
[x] Botão "Centralizar mapa"
[x] Light/Dark Mode + Button (Light = ☀️ | Dark = 🌕)
[x] Hexcrawl mode

Fase 2 — Imagem de fundo
[x] Carregar imagem de fundo (PNG/JPG/WEBP) do PC
[x] Controle de opacidade (slider 0–100%)
[x] Ajustar posição e escala da imagem
[x] Travar/destravar a imagem de fundo
[x] Mostrar/ocultar a imagem de fundo

Fase 3 — Desenho
[x] Fix: Dark Mode faz o canva continuar em branco
[x] Ferramenta de traço livre (lápis) com perfect-freehand
[ ] Escolher cor e espessura do traço
[ ] Paleta de cores predefinidas com elementos simples (costa, montanha, floresta, rio, lago, deserto, fronteira)
[ ] Ferramenta de seleção (clicar em um traço para selecionar)
[ ] Apagar traço selecionado / borracha
[ ] Atalhos de teclado para as ferramentas
[ ] CTRL + Z

Fase 4 — Camadas
[ ] Camada Base [sempre vai começar com ela] (alterar cor)
[ ] Criar, renomear e excluir camadas (ex.: Costa, Rios, Relevo, Fronteiras)
[ ] Mostrar/ocultar camada
[ ] Travar camada (não editável)
[ ] Reordenar camadas
[ ] Desenhar sempre na camada ativa

Fase 5 — Salvar e abrir
[ ] Menu inicial ao abrir: "criar novo" ou "carregar arquivo"
[ ] Predefinições de Tamanho de Hexcrawl [ao apertar em criar novo]
    - Continent
    - Kingdom
    - Town
[ ] Definir formato do arquivo (MapFile em JSON, com versão)
[ ] Salvar em arquivo (File System Access API)
[ ] "Salvar" sobrescreve o arquivo aberto; "Salvar como" cria outro
[ ] Abrir arquivo .json
[ ] Imagem de fundo embutida no arquivo (base64) ou referenciada
[ ] Aviso de alterações não salvas ao fechar a aba
[ ] Autosave em localStorage como backup

Fase 6 — Cidades e marcadores
[ ] Ferramenta para colocar marcador (cidade, vila, capital, ponto de interesse)
[ ] Ícones diferentes por tipo de marcador
[ ] Nome/legenda do marcador
[ ] Mostrar/ocultar todas as legendas
[ ] Mostrar/ocultar marcadores por tipo
[ ] Mover e excluir marcadores
[ ] Notas em cada marcador (painel lateral)

Fase 7 — Regiões e nações
[ ] Ferramenta de região: desenhar contorno que fecha automaticamente
[ ] Nome, tipo (continente, nação, região, etc.) e cor de preenchimento
[ ] Hierarquia (região pertence a uma nação, nação a um continente)
[ ] Clicar na região para abrir as notas no painel lateral
[ ] Editor de notas (texto simples ou Markdown)
[ ] Lista/árvore de regiões no painel lateral
[ ] Mostrar/ocultar regiões por tipo
[ ] Nome da região exibido no mapa
[ ] Ferramenta para calcular distância

Fase 8 — Encaixe e edição
[ ] Snap: traço começa/termina grudado na ponta de outro traço próximo
[ ] Ligar/desligar snap e ajustar a distância
[ ] Desfazer/refazer (Ctrl+Z / Ctrl+Y)
[ ] Mover e duplicar elementos selecionados

Fase 9 — Extras
[ ] Exportar o mapa como PNG/SVG (com ou sem legendas)
[ ] Busca por nome (cidades e regiões)
[ ] Régua de distância com escala configurável
[ ] Rosa dos ventos e escala no canto do mapa
[ ] Modo "visualização" (só navegar e ler notas, sem editar)

Ideias futuras
[ ] Múltiplos mapas ligados (clicar em uma cidade abre o mapa dela)
[ ] Gerar terreno automaticamente