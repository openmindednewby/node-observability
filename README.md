# @dloizides/node-observability

Metrics, JSON logs and W3C trace context for small Node services built on plain `node:http`.
It writes the same Prometheus series as the .NET `Metrics.Client` package, so one dashboard and one set of alerts covers both stacks.

## Quick start

```js
import { createServer } from 'node:http';
import { createHttpMetrics, createLogger, instrument } from '@dloizides/node-observability';

const app = 'surge-api';
const logger = createLogger({ app });
const metrics = createHttpMetrics({ app });

createServer(
  instrument(handler, {
    routes: ['/api/runs', '/api/items/:id'],
    skipPaths: ['/api/health'],
    logger,
    metrics,
    metricsToken: process.env.METRICS_TOKEN,
  }),
).listen(3002);
```

## What it records

| Series | Labels | Same as Metrics.Client |
|---|---|---|
| `http_requests_total` | `app`, `method`, `http_route`, `status_code` | yes |
| `http_request_duration_seconds` (buckets 5 ms .. 10 s) | `app`, `method`, `http_route`, `status_code` | yes |
| `http_unmatched_requests_total` | `app`, `method` | yes |
| `http_requests_in_flight` | `app` | yes |
| `process_*`, `nodejs_*` | none | the Node equivalent of prometheus-net's defaults |

- `http_route` is the matching template from `routes`; any other path is counted as the literal `unmatched`, so a URL never becomes a label.
- `/metrics`, `/health` and every `skipPaths` entry are neither counted nor logged.
- `metricsToken` set: `GET /metrics` needs `Authorization: Bearer <token>`.
- Own metrics go through `createCounter` / `createGauge` / `createHistogram` / `createSummary`: they throw at registration on a banned label (`user_id`, `userid`, `user`, `email`, `request_id`, `trace_id`, `span_id`, `correlation_id`, `path`, `url`, `raw_path`, `query`, `ip`, `client_ip`, `user_agent`, `message`, `error_message`), on `tenant` on an `http_*` metric, and on more than 8 labels. Wrap a tenant value in `createBoundedLabel()` (first 100 values, then `other`).

## Logs and traces

- One JSON line per request: `app`, `level`, `time`, `method`, `route`, `status`, `duration_ms`, `trace_id`, `span_id`, plus `TraceId` / `SpanId` for older queries, and `correlation_id` when the caller sent `X-Correlation-Id`.
- An incoming `traceparent` header is continued with a new span id; without one a new sampled trace starts. The response carries `traceparent` and `X-Trace-Id` back; a 500 body carries `traceId`.
- `currentTrace()` and `outgoingTraceparent()` give the trace to code that logs or calls another service while a request is in flight.
- A handler that throws or rejects is logged at `error` and answered with a 500 when nothing was sent yet.

## API

`instrument(handler, options)`, `createHttpMetrics({ app, register?, defaultMetrics? })`, `createLogger({ app, level?, destination? })`,
`currentTrace()`, `outgoingTraceparent()`, `runWithTrace(ctx, fn)`, `parseTraceparent()`, `startTrace()`, `formatTraceparent()`, `matchRoute(templates)`, `normalisePath(url)`,
`createCounter()`, `createGauge()`, `createHistogram()`, `createSummary()`, `assertMetricLabels(name, labelNames)`, `createBoundedLabel(limit?)`.
