/**
 * Converter Service API Client
 * Communication with the converter mini-service
 */

const CONVERTER_API_URL = process.env.CONVERTER_API_URL || "http://localhost:50004";

/**
 * Fetch from converter service (server-side)
 * Uses direct URL to converter service
 */
export async function fetchConverterApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; error?: string }> {
  const url = `${CONVERTER_API_URL}/api/${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      signal: AbortSignal.timeout(5000),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Converter API error:", error);
    return { success: false, error: "Failed to connect to converter service" };
  }
}

// TCP Sources API
export const tcpSourcesApi = {
  list: () => fetchConverterApi<{ sourceId: string; status: string }[]>("tcp/sources"),

  add: (config: {
    id: string;
    name: string;
    host: string;
    port: number;
    isEnabled?: boolean;
    autoReconnect?: boolean;
    reconnectDelay?: number;
    sendEnabled?: boolean;
    trustedOnly?: boolean;
  }) =>
    fetchConverterApi<{ message: string }>("tcp/sources", {
      method: "POST",
      body: JSON.stringify(config),
    }),

  connect: (id: string) =>
    fetchConverterApi<{ message: string }>(`tcp/sources/${id}/connect`, { method: "POST" }),

  disconnect: (id: string) =>
    fetchConverterApi<{ message: string }>(`tcp/sources/${id}/disconnect`, { method: "POST" }),

  remove: (id: string) =>
    fetchConverterApi<{ message: string }>(`tcp/sources/${id}`, { method: "DELETE" }),
};

// WebSocket API
export const wsApi = {
  status: () =>
    fetchConverterApi<{ clientCount: number; clients: unknown[] }>("ws/status"),

  registerApiKey: (data: {
    apiKey: string;
    roleId: string;
    roleName: string;
    allowedCommands: string[] | "all";
    canSend: boolean;
    canReceive: boolean;
  }) =>
    fetchConverterApi<{ message: string }>("ws/apikeys", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  removeApiKey: (key: string) =>
    fetchConverterApi<{ message: string }>(`ws/apikeys/${key}`, { method: "DELETE" }),
};

// Cache API
export const cacheApi = {
  stats: () => fetchConverterApi<Record<string, number>>("cache/stats"),
  clear: () => fetchConverterApi<{ message: string }>("cache/clear", { method: "POST" }),
};

// Health API
export const healthApi = {
  check: () => fetchConverterApi<{ status: string }>("health"),
};
