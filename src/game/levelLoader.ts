import { parseLevelText, type LevelMetadata } from './levelParser';
import type { LevelDefinition } from './types';

export interface LevelIndexEntry extends LevelMetadata {
  file: string;
}

export async function loadLevelIndex(): Promise<LevelIndexEntry[]> {
  return parseLevelIndex(await loadLevelIndexSource());
}

export async function loadLevel(entry: LevelIndexEntry): Promise<LevelDefinition> {
  return parseLevelText(await loadLevelSource(entry), entry);
}

export async function loadLevelIndexSource(cacheKey?: string | number): Promise<string> {
  const response = await fetch(withCacheKey('./levels/index.json', cacheKey), { cache: 'no-store' });
  if (!response.ok) throw new Error(`Could not load level index (${response.status}).`);
  return response.text();
}

export function parseLevelIndex(source: string): LevelIndexEntry[] {
  return JSON.parse(source) as LevelIndexEntry[];
}

export async function loadLevelSource(entry: LevelIndexEntry, cacheKey?: string | number): Promise<string> {
  const response = await fetch(withCacheKey(`./levels/${entry.file}`, cacheKey), { cache: 'no-store' });
  if (!response.ok) throw new Error(`Could not load ${entry.file} (${response.status}).`);
  return response.text();
}

function withCacheKey(path: string, cacheKey?: string | number): string {
  if (cacheKey === undefined) return path;
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}t=${encodeURIComponent(String(cacheKey))}`;
}
