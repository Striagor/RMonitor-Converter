/**
 * Multi-WebSocket Server Manager
 * Manages multiple WebSocket server instances with API key authentication
 */

import { WebSocketServer, WebSocket, createWebSocketStream } from "ws";
import * as https from "https";
import * as fs from "fs";
import type { WsClientInfo, WebJsonMessage, WsMessageWrapper } from "../types";
import { cacheManager, tcpClientManager } from "../managers";
import { jsonToRMonitor } from "../shared/utils";

interface WsServerConfig {
  id: string;
  name: string;
  port: number;
  isEnabled: boolean;
  useSSL: boolean;
  sslCertPath?: string;
  sslKeyPath?: string;
  maxClients: number;
  heartbeatInterval: number;
  tcpMappings: string[]; // TCP source IDs to listen to
}

interface ConnectedClient {
  id: string;
  ws: WebSocket;
  info: WsClientInfo;
  lastPing: Date;
  isAlive: boolean;
  serverId: string;
}

interface WsServerInstance {
  config: WsServerConfig;
  wss: WebSocketServer;
  clients: Map<string, ConnectedClient>;
  heartbeatInterval: Timer | null;
}

class MultiWsServerManager {
  private servers: Map<string, WsServerInstance> = new Map();
  private apiKeys: Map<string, WsClientInfo> = new Map();
  private allClients: Map<string, ConnectedClient> = new Map();
  private recentMessages: Map<string, number> = new Map(); // For deduplication
  private messageDedupWindow = 1000; // 1 second window for dedup

  /**
   * Create and start a WebSocket server
   */
  async createServer(config: WsServerConfig): Promise<boolean> {
    if (this.servers.has(config.id)) {
      console.log(`[WS] Server ${config.id} already exists, stopping it first`);
      await this.stopServer(config.id);
    }

    if (!config.isEnabled) {
      console.log(`[WS] Server ${config.name} is disabled, skipping`);
      return false;
    }

    try {
      let wss: WebSocketServer;

      if (config.useSSL && config.sslCertPath && config.sslKeyPath) {
        // Create HTTPS server for WSS
        const server = https.createServer({
          cert: fs.readFileSync(config.sslCertPath),
          key: fs.readFileSync(config.sslKeyPath),
        });

        wss = new WebSocketServer({ server });

        await new Promise<void>((resolve, reject) => {
          server.listen(config.port, () => {
            console.log(`[WS] WSS server ${config.name} listening on port ${config.port}`);
            resolve();
          });
          server.on("error", reject);
        });
      } else {
        // Plain WS
        wss = new WebSocketServer({ port: config.port });
        await new Promise<void>((resolve, reject) => {
          wss.on("listening", () => {
            console.log(`[WS] WS server ${config.name} listening on port ${config.port}`);
            resolve();
          });
          wss.on("error", reject);
        });
      }

      const instance: WsServerInstance = {
        config,
        wss,
        clients: new Map(),
        heartbeatInterval: null,
      };

      // Handle connections
      wss.on("connection", (ws, req) => {
        this.handleConnection(instance, ws, req);
      });

      wss.on("error", (err) => {
        console.error(`[WS] Server ${config.name} error:`, err);
      });

      // Start heartbeat
      instance.heartbeatInterval = setInterval(() => {
        this.doHeartbeat(instance);
      }, config.heartbeatInterval || 30000);

      this.servers.set(config.id, instance);
      console.log(`[WS] Server ${config.name} (${config.id}) started on port ${config.port}`);
      return true;
    } catch (err) {
      console.error(`[WS] Failed to create server ${config.name}:`, err);
      return false;
    }
  }

  /**
   * Stop a WebSocket server
   */
  async stopServer(serverId: string): Promise<void> {
    const instance = this.servers.get(serverId);
    if (!instance) return;

    // Clear heartbeat
    if (instance.heartbeatInterval) {
      clearInterval(instance.heartbeatInterval);
    }

    // Close all clients
    for (const [clientId, client] of instance.clients) {
      client.ws.close(1001, "Server stopping");
      this.allClients.delete(clientId);
    }
    instance.clients.clear();

    // Close server
    instance.wss.close();
    this.servers.delete(serverId);

    console.log(`[WS] Server ${instance.config.name} stopped`);
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(instance: WsServerInstance, ws: WebSocket, req: any): void {
    // Parse URL for API key
    const url = new URL(req.url || "", `http://localhost`);
    const apiKey = url.searchParams.get("apiKey");

    if (!apiKey) {
      this.sendError(ws, "API key required. Use: ws://host:port?apiKey=YOUR_KEY");
      ws.close(4001, "API key required");
      return;
    }

    // Validate API key
    const clientInfo = this.apiKeys.get(apiKey);
    if (!clientInfo) {
      this.sendError(ws, "Invalid API key");
      ws.close(4002, "Invalid API key");
      return;
    }

    if (!clientInfo.canReceive) {
      this.sendError(ws, "Receive permission denied");
      ws.close(4003, "Permission denied");
      return;
    }

    // Check max clients
    if (instance.clients.size >= instance.config.maxClients) {
      this.sendError(ws, "Server full");
      ws.close(4004, "Server full");
      return;
    }

    // Generate client ID
    const clientId = `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Get client IP
    const ip = req.headers?.["x-forwarded-for"]?.toString() || 
               req.socket?.remoteAddress || 
               "unknown";

    const client: ConnectedClient = {
      id: clientId,
      ws,
      info: { ...clientInfo, id: clientId, connectedAt: new Date(), ipAddress: ip },
      lastPing: new Date(),
      isAlive: true,
      serverId: instance.config.id,
    };

    instance.clients.set(clientId, client);
    this.allClients.set(clientId, client);

    console.log(`[WS] Client ${clientId} connected to ${instance.config.name} (role: ${clientInfo.roleName})`);

    // Send init block
    this.sendInitBlock(client);

    // Handle messages
    ws.on("message", (data: Buffer) => {
      this.handleMessage(client, data);
    });

    ws.on("pong", () => {
      client.isAlive = true;
      client.lastPing = new Date();
    });

    ws.on("close", () => {
      console.log(`[WS] Client ${clientId} disconnected from ${instance.config.name}`);
      instance.clients.delete(clientId);
      this.allClients.delete(clientId);
    });
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(client: ConnectedClient, data: Buffer): void {
    try {
      const wrapper: WsMessageWrapper = JSON.parse(data.toString());

      switch (wrapper.action) {
        case "pong":
          client.isAlive = true;
          client.lastPing = new Date();
          break;

        case "send":
          this.handleSendCommand(client, wrapper);
          break;

        case "ping":
          this.send(client.ws, { action: "pong", timestamp: new Date().toISOString() });
          break;

        default:
          this.sendError(client.ws, `Unknown action: ${wrapper.action}`);
      }
    } catch (err) {
      console.error("[WS] Error parsing message:", err);
      this.sendError(client.ws, "Invalid message format");
    }
  }

  /**
   * Handle send command from client
   */
  private handleSendCommand(client: ConnectedClient, wrapper: WsMessageWrapper): void {
    // Check if client can send
    if (!client.info.canSend) {
      this.sendError(client.ws, "Send permission denied");
      return;
    }

    if (!wrapper.message) {
      this.sendError(client.ws, "No message provided");
      return;
    }

    try {
      const jsonMessage = wrapper.message as WebJsonMessage;

      // Check if command is allowed
      if (
        client.info.allowedCommands !== "all" &&
        !client.info.allowedCommands.includes(jsonMessage.Id)
      ) {
        this.sendError(client.ws, `Command $${jsonMessage.Id} not allowed`);
        return;
      }

      // Convert to RMonitor and send
      const rMonitorData = jsonToRMonitor(jsonMessage);

      // Get connected TCP sources
      const connectedSources = tcpClientManager.getConnectedSourceIds();
      if (connectedSources.length === 0) {
        this.sendError(client.ws, "No TCP sources connected");
        return;
      }

      // Send to all connected sources
      let sent = false;
      for (const sourceId of connectedSources) {
        if (tcpClientManager.send(sourceId, rMonitorData)) {
          sent = true;
        }
      }

      if (sent) {
        this.send(client.ws, {
          action: "status",
          message: `Command $${jsonMessage.Id} sent successfully`,
          timestamp: new Date().toISOString(),
        });
      } else {
        this.sendError(client.ws, "Failed to send command");
      }
    } catch (err) {
      console.error("[WS] Error handling send command:", err);
      this.sendError(client.ws, "Invalid message format");
    }
  }

  /**
   * Send init block to client
   */
  private sendInitBlock(client: ConnectedClient): void {
    const messages = cacheManager.getInitBlock(client.info.allowedCommands);

    const wrapper: WsMessageWrapper = {
      action: "init",
      message: messages.map((m) => JSON.parse(m)),
      timestamp: new Date().toISOString(),
    };

    this.send(client.ws, wrapper);
    console.log(`[WS] Sent init block (${messages.length} messages) to ${client.id}`);
  }

  /**
   * Broadcast message to relevant clients
   */
  broadcast(jsonData: string, sourceId?: string): void {
    const jsonMsg = JSON.parse(jsonData) as WebJsonMessage;
    
    // Deduplication: Create a unique key for the message
    const dedupKey = `${jsonMsg.Id}:${JSON.stringify(jsonMsg).slice(0, 200)}`;
    const now = Date.now();
    const lastSeen = this.recentMessages.get(dedupKey);
    
    // Skip if we've seen this exact message recently (within dedup window)
    if (lastSeen && (now - lastSeen) < this.messageDedupWindow) {
      console.log(`[WS] Skipping duplicate $${jsonMsg.Id}`);
      return;
    }
    
    // Update last seen
    this.recentMessages.set(dedupKey, now);
    
    // Clean up old entries periodically
    if (this.recentMessages.size > 1000) {
      const cutoff = now - this.messageDedupWindow * 10;
      for (const [key, time] of this.recentMessages) {
        if (time < cutoff) {
          this.recentMessages.delete(key);
        }
      }
    }
    
    const wrapper: WsMessageWrapper = {
      action: "data",
      message: jsonMsg,
      timestamp: new Date().toISOString(),
    };

    const data = JSON.stringify(wrapper);
    let sentCount = 0;

    for (const client of this.allClients.values()) {
      // Check if client can receive
      if (!client.info.canReceive) continue;

      // Check if command is allowed
      if (
        client.info.allowedCommands !== "all" &&
        !client.info.allowedCommands.includes(jsonMsg.Id)
      ) {
        continue;
      }

      // Check server's TCP mappings if sourceId is provided
      const instance = this.servers.get(client.serverId);
      if (instance && instance.config.tcpMappings.length > 0 && sourceId) {
        if (!instance.config.tcpMappings.includes(sourceId)) {
          continue;
        }
      }

      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(data);
        sentCount++;
      }
    }

    if (sentCount > 0) {
      console.log(`[WS] Broadcast $${jsonMsg.Id} to ${sentCount} clients`);
    }
  }

  /**
   * Send message to specific client
   */
  private send(ws: WebSocket, wrapper: WsMessageWrapper): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(wrapper));
    }
  }

  /**
   * Send error message
   */
  private sendError(ws: WebSocket, message: string): void {
    this.send(ws, { action: "error", message, timestamp: new Date().toISOString() });
  }

  /**
   * Do heartbeat for a server instance
   */
  private doHeartbeat(instance: WsServerInstance): void {
    for (const client of instance.clients.values()) {
      if (!client.isAlive) {
        console.log(`[WS] Terminating inactive client: ${client.id}`);
        client.ws.terminate();
        instance.clients.delete(client.id);
        this.allClients.delete(client.id);
        continue;
      }

      client.isAlive = false;
      client.ws.ping();
    }
  }

  /**
   * Register API key with client info
   */
  registerApiKey(apiKey: string, info: WsClientInfo): void {
    this.apiKeys.set(apiKey, info);
    console.log(`[WS] Registered API key: ${apiKey.substring(0, 12)}...`);
  }

  /**
   * Remove API key and disconnect all clients using it
   */
  removeApiKey(apiKey: string): number {
    let disconnectedCount = 0;
    
    // Find and disconnect all clients using this API key
    for (const [clientId, client] of this.allClients) {
      if (client.info.apiKey === apiKey) {
        console.log(`[WS] Disconnecting client ${clientId} - API key removed`);
        client.ws.close(4005, "API key removed");
        
        // Remove from server's client list
        const instance = this.servers.get(client.serverId);
        if (instance) {
          instance.clients.delete(clientId);
        }
        
        this.allClients.delete(clientId);
        disconnectedCount++;
      }
    }
    
    // Remove the API key
    this.apiKeys.delete(apiKey);
    console.log(`[WS] Removed API key: ${apiKey.substring(0, 12)}... (disconnected ${disconnectedCount} clients)`);
    
    return disconnectedCount;
  }

  /**
   * Disconnect all clients using a specific API key
   */
  disconnectClientsByApiKey(apiKey: string): number {
    let disconnectedCount = 0;
    
    for (const [clientId, client] of this.allClients) {
      if (client.info.apiKey === apiKey) {
        console.log(`[WS] Disconnecting client ${clientId} - API key invalidated`);
        client.ws.close(4005, "API key invalidated");
        
        const instance = this.servers.get(client.serverId);
        if (instance) {
          instance.clients.delete(clientId);
        }
        
        this.allClients.delete(clientId);
        disconnectedCount++;
      }
    }
    
    return disconnectedCount;
  }

  /**
   * Update API key info (for role changes)
   */
  updateApiKeyInfo(apiKey: string, info: Partial<WsClientInfo>): void {
    const existing = this.apiKeys.get(apiKey);
    if (existing) {
      this.apiKeys.set(apiKey, { ...existing, ...info });
      console.log(`[WS] Updated API key: ${apiKey.substring(0, 12)}...`);
      
      // Update all connected clients with this API key
      for (const client of this.allClients.values()) {
        if (client.info.apiKey === apiKey) {
          client.info = { ...client.info, ...info };
          
          // Notify client about role update
          this.send(client.ws, {
            action: "role_update",
            message: {
              roleName: info.roleName || client.info.roleName,
              allowedCommands: info.allowedCommands || client.info.allowedCommands,
              canSend: info.canSend ?? client.info.canSend,
              canReceive: info.canReceive ?? client.info.canReceive,
            },
            timestamp: new Date().toISOString(),
          });
        }
      }
    }
  }

  /**
   * Update all clients with a specific role
   */
  updateRoleClients(roleId: string, updates: {
    roleName?: string;
    allowedCommands?: string[] | "all";
    canSend?: boolean;
    canReceive?: boolean;
  }): number {
    let updatedCount = 0;
    
    for (const [apiKey, info] of this.apiKeys) {
      if (info.roleId === roleId) {
        this.updateApiKeyInfo(apiKey, updates);
        updatedCount++;
      }
    }
    
    console.log(`[WS] Updated ${updatedCount} clients for role ${roleId}`);
    return updatedCount;
  }

  /**
   * Get total connected client count
   */
  getClientCount(): number {
    return this.allClients.size;
  }

  /**
   * Get all connected clients info
   */
  getClients(): WsClientInfo[] {
    return Array.from(this.allClients.values()).map((c) => c.info);
  }

  /**
   * Get server status
   */
  getServerStatus(serverId: string): { running: boolean; clientCount: number } | null {
    const instance = this.servers.get(serverId);
    if (!instance) return null;
    return {
      running: true,
      clientCount: instance.clients.size,
    };
  }

  /**
   * Get all servers status
   */
  getAllServersStatus(): { id: string; name: string; port: number; clientCount: number; running: boolean }[] {
    return Array.from(this.servers.values()).map((instance) => ({
      id: instance.config.id,
      name: instance.config.name,
      port: instance.config.port,
      clientCount: instance.clients.size,
      running: true,
    }));
  }

  /**
   * Initialize with default server on specified port
   */
  async init(port: number): Promise<void> {
    // Create default server
    await this.createServer({
      id: "default",
      name: "Default WS Server",
      port,
      isEnabled: true,
      useSSL: false,
      maxClients: 100,
      heartbeatInterval: 30000,
      tcpMappings: [], // Empty means all TCP sources
    });
  }

  /**
   * Stop all servers
   */
  stop(): void {
    for (const [serverId] of this.servers) {
      this.stopServer(serverId);
    }
    console.log("[WS] All servers stopped");
  }
}

export const wsServerManager = new MultiWsServerManager();
