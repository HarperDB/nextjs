# Base Dockerfile for HarperDB Next.js Integration Tests fixtures
# Must be run from the root of the repository

ARG NODE_MAJOR

FROM node:${NODE_MAJOR}

RUN apt-get update && apt-get install -y \
	curl \
	&& rm -rf /var/lib/apt/lists/*

# Install HarperDB Globally
RUN npm install -g harperdb

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

# Create components directory
RUN mkdir -p /hdb/components

# Add base component
COPY /fixtures/harperdb-base-component /hdb/components/harperdb-base-component

# Create the @harperdb/nextjs module directory so it can be linked locally
RUN mkdir -p /@harperdb/nextjs

# Cache Bust copying project files
ARG CACHE_BUST
RUN echo "${CACHE_BUST}"
COPY config.yaml extension.js cli.js package.json /@harperdb/nextjs/

WORKDIR /@harperdb/nextjs
# Install dependencies for the @harperdb/nextjs module
RUN npm install

# Create link to the @harperdb/nextjs module
RUN npm link
