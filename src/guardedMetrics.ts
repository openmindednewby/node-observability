import {
  Counter, Gauge, Histogram, Summary,
  type CounterConfiguration, type GaugeConfiguration, type HistogramConfiguration, type SummaryConfiguration,
} from 'prom-client';
import { assertMetricLabels } from './labelGuard';

/** A prom-client Counter whose label names pass {@link assertMetricLabels} first. */
export function createCounter<T extends string>(config: CounterConfiguration<T>): Counter<T> {
  assertMetricLabels(config.name, config.labelNames ?? []);
  return new Counter(config);
}

/** A prom-client Gauge whose label names pass {@link assertMetricLabels} first. */
export function createGauge<T extends string>(config: GaugeConfiguration<T>): Gauge<T> {
  assertMetricLabels(config.name, config.labelNames ?? []);
  return new Gauge(config);
}

/** A prom-client Histogram whose label names pass {@link assertMetricLabels} first. */
export function createHistogram<T extends string>(config: HistogramConfiguration<T>): Histogram<T> {
  assertMetricLabels(config.name, config.labelNames ?? []);
  return new Histogram(config);
}

/** A prom-client Summary whose label names pass {@link assertMetricLabels} first. */
export function createSummary<T extends string>(config: SummaryConfiguration<T>): Summary<T> {
  assertMetricLabels(config.name, config.labelNames ?? []);
  return new Summary(config);
}
