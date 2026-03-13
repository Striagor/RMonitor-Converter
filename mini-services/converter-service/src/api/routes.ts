/**
 * Management API Routes
 * REST API for managing the converter service
 */

import type { IncomingMessage, ServerResponse } from "http";
import { tcpClientManager, cacheManager } from "../managers";
import { wsServerManager } from "../modules/ws-server";
import { remoteDbManager } from "../managers/remote-db-manager";

interface RouteHandler {
  (req: IncomingMessage, res: ServerResponse, body?: unknown): Promise<void>;
}

interface Route {
  method: string;
  path: string;
  handler: RouteHandler;
}

const routes: Route[] = [
  // Health check
  {
    method: "GET",
    path: "/api/health",
    handler: async (_, res) => {
      jsonResponse(res, {
        success: true,
        data: { status: "ok", timestamp: new Date().toISOString() },
        timestamp: new Date().toISOString(),
      });
    },
  },

  // Get TCP sources status
  {
    method: "GET",
    path: "/api/tcp/sources",
    handler: async (_, res) => {
      const states = tcpClientManager.getStates();
      jsonResponse(res, {
        success: true,
        data: states,
        timestamp: new Date().toISOString(),
      });
    },
  },

  // Add TCP source
  {
    method: "POST",
    path: "/api/tcp/sources",
    handler: async (req, res, body) => {
      const config = body as {
        id: string;
        name: string;
        host: string;
        port: number;
        isEnabled?: boolean;
        autoReconnect?: boolean;
        reconnectDelay?: number;
        sendEnabled?: boolean;
        trustedOnly?: boolean;
      };

      tcpClientManager.addSource({
        id: config.id,
        name: config.name,
        host: config.host,
        port: config.port,
        isEnabled: config.isEnabled ?? true,
        autoReconnect: config.autoReconnect ?? true,
        reconnectDelay: config.reconnectDelay ?? 5000,
        sendEnabled: config.sendEnabled ?? false,
        trustedOnly: config.trustedOnly ?? false,
      });

      jsonResponse(res, {
        success: true,
        data: { message: "TCP source added" },
        timestamp: new Date().toISOString(),
      });
    },
  },

  // Remove TCP source
  {
    method: "DELETE",
    path: "/api/tcp/sources/:id",
    handler: async (req, res) => {
      const id = req.url?.split("/").pop();
      if (!id) {
        errorResponse(res, 400, "Source ID required");
        return;
      }

      tcpClientManager.removeSource(id);
      jsonResponse(res, {
        success: true,
        data: { message: "TCP source removed" },
        timestamp: new Date().toISOString(),
      });
    },
  },

  // Connect TCP source
  {
    method: "POST",
    path: "/api/tcp/sources/:id/connect",
    handler: async (req, res) => {
      const id = req.url?.split("/")[4];
      if (!id) {
        errorResponse(res, 400, "Source ID required");
        return;
      }

      const success = tcpClientManager.connect(id);
      jsonResponse(res, {
        success,
        data: { message: success ? "Connecting..." : "Failed to connect" },
        timestamp: new Date().toISOString(),
      });
    },
  },

  // Disconnect TCP source
  {
    method: "POST",
    path: "/api/tcp/sources/:id/disconnect",
    handler: async (req, res) => {
      const id = req.url?.split("/")[4];
      if (!id) {
        errorResponse(res, 400, "Source ID required");
        return;
      }

      tcpClientManager.disconnect(id);
      jsonResponse(res, {
        success: true,
        data: { message: "Disconnected" },
        timestamp: new Date().toISOString(),
      });
    },
  },

  // Get WS server status
  {
    method: "GET",
    path: "/api/ws/status",
    handler: async (_, res) => {
      const stats = {
        clientCount: wsServerManager.getClientCount(),
        clients: wsServerManager.getClients(),
        servers: wsServerManager.getAllServersStatus(),
      };
      jsonResponse(res, {
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      });
    },
  },

  // Get all WS servers status
  {
    method: "GET",
    path: "/api/ws/servers",
    handler: async (_, res) => {
      const servers = wsServerManager.getAllServersStatus();
      jsonResponse(res, {
        success: true,
        data: servers,
        timestamp: new Date().toISOString(),
      });
    },
  },

  // Register API key
  {
    method: "POST",
    path: "/api/ws/apikeys",
    handler: async (req, res, body) => {
      const data = body as {
        apiKey: string;
        roleId: string;
        roleName: string;
        allowedCommands: string[] | "all";
        canSend: boolean;
        canReceive: boolean;
      };

      wsServerManager.registerApiKey(data.apiKey, {
        id: "",
        apiKey: data.apiKey,
        roleId: data.roleId,
        roleName: data.roleName,
        allowedCommands: data.allowedCommands,
        canSend: data.canSend,
        canReceive: data.canReceive,
        connectedAt: new Date(),
        ipAddress: "",
      });

      jsonResponse(res, {
        success: true,
        data: { message: "API key registered" },
        timestamp: new Date().toISOString(),
      });
    },
  },

  // Remove API key and disconnect clients
  {
    method: "DELETE",
    path: "/api/ws/apikeys/:key",
    handler: async (req, res) => {
      const key = req.url?.split("/").pop();
      if (!key) {
        errorResponse(res, 400, "API key required");
        return;
      }

      const disconnectedCount = wsServerManager.removeApiKey(key);
      jsonResponse(res, {
        success: true,
        data: { 
          message: "API key removed", 
          disconnectedClients: disconnectedCount 
        },
        timestamp: new Date().toISOString(),
      });
    },
  },

  // Get cache stats
  {
    method: "GET",
    path: "/api/cache/stats",
    handler: async (_, res) => {
      const stats = cacheManager.getStats();
      jsonResponse(res, {
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      });
    },
  },

  // Clear cache
  {
    method: "POST",
    path: "/api/cache/clear",
    handler: async (_, res) => {
      cacheManager.clear();
      jsonResponse(res, {
        success: true,
        data: { message: "Cache cleared" },
        timestamp: new Date().toISOString(),
      });
    },
  },

  // Create/Start WS Server
  {
    method: "POST",
    path: "/api/ws/servers",
    handler: async (req, res, body) => {
      const config = body as {
        id: string;
        name: string;
        port: number;
        isEnabled?: boolean;
        useSSL?: boolean;
        sslCertPath?: string;
        sslKeyPath?: string;
        maxClients?: number;
        heartbeatInterval?: number;
        tcpMappings?: string[];
      };

      const success = await wsServerManager.createServer({
        id: config.id,
        name: config.name,
        port: config.port,
        isEnabled: config.isEnabled ?? true,
        useSSL: config.useSSL ?? false,
        sslCertPath: config.sslCertPath,
        sslKeyPath: config.sslKeyPath,
        maxClients: config.maxClients ?? 100,
        heartbeatInterval: config.heartbeatInterval ?? 30000,
        tcpMappings: config.tcpMappings ?? [],
      });

      jsonResponse(res, {
        success,
        data: { 
          message: success ? `WS Server ${config.name} started on port ${config.port}` : "Failed to create WS server",
          serverId: config.id,
        },
        timestamp: new Date().toISOString(),
      });
    },
  },

  // Stop WS Server
  {
    method: "DELETE",
    path: "/api/ws/servers/:id",
    handler: async (req, res) => {
      const id = req.url?.split("/").pop();
      if (!id) {
        errorResponse(res, 400, "Server ID required");
        return;
      }

      await wsServerManager.stopServer(id);
      jsonResponse(res, {
        success: true,
        data: { message: "WS Server stopped" },
        timestamp: new Date().toISOString(),
      });
    },
  },

  // Reload Remote DB settings
  {
    method: "POST",
    path: "/api/remote-db/reload",
    handler: async (_, res) => {
      try {
        // Close existing connections
        await remoteDbManager.close();
        
        // Re-initialize with current settings
        const { getPrisma } = await import("../lib/prisma");
        const prisma = getPrisma();
        
        const enabled = await remoteDbManager.init(prisma);

        jsonResponse(res, {
          success: true,
          data: { 
            message: enabled 
              ? "Remote database reloaded and connected" 
              : "Remote database disabled or not configured",
            enabled,
          },
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        console.error("[API] Error reloading remote DB:", err);
        errorResponse(res, 500, "Failed to reload remote database settings");
      }
    },
  },

  // Get Remote DB status
  {
    method: "GET",
    path: "/api/remote-db/status",
    handler: async (_, res) => {
      const status = remoteDbManager.getStatus();
      jsonResponse(res, {
        success: true,
        data: status,
        timestamp: new Date().toISOString(),
      });
    },
  },

  // Update role (notify connected clients)
  {
    method: "POST",
    path: "/api/roles/update",
    handler: async (req, res, body) => {
      const data = body as {
        roleId: string;
        roleName?: string;
        allowedCommands?: string[] | "all";
        canSend?: boolean;
        canReceive?: boolean;
      };

      if (!data.roleId) {
        errorResponse(res, 400, "Role ID required");
        return;
      }

      const updatedCount = wsServerManager.updateRoleClients(data.roleId, {
        roleName: data.roleName,
        allowedCommands: data.allowedCommands,
        canSend: data.canSend,
        canReceive: data.canReceive,
      });

      jsonResponse(res, {
        success: true,
        data: { 
          message: `Updated ${updatedCount} clients with role ${data.roleId}`,
          updatedCount,
        },
        timestamp: new Date().toISOString(),
      });
    },
  },
];

/**
 * Handle API request
 */
export async function handleApiRequest(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Handle preflight
  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // Parse body for POST/PUT
  let body: unknown = null;
  if (req.method === "POST" || req.method === "PUT") {
    body = await parseBody(req);
  }

  // Find matching route
  for (const route of routes) {
    if (req.method !== route.method) continue;

    const pathMatches = matchPath(req.url || "", route.path);
    if (pathMatches) {
      try {
        await route.handler(req, res, body);
        return;
      } catch (err) {
        console.error("[API] Route error:", err);
        errorResponse(res, 500, "Internal server error");
        return;
      }
    }
  }

  // No route found
  errorResponse(res, 404, "Not found");
}

/**
 * Parse request body
 */
function parseBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : null);
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

/**
 * Match path with route pattern
 */
function matchPath(url: string, pattern: string): boolean {
  const urlPath = url.split("?")[0];
  const urlParts = urlPath.split("/").filter(Boolean);
  const patternParts = pattern.split("/").filter(Boolean);

  if (urlParts.length !== patternParts.length) return false;

  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(":")) continue;
    if (urlParts[i] !== patternParts[i]) return false;
  }

  return true;
}

/**
 * Send JSON response
 */
function jsonResponse(res: ServerResponse, data: unknown): void {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

/**
 * Send error response
 */
function errorResponse(res: ServerResponse, code: number, message: string): void {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      success: false,
      error: message,
      timestamp: new Date().toISOString(),
    })
  );
}
