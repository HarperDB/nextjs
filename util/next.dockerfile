ARG BASE_IMAGE

FROM ${BASE_IMAGE}

ARG NEXT_MAJOR

COPY fixtures/next-${NEXT_MAJOR} /hdb/components/next-${NEXT_MAJOR}

RUN npm install -C hdb/components/next-${NEXT_MAJOR}

EXPOSE 9925 9926

CMD ["harperdb", "run"]