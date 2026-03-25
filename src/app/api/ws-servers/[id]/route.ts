/**
 * WS Server by ID API Routes
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
      await fetch(`${CONVERTER_API_URL}/api/ws/servers/${server.id}`, {
        method: "DELETE",
      });
    }
  } catch (error) {
    console.error("[WS API] Failed to notify converter:", error);
  }
}

// GET - Get single WS server
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const server = await db.wsServer.findUnique({
      where: { id },
      include: {
        tcpMappings: {
          include: {
            tcpSource: true,
          },
        },
      },
    });

    if (!server) {
      return NextResponse.json(
        { success: false, error: "WS server not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: server });
  } catch (error) {
    console.error("Error fetching WS server:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch WS server" },
      { status: 500 }
    );
  }
}

// PUT - Update WS server
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();

    // Get the old server to check if we need to stop it
    const oldServer = await db.wsServer.findUnique({ where: { id } });

    const server = await db.wsServer.update({
      where: { id },
      data: {
        name: body.name,
        port: body.port,
        isEnabled: body.isEnabled,
        useSSL: body.useSSL,
        sslCertPath: body.sslCertPath,
        sslKeyPath: body.sslKeyPath,
        maxClients: body.maxClients,
        heartbeatInterval: body.heartbeatInterval,
        description: body.description,
      },
    });

    // If port changed or SSL settings changed, stop old and start new
    if (oldServer && (oldServer.port !== server.port || oldServer.useSSL !== server.useSSL)) {
      // Stop old server (by id which corresponds to old port)
      await notifyConverter("delete", { ...oldServer, sslCertPath: oldServer.sslCertPath, sslKeyPath: oldServer.sslKeyPath });
    }

    // Notify converter about the change
    if (server.isEnabled) {
      await notifyConverter("update", server);
    } else {
      // If disabled, stop it
      await notifyConverter("delete", server);
    }

    return NextResponse.json({ success: true, data: server });
  } catch (error) {
    console.error("Error updating WS server:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update WS server" },
      { status: 500 }
    );
  }
}

// DELETE - Delete WS server
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Get server info before deleting
    const server = await db.wsServer.findUnique({ where: { id } });

    await db.wsServer.delete({
      where: { id },
    });

    // Notify converter to stop the server
    if (server) {
      await notifyConverter("delete", server);
    }

    return NextResponse.json({ success: true, message: "WS server deleted" });
  } catch (error) {
    console.error("Error deleting WS server:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete WS server" },
      { status: 500 }
    );
  }
}
