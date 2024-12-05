# Next.js Specific Dockerfile for HarperDB Next.js Integration Tests fixtures
# Must be run from the root of the repository

ARG BASE_IMAGE

FROM ${BASE_IMAGE}

ARG NEXT_MAJOR

COPY fixtures/next-${NEXT_MAJOR} /hdb/components/next-${NEXT_MAJOR}

WORKDIR /hdb/components/next-${NEXT_MAJOR}

# Fixtures should automatically link the @harperdb/nextjs module via their postinstall script.
RUN npm install

WORKDIR /
