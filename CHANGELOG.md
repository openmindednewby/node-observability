# Changelog

## 0.1.0

- `instrument()` for plain `node:http` listeners: `/metrics` (optional bearer token), the Metrics.Client HTTP series and labels, a bounded `http_route` from route templates, and one JSON access line per request.
- `createLogger()`: pino JSON logs with `app`, `TraceId` and `SpanId`.
- W3C `traceparent` in and out, plus `currentTrace()` / `outgoingTraceparent()` for outgoing calls.
