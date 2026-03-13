/**
 * Cache Manager
 * Singleton class for caching WebJSON messages for init block
 * Uses Observer pattern to notify on cache updates
 * 
 * Cache types:
 * - Single: Only one entry (I, F)
 * - By key: Multiple entries keyed by specific field(s)
 * 
 * Command  Description          Cache Type
 * $I       Инициализация        Одиночный
 * $E       Время                По описанию
 * $B       Участник             По UniqueNumber
 * $C       Класс                По UniqueNumber
 * $A       Автомобиль           По RegNumber:Transponder
 * $COMP    Соревнование         По RegNumber
 * $G       Группа               По RegNumber
 * $H       История              По RegNumber
 * $J       Судья                По RegNumber
 * $F       Флаг                 Одиночный
 * $DPD     Данные декодера      По DecoderID:RegNumber
 * $DSI     Информация           По RegNumber
 * $DPF     Параметры            НЕ кешируется
 */

import type { WebJsonMessage, CacheEntry } from "../types";
import { getCacheKey } from "../shared/utils";

type CacheObserver = (command: string, entry: CacheEntry) => void;

class CacheManager {
  private static instance: CacheManager;

  // Single-instance caches
  private cacheI: CacheEntry | null = null;
  private cacheF: CacheEntry | null = null;

  // Keyed caches (Map<key, entry>)
  private cacheE: Map<string, CacheEntry> = new Map();      // По описанию
  private cacheB: Map<string, CacheEntry> = new Map();      // По UniqueNumber
  private cacheC: Map<string, CacheEntry> = new Map();      // По UniqueNumber
  private cacheA: Map<string, CacheEntry> = new Map();      // По RegNumber:Transponder
  private cacheCOMP: Map<string, CacheEntry> = new Map();   // По RegNumber
  private cacheG: Map<string, CacheEntry> = new Map();      // По RegNumber
  private cacheH: Map<string, CacheEntry> = new Map();      // По RegNumber
  private cacheJ: Map<string, CacheEntry> = new Map();      // По RegNumber
  private cacheDPD: Map<string, CacheEntry> = new Map();    // По DecoderID:RegNumber
  private cacheDSI: Map<string, CacheEntry> = new Map();    // По RegNumber

  private observers: Set<CacheObserver> = new Set();

  private constructor() {}

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  /**
   * Add observer for cache updates
   */
  subscribe(observer: CacheObserver): () => void {
    this.observers.add(observer);
    return () => this.observers.delete(observer);
  }

  /**
   * Notify all observers
   */
  private notify(command: string, entry: CacheEntry): void {
    this.observers.forEach((observer) => observer(command, entry));
  }

  /**
   * Store a message in cache
   */
  store(message: WebJsonMessage, jsonData: string): CacheEntry | null {
    const key = getCacheKey(message);
    const entry: CacheEntry = {
      command: message.Id,
      key,
      message: jsonData,
      timestamp: new Date(),
    };

    switch (message.Id) {
      // Single-instance caches
      case "I":
        this.cacheI = entry;
        break;
      case "F":
        this.cacheF = entry;
        break;

      // Keyed caches
      case "E":
        this.cacheE.set(key, entry);
        break;
      case "B":
        this.cacheB.set(key, entry);
        break;
      case "C":
        this.cacheC.set(key, entry);
        break;
      case "A":
        this.cacheA.set(key, entry);
        break;
      case "COMP":
        this.cacheCOMP.set(key, entry);
        break;
      case "G":
        this.cacheG.set(key, entry);
        break;
      case "H":
        this.cacheH.set(key, entry);
        break;
      case "J":
        this.cacheJ.set(key, entry);
        break;
      case "DPD":
        this.cacheDPD.set(key, entry);
        break;
      case "DSI":
        this.cacheDSI.set(key, entry);
        break;

      // NOT cached
      case "DPF":
        return null; // $DPF parameters are not cached

      default:
        return null;
    }

    this.notify(message.Id, entry);
    return entry;
  }

  /**
   * Get init block for new WebSocket clients
   * Returns cached messages in proper order
   */
  getInitBlock(allowedCommands: string[] | "all"): string[] {
    const messages: string[] = [];
    const allowed = allowedCommands === "all" ? null : new Set(allowedCommands);

    const isAllowed = (cmd: string): boolean => {
      if (!allowed) return true;
      return allowed.has(cmd);
    };

    // $I always first (initialization)
    if (this.cacheI && isAllowed("I")) {
      messages.push(this.cacheI.message);
    }

    // $E - time data (by description)
    if (isAllowed("E")) {
      for (const entry of this.cacheE.values()) {
        messages.push(entry.message);
      }
    }

    // $B - participant data (by UniqueNumber)
    if (isAllowed("B")) {
      for (const entry of this.cacheB.values()) {
        messages.push(entry.message);
      }
    }

    // $C - class data (by UniqueNumber)
    if (isAllowed("C")) {
      for (const entry of this.cacheC.values()) {
        messages.push(entry.message);
      }
    }

    // $A - car data (by RegNumber:Transponder)
    if (isAllowed("A")) {
      for (const entry of this.cacheA.values()) {
        messages.push(entry.message);
      }
    }

    // $COMP - competition data (by RegNumber)
    if (isAllowed("COMP")) {
      for (const entry of this.cacheCOMP.values()) {
        messages.push(entry.message);
      }
    }

    // $G - group/position data (by RegNumber)
    if (isAllowed("G")) {
      for (const entry of this.cacheG.values()) {
        messages.push(entry.message);
      }
    }

    // $H - history/best lap data (by RegNumber)
    if (isAllowed("H")) {
      for (const entry of this.cacheH.values()) {
        messages.push(entry.message);
      }
    }

    // $J - judge/lap time data (by RegNumber)
    if (isAllowed("J")) {
      for (const entry of this.cacheJ.values()) {
        messages.push(entry.message);
      }
    }

    // $DPD - decoder data (by DecoderID:RegNumber)
    if (isAllowed("DPD")) {
      for (const entry of this.cacheDPD.values()) {
        messages.push(entry.message);
      }
    }

    // $DSI - information data (by RegNumber)
    if (isAllowed("DSI")) {
      for (const entry of this.cacheDSI.values()) {
        messages.push(entry.message);
      }
    }

    // $F always last (flag status)
    if (this.cacheF && isAllowed("F")) {
      messages.push(this.cacheF.message);
    }

    return messages;
  }

  /**
   * Clear all caches (called on $I with new session)
   */
  clear(): void {
    // Single-instance caches
    this.cacheI = null;
    this.cacheF = null;

    // Keyed caches
    this.cacheE.clear();
    this.cacheB.clear();
    this.cacheC.clear();
    this.cacheA.clear();
    this.cacheCOMP.clear();
    this.cacheG.clear();
    this.cacheH.clear();
    this.cacheJ.clear();
    this.cacheDPD.clear();
    this.cacheDSI.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): Record<string, number> {
    return {
      I: this.cacheI ? 1 : 0,
      E: this.cacheE.size,
      B: this.cacheB.size,
      C: this.cacheC.size,
      A: this.cacheA.size,
      COMP: this.cacheCOMP.size,
      G: this.cacheG.size,
      H: this.cacheH.size,
      J: this.cacheJ.size,
      F: this.cacheF ? 1 : 0,
      DPD: this.cacheDPD.size,
      DSI: this.cacheDSI.size,
      // DPF is not cached
    };
  }
}

export const cacheManager = CacheManager.getInstance();
