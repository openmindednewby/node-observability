# Changelog

## 0.2.0

- Banned-label guard (OBS-7 "Every app and service ships the seven observability pillars", observability-pillars.md section 7): `createCounter` / `createGauge` / `createHistogram` / `createSummary` and `assertMetricLabels` throw at registration on a personal or unbounded label (`user_id`, `email`, `trace_id`, `path`, `ip`, `user_agent`, `message`, ...), on `tenant` on any `http_*` metric, and on more than 8 labels. The HTTP metrics are created through it.
- `createBoundedLabel(limit = 100)`: the first 100 distinct values pass, the rest become `other`.
- Every response carries `X-Trace-Id`; the 500 body carries `traceId`.
- Logs carry `trace_id` / `span_id` (the old `TraceId` / `SpanId` stay for now) and an inbound `X-Correlation-Id` as `correlation_id` (max 128 chars).

## 0.1.0

- `instrument()` for plain `node:http` listeners: `/metrics` (optional bearer token), the Metrics.Client HTTP series and labels, a bounded `http_route` from route templates, and one JSON access line per request.
- `createLogger()`: pino JSON logs with `app`, `TraceId` and `SpanId`.
- W3C `traceparent` in and out, plus `currentTrace()` / `outgoingTraceparent()` for outgoing calls.
