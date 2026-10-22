# syntax=docker/dockerfile:1.7@sha256:a57df69d0ea827fb7266491f2813635de6f17269be881f696fbfdf2d83dda33e
FROM registry.access.redhat.com/hi/go:1.27.3-builder-1792647751@sha256:d625ad0529171135c191e32c52b13bc8c02bbaaeb9a979509b62b90095df9454 AS build
WORKDIR /src
COPY apps/api/go.mod apps/api/go.sum* ./
RUN go mod download
COPY apps/api .
RUN CGO_ENABLED=0 go build -o /out/ ./cmd/server ./cmd/schema ./cmd/migrate ./cmd/spicedb-runtime-proxy ./cmd/audit-retention
FROM registry.access.redhat.com/hi/static:latest-1790234989@sha256:08d039e8b4f70c0b22118acfff9ada93fc7f9d349e5c5ac991fbdf6b876eea91
COPY --from=build /out/server /app
COPY --from=build /out/schema /schema
COPY --from=build /out/migrate /migrate
COPY --from=build /out/spicedb-runtime-proxy /spicedb-runtime-proxy
COPY --from=build /out/audit-retention /audit-retention
ENTRYPOINT ["/app"]
