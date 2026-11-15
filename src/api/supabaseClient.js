import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[Supabase] Missing env vars: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

// In-memory mutex replacing navigator.locks (prevents SES/lockdown extension deadlocks
// while maintaining auth operation serialization — fixes logout→login race condition)
const locks = new Map();

async function acquireLock(name, acquireTimeout, fn) {
  if (!locks.has(name)) {
    locks.set(name, Promise.resolve());
  }

  let releaseLock;
  const waitForTurn = locks.get(name);
  const newTail = new Promise((resolve) => {
    releaseLock = resolve;
  });
  locks.set(name, newTail);

  const timeoutMs = acquireTimeout || 5000;
  try {
    await Promise.race([
      waitForTurn,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Lock timeout: ' + name)), timeoutMs)
      ),
    ]);
  } catch (e) {
    // Intentional: proceed despite timeout to avoid blocking auth permanently.
    // Concurrent execution is better than a stuck user.
    console.warn('[Supabase Lock]', e.message, '- proceeding anyway');
  }

  try {
    return await fn();
  } finally {
    releaseLock();
  }
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    lock: acquireLock,
  },
});
