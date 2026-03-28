import { createProjectStorage } from '@taylorvance/tv-shared-runtime/storage'
import { describe, expect, it } from 'vitest'
import { DEFAULT_RULES, createGame } from './game'
import {
  clearPersistedAppState,
  loadPersistedAppState,
  savePersistedAppState,
  type PersistedAppState,
} from './persistence'

function createMemoryStorage() {
  const values = new Map<string, string>()

  return {
    get length() {
      return values.size
    },
    getItem(key: string) {
      return values.get(key) ?? null
    },
    key(index: number) {
      return [...values.keys()][index] ?? null
    },
    setItem(key: string, value: string) {
      values.set(key, value)
    },
    removeItem(key: string) {
      values.delete(key)
    },
  }
}

function createSnapshot(): PersistedAppState {
  const activeRules = {
    ...DEFAULT_RULES,
    seed: 19,
  }

  return {
    activeRules,
    draftRules: {
      ...activeRules,
      obstacleCount: 4,
    },
    game: createGame(activeRules),
    showPlaytestControls: true,
  }
}

describe('app persistence', () => {
  it('round-trips a saved app snapshot', () => {
    const storage = createProjectStorage('traingame', {
      version: 1,
      storage: createMemoryStorage(),
    })
    const snapshot = createSnapshot()

    savePersistedAppState(snapshot, storage)

    expect(loadPersistedAppState(storage)).toEqual(snapshot)
  })

  it('falls back to active rules when the stored game snapshot is invalid', () => {
    const storage = createProjectStorage('traingame', {
      version: 1,
      storage: createMemoryStorage(),
    })

    storage.writeJson(
      {
        activeRules: {
          ...DEFAULT_RULES,
          boardWidth: 20,
          seed: 77,
        },
        draftRules: {
          ...DEFAULT_RULES,
          boardHeight: 2,
          seed: 91,
        },
        game: { bad: true },
        showPlaytestControls: true,
      },
      'app-state',
    )

    const restored = loadPersistedAppState(storage)

    expect(restored).not.toBeNull()
    expect(restored?.activeRules.boardWidth).toBe(9)
    expect(restored?.draftRules.boardHeight).toBe(4)
    expect(restored?.game.rules.seed).toBe(77)
    expect(restored?.showPlaytestControls).toBe(true)
  })

  it('returns null when there is no usable saved state', () => {
    const storage = createProjectStorage('traingame', {
      version: 1,
      storage: createMemoryStorage(),
    })

    storage.writeJson({ showPlaytestControls: true }, 'app-state')

    expect(loadPersistedAppState(storage)).toBeNull()
  })

  it('clears the saved snapshot key', () => {
    const backingStorage = createMemoryStorage()
    const storage = createProjectStorage('traingame', {
      version: 1,
      storage: backingStorage,
    })

    savePersistedAppState(createSnapshot(), storage)
    clearPersistedAppState(storage)

    expect(loadPersistedAppState(storage)).toBeNull()
    expect(backingStorage.length).toBe(0)
  })
})
