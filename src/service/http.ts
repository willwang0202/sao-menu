import { createServer, type Server } from 'node:http';
import { createSocialService } from './accounts';

export function accountHTTPServer(service: ReturnType<typeof createSocialService>): Server {
  return createServer(async (request, response) => {
    try {
      const chunks: Buffer[] = []; let bytes = 0;
      for await (const chunk of request) {
        bytes += chunk.length;
        if (bytes > 16384) { response.writeHead(413, { 'content-type': 'application/json', connection: 'close' }); response.end('{"error":"Request is too large."}'); return; }
        chunks.push(chunk);
      }
      if (!request.url?.startsWith('/')) { response.writeHead(400); response.end(); return; }
      const result = await service.handle(new Request(`http://localhost${request.url}`, {
        method: request.method,
        headers: { 'content-type': String(request.headers['content-type'] ?? ''), authorization: String(request.headers.authorization ?? '') },
        ...(request.method === 'POST' ? { body: Buffer.concat(chunks).toString('utf8') } : {}),
      }), request.socket.remoteAddress ?? 'unknown');
      response.writeHead(result.status, Object.fromEntries(result.headers)); response.end(await result.text());
    } catch { if (!response.headersSent) response.writeHead(400, { 'content-type': 'application/json' }); response.end('{"error":"Invalid request."}'); }
  });
}
