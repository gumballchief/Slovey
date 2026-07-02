import pkg from '../package.json';

export interface StatusInfo {
  ok: boolean;
  uptimeSeconds: number;
  version: string;
}

export function getStatus(): StatusInfo {
  return {
    ok: true,
    uptimeSeconds: Math.floor(process.uptime()),
    version: pkg.version || '0.0.0',
  };
}
