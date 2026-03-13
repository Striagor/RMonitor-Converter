/**
 * Remote Database Manager
 * Handles connections to MySQL/PostgreSQL for command logging
 * Includes offline cache for when database is temporarily unavailable
 */

import type { Pool } from "mysql2/promise";
import type { PrismaClient } from "@prisma/client";

// Command ID to table name mapping
const COMMAND_TABLES: Record<string, string> = {
  I: "RMonitor_I",
  A: "RMonitor_A",
  B: "RMonitor_B",
  C: "RMonitor_C",
  COMP: "RMonitor_COMP",
  G: "RMonitor_G",
  H: "RMonitor_H",
  J: "RMonitor_J",
  F: "RMonitor_F",
  E: "RMonitor_E",
  DPD: "RMonitor_DPD",
  DPF: "RMonitor_DPF",
  DSI: "RMonitor_DSI",
};

// Table schemas for each command type
const TABLE_SCHEMAS: Record<string, string[]> = {
  RMonitor_I: ["TimeOfDay", "Date"],
  RMonitor_A: ["RegistrationNumber", "Number", "TransponderNumber", "FirstName", "LastName", "Nationality", "ClassNumber"],
  RMonitor_B: ["UniqueNumber", "Description"],
  RMonitor_C: ["UniqueNumber", "Description"],
  RMonitor_COMP: ["RegistrationNumber", "Number", "TransponderNumber", "FirstName", "LastName", "Nationality", "ClassNumber", "AdditionalData"],
  RMonitor_G: ["Position", "RegistrationNumber", "Laps", "TotalTime"],
  RMonitor_H: ["Position", "RegistrationNumber", "BestLap", "BestLaptime"],
  RMonitor_J: ["RegistrationNumber", "Laptime", "TotalTime"],
  RMonitor_F: ["LapsToGo", "TimeToGo", "TimeOfDay", "RaceTime", "FlagStatus"],
  RMonitor_E: ["Description", "Value"],
  RMonitor_DPD: ["DECODER_ID", "TRANSPONDER", "RTC_TIME", "LOOP_NUMBER", "BATTERY_STATUS", "TEMPERATURE", "PULSE_COUNT", "SIGNAL_STRENGTH"],
  RMonitor_DPF: ["DECODER_ID", "TRANSPONDER", "RTC_TIME", "LOOP_NUMBER", "BATTERY_STATUS", "TEMPERATURE", "PULSE_COUNT", "SIGNAL_STRENGTH", "VERSION", "FLAGS"],
  RMonitor_DSI: ["RegistrationNumber", "Speed", "TimeOfStay"],
};

interface RemoteDbConfig {
  enabled: boolean;
  type: "mysql" | "postgresql";
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  poolSize: number;
  logCommands: boolean;
  loggedCommands: string[] | "all";
  offlineCacheSizeMb: number; // 1-20 MB
}

interface RemoteDbStatus {
  connected: boolean;
  enabled: boolean;
  type: "mysql" | "postgresql" | null;
  host: string;
  database: string;
  poolSize: number;
  activeConnections: number;
  lastError: string | null;
  commandsLogged: number;
  tablesCreated: string[];
  offlineCacheSize: number;
  offlineCacheCount: number;
}

interface CommandData {
  Id: string;
  [key: string]: unknown;
}

interface CachedCommand {
  sourceId: string;
  command: CommandData;
  timestamp: Date;
}

class RemoteDbManager {
  private config: RemoteDbConfig | null = null;
  private mysqlPool: Pool | null = null;
  private pgPool: ReturnType<typeof import("pg").Pool> | null = null;
  private initialized = false;
  private connected = false;
  private createdTables = new Set<string>();
  private commandsLogged = 0;
  private lastError: string | null = null;

  // Offline cache
  private offlineCache: CachedCommand[] = [];
  private offlineCacheSizeBytes = 0;

  // Last $F command for change detection
  private lastFCommand: { 
    LapsToGo: string; 
    TimeOfDay: string; 
    TimeToGo: string; 
    RaceTime: string; 
    FlagStatus: string;
    timestamp: number;
  } | null = null;

  /**
   * Initialize with configuration from main database
   */
  async init(prisma: PrismaClient): Promise<boolean> {
    try {
      // Load settings from main database
      const settings = await prisma.converterSettings.findMany();
      const settingsMap: Record<string, string> = {};

      for (const setting of settings) {
        settingsMap[setting.key] = setting.value;
      }

      const enabled = settingsMap.useRemoteDb === "true";

      if (!enabled) {
        console.log("[RemoteDB] Remote database logging is disabled");
        this.config = null;
        this.initialized = false;
        this.connected = false;
        return false;
      }

      const offlineCacheSizeMb = Math.min(20, Math.max(1, parseInt(settingsMap.remoteDbOfflineCacheSizeMb) || 10));

      this.config = {
        enabled: true,
        type: (settingsMap.remoteDbType as "mysql" | "postgresql") || "mysql",
        host: settingsMap.remoteDbHost || "",
        port: parseInt(settingsMap.remoteDbPort) || 3306,
        database: settingsMap.remoteDbName || "",
        user: settingsMap.remoteDbUser || "",
        password: settingsMap.remoteDbPassword || "",
        poolSize: parseInt(settingsMap.remoteDbPoolSize) || 10,
        logCommands: settingsMap.logCommands === "true",
        loggedCommands: settingsMap.loggedCommands === "all" ? "all" : (settingsMap.loggedCommands || "").split(",").filter(Boolean),
        offlineCacheSizeMb,
      };

      if (!this.config.host || !this.config.database) {
        console.log("[RemoteDB] Missing host or database, logging disabled");
        this.lastError = "Missing host or database configuration";
        this.config = null;
        this.initialized = false;
        this.connected = false;
        return false;
      }

      // Mark as initialized even if connection fails (we'll use offline cache)
      this.initialized = true;

      // Try to connect to remote database
      try {
        await this.connect();
        await this.createTables();
        this.connected = true;
        this.lastError = null;
        console.log("[RemoteDB] Connected and ready for logging");
        
        // Flush any offline cached data
        await this.flushOfflineCache();
      } catch (connErr) {
        console.warn("[RemoteDB] Failed to connect, will use offline cache:", connErr);
        this.connected = false;
        this.lastError = connErr instanceof Error ? connErr.message : String(connErr);
      }

      return true;
    } catch (err) {
      console.error("[RemoteDB] Failed to initialize:", err);
      this.lastError = err instanceof Error ? err.message : String(err);
      this.config = null;
      this.initialized = false;
      this.connected = false;
      return false;
    }
  }

  /**
   * Connect to remote database
   */
  private async connect(): Promise<void> {
    if (!this.config) throw new Error("No config");

    const poolSize = this.config.poolSize || 10;

    console.log(`[RemoteDB] Connecting to ${this.config.type.toUpperCase()} at ${this.config.host}:${this.config.port}/${this.config.database} as user '${this.config.user}'`);

    if (this.config.type === "mysql") {
      const mysql = await import("mysql2/promise");
      this.mysqlPool = mysql.createPool({
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        user: this.config.user,
        password: this.config.password,
        waitForConnections: true,
        connectionLimit: poolSize,
        queueLimit: 0,
      });
      // Test connection
      const conn = await this.mysqlPool.getConnection();
      await conn.ping();
      conn.release();
      console.log(`[RemoteDB] MySQL pool created for ${this.config.host}:${this.config.port}/${this.config.database} (pool size: ${poolSize})`);
    } else {
      const { Pool } = await import("pg");
      this.pgPool = new Pool({
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        user: this.config.user,
        password: this.config.password,
        max: poolSize,
      });
      // Test connection
      await this.pgPool.query("SELECT 1");
      console.log(`[RemoteDB] PostgreSQL pool created for ${this.config.host}:${this.config.port}/${this.config.database} (pool size: ${poolSize})`);
    }
  }

  /**
   * Create RMonitor tables if they don't exist
   */
  private async createTables(): Promise<void> {
    if (!this.config) return;

    for (const [tableName, columns] of Object.entries(TABLE_SCHEMAS)) {
      await this.createTable(tableName, columns);
      this.createdTables.add(tableName);
    }
  }

  /**
   * Create a single table if it doesn't exist
   */
  private async createTable(tableName: string, columns: string[]): Promise<void> {
    if (!this.config) return;

    // Skip if already created
    if (this.createdTables.has(tableName)) {
      return;
    }

    // Base columns for all tables
    const baseColumns = [
      "id INT AUTO_INCREMENT PRIMARY KEY",
      "source_id VARCHAR(100)",
      "timestamp DATETIME DEFAULT CURRENT_TIMESTAMP",
      "raw_data JSON",
    ];

    // Add command-specific columns as TEXT
    const columnDefs = columns.map((col) => `${col} TEXT`);

    const allColumns = [...baseColumns, ...columnDefs].join(", ");

    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS \`${tableName}\` (
        ${allColumns}
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `;

    try {
      if (this.config.type === "mysql" && this.mysqlPool) {
        await this.mysqlPool.execute(createTableSQL);
      } else if (this.pgPool) {
        // PostgreSQL version
        const pgSQL = createTableSQL
          .replace(/INT AUTO_INCREMENT PRIMARY KEY/g, "SERIAL PRIMARY KEY")
          .replace(/DATETIME DEFAULT CURRENT_TIMESTAMP/g, "TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
          .replace(/JSON/g, "JSONB")
          .replace(/ENGINE=InnoDB DEFAULT CHARSET=utf8mb4/g, "")
          .replace(/`/g, '"');
        await this.pgPool.query(pgSQL);
      }
      console.log(`[RemoteDB] Table ${tableName} ready`);
    } catch (err) {
      console.error(`[RemoteDB] Failed to create table ${tableName}:`, err);
      throw err;
    }
  }

  /**
   * Ensure table exists before logging
   */
  private async ensureTableExists(tableName: string): Promise<void> {
    if (this.createdTables.has(tableName)) {
      return;
    }

    const columns = TABLE_SCHEMAS[tableName];
    if (columns) {
      await this.createTable(tableName, columns);
      this.createdTables.add(tableName);
    }
  }

  /**
   * Check if a command should be logged
   */
  shouldLogCommand(commandId: string): boolean {
    if (!this.config || !this.config.logCommands || !this.initialized) return false;

    if (this.config.loggedCommands === "all") return true;

    return this.config.loggedCommands.includes(commandId);
  }

  /**
   * Check if $F command has significant changes to log
   * Log only if:
   * - LapsToGo changed
   * - TimeOfDay, TimeToGo, or RaceTime jumped more than 1 second
   * - FlagStatus changed
   * 
   * IMPORTANT: lastFCommand is ALWAYS updated with the new command,
   * comparison is done against the PREVIOUS command.
   */
  private shouldLogFCommand(command: CommandData): boolean {
    const fCmd = command as {
      LapsToGo: string;
      TimeToGo: string;
      TimeOfDay: string;
      RaceTime: string;
      FlagStatus: string;
    };

    // Default: don't log, will update lastFCommand at the end
    let shouldLog = false;

    // First $F command - always log
    if (!this.lastFCommand) {
      shouldLog = true;
    } else {
      // Compare with previous command
      
      // Check LapsToGo change
      if (fCmd.LapsToGo !== this.lastFCommand.LapsToGo) {
        shouldLog = true;
      }

      // Check FlagStatus change
      if (fCmd.FlagStatus !== this.lastFCommand.FlagStatus) {
        shouldLog = true;
      }

      // Check time jump (more than 1 second)
      // Parse time strings like "12:34:56.789" to seconds
      const parseTimeToSeconds = (timeStr: string): number => {
        if (!timeStr) return 0;
        const parts = timeStr.split(":");
        if (parts.length < 3) return 0;
        const hours = parseInt(parts[0]) || 0;
        const minutes = parseInt(parts[1]) || 0;
        const seconds = parseFloat(parts[2]) || 0;
        return hours * 3600 + minutes * 60 + seconds;
      };

      const timeOfDayDiff = Math.abs(parseTimeToSeconds(fCmd.TimeOfDay) - parseTimeToSeconds(this.lastFCommand.TimeOfDay));
      const timeToGoDiff = Math.abs(parseTimeToSeconds(fCmd.TimeToGo) - parseTimeToSeconds(this.lastFCommand.TimeToGo));
      const raceTimeDiff = Math.abs(parseTimeToSeconds(fCmd.RaceTime) - parseTimeToSeconds(this.lastFCommand.RaceTime));

      // If any time jumped more than 1 second
      if (timeOfDayDiff > 1 || timeToGoDiff > 1 || raceTimeDiff > 1) {
        shouldLog = true;
      }
    }

    // ALWAYS update lastFCommand with the new command
    this.lastFCommand = {
      LapsToGo: fCmd.LapsToGo,
      TimeOfDay: fCmd.TimeOfDay,
      TimeToGo: fCmd.TimeToGo,
      RaceTime: fCmd.RaceTime,
      FlagStatus: fCmd.FlagStatus,
      timestamp: Date.now(),
    };

    return shouldLog;
  }

  /**
   * Log a command to the remote database or offline cache
   */
  async logCommand(sourceId: string, command: CommandData): Promise<void> {
    if (!this.config || !this.initialized || !this.shouldLogCommand(command.Id)) {
      return;
    }

    // Special check for $F command - only log on significant changes
    if (command.Id === "F" && !this.shouldLogFCommand(command)) {
      return;
    }

    const tableName = COMMAND_TABLES[command.Id];
    if (!tableName) {
      return; // Unknown command, skip
    }

    // If not connected, add to offline cache
    if (!this.connected) {
      this.addToOfflineCache(sourceId, command);
      return;
    }

    try {
      // Ensure table exists
      await this.ensureTableExists(tableName);

      // Build INSERT statement
      const columns = ["source_id", "raw_data"];
      const values: (string | number | null)[] = [sourceId, JSON.stringify(command)];
      const placeholders = ["?", "?"];

      // Add specific columns from TABLE_SCHEMAS
      const tableColumns = TABLE_SCHEMAS[tableName] || [];
      for (const col of tableColumns) {
        columns.push(col);
        values.push(command[col] !== undefined ? String(command[col]) : null);
        placeholders.push("?");
      }

      const sql = `INSERT INTO \`${tableName}\` (${columns.map((c) => `\`${c}\``).join(", ")}) VALUES (${placeholders.join(", ")})`;

      if (this.config.type === "mysql" && this.mysqlPool) {
        await this.mysqlPool.execute(sql, values);
      } else if (this.pgPool) {
        // PostgreSQL version
        const pgSQL = sql.replace(/\?/g, (_, i) => `$${i + 1}`).replace(/`/g, '"');
        await this.pgPool.query(pgSQL, values);
      }

      this.commandsLogged++;
      this.lastError = null;
    } catch (err) {
      console.error(`[RemoteDB] Failed to log command $${command.Id}:`, err);
      this.lastError = err instanceof Error ? err.message : String(err);

      // Check if table doesn't exist - try to create it and retry
      if (this.isTableNotFoundError(err, tableName)) {
        console.log(`[RemoteDB] Table ${tableName} not found, creating it...`);
        // Remove from createdTables so it will be recreated
        this.createdTables.delete(tableName);
        
        try {
          // Create the table
          await this.createTable(tableName, TABLE_SCHEMAS[tableName] || []);
          this.createdTables.add(tableName);
          
          // Retry the insert
          await this.insertCommand(tableName, sourceId, command);
          this.commandsLogged++;
          this.lastError = null;
          console.log(`[RemoteDB] Table ${tableName} created and command logged successfully`);
          return;
        } catch (retryErr) {
          console.error(`[RemoteDB] Failed to create table ${tableName} and retry:`, retryErr);
          this.lastError = retryErr instanceof Error ? retryErr.message : String(retryErr);
        }
      }

      // Connection lost? Add to offline cache
      if (this.isConnectionError(err)) {
        this.connected = false;
        this.addToOfflineCache(sourceId, command);
      }
    }
  }

  /**
   * Insert a command into a table (used for retry after table creation)
   */
  private async insertCommand(tableName: string, sourceId: string, command: CommandData): Promise<void> {
    if (!this.config) return;

    // Build INSERT statement
    const columns = ["source_id", "raw_data"];
    const values: (string | number | null)[] = [sourceId, JSON.stringify(command)];
    const placeholders = ["?", "?"];

    // Add specific columns from TABLE_SCHEMAS
    const tableColumns = TABLE_SCHEMAS[tableName] || [];
    for (const col of tableColumns) {
      columns.push(col);
      values.push(command[col] !== undefined ? String(command[col]) : null);
      placeholders.push("?");
    }

    const sql = `INSERT INTO \`${tableName}\` (${columns.map((c) => `\`${c}\``).join(", ")}) VALUES (${placeholders.join(", ")})`;

    if (this.config.type === "mysql" && this.mysqlPool) {
      await this.mysqlPool.execute(sql, values);
    } else if (this.pgPool) {
      // PostgreSQL version
      const pgSQL = sql.replace(/\?/g, (_, i) => `$${i + 1}`).replace(/`/g, '"');
      await this.pgPool.query(pgSQL, values);
    }
  }

  /**
   * Check if error is a connection error
   */
  private isConnectionError(err: unknown): boolean {
    if (err instanceof Error) {
      const msg = err.message.toLowerCase();
      return (
        msg.includes("connection") ||
        msg.includes("econnrefused") ||
        msg.includes("etimedout") ||
        msg.includes("lost") ||
        msg.includes("closed")
      );
    }
    return false;
  }

  /**
   * Check if error is a "table doesn't exist" error
   */
  private isTableNotFoundError(err: unknown, tableName: string): boolean {
    if (err instanceof Error) {
      const msg = err.message.toLowerCase();
      const tableLower = tableName.toLowerCase();
      // MySQL: Table 'db.table' doesn't exist
      // PostgreSQL: relation "table" does not exist
      return (
        msg.includes("doesn't exist") ||
        msg.includes("does not exist") ||
        msg.includes(`table '${tableLower}'`) ||
        msg.includes(`relation "${tableLower}"`)
      );
    }
    return false;
  }

  /**
   * Add command to offline cache
   */
  private addToOfflineCache(sourceId: string, command: CommandData): void {
    if (!this.config) return;

    const cacheItem: CachedCommand = {
      sourceId,
      command,
      timestamp: new Date(),
    };

    const itemSize = JSON.stringify(cacheItem).length;
    const maxSizeBytes = this.config.offlineCacheSizeMb * 1024 * 1024;

    // If adding this item would exceed max size, remove oldest items
    while (this.offlineCacheSizeBytes + itemSize > maxSizeBytes && this.offlineCache.length > 0) {
      const removed = this.offlineCache.shift();
      if (removed) {
        this.offlineCacheSizeBytes -= JSON.stringify(removed).length;
      }
    }

    // Add item if it fits
    if (this.offlineCacheSizeBytes + itemSize <= maxSizeBytes) {
      this.offlineCache.push(cacheItem);
      this.offlineCacheSizeBytes += itemSize;
    }
  }

  /**
   * Flush offline cache to database
   */
  private async flushOfflineCache(): Promise<void> {
    if (this.offlineCache.length === 0) return;

    console.log(`[RemoteDB] Flushing ${this.offlineCache.length} cached commands to database...`);

    const cacheCopy = [...this.offlineCache];
    this.offlineCache = [];
    this.offlineCacheSizeBytes = 0;

    for (const item of cacheCopy) {
      try {
        await this.logCommand(item.sourceId, item.command);
      } catch (err) {
        console.error(`[RemoteDB] Failed to flush cached command:`, err);
        // Re-add to cache on failure
        this.addToOfflineCache(item.sourceId, item.command);
      }
    }
  }

  /**
   * Try to reconnect and flush cache
   */
  async tryReconnect(): Promise<boolean> {
    if (this.connected || !this.config) return true;

    try {
      await this.connect();
      this.connected = true;
      this.lastError = null;
      console.log("[RemoteDB] Reconnected to database");
      
      // Flush any offline cached data
      await this.flushOfflineCache();
      
      return true;
    } catch (err) {
      console.error("[RemoteDB] Failed to reconnect:", err);
      this.lastError = err instanceof Error ? err.message : String(err);
      return false;
    }
  }

  /**
   * Get current status
   */
  getStatus(): RemoteDbStatus {
    return {
      connected: this.connected,
      enabled: this.config?.enabled ?? false,
      type: this.config?.type ?? null,
      host: this.config?.host ?? "",
      database: this.config?.database ?? "",
      poolSize: this.config?.poolSize ?? 10,
      activeConnections: 0,
      lastError: this.lastError,
      commandsLogged: this.commandsLogged,
      tablesCreated: Array.from(this.createdTables),
      offlineCacheSize: Math.round(this.offlineCacheSizeBytes / 1024 / 1024 * 100) / 100, // MB
      offlineCacheCount: this.offlineCache.length,
    };
  }

  /**
   * Close connections
   */
  async close(): Promise<void> {
    if (this.mysqlPool) {
      await this.mysqlPool.end();
      this.mysqlPool = null;
    }
    if (this.pgPool) {
      await this.pgPool.end();
      this.pgPool = null;
    }
    this.initialized = false;
    this.connected = false;
    this.lastFCommand = null; // Reset $F tracking
    console.log("[RemoteDB] Connections closed");
  }
}

export const remoteDbManager = new RemoteDbManager();
