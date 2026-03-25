/**
 * TCP Client Manager
 * Manages connections to RMonitor TCP sources
 */

import * as net from "net";
import { RMonitorStreamParser, rMonitorToJson } from "../shared/utils";
import { cacheManager } from "./cache-manager";
import type { TcpSourceConfig, TcpConnectionState, WebJsonMessage } from "../types";

interface TcpConnection {
  sourceId: string;
  config: TcpSourceConfig;
  socket: net.Socket | null;
  parser: RMonitorStreamParser;
  state: TcpConnectionState;
  reconnectTimeout: Timer | null;
  onDataCallback: ((sourceId: string, message: WebJsonMessage, jsonData: string) => void | Promise<void>) | null;
}

// Deduplication for incoming messages
interface MessageKey {
  id: string;
  sourceId: string;
  hash: string;
}

class TcpClientManager {
  private connections: Map<string, TcpConnection> = new Map();
  private defaultCallback: ((sourceId: string, message: WebJsonMessage, jsonData: string) => void | Promise<void>) | null = null;
  
  // Message deduplication - track recent messages to avoid duplicates
  private recentMessages: Map<string, number> = new Map();
  private dedupWindow = 500; // 500ms window for deduplication

  /**
   * Add a TCP source configuration
   */
  addSource(config: TcpSourceConfig): void {
    // If source already exists, remove it first
    if (this.connections.has(config.id)) {
      console.log(`[TCP] Source ${config.id} already exists, replacing...`);
      this.removeSource(config.id);
    }

    const connection: TcpConnection = {
      sourceId: config.id,
      config,
      socket: null,
      parser: new RMonitorStreamParser(),
      state: {
        sourceId: config.id,
        status: "disconnected",
        reconnectAttempts: 0,
      },
      reconnectTimeout: null,
      // Use default callback if available (important for hot-reload)
      onDataCallback: this.defaultCallback,
    };

    this.connections.set(config.id, connection);
    console.log(`[TCP] Source ${config.id} (${config.name}) added with callback: ${this.defaultCallback ? 'yes' : 'no'}`);

    if (config.isEnabled) {
      console.log(`[TCP] Auto-connecting to ${config.name} (${config.host}:${config.port})`);
      this.connect(config.id);
    }
  }

  /**
   * Remove a TCP source completely
   */
  removeSource(sourceId: string): void {
    const connection = this.connections.get(sourceId);
    if (!connection) {
      console.log(`[TCP] Source ${sourceId} not found for removal`);
      return;
    }

    console.log(`[TCP] Removing source ${sourceId} (${connection.config.name})`);

    // Cancel any pending reconnect
    if (connection.reconnectTimeout) {
      clearTimeout(connection.reconnectTimeout);
      connection.reconnectTimeout = null;
    }

    // Destroy the socket if it exists
    if (connection.socket) {
      connection.socket.destroy();
      connection.socket = null;
    }

    // Update state
    connection.state.status = "disconnected";
    connection.state.error = undefined;

    // Remove from connections map
    this.connections.delete(sourceId);
    console.log(`[TCP] Source ${sourceId} removed successfully`);
  }

  /**
   * Connect to a TCP source
   */
  connect(sourceId: string): boolean {
    const connection = this.connections.get(sourceId);
    if (!connection) {
      console.error(`[TCP] Unknown source: ${sourceId}`);
      return false;
    }

    if (connection.state.status === "connected" || connection.state.status === "connecting") {
      console.log(`[TCP] Already ${connection.state.status} to: ${connection.config.name}`);
      return true;
    }

    connection.state.status = "connecting";
    console.log(
      `[TCP] Connecting to ${connection.config.name} (${connection.config.host}:${connection.config.port})...`
    );

    const socket = new net.Socket();

    socket.on("connect", () => {
      console.log(`[TCP] Connected to ${connection.config.name}`);
      connection.state.status = "connected";
      connection.state.lastConnectedAt = new Date();
      connection.state.reconnectAttempts = 0;
      connection.state.error = undefined;
      connection.socket = socket;
    });

    socket.on("data", (data: Buffer) => {
      const messages = connection.parser.parse(data);

      for (const msg of messages) {
        try {
          const jsonMessage = rMonitorToJson(msg);
          if (jsonMessage) {
            // Clear cache on $I (new session)
            if (jsonMessage.Id === "I") {
              cacheManager.clear();
            }

            // Store in cache
            const jsonData = JSON.stringify(jsonMessage);
            cacheManager.store(jsonMessage, jsonData);

            // Deduplicate before callback
            if (this.shouldProcessMessage(sourceId, jsonMessage)) {
              // Callback
              if (connection.onDataCallback) {
                connection.onDataCallback(sourceId, jsonMessage, jsonData);
              }
            }
          }
        } catch (err) {
          console.error(`[TCP] Error parsing message:`, err);
        }
      }
    });

    socket.on("close", () => {
      console.log(`[TCP] Disconnected from ${connection.config.name}`);
      connection.state.status = "disconnected";
      connection.socket = null;

      // Auto reconnect only if source is still enabled and exists
      if (connection.config.autoReconnect && connection.config.isEnabled && this.connections.has(sourceId)) {
        this.scheduleReconnect(sourceId);
      }
    });

    socket.on("error", (err: Error) => {
      console.error(`[TCP] Error on ${connection.config.name}:`, err.message);
      connection.state.status = "error";
      connection.state.error = err.message;
    });

    try {
      socket.connect(connection.config.port, connection.config.host);
      return true;
    } catch (err) {
      console.error(`[TCP] Failed to connect:`, err);
      connection.state.status = "error";
      return false;
    }
  }

  /**
   * Check if message should be processed (deduplication)
   */
  private shouldProcessMessage(sourceId: string, message: WebJsonMessage): boolean {
    // Create a hash for the message
    const hash = this.createMessageHash(message);
    const key = `${sourceId}:${message.Id}:${hash}`;
    const now = Date.now();

    const lastSeen = this.recentMessages.get(key);
    if (lastSeen && (now - lastSeen) < this.dedupWindow) {
      return false; // Skip duplicate
    }

    // Update last seen
    this.recentMessages.set(key, now);

    // Clean up old entries periodically
    if (this.recentMessages.size > 1000) {
      const cutoff = now - this.dedupWindow * 10;
      for (const [k, time] of this.recentMessages) {
        if (time < cutoff) {
          this.recentMessages.delete(k);
        }
      }
    }

    return true;
  }

  /**
   * Create a simple hash for message content
   */
  private createMessageHash(message: WebJsonMessage): string {
    // Use relevant fields for deduplication based on message type
    const msg = message as Record<string, unknown>;
    const fields: string[] = [];
    
    for (const [key, value] of Object.entries(msg)) {
      if (key !== 'Id' && typeof value === 'string') {
        fields.push(value);
      }
    }
    
    return fields.slice(0, 5).join(':'); // Use first 5 fields for hash
  }

  /**
   * Disconnect from a TCP source (but keep in connections map)
   */
  disconnect(sourceId: string): void {
    const connection = this.connections.get(sourceId);
    if (!connection) return;

    console.log(`[TCP] Disconnecting from ${connection.config.name}`);

    // Cancel any pending reconnect
    if (connection.reconnectTimeout) {
      clearTimeout(connection.reconnectTimeout);
      connection.reconnectTimeout = null;
    }

    // Destroy the socket
    if (connection.socket) {
      connection.socket.destroy();
      connection.socket = null;
    }

    connection.state.status = "disconnected";
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(sourceId: string): void {
    const connection = this.connections.get(sourceId);
    if (!connection) return;

    // Check if source was removed while we were waiting
    if (!this.connections.has(sourceId)) {
      console.log(`[TCP] Source ${sourceId} was removed, skipping reconnect`);
      return;
    }

    connection.state.reconnectAttempts++;
    console.log(
      `[TCP] Reconnecting to ${connection.config.name} in ${connection.config.reconnectDelay}ms (attempt ${connection.state.reconnectAttempts})`
    );

    connection.reconnectTimeout = setTimeout(() => {
      // Check again if source still exists
      if (this.connections.has(sourceId) && connection.config.isEnabled) {
        this.connect(sourceId);
      } else {
        console.log(`[TCP] Source ${sourceId} no longer exists or disabled, skipping reconnect`);
      }
    }, connection.config.reconnectDelay);
  }

  /**
   * Set callback for received data
   * This callback will be used for all current and future connections
   */
  onData(
    callback: (sourceId: string, message: WebJsonMessage, jsonData: string) => void | Promise<void>
  ): void {
    // Store as default for future connections
    this.defaultCallback = callback;
    
    // Set callback for all existing connections
    for (const connection of this.connections.values()) {
      connection.onDataCallback = callback;
    }
    
    console.log(`[TCP] Data callback registered for ${this.connections.size} connections`);
  }

  /**
   * Send data to a TCP source
   */
  send(sourceId: string, data: string): boolean {
    const connection = this.connections.get(sourceId);
    if (!connection || !connection.socket || connection.state.status !== "connected") {
      return false;
    }

    if (!connection.config.sendEnabled) {
      console.warn(`[TCP] Sending disabled for ${connection.config.name}`);
      return false;
    }

    try {
      connection.socket.write(data);
      return true;
    } catch (err) {
      console.error(`[TCP] Error sending data:`, err);
      return false;
    }
  }

  /**
   * Get all connection states
   */
  getStates(): TcpConnectionState[] {
    return Array.from(this.connections.values()).map((c) => c.state);
  }

  /**
   * Get single connection state
   */
  getState(sourceId: string): TcpConnectionState | undefined {
    return this.connections.get(sourceId)?.state;
  }

  /**
   * Get connected source IDs
   */
  getConnectedSourceIds(): string[] {
    return Array.from(this.connections.entries())
      .filter(([, c]) => c.state.status === "connected")
      .map(([id]) => id);
  }

  /**
   * Check if a source exists
   */
  hasSource(sourceId: string): boolean {
    return this.connections.has(sourceId);
  }
}

export const tcpClientManager = new TcpClientManager();
