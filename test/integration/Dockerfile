ARG NODE_MAJOR

FROM node:${NODE_MAJOR} as node-base-${NODE_MAJOR}

RUN apt-get update && apt-get install -y \
	curl \
	&& rm -rf /var/lib/apt/lists/*

RUN npm install -g harperdb

FROM node-base-${NODE_MAJOR}

ARG NEXT_MAJOR
ARG NODE_MAJOR

COPY next-${NEXT_MAJOR}/ ./template/

EXPOSE 3000
CMD ["node", "template/index.js"]