import type { Env as WorkerEnv } from '../src/types';

declare global {
  namespace Cloudflare {
    interface Env extends WorkerEnv {
      /** Optional — real Supabase test users for idor.test.ts. See .env.example. */
      TEST_USER_A_EMAIL?: string;
      TEST_USER_A_PASSWORD?: string;
      TEST_USER_B_EMAIL?: string;
      TEST_USER_B_PASSWORD?: string;
    }
  }
}
