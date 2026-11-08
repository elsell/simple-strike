# syntax=docker/dockerfile:1.7@sha256:a57df69d0ea827fb7266491f2813635de6f17269be881f696fbfdf2d83dda33e
FROM registry.access.redhat.com/hi/go:1.26.9-builder-1792219929@sha256:b4e44ef2280aace1a866614567ab6b373a4f92a971283246e74d64ae5b056c79 AS build
WORKDIR /src
COPY apps/api/go.mod apps/api/go.sum* ./
RUN go mod download
COPY apps/api .
RUN CGO_ENABLED=0 go build -o /out/ ./cmd/server ./cmd/schema ./cmd/migrate ./cmd/spicedb-runtime-proxy ./cmd/audit-retention
FROM registry.access.redhat.com/hi/static:latest-1793816400@sha256:5ccc33cd2058587d048e9b0f17fbc11be72f1886ae68a1a11385fe233a8ba645
COPY --from=build /out/server /app
COPY --from=build /out/schema /schema
COPY --from=build /out/migrate /migrate
COPY --from=build /out/spicedb-runtime-proxy /spicedb-runtime-proxy
COPY --from=build /out/audit-retention /audit-retention
ENTRYPOINT ["/app"]
