/**
 * Leichtgewichtige Typ-Guards für API-Input-Validierung.
 * Kein Zod-Dep nötig; reicht für die meisten POST-Bodies aus.
 *
 * Pattern:
 *   const v = validate(body, {
 *     title: str({ min: 1, max: 120 }),
 *     xp_cost: int({ min: 1, max: 100000 }),
 *     email: str({ pattern: /^\S+@\S+$/, max: 200 }),
 *     active: bool({ optional: true }),
 *   });
 *   if (!v.ok) return NextResponse.json({ error: "invalid", issues: v.issues }, { status: 400 });
 */

type Issue = { field: string; msg: string };
type Ok<T> = { ok: true; data: T };
type Fail = { ok: false; issues: Issue[] };
type Result<T> = Ok<T> | Fail;

type Validator<T> = (val: unknown, field: string) => { value?: T; issue?: Issue };

export function str(opts: { min?: number; max?: number; pattern?: RegExp; optional?: boolean } = {}): Validator<string | undefined> {
  return (v, field) => {
    if (v == null || v === "") {
      if (opts.optional) return { value: undefined };
      return { issue: { field, msg: "required" } };
    }
    if (typeof v !== "string") return { issue: { field, msg: "not_string" } };
    if (opts.min != null && v.length < opts.min) return { issue: { field, msg: `min_${opts.min}` } };
    if (opts.max != null && v.length > opts.max) return { issue: { field, msg: `max_${opts.max}` } };
    if (opts.pattern && !opts.pattern.test(v)) return { issue: { field, msg: "pattern" } };
    return { value: v };
  };
}

export function int(opts: { min?: number; max?: number; optional?: boolean } = {}): Validator<number | undefined> {
  return (v, field) => {
    if (v == null) {
      if (opts.optional) return { value: undefined };
      return { issue: { field, msg: "required" } };
    }
    if (typeof v !== "number" || !Number.isInteger(v)) return { issue: { field, msg: "not_int" } };
    if (opts.min != null && v < opts.min) return { issue: { field, msg: `min_${opts.min}` } };
    if (opts.max != null && v > opts.max) return { issue: { field, msg: `max_${opts.max}` } };
    return { value: v };
  };
}

export function bool(opts: { optional?: boolean } = {}): Validator<boolean | undefined> {
  return (v, field) => {
    if (v == null) {
      if (opts.optional) return { value: undefined };
      return { issue: { field, msg: "required" } };
    }
    if (typeof v !== "boolean") return { issue: { field, msg: "not_bool" } };
    return { value: v };
  };
}

export function uuid(opts: { optional?: boolean } = {}): Validator<string | undefined> {
  const RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return str({ min: 36, max: 36, pattern: RE, optional: opts.optional });
}

export function oneOf<T extends string>(values: readonly T[], opts: { optional?: boolean } = {}): Validator<T | undefined> {
  return (v, field) => {
    if (v == null) {
      if (opts.optional) return { value: undefined };
      return { issue: { field, msg: "required" } };
    }
    if (typeof v !== "string" || !values.includes(v as T)) {
      return { issue: { field, msg: `not_in_${values.join("|")}` } };
    }
    return { value: v as T };
  };
}

type Shape = Record<string, Validator<unknown>>;
type Inferred<S extends Shape> = { [K in keyof S]: S[K] extends Validator<infer T> ? T : never };

export function validate<S extends Shape>(body: unknown, shape: S): Result<Inferred<S>> {
  if (!body || typeof body !== "object") return { ok: false, issues: [{ field: "_body", msg: "not_object" }] };
  const src = body as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  const issues: Issue[] = [];
  for (const [field, v] of Object.entries(shape)) {
    const r = v(src[field], field);
    if (r.issue) issues.push(r.issue);
    else out[field] = r.value;
  }
  if (issues.length) return { ok: false, issues };
  return { ok: true, data: out as Inferred<S> };
}
