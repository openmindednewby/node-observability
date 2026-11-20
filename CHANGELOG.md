# Changelog

## 0.3.0

- `startManagementServer({ metrics, port = 8081, host?, health? })`: a second `node:http` listener serving `/metrics`, `/health/live` and `/health/ready` only; every other path or method is 404. `health.live` / `health.ready` return a boolean (or throw) and map to 200 / 503.
- `hideManagementPaths(handler)`: wraps the public listener (outside `instrument`) so `/metrics`, `/health/live` and `/health/ready` answer 404 there. Without it nothing changes.

## 0.2.0

- Banned-label guard (OBS-7 "Every app and service ships the seven observability pillars", observability-pillars.md section 7): `createCounter` / `createGauge` / `createHistogram` / `createSummary` and `assertMetricLabels` throw at registration on a personal or unbounded label (`user_id`, `email`, `trace_id`, `path`, `ip`, `user_agent`, `message`, ...), on `tenant` on any `http_*` metric, and on more than 8 labels. The HTTP metrics are created through it.
- `createBoundedLabel(limit = 100)`: the first 100 distinct values pass, the rest become `other`.
- Every response carries `X-Trace-Id`; the 500 body carries `traceId`.
- Logs carry `trace_id` / `span_id` (the old `TraceId` / `SpanId` stay for now) and an inbound `X-Correlation-Id` as `correlation_id` (max 128 chars).

## 0.1.0

- `instrument()` for plain `node:http` listeners: `/metrics` (optional bearer token), the Metrics.Client HTTP series and labels, a bounded `http_route` from route templates, and one JSON access line per request.
- `createLogger()`: pino JSON logs with `app`, `TraceId` and `SpanId`.
- W3C `traceparent` in and out, plus `currentTrace()` / `outgoingTraceparent()` for outgoing calls.
