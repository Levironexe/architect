import path from 'node:path';
import { routeDefinitions } from '../config';

export function registerRoutes(basePath: string, includeDisabled = false): string[] {
  const enabledRoutes: string[] = [];

  for (const route of routeDefinitions) {
    if (
      route.enabled &&
      route.path.startsWith('/route') &&
      route.handler.length > 0 &&
      (basePath.length > 0 || includeDisabled)
    ) {
      enabledRoutes.push(path.join(basePath, route.path));
    }
  }

  return enabledRoutes;
}
