export class AiTimeoutError extends Error { name = 'AiTimeoutError'; }
export class AiOutputError extends Error { name = 'AiOutputError'; }

export function errorStatus(err: unknown): number | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const e = err as { status?: unknown; statusCode?: unknown };
  const value = e.status ?? e.statusCode;
  return typeof value === 'number' ? value : undefined;
}
export function retryableAiError(err: unknown): boolean {
  const status = errorStatus(err);
  if (status !== undefined) return status === 0 || status === 404 || status === 408 || status === 429 || status >= 500;
  return err instanceof AiOutputError || err instanceof AiTimeoutError ||
    (err instanceof Error && ['TypeError', 'AbortError', 'TimeoutError', 'FetchError'].includes(err.name));
}

// Validate the subset of JSON Schema used by our routes before an attempt wins.
type Schema = { type?: string; enum?: unknown[]; required?: string[]; properties?: Record<string, Schema>; items?: Schema; minItems?: number; maxItems?: number; minimum?: number; maximum?: number; anyOf?: Schema[] };
export function matchesSchema(value: unknown, schema: Schema): boolean {
  if (schema.anyOf) return schema.anyOf.some(s => matchesSchema(value, s));
  if (schema.enum && !schema.enum.includes(value)) return false;
  if (schema.type === 'null') return value === null;
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const record = value as Record<string, unknown>;
    return (schema.required ?? []).every(k => k in record) && Object.entries(schema.properties ?? {}).every(([k, s]) => !(k in record) || matchesSchema(record[k], s));
  }
  if (schema.type === 'array') return Array.isArray(value) && value.length >= (schema.minItems ?? 0) && value.length <= (schema.maxItems ?? Infinity) && value.every(v => !schema.items || matchesSchema(v, schema.items));
  if (schema.type === 'string') return typeof value === 'string';
  if (schema.type === 'boolean') return typeof value === 'boolean';
  if (schema.type === 'number' || schema.type === 'integer') return typeof value === 'number' && Number.isFinite(value) && (schema.type !== 'integer' || Number.isInteger(value)) && value >= (schema.minimum ?? -Infinity) && value <= (schema.maximum ?? Infinity);
  return true;
}
