# Base Dockerfile for HarperDB Next.js Integration Tests fixtures
# Must be run from the root of the repository

ARG NODE_MAJOR

FROM docker.io/node:${NODE_MAJOR}-slim

EXPOSE 9925 9926

# Install utilities for the container
RUN apt-get update && apt-get install -y \
	# List of tools to install
	# curl \
	# Clean Up
	&& rm -rf /var/lib/apt/lists/*

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

RUN harperdb start && sleep 5

# Add base component
COPY /fixtures/harperdb-base-component /hdb/components/harperdb-base-component

RUN harperdb start && sleep 5

# Create the @harperdb/nextjs module directory so it can be linked locally
RUN mkdir -p /@harperdb/nextjs

COPY config.yaml extension.js cli.js package.json /@harperdb/nextjs/

WORKDIR /@harperdb/nextjs

# Install dependencies for the @harperdb/nextjs module
RUN npm install --omit=dev

# Create link to the @harperdb/nextjs module
RUN npm link

WORKDIR /

RUN harperdb start

# By default, run HarperDB when the container starts. This can be overridden by passing a different command to the container, or using a new CMD in a child Dockerfile.
CMD harperdb run