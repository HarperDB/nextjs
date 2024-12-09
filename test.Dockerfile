ARG NODE_VERSION=22
FROM docker.io/node:${NODE_VERSION}-slim

EXPOSE 9925 9926

RUN npx -y playwright install --with-deps

# Install HarperDB Globally
RUN npm install -g harperdb@4.4.8

# Set HarperDB Environment Variables
ENV TC_AGREEMENT=yes
ENV HDB_ADMIN_USERNAME=hdb_admin
ENV HDB_ADMIN_PASSWORD=password
ENV ROOTPATH=/hdb
ENV OPERATIONSAPI_NETWORK_PORT=9925
ENV HTTP_PORT=9926
ENV THREADS_COUNT=1
ENV LOGGING_STDSTREAMS=true
ENV LOGGING_LEVEL=debug
ENV AUTHENTICATION_AUTHORIZELOCAL=false

# Create the @harperdb/nextjs module directory so it can be linked locally
RUN mkdir -p /@harperdb/nextjs
COPY config.yaml extension.js cli.js package.json /@harperdb/nextjs/
WORKDIR /@harperdb/nextjs
# Install dependencies for the @harperdb/nextjs module
RUN npm install --omit=dev
# Create link to the @harperdb/nextjs module
RUN npm link

WORKDIR /

ARG FIXTURE
COPY /fixtures/${FIXTURE} /fixture
WORKDIR /fixture
RUN npm install

CMD npm run test