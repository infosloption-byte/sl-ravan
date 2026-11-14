/** The local session owns persistence; a remote session can replace it later. */
export interface SavedPosition { x: number; y: number; z: number }
export interface SaveData {
  version: 1;
  position: SavedPosition;
  night: boolean;
  discoveredShrine: boolean;
  savedAt: string;
}
export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export const SAVE_KEY = "sl-ravan:prototype-save:v1";

export function validateSave(value: unknown): SaveData | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Partial<SaveData>;
  const p = v.position;
  if (v.version !== 1 || !p || typeof p !== "object") return null;
  if (![p.x, p.y, p.z].every((n) => typeof n === "number" && Number.isFinite(n) && Math.abs(n) < 1000)) return null;
  return {
    version: 1,
    position: { x: p.x!, y: p.y!, z: p.z! },
    night: v.night === true,
    discoveredShrine: v.discoveredShrine === true,
    savedAt: typeof v.savedAt === "string" ? v.savedAt : "",
  };
}

export class LocalSession {
  constructor(private readonly storage: StoragePort, private readonly key = SAVE_KEY) {}
  load(): SaveData | null {
    try { return validateSave(JSON.parse(this.storage.getItem(this.key) ?? "null")); }
    catch { return null; }
  }
  save(data: Omit<SaveData, "savedAt">): boolean {
    try {
      this.storage.setItem(this.key, JSON.stringify({ ...data, savedAt: new Date().toISOString() }));
      return true;
    } catch {
      return false; // Browsers may disable storage or run out of quota.
    }
  }
}
