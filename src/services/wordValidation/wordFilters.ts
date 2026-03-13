import { createRequire } from "node:module";

// NOTE: this file is for browser runtime, so we cannot use createRequire here.
// We'll use ESM import and handle the bloom-filters CJS module carefully.

type XorFilterType = {
  has: (value: string) => boolean;
};

type FilterJSON = any;

const filterCache = new Map<number, Promise<XorFilterType>>();

async function getXorCtor() {
  // bloom-filters is CJS; in Vite this usually comes through as a default export object
  const mod: any = await import("bloom-filters");
  return mod.XorFilter ?? mod.default?.XorFilter ?? mod.default?.XorFilter;
}

async function loadFilterJson(len: number): Promise<FilterJSON> {
  switch (len) {
    case 3:  return (await import("@/assets/word-filters/word-filter-len-3.json")).default;
    case 4:  return (await import("@/assets/word-filters/word-filter-len-4.json")).default;
    case 5:  return (await import("@/assets/word-filters/word-filter-len-5.json")).default;
    case 6:  return (await import("@/assets/word-filters/word-filter-len-6.json")).default;
    case 7:  return (await import("@/assets/word-filters/word-filter-len-7.json")).default;
    case 8:  return (await import("@/assets/word-filters/word-filter-len-8.json")).default;
    case 9:  return (await import("@/assets/word-filters/word-filter-len-9.json")).default;
    case 10: return (await import("@/assets/word-filters/word-filter-len-10.json")).default;
    default:
      throw new Error(`Unsupported word length: ${len}`);
  }
}

async function getFilter(len: number): Promise<XorFilterType> {
  if (!filterCache.has(len)) {
    filterCache.set(
      len,
      (async () => {
        const XorFilter = await getXorCtor();
        if (!XorFilter?.fromJSON) {
          throw new Error("Could not access XorFilter.fromJSON from bloom-filters");
        }
        const json = await loadFilterJson(len);
        return XorFilter.fromJSON(json) as XorFilterType;
      })()
    );
  }
  return filterCache.get(len)!;
}

export async function isDefinitelyInvalidWord(wordRaw: string): Promise<boolean> {
  const w = wordRaw.trim().toLowerCase();

  // cheap rejects first
  if (!/^[a-z]+$/.test(w)) return true;
  if (w.length < 3 || w.length > 10) return true;

  const filter = await getFilter(w.length);
  return !filter.has(w); // false => definitely invalid
}

export async function isMaybeValidWord(wordRaw: string): Promise<boolean> {
  return !(await isDefinitelyInvalidWord(wordRaw));
}