import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from 'prom-client';
import { UNMATCHED_ROUTE } from './route';

/** Options for {@link createHttpMetrics}. */
export interface HttpMetricsOptions {
  app: string;
  register?: Registry;
  defaultMetrics?: boolean;
}

/** One finished request. */
export interface RequestSample {
  method: string;
  route: string;
  statusCode: number;
  seconds: number;
}

/** The HTTP metrics of one service, named and labelled exactly as Metrics.Client's HttpMetricsMiddleware. */
export interface HttpMetrics {
  register: Registry;
  requestStarted(): void;
  requestFinished(sample: RequestSample): void;
}

const DURATION_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
const ROUTE_LABELS = ['app', 'method', 'http_route', 'status_code'] as const;

/** Creates the request counter, duration histogram, unmatched counter and in-flight gauge on one registry. */
export function createHttpMetrics(options: HttpMetricsOptions): HttpMetrics {
  const register = options.register ?? new Registry();
  const registers = [register];
  if (options.defaultMetrics !== false) collectDefaultMetrics({ register });

  const total = new Counter({ name: 'http_requests_total', help: 'Total number of HTTP requests processed.', labelNames: ROUTE_LABELS, registers });
  const unmatched = new Counter({ name: 'http_unmatched_requests_total', help: 'Total number of HTTP requests that did not match any route.', labelNames: ['app', 'method'], registers });
  const duration = new Histogram({ name: 'http_request_duration_seconds', help: 'Duration of HTTP requests in seconds.', labelNames: ROUTE_LABELS, buckets: DURATION_BUCKETS, registers });
  const inFlight = new Gauge({ name: 'http_requests_in_flight', help: 'Number of HTTP requests currently being processed.', labelNames: ['app'], registers });
  inFlight.labels(options.app).set(0);

  return {
    register,
    requestStarted: () => inFlight.labels(options.app).inc(),
    requestFinished: ({ method, route, statusCode, seconds }) => {
      inFlight.labels(options.app).dec();
      const labels = { app: options.app, method, http_route: route, status_code: String(statusCode) };
      total.inc(labels);
      duration.observe(labels, seconds);
      if (route === UNMATCHED_ROUTE) unmatched.inc({ app: options.app, method });
    },
  };
}
