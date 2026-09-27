# Corrigir tela branca no iPad

## Objetivo
Garantir que o app sempre mostre uma interface visível em tablets, tanto deslogado quanto autenticado, nas larguras de iPad em retrato e paisagem.

## Mudanças
- Tornar o carregamento inicial e a tela global de erro compatíveis com altura dinâmica (`100dvh`) e áreas seguras do iPad.
- Fazer rotas desconhecidas encaminharem para o login quando não houver sessão, evitando qualquer página vazia.
- Remover retornos vazios durante verificações de sessão e substituir por uma tela “Carregando...” visível.
- Ajustar o layout interno para tablet: barra lateral colapsada por padrão em larguras intermediárias, conteúdo com largura mínima zero, rolagem segura e sem sobreposição.
- Substituir alturas baseadas em `100vh` nas telas críticas por `100dvh`/altura dinâmica.
- Manter a meta viewport com `viewport-fit=cover` e aplicar as áreas seguras no contêiner principal.
- Verificar que nenhuma checagem de navegador, dispositivo ou largura bloqueia a renderização.

## Validação
- Testar deslogado em janelas anônimas de 820×1180 e 1180×820.
- Confirmar visualmente que a tela de login aparece nos dois tamanhos.
- Validar também 768, 1024 e 1366 px, conferindo ausência de tela branca e sobreposição da barra lateral.
- Conferir erros de execução e o estado final da compilação.

## Limites
- Nenhuma alteração no banco de dados ou nas regras de acesso.
- O login e os dados existentes permanecem inalterados.
