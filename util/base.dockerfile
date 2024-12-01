ARG NODE_MAJOR

FROM node:${NODE_MAJOR}

RUN apt-get update && apt-get install -y \
	curl \
	&& rm -rf /var/lib/apt/lists/*

RUN mkdir -p /@harperdb/nextjs

COPY --exclude=.github --exclude=fixtures --exclude=test --exclude=util --exclude=node_modules --exclude=.node-version --exclude=.git \
	. /@harperdb/nextjs

RUN npm install -C /@harperdb/nextjs

RUN npm install -g harperdb

RUN mkdir -p /hdb/components

ENV TC_AGREEMENT=yes
ENV HDB_ADMIN_USERNAME=hdb_admin
ENV HDB_ADMIN_PASSWORD=password
ENV ROOTPATH=/hdb
ENV OPERATIONSAPI_NETWORK_PORT=9925
ENV HTTP_PORT=9926

COPY /fixtures/harperdb-base-component /hdb/components/harperdb-base-component