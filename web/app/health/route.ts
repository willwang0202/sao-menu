import { accountService } from '@/lib/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(request: Request): Promise<Response> {
  return accountService().handle(request);
}
