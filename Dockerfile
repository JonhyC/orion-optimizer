# Orion Optimizer - imagem de producao.
#
# Node 24 por causa do node:sqlite, que so existe sem flag a partir do
# 22.13. Fixar a versao maior evita que um rebuild futuro caia num runtime
# onde o modulo desaparece.
FROM node:24-alpine

WORKDIR /app/site

# Dependencias primeiro: a camada so e refeita quando os manifests mudam.
COPY site/package.json site/package-lock.json ./
RUN npm ci

COPY site ./
COPY catalog /app/catalog
COPY scripts /app/scripts

RUN npm run build

# Tudo o que a aplicacao escreve enquanto corre vai para /data, que e o
# ponto de montagem do volume. O resto do sistema de ficheiros e
# descartado a cada deploy.
ENV NODE_ENV=production
ENV ORION_DATA_DIR=/data
ENV ORION_CATALOG_PATH=/data/tweaks.json
ENV PORT=3400

EXPOSE 3400

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "start"]
