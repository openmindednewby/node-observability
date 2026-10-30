import { Registry } from 'prom-client';
import { assertMetricLabels, MAX_LABELS_PER_METRIC } from './labelGuard';
import { createCounter, createGauge, createHistogram } from './guardedMetrics';

describe('assertMetricLabels', () => {
  it.each(['user_id', 'userid', 'user', 'email', 'request_id', 'trace_id', 'span_id', 'correlation_id', 'path', 'url', 'raw_path', 'query', 'ip', 'client_ip', 'user_agent', 'message', 'error_message'])(
    'with the banned label %s, throws naming the standard',
    (label) => {
      const register = (): void => assertMetricLabels('orders_total', [label]);

      expect(register).toThrow(/observability-pillars\.md/);
    },
  );

  it('with a banned label in upper case, throws', () => {
    const register = (): void => assertMetricLabels('orders_total', ['Email']);

    expect(register).toThrow(/Email/);
  });

  it('with tenant on an http_ metric, throws', () => {
    const register = (): void => assertMetricLabels('http_requests_total', ['method', 'tenant']);

    expect(register).toThrow(/tenant/);
  });

  it('with tenant on a business counter, accepts it', () => {
    const register = (): void => assertMetricLabels('orders_placed_total', ['tenant', 'plan']);

    expect(register).not.toThrow();
  });

  it('with more labels than the budget, throws', () => {
    const labels = Array.from({ length: MAX_LABELS_PER_METRIC + 1 }, (_, i) => `l${i}`);

    const register = (): void => assertMetricLabels('orders_total', labels);

    expect(register).toThrow(/at most 8 labels/);
  });

  it('with exactly the label budget, accepts it', () => {
    const labels = Array.from({ length: MAX_LABELS_PER_METRIC }, (_, i) => `l${i}`);

    const register = (): void => assertMetricLabels('orders_total', labels);

    expect(register).not.toThrow();
  });
});

describe('createCounter', () => {
  it('with a banned label, throws before registering the metric', () => {
    const registry = new Registry();

    const create = (): unknown => createCounter({ name: 'signups_total', help: 'h', labelNames: ['email'], registers: [registry] });

    expect(create).toThrow(/email/);
    expect(registry.getSingleMetric('signups_total')).toBeUndefined();
  });

  it('with allowed labels, registers the counter', () => {
    const registry = new Registry();

    createCounter({ name: 'signups_total', help: 'h', labelNames: ['plan'], registers: [registry] });

    expect(registry.getSingleMetric('signups_total')).toBeDefined();
  });
});

describe('createGauge', () => {
  it('with a raw path label, throws', () => {
    const create = (): unknown => createGauge({ name: 'queue_depth', help: 'h', labelNames: ['path'], registers: [] });

    expect(create).toThrow(/path/);
  });
});

describe('createHistogram', () => {
  it('with tenant on an http_ histogram, throws', () => {
    const create = (): unknown => createHistogram({ name: 'http_upload_seconds', help: 'h', labelNames: ['tenant'], registers: [] });

    expect(create).toThrow(/tenant/);
  });
});
