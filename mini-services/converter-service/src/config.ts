/**
 * Converter Service Configuration
 */

export const config = {
  // Service ports
  tcpWsPort: 50003, // TCP client + WS server port
  managementApiPort: 50004, // Management API port

  // TCP settings
  tcpReconnectDelay: 5000,
  tcpMaxReconnectAttempts: 100,

  // WebSocket settings
  wsHeartbeatInterval: 30000,
  wsMaxClients: 100,

  // Cache settings
  cacheMaxAge: 3600000, // 1 hour in ms

  // Database
  databasePath: "../../../db/custom.db",

  // Logging
  logLevel: "info", // "debug", "info", "warn", "error"
};

export type Config = typeof config;
