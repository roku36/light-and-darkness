const STORAGE_KEY = 'light-dark-progress-v1';

export interface ProgressData {
  currentLevel: string;
  completed: string[];
}

export function loadProgress(fallbackLevel: string): ProgressData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { currentLevel: fallbackLevel, completed: [] };
    const parsed = JSON.parse(raw) as Partial<ProgressData>;
    return {
      currentLevel: typeof parsed.currentLevel === 'string' ? parsed.currentLevel : fallbackLevel,
      completed: Array.isArray(parsed.completed) ? parsed.completed.filter((item): item is string => typeof item === 'string') : [],
    };
  } catch {
    return { currentLevel: fallbackLevel, completed: [] };
  }
}

export function saveProgress(progress: ProgressData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}
