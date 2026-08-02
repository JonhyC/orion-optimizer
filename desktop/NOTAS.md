# Notas da proxima versao

Uma linha por alteracao. O publish-release.mjs le este ficheiro e mete as
linhas no manifesto, para o painel poder mostrar o que mudou antes de
alguem carregar em actualizar. Linhas com # sao ignoradas.

Limpar depois de publicar.

- Corrigido o update pelo site quando o servidor guardado na app aponta para localhost
- O painel descarrega o instalador oficial nas versoes anteriores, sem depender do atualizador antigo
- Futuras atualizacoes automaticas usam o feed enviado pelo site
