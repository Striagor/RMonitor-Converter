/**
 * WS Servers API Routes
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const CONVERTER_API_URL = process.env.CONVERTER_API_URL || "http://localhost:50004";

/**
 * Notify converter service about WS server changes
 */
async function notifyConverter(
  action: "create" | "update" | "delete",
  server: {
    id: string;
    name: string;
    port: number;
    isEnabled: boolean;
    useSSL: boolean;
    sslCertPath?: string | null;
    sslKeyPath?: string | null;
    maxClients: number;
    heartbeatInterval: number;
  }
) {
  try {
    if (action === "create" || action === "update") {
      // Create or start server in converter
      await fetch(`${CONVERTER_API_URL}/api/ws/servers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: server.id,
          name: server.name,
          port: server.port,
          isEnabled: server.isEnabled,
          useSSL: server.useSSL,
          sslCertPath: server.sslCertPath,
          sslKeyPath: server.sslKeyPath,
          maxClients: server.maxClients,
          heartbeatInterval: server.heartbeatInterval,
          tcpMappings: [],
        }),
      });
    } else if (action === "delete") {
      // Stop server in converter
      await fetch(`${CONVERTER_API_URL}/api/ws/servers/${server.id}`, {
        method: "DELETE",
      });
    }
  } catch (error) {
    console.error("[WS API] Failed to notify converter:", error);
  }
}

// GET - List all WS servers
export async function GET() {
  try {
    const servers = await db.wsServer.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        tcpMappings: {
          include: {
            tcpSource: true,
          },
        },
        _count: {
          select: { tcpMappings: true },
        },
      },
    });

    return NextResponse.json({ success: true, data: servers });
  } catch (error) {
    console.error("Error fetching WS servers:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch WS servers" },
      { status: 500 }
    );
  }
}

// POST - Create new WS server
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const server = await db.wsServer.create({
      data: {
        name: body.name,
        port: body.port,
        isEnabled: body.isEnabled ?? true,
        useSSL: body.useSSL ?? false,
        sslCertPath: body.sslCertPath,
        sslKeyPath: body.sslKeyPath,
        maxClients: body.maxClients ?? 100,
        heartbeatInterval: body.heartbeatInterval ?? 30000,
        description: body.description,
      },
    });

    // Notify converter service if server is enabled
    if (server.isEnabled) {
      await notifyConverter("create", server);
    }

    return NextResponse.json({ success: true, data: server });
  } catch (error) {
    console.error("Error creating WS server:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create WS server" },
      { status: 500 }
    );
  }
}
