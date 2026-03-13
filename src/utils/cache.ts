export enum CacheType {
  Persisted = 'persisted',
  Session = 'session',
  Memory = 'memory'
}

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();

const CACHE_PREFIX = 'margana_cache_';

export const cache = {
  set<T>(key: string, data: T, ttlSeconds: number, type: CacheType = CacheType.Memory) {
    const entry: CacheEntry<T> = {
      data,
      expiry: Date.now() + ttlSeconds * 1000
    };

    const storageKey = CACHE_PREFIX + key;

    if (type === CacheType.Memory) {
      memoryCache.set(key, entry);
    } else if (type === CacheType.Session) {
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(entry));
      } catch (e) {
        console.warn('SessionStorage set failed', e);
      }
    } else if (type === CacheType.Persisted) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(entry));
      } catch (e) {
        console.warn('LocalStorage set failed', e);
      }
    }
  },

  get<T>(key: string, type: CacheType = CacheType.Memory): T | null {
    let entry: CacheEntry<T> | null = null;
    const storageKey = CACHE_PREFIX + key;

    if (type === CacheType.Memory) {
      entry = memoryCache.get(key) || null;
    } else if (type === CacheType.Session) {
      const val = sessionStorage.getItem(storageKey);
      if (val) {
        try {
          entry = JSON.parse(val);
        } catch (e) {
          entry = null;
        }
      }
    } else if (type === CacheType.Persisted) {
      const val = localStorage.getItem(storageKey);
      if (val) {
        try {
          entry = JSON.parse(val);
        } catch (e) {
          entry = null;
        }
      }
    }

    if (!entry) return null;

    if (Date.now() > entry.expiry) {
      this.remove(key, type);
      return null;
    }

    return entry.data;
  },

  remove(key: string, type: CacheType = CacheType.Memory) {
    const storageKey = CACHE_PREFIX + key;
    if (type === CacheType.Memory) {
      memoryCache.delete(key);
    } else if (type === CacheType.Session) {
      sessionStorage.removeItem(storageKey);
    } else if (type === CacheType.Persisted) {
      localStorage.removeItem(storageKey);
    }
  },

  clearAll(type?: CacheType, hard: boolean = false) {
    if (!type || type === CacheType.Memory) {
      memoryCache.clear();
    }
    
    // Hard clear removes all margana-related keys (preferences, tutorial flags, etc.)
    // Soft clear (default) only removes the internal application cache.
    const prefix = hard ? 'margana' : CACHE_PREFIX;

    if (!type || type === CacheType.Session) {
      Object.keys(sessionStorage).forEach(key => {
        if (key.toLowerCase().startsWith(prefix.toLowerCase())) {
          sessionStorage.removeItem(key);
        }
      });
    }

    if (!type || type === CacheType.Persisted) {
      Object.keys(localStorage).forEach(key => {
        if (key.toLowerCase().startsWith(prefix.toLowerCase())) {
          localStorage.removeItem(key);
        }
      });
    }
  }
};
