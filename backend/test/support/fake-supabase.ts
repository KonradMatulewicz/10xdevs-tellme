import type { SupabaseClient } from '@supabase/supabase-js';

export interface FakeResponse {
  data: unknown;
  error: { message: string; code?: string } | null;
}

/**
 * A minimal chainable Supabase query-builder double. Every chain method
 * (`select`, `order`, `eq`, `ilike`, `limit`, `insert`, `update`, `single`)
 * returns the same thenable so route code can chain calls in any order and
 * `await` the result, exactly like the real `@supabase/supabase-js` builder.
 * Arguments passed to chain methods are not inspected — these tests exercise
 * how a route *handles* a given response shape, not Postgres's own filtering.
 */
function createFakeQueryBuilder(response: FakeResponse) {
  const builder: Record<string, unknown> = {
    select: () => builder,
    order: () => builder,
    eq: () => builder,
    ilike: () => builder,
    limit: () => builder,
    insert: () => builder,
    update: () => builder,
    single: () => builder,
    then(onFulfilled: (value: FakeResponse) => unknown, onRejected?: (reason: unknown) => unknown) {
      return Promise.resolve(response).then(onFulfilled, onRejected);
    },
  };
  return builder;
}

/** A fake Supabase client whose every `.from(table)` query resolves to `response`. */
export function createFakeSupabaseClient(response: FakeResponse): SupabaseClient {
  return {
    from: () => createFakeQueryBuilder(response),
  } as unknown as SupabaseClient;
}

/** Simulates Postgres's "no row matched" error, as returned by `.single()` under RLS. */
export const PGRST116: FakeResponse['error'] = {
  message: 'The result contains 0 rows',
  code: 'PGRST116',
};
