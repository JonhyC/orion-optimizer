#!/bin/sh
set -e

# O volume comeca vazio. Sem catalogo, a rota /api/catalog responde 503 e
# nenhum cliente consegue optimizar nada - por isso semeamos a copia do
# repositorio no primeiro arranque.
#
# A partir dai o ficheiro do VOLUME manda. As edicoes feitas no painel
# ficam nele, e um deploy novo nao lhes toca. O catalogo/tweaks.json do
# repositorio passa a ser semente e copia de seguranca, nao a versao viva.

mkdir -p "$ORION_DATA_DIR"

if [ ! -f "$ORION_CATALOG_PATH" ]; then
  echo "[orion] volume sem catalogo; a semear a partir do repositorio"
  cp /app/catalog/tweaks.json "$ORION_CATALOG_PATH"
fi

if [ ! -f "$ORION_DATA_DIR/orion.sqlite" ]; then
  echo "[orion] volume sem base de dados; vai ser criada vazia no arranque"
  echo "[orion] carrega a tua orion.sqlite para $ORION_DATA_DIR antes de usar a serio"
fi

exec "$@"
