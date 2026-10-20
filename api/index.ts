import type { VercelRequest, VercelResponse } from '@vercel/node';
import handler from '../apps/server/src/server';

export default async function (req: VercelRequest, res: VercelResponse) {
  return handler(req, res);
}
