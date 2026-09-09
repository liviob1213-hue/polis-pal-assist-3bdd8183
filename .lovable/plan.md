# Corrigir processamento de PDFs grandes

## Alterações
- Ler somente a quantidade de páginas na primeira chamada, sem extrair todo o documento.
- Extrair apenas as páginas do bloco solicitado, evitando reler e processar o PDF inteiro a cada etapa.
- Reduzir o tamanho dos blocos e dos lotes de vetorização para manter cada chamada dentro do tempo limite.
- Preservar o progresso, mensagens de erro e remoção do arquivo temporário.

## Validação
- Verificar os tipos do projeto.
- Confirmar que a função responde ao modo de consulta com `total_paginas` e processa intervalos separados.

## No banco externo
- Não será necessário novo SQL se o armazenamento `conhecimento` já foi criado.
- Será necessário substituir e publicar novamente a função `processar-pdf-conhecimento`.
