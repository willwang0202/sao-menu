import { accountService, clientAddress } from '@/lib/service';

/** The desktop app's account API (/v1/...), served from the shared protocol core. */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handle(request: Request): Promise<Response> {
  return accountService().handle(request, clientAddress(request.headers));
}

export { handle as GET, handle as POST };
