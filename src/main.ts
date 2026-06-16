import Phaser from 'phaser';
import './style.css';
import {
  loadLevelIndexSource,
  loadLevelSource,
  loadTitleSource,
  parseLevelIndex,
  type LevelIndexEntry,
} from './game/levelLoader';
import { parseLevelText, parseLevelTitle } from './game/levelParser';
import { loadProgress, saveProgress, type ProgressData } from './game/progress';
import type { GameState, LevelDefinition } from './game/types';
import { GameScene } from './phaser/GameScene';
import { OneBitPipeline } from './phaser/OneBitPipeline';
import { TitleScene } from './phaser/TitleScene';

const stageLabel = requiredElement<HTMLSpanElement>('stage-label');
const movesLabel = requiredElement<HTMLSpanElement>('moves-label');
const actorLabel = requiredElement<HTMLSpanElement>('actor-label');
const stageSelect = requiredElement<HTMLSelectElement>('stage-select');
const tutorialLabel = requiredElement<HTMLDivElement>('tutorial-label');
const message = requiredElement<HTMLDivElement>('message');
const gameRoot = requiredElement<HTMLDivElement>('game');

let game: Phaser.Game | undefined;
let levels: LevelIndexEntry[] = [];
let currentIndex = 0;
let progress: ProgressData;
let messageTimer = 0;
let levelIndexSource = '';
let currentLevelSource = '';
let hotReloadTimer = 0;
let hotReloading = false;
let titleVisible = false;

const HOT_RELOAD_INTERVAL_MS = 700;

async function start(): Promise<void> {
  try {
    levelIndexSource = await loadLevelIndexSource();
    levels = await hydrateLevelNames(parseLevelIndex(levelIndexSource));
    if (levels.length === 0) throw new Error('No stages are configured.');
    progress = loadProgress(levels[0].id);
    currentIndex = Math.max(0, levels.findIndex((entry) => entry.id === progress.currentLevel));
    buildStageSelect();
    await showTitle();
  } catch (error) {
    showMessage(error instanceof Error ? error.message : 'Unknown startup error.', true);
  }
}

async function showTitle(): Promise<void> {
  window.clearInterval(hotReloadTimer);
  setUndoPrompt(false);
  titleVisible = true;
  currentLevelSource = '';
  stageLabel.textContent = 'TITLE';
  movesLabel.textContent = '';
  actorLabel.textContent = '';
  delete actorLabel.dataset.actor;
  tutorialLabel.textContent = 'SPACE / ENTER / CLICK START';
  stageSelect.value = levels[currentIndex]?.id ?? '';
  const source = await loadTitleSource();
  mountTitle(source);
}

async function beginCurrentLevel(): Promise<void> {
  if (!titleVisible) return;
  titleVisible = false;
  await startLevel(currentIndex);
  startLevelHotReload();
}

async function startLevel(index: number): Promise<void> {
  const entry = levels[index];
  const source = await loadLevelSource(entry);
  await mountLevel(index, parseLevelText(source, entry), source);
}

async function mountLevel(index: number, level: LevelDefinition, source: string): Promise<void> {
  setUndoPrompt(false);
  currentIndex = index;
  const entry = levels[index];
  levels[index] = { ...entry, name: level.name };
  currentLevelSource = source;
  progress.currentLevel = entry.id;
  saveProgress(progress);
  buildStageSelect();
  stageSelect.value = entry.id;
  stageLabel.textContent = `STAGE ${String(index + 1).padStart(2, '0')} · ${level.name}`;
  tutorialLabel.textContent = entry.tutorial ?? '';

  createPhaserGame((bootedGame) => {
    bootedGame.scene.add('game', GameScene, true, {
      level,
      onState: updateHud,
      onUndoPrompt: (visible: boolean) => setUndoPrompt(visible),
      onComplete: completeLevel,
    });
  });
}

function mountTitle(source: string): void {
  createPhaserGame((bootedGame) => {
    bootedGame.scene.add('title', TitleScene, true, {
      source,
      onStart: () => void beginCurrentLevel(),
    });
  });
}

function createPhaserGame(startScene: (bootedGame: Phaser.Game) => void): void {
  if (game) game.destroy(true);
  gameRoot.replaceChildren();
  game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent: 'game',
    backgroundColor: '#000000',
    pixelArt: true,
    antialias: false,
    roundPixels: true,
    scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
    callbacks: {
      postBoot: (bootedGame) => {
        if (bootedGame.renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer) {
          bootedGame.renderer.pipelines.addPostPipeline('OneBitPipeline', OneBitPipeline);
        }
        startScene(bootedGame);
      },
    },
  });
}

function startLevelHotReload(): void {
  window.clearInterval(hotReloadTimer);
  hotReloadTimer = window.setInterval(() => {
    void checkLevelHotReload();
  }, HOT_RELOAD_INTERVAL_MS);
}

async function checkLevelHotReload(): Promise<void> {
  if (hotReloading || levels.length === 0) return;
  hotReloading = true;
  try {
    const cacheKey = Date.now();
    const nextIndexSource = await loadLevelIndexSource(cacheKey);
    const indexChanged = nextIndexSource !== levelIndexSource;
    let nextLevels = levels;
    let nextIndex = currentIndex;

    if (indexChanged) {
      nextLevels = await hydrateLevelNames(parseLevelIndex(nextIndexSource), cacheKey);
      if (nextLevels.length === 0) throw new Error('No stages are configured.');
      const currentId = levels[currentIndex]?.id ?? progress.currentLevel;
      nextIndex = Math.max(0, nextLevels.findIndex((entry) => entry.id === currentId));
    }

    const nextEntry = nextLevels[nextIndex];
    const nextLevelSource = await loadLevelSource(nextEntry, cacheKey);
    if (!indexChanged && nextLevelSource === currentLevelSource) return;

    const nextLevel = parseLevelText(nextLevelSource, nextEntry);
    if (!indexChanged) {
      nextLevels = nextLevels.map((entry, index) => (
        index === nextIndex ? { ...entry, name: nextLevel.name } : entry
      ));
    }
    levelIndexSource = nextIndexSource;
    levels = nextLevels;
    buildStageSelect();
    await mountLevel(nextIndex, nextLevel, nextLevelSource);
    showMessage('LEVEL RELOADED');
  } catch (error) {
    showMessage(error instanceof Error ? error.message : 'Unknown level reload error.', true);
  } finally {
    hotReloading = false;
  }
}

async function hydrateLevelNames(entries: LevelIndexEntry[], cacheKey?: string | number): Promise<LevelIndexEntry[]> {
  return Promise.all(entries.map(async (entry) => {
    const source = await loadLevelSource(entry, cacheKey);
    return { ...entry, name: parseLevelTitle(source) ?? entry.name ?? entry.id };
  }));
}

function updateHud(state: GameState): void {
  movesLabel.textContent = `MOVES ${state.turns}`;
  actorLabel.textContent = state.activeActor.toUpperCase();
  actorLabel.dataset.actor = state.activeActor;
}

function completeLevel(): void {
  const id = levels[currentIndex].id;
  if (!progress.completed.includes(id)) progress.completed.push(id);
  saveProgress(progress);
  buildStageSelect();
  showMessage('BOTH TREASURES RESONATE');
  const next = levels[currentIndex].nextLevel;
  if (next) {
    const nextIndex = levels.findIndex((entry) => entry.id === next);
    window.setTimeout(() => void startLevel(nextIndex), 950);
  }
}

function buildStageSelect(): void {
  stageSelect.replaceChildren(...levels.map((entry, index) => {
    const option = document.createElement('option');
    option.value = entry.id;
    const complete = progress?.completed.includes(entry.id) ? ' ✓' : '';
    option.textContent = `${String(index + 1).padStart(2, '0')} ${entry.name ?? entry.id}${complete}`;
    return option;
  }));
}

stageSelect.addEventListener('change', () => {
  const index = levels.findIndex((entry) => entry.id === stageSelect.value);
  if (index >= 0) {
    titleVisible = false;
    void startLevel(index);
    startLevelHotReload();
  }
});

function showMessage(text: string, persistent = false): void {
  window.clearTimeout(messageTimer);
  message.classList.remove('undo-prompt');
  message.textContent = text;
  message.classList.add('visible');
  if (!persistent) messageTimer = window.setTimeout(() => message.classList.remove('visible'), 800);
}

function setUndoPrompt(visible: boolean): void {
  window.clearTimeout(messageTimer);
  if (!visible) {
    message.classList.remove('visible', 'undo-prompt');
    message.textContent = '';
    return;
  }
  message.textContent = 'Z  UNDO';
  message.classList.add('visible', 'undo-prompt');
}

function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id}.`);
  return element as T;
}

void start();
