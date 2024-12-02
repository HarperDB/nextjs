# syntax=docker/dockerfile:1.7-labs

# Next.js Specific Dockerfile for HarperDB Next.js Integration Tests fixtures
# Must be run from the root of the repository

ARG BASE_IMAGE

FROM ${BASE_IMAGE}

ARG NEXT_MAJOR

ARG CACHE_BUST
RUN echo "${CACHE_BUST}"
COPY --exclude=node_modules --exclude=.next fixtures/next-${NEXT_MAJOR} /hdb/components/next-${NEXT_MAJOR}

RUN cd hdb/components/next-${NEXT_MAJOR} && npm install

EXPOSE 9925 9926

CMD ["harperdb", "run"]