import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { createSocialService } from './accounts';
import { accountHTTPServer } from './http';

const directory = path.resolve(process.env.SAO_SOCIAL_DATA ?? './social-data');
mkdirSync(directory, { recursive: true, mode: 0o700 });
const service = createSocialService(path.join(directory, 'accounts.sqlite'));
const server = accountHTTPServer(service);
server.requestTimeout = 15000; server.headersTimeout = 10000; server.maxRequestsPerSocket = 100;
const port = Number(process.env.SAO_SOCIAL_PORT ?? 3210);
if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error('Set SAO_SOCIAL_PORT to a valid port.');
server.listen(port, process.env.SAO_SOCIAL_HOST ?? '127.0.0.1', () => console.log(`SAO account service listening on port ${port}. Public clients require an HTTPS reverse proxy.`));
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { server.close(() => { service.close(); process.exit(0); }); server.closeIdleConnections(); });
