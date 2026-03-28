import api from './api';

// ── Web Vitals ────────────────────────────────────────────────────────────────
type VitalName = 'CLS' | 'FID' | 'LCP' | 'FCP' | 'TTFB' | 'INP';

export const reportVital = (name: VitalName, value: number) => {
  api.post('/monitor/vitals', {
    metric: name,
    value: Math.round(value),
    path: window.location.pathname,
  }).catch(() => null);
};

// Inline reporter compatible with web-vitals onCLS/onLCP/etc signature
export const vitalReporter = ({ name, value }: { name: string; value: number }) => {
  reportVital(name as VitalName, value);
};

// ── Frontend error reporter ───────────────────────────────────────────────────
export const reportError = (error: Error | string, context?: Record<string, unknown>) => {
  const message = error instanceof Error ? error.message : String(error);
  const stack   = error instanceof Error ? error.stack   : undefined;

  api.post('/monitor/errors', {
    level:   'error',
    message,
    stack,
    path:    window.location.pathname,
    context: { ...context, userAgent: navigator.userAgent },
  }).catch(() => null);
};

// ── Global unhandled error capture ───────────────────────────────────────────
export const initGlobalErrorCapture = () => {
  window.addEventListener('error', (e) => {
    reportError(e.error ?? new Error(e.message), { type: 'uncaught', filename: e.filename, lineno: e.lineno });
  });

  window.addEventListener('unhandledrejection', (e) => {
    const err = e.reason instanceof Error ? e.reason : new Error(String(e.reason));
    reportError(err, { type: 'unhandledRejection' });
  });
};
