/**
 * RMonitor Converter Service
 * Main entry point
 *
 * Architecture:
 * - TCP Client: Connects to RMonitor servers
 * - WebSocket Server: Serves WebJSON to clients
 * - Management API: REST API for configuration
 * - Cache: Stores init block for new clients
 * - Remote DB: Logs commands to MySQL/PostgreSQL
 */

import * as http from "http";
import * as path from "path";
import { config } from "./config";
import { tcpClientManager, cacheManager } from "./managers";
import { remoteDbManager } from "./managers/remote-db-manager";
import { wsServerManager } from "./modules/ws-server";
import { handleApiRequest } from "./api/routes";
import { getPrisma, closePrisma } from "./lib/prisma";

// Service state
const startTime = new Date();
let isRunning = false;

/**
 * Load TCP sources from database and start enabled ones
 */
async function loadSourcesFromDatabase(): Promise<void> {
  const prisma = getPrisma();

  try {
    const sources = await prisma.tcpSource.findMany({
      where: { isEnabled: true },
    });

    console.log(`[DB] Found ${sources.length} enabled TCP sources`);

    for (const source of sources) {
      tcpClientManager.addSource({
        id: source.id,
        name: source.name,
        host: source.host,
        port: source.port,
        isEnabled: source.isEnabled,
        autoReconnect: source.autoReconnect,
        reconnectDelay: source.reconnectDelay,
        sendEnabled: source.sendEnabled,
        trustedOnly: source.trustedOnly,
      });

      // Auto-connect
      console.log(`[TCP] Auto-connecting to ${source.name} (${source.host}:${source.port})`);
      tcpClientManager.connect(source.id);
    }
  } catch (err) {
    console.error("[DB] Error loading sources:", err);
  }
}

/**
 * Load API keys from database
 */
async function loadApiKeysFromDatabase(): Promise<void> {
  const prisma = getPrisma();

  try {
    const apiKeys = await prisma.apiKey.findMany({
      where: { isActive: true },
    });

    console.log(`[DB] Found ${apiKeys.length} enabled API keys`);

    for (const apiKey of apiKeys) {
      // Get role info
      const role = await prisma.wsClientRole.findUnique({
        where: { id: apiKey.roleId },
      });

      if (role) {
        wsServerManager.registerApiKey(apiKey.key, {
          id: apiKey.id,
          apiKey: apiKey.key,
          roleId: role.id,
          roleName: role.name,
          allowedCommands: role.allowedCommands === "all" ? "all" : role.allowedCommands.split(","),
          canSend: role.canSend,
          canReceive: role.canReceive,
          connectedAt: new Date(),
          ipAddress: "",
        });
      }
    }
  } catch (err) {
    console.error("[DB] Error loading API keys:", err);
  }
}

/**
 * Load WS servers from database and start them
 */
async function loadWsServersFromDatabase(): Promise<void> {
  const prisma = getPrisma();

  try {
    const wsServers = await prisma.wsServer.findMany({
      where: { isEnabled: true },
      include: {
        tcpMappings: {
          where: { isEnabled: true },
        },
      },
    });

    console.log(`[DB] Found ${wsServers.length} WS servers to start`);

    for (const server of wsServers) {
      const tcpMappings = server.tcpMappings.map((m) => m.tcpSourceId);

      await wsServerManager.createServer({
        id: server.id,
        name: server.name,
        port: server.port,
        isEnabled: server.isEnabled,
        useSSL: server.useSSL,
        sslCertPath: server.sslCertPath || undefined,
        sslKeyPath: server.sslKeyPath || undefined,
        maxClients: server.maxClients,
        heartbeatInterval: server.heartbeatInterval,
        tcpMappings,
      });
    }
  } catch (err) {
    console.error("[DB] Error loading WS servers:", err);
  }
}

/**
 * Initialize remote database for command logging
 */
async function initRemoteDatabase(): Promise<void> {
  const prisma = getPrisma();

  try {
    // Initialize remote DB manager with settings from main database
    const remoteEnabled = await remoteDbManager.init(prisma);

    if (remoteEnabled) {
      console.log("[RemoteDB] Command logging to remote database enabled");
    }
  } catch (err) {
    console.error("[RemoteDB] Failed to initialize:", err);
  }
}

/**
 * Initialize and start the converter service
 */
async function start(): Promise<void> {
  console.log("=".repeat(60));
  console.log("  RMonitor Converter Service");
  console.log("=".repeat(60));
  console.log("");

  try {
    // Initialize Prisma
    console.log("[DB] Connecting to database...");
    const prisma = getPrisma();
    await prisma.$connect();
    console.log("[DB] Database connected");

    // Start Management API first (so we can accept commands)
    await startManagementApi();
    console.log(`[API] Management API listening on port ${config.managementApiPort}`);

    // Load WS servers from database and start them
    await loadWsServersFromDatabase();

    // If no WS servers in DB, start default one
    if (wsServerManager.getAllServersStatus().length === 0) {
      console.log("[WS] No WS servers in database, starting default on port " + config.tcpWsPort);
      await wsServerManager.init(config.tcpWsPort);
    }

    // Initialize remote database for command logging
    await initRemoteDatabase();

    // IMPORTANT: Set up TCP data callback BEFORE loading sources
    // This ensures callback is set for all current and future connections
    tcpClientManager.onData(async (sourceId, message, jsonData) => {
      // Broadcast to WebSocket clients
      wsServerManager.broadcast(jsonData, sourceId);

      // Log to remote database if enabled
      try {
        await remoteDbManager.logCommand(sourceId, message);
      } catch (err) {
        // Don't spam logs for logging errors
      }
    });
    console.log("[TCP] Data callback registered");

    // NOW load sources - they will have the callback already set
    await loadSourcesFromDatabase();
    await loadApiKeysFromDatabase();

    isRunning = true;
    console.log("");
    console.log("Service started successfully!");
    console.log("- Management API: http://localhost:" + config.managementApiPort);
    for (const server of wsServerManager.getAllServersStatus()) {
      console.log(`- WS Server "${server.name}": ws://localhost:${server.port} (${server.clientCount} clients)`);
    }
    console.log("");

    // Graceful shutdown handlers
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (err) {
    console.error("Failed to start service:", err);
    process.exit(1);
  }
}

/**
 * Start Management API server
 */
function startManagementApi(): Promise<void> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      handleApiRequest(req, res).catch((err) => {
        console.error("[API] Error:", err);
        res.writeHead(500);
        res.end("Internal Server Error");
      });
    });

    server.on("error", reject);
    server.listen(config.managementApiPort, () => resolve());
  });
}

/**
 * Graceful shutdown
 */
async function shutdown(): Promise<void> {
  if (!isRunning) return;

  console.log("");
  console.log("Shutting down...");

  isRunning = false;

  // Stop WebSocket servers
  wsServerManager.stop();

  // Disconnect all TCP sources
  for (const state of tcpClientManager.getStates()) {
    tcpClientManager.disconnect(state.sourceId);
  }

  // Close remote database connections
  await remoteDbManager.close();

  // Disconnect from database
  await closePrisma();

  console.log("Service stopped.");
  process.exit(0);
}

// Start the service
start();
