# Next.js Specific Dockerfile for HarperDB Next.js Integration Tests fixtures
# Must be run from the root of the repository

ARG BASE_IMAGE

FROM ${BASE_IMAGE}

ARG NEXT_MAJOR

ARG CACHE_BUST
RUN echo "${CACHE_BUST}"
COPY fixtures/next-${NEXT_MAJOR} /hdb/components/next-${NEXT_MAJOR}

WORKDIR /hdb/components/next-${NEXT_MAJOR}
RUN npm install

WORKDIR /

EXPOSE 9925 9926

CMD ["harperdb", "run"]