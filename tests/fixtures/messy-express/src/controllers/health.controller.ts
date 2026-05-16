import { Request, Response } from 'express';
import { noisyConfiguration } from '../config';
import { registerRoutes } from '../services/route.service';

export function getHealth(_req: Request, res: Response): void {
  res.json({ ok: true, routes: registerRoutes('/api').length, config: noisyConfiguration.flag150 });
}
