import { createAccountService } from './core';
import { createSqliteStore } from './sqlite-store';

/** Standalone local account service over SQLite. A deployment terminates HTTPS in front of it. */
export function createSocialService(file: string) {
  const store = createSqliteStore(file);
  const service = createAccountService(store);
  return { handle: service.handle, close: () => store.close() };
}
