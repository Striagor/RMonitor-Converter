/**
 * Types for Converter Service
 * Re-exporting from shared types and adding service-specific types
 */

// Re-export shared types
export type {
  WebJsonMessage,
  WebJsonMessageId,
  WebJsonMessage_I,
  WebJsonMessage_E,
  WebJsonMessage_B,
  WebJsonMessage_C,
  WebJsonMessage_A,
  WebJsonMessage_COMP,
  WebJsonMessage_G,
  WebJsonMessage_H,
  WebJsonMessage_J,
  WebJsonMessage_F,
  WebJsonMessage_DPD,
  WebJsonMessage_DPF,
  WebJsonMessage_DSI,
  WsMessageWrapper,
  WsClientInfo,
  RMonitorMessage,
  TcpSourceConfig,
  TcpConnectionState,
  WsServerConfig,
  WsServerState,
  RolePermissions,
  CacheEntry,
  ConverterStats,
  ManagementApiResponse,
} from "./shared/types";

export { ALL_COMMAND_IDS } from "./shared/types";

// Service-specific types
export interface ServiceState {
  isRunning: boolean;
  startTime: Date;
  tcpConnections: Map<string, TcpConnectionState>;
  wsClients: Map<string, WsClientInfo>;
  stats: ConverterStats;
}

export interface TcpClient {
  id: string;
  sourceId: string;
  config: TcpSourceConfig;
  socket: unknown;
  parser: unknown;
  isConnected: boolean;
  reconnectAttempts: number;
}

export interface WsClient {
  id: string;
  ws: unknown;
  clientInfo: WsClientInfo;
  lastPing: Date;
  messageCount: number;
}

export interface CachedMessage {
  command: string;
  key: string;
  data: string; // JSON string
  timestamp: Date;
}
