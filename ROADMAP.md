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
[x] Escolher cor e espessura do traço
[x] Paleta de cores predefinidas com elementos simples (costa, montanha, floresta, rio, lago, deserto, fronteira)
[x] Ferramenta de seleção (clicar em um traço para selecionar)
[x] Apagar traço selecionado / borracha
[x] Atalhos de teclado para as ferramentas
[x] CTRL + Z

Fase 4 — Camadas
[x] Camada Base [sempre vai começar com ela] (alterar cor)
[x] Criar, renomear e excluir camadas (ex.: Costa, Rios, Relevo, Fronteiras)
[x] Mostrar/ocultar camada
[x] Travar camada (não editável)
[x] Reordenar camadas
[x] Desenhar sempre na camada ativa

Fase 5 — Salvar e abrir
[x] Menu inicial ao abrir: "criar novo" ou "carregar arquivo"
[x] Predefinições de Tamanho de Hexcrawl [ao apertar em criar novo] [pode ser editado durante o projeto também]
[x] Definir formato do arquivo (MapFile em JSON, com versão)
[x] Salvar em arquivo (File System Access API)
[x] "Salvar" sobrescreve o arquivo aberto; "Salvar como" cria outro
[x] Abrir arquivo .json
[x] Imagem de fundo embutida no arquivo (base64) ou referenciada
[x] Aviso de alterações não salvas ao fechar a aba
[x] Autosave em localStorage como backup

Fase 6 — Cidades e marcadores
[x] Ferramenta para colocar marcador (cidade, vila, capital, ponto de interesse)
    [x] Criar camada de marcadores automaticamente, ao adicionar o primeiro marcador
[x] Ícones diferentes por tipo de marcador
[x] Nome/legenda do marcador
[x] Mostrar/ocultar todas as legendas
[x] Mostrar/ocultar marcadores por tipo
[x] Mover e excluir marcadores
[x] Notas em cada marcador (painel lateral)

Fase 7 — Regiões e nações
[ ] Ferramenta de região: desenhar contorno que fecha automaticamente
[ ] Nome, tipo (continente, nação, região, etc.) e cor de preenchimento
[ ] Hierarquia (região pertence a uma nação, nação a um continente)
[ ] Clicar na região para abrir as notas no painel lateral
[ ] Editor de notas (texto simples ou Markdown)
[ ] Lista/árvore de regiões no painel lateral
[ ] Mostrar/ocultar regiões por tipo
[ ] Nome da região exibido no mapa
[ ] Ferramenta para calcular distância (km) e definir quantos dias de viagem (SEMPRE falar quantos dias, horas e minutos serão necessários) (separado por vários meios de transporte; a pé, a cavalo / carroça, barco, voando...)

Fase 8 — Encaixe e edição
[ ] Snap: traço começa/termina grudado na ponta de outro traço próximo
[ ] Ligar/desligar snap e ajustar a distância
[ ] Mover e duplicar elementos selecionados
[ ] Fazer desenho de elementos incluir simbolos que representem (usar a imagem de exemplo)

Fase 9 — Extras
[ ] Exportar o mapa como PNG/SVG (com ou sem legendas)
[ ] Busca por nome (cidades e regiões)
[ ] Régua de distância com escala configurável
[ ] Rosa dos ventos e escala no canto do mapa
[ ] Modo "visualização" (só navegar e ler notas, sem editar)

Ideias futuras
[ ] Múltiplos mapas ligados (clicar em uma cidade abre o mapa dela)
[ ] Gerar terreno automaticamente