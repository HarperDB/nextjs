ARG NODE_MAJOR

FROM node:${NODE_MAJOR} as node-base-${NODE_MAJOR}

RUN apt-get update && apt-get install -y \
	curl \
	&& rm -rf /var/lib/apt/lists/*

RUN npm install -g harperdb

RUN mkdir -p /hdb/components

ENV TC_AGREEMENT=yes
ENV HDB_ADMIN_USERNAME=hdb_admin
ENV HDB_ADMIN_PASSWORD=password
ENV ROOTPATH=/hdb
ENV OPERATIONSAPI_NETWORK_PORT=9925
ENV HTTP_PORT=9926

COPY harperdb-base-component /hdb/components/harperdb-base-component

ARG NODE_MAJOR

FROM node-base-${NODE_MAJOR}

ARG NEXT_MAJOR

COPY next-${NEXT_MAJOR} /hdb/components/next-${NEXT_MAJOR}

EXPOSE 9925 9926

CMD ["harperdb", "run"]
