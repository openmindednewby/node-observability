import { pino, type DestinationStream, type Logger, type LoggerOptions as PinoOptions } from 'pino';
import { currentTrace } from './context';

/** Options for {@link createLogger}. */
export interface LoggerOptions {
  app: string;
  level?: string;
  destination?: DestinationStream;
}

/** A JSON logger that stamps `app` and the current `TraceId` / `SpanId` (Logging.Client names) on every line. */
export function createLogger(options: LoggerOptions): Logger {
  const config: PinoOptions = {
    level: options.level ?? process.env.LOG_LEVEL ?? 'info',
    base: { app: options.app },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: { level: (label) => ({ level: label }) },
    mixin: () => {
      const ctx = currentTrace();
      return ctx ? { TraceId: ctx.traceId, SpanId: ctx.spanId } : {};
    },
  };
  return options.destination ? pino(config, options.destination) : pino(config);
}
