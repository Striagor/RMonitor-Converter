/**
 * RMonitor Protocol Types
 * Types for parsing and handling RMonitor TCP protocol
 */

// RMonitor protocol constants
export const RMONITOR_SOR = 0x24; // $ - Start of record
export const RMONITOR_SEP = 0x2c; // , - Field separator
export const RMONITOR_EOR = "\r\n"; // CR/LF - End of record

// Parsed RMonitor message
export interface RMonitorMessage {
  command: string;
  fields: string[];
  raw: string;
}

// TCP Source configuration
export interface TcpSourceConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  isEnabled: boolean;
  autoReconnect: boolean;
  reconnectDelay: number;
  sendEnabled: boolean;
  trustedOnly: boolean;
}

// TCP Connection state
export interface TcpConnectionState {
  sourceId: string;
  status: "connected" | "disconnected" | "connecting" | "error";
  lastConnectedAt?: Date;
  error?: string;
  reconnectAttempts: number;
}

// WebSocket Server configuration
export interface WsServerConfig {
  id: string;
  name: string;
  port: number;
  isEnabled: boolean;
  useSSL: boolean;
  sslCertPath?: string;
  sslKeyPath?: string;
  maxClients: number;
  heartbeatInterval: number;
}

// WebSocket Server state
export interface WsServerState {
  serverId: string;
  status: "running" | "stopped" | "error";
  clientCount: number;
  error?: string;
}

// Role permissions
export interface RolePermissions {
  id: string;
  name: string;
  canSend: boolean;
  canReceive: boolean;
  allowedCommands: string[] | "all";
  maxConnections: number;
  rateLimit: number;
}

// Cache entry
export interface CacheEntry {
  command: string;
  key: string; // Unique key for deduplication
  message: string; // WebJSON string
  timestamp: Date;
}

// Converter statistics
export interface ConverterStats {
  tcpConnections: number;
  wsConnections: number;
  messagesReceived: number;
  messagesSent: number;
  messagesDropped: number;
  conversionErrors: number;
  uptime: number;
}

// Management API types
export interface ManagementApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}
