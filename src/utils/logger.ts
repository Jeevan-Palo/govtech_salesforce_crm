import fs from 'fs';
import path from 'path';

const LOG_DIR = path.resolve(__dirname, '../../test-results');
const LOG_FILE = path.join(LOG_DIR, 'run.log');

type Level = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

function write(level: Level, message: string, meta?: unknown): void {
  const line = `[${new Date().toISOString()}] [${level}] ${message}${meta !== undefined ? ` ${JSON.stringify(meta)}` : ''}`;
  // eslint-disable-next-line no-console
  console.log(line);
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, `${line}\n`);
  } catch {
    // Best-effort file logging; a logging failure must never fail a test.
  }
}

export const logger = {
  info: (message: string, meta?: unknown) => write('INFO', message, meta),
  warn: (message: string, meta?: unknown) => write('WARN', message, meta),
  error: (message: string, meta?: unknown) => write('ERROR', message, meta),
  debug: (message: string, meta?: unknown) => write('DEBUG', message, meta),
};
