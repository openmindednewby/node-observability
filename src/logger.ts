import { pino, type DestinationStream, type Logger, type LoggerOptions as PinoOptions } from 'pino';
import { currentTrace } from './context';

/** Options for {@link createLogger}. */
export interface LoggerOptions {
  app: string;
  level?: string;
  destination?: DestinationStream;
}

/** A JSON logger that stamps `app`, `trace_id` / `span_id` (and the older `TraceId` / `SpanId`) and `correlation_id` on every line. */
export function createLogger(options: LoggerOptions): Logger {
  const config: PinoOptions = {
    level: options.level ?? process.env.LOG_LEVEL ?? 'info',
    base: { app: options.app },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: { level: (label) => ({ level: label }) },
    mixin: () => {
      const ctx = currentTrace();
      if (!ctx) return {};
      const ids = { trace_id: ctx.traceId, span_id: ctx.spanId, TraceId: ctx.traceId, SpanId: ctx.spanId };
      return ctx.correlationId === undefined ? ids : { ...ids, correlation_id: ctx.correlationId };
    },
  };
  return options.destination ? pino(config, options.destination) : pino(config);
}
