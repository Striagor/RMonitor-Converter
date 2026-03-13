/**
 * TCP Source by ID API Routes
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const CONVERTER_API_PORT = 50004;

// Notify converter service about source changes
async function notifyConverter(action: "add" | "remove" | "update", source: { id: string; name: string; host: string; port: number; isEnabled?: boolean; autoReconnect?: boolean; reconnectDelay?: number; sendEnabled?: boolean; trustedOnly?: boolean }) {
  try {
    if (action === "add" || action === "update") {
      await fetch(`http://localhost:${CONVERTER_API_PORT}/api/tcp/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(source),
        signal: AbortSignal.timeout(3000),
      });
    } else if (action === "remove") {
      await fetch(`http://localhost:${CONVERTER_API_PORT}/api/tcp/sources/${source.id}`, {
        method: "DELETE",
        signal: AbortSignal.timeout(3000),
      });
    }
  } catch {
    // Converter service might not be running, that's OK
    console.log("[API] Converter service not available for notification");
  }
}

// GET - Get single TCP source
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const source = await db.tcpSource.findUnique({
      where: { id },
      include: {
        trustedSources: true,
        wsServerMappings: {
          include: {
            wsServer: true,
          },
        },
      },
    });

    if (!source) {
      return NextResponse.json(
        { success: false, error: "TCP source not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: source });
  } catch (error) {
    console.error("Error fetching TCP source:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch TCP source" },
      { status: 500 }
    );
  }
}

// PUT - Update TCP source
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();

    const source = await db.tcpSource.update({
      where: { id },
      data: {
        name: body.name,
        host: body.host,
        port: body.port,
        isEnabled: body.isEnabled,
        autoReconnect: body.autoReconnect,
        reconnectDelay: body.reconnectDelay,
        sendEnabled: body.sendEnabled,
        trustedOnly: body.trustedOnly,
        description: body.description,
      },
    });

    // Notify converter service about the update
    await notifyConverter("update", {
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

    return NextResponse.json({ success: true, data: source });
  } catch (error) {
    console.error("Error updating TCP source:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update TCP source" },
      { status: 500 }
    );
  }
}

// DELETE - Delete TCP source
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Get source info before deleting
    const source = await db.tcpSource.findUnique({
      where: { id },
    });

    await db.tcpSource.delete({
      where: { id },
    });

    // Notify converter service about the deletion
    if (source) {
      await notifyConverter("remove", {
        id: source.id,
        name: source.name,
        host: source.host,
        port: source.port,
      });
    }

    return NextResponse.json({ success: true, message: "TCP source deleted" });
  } catch (error) {
    console.error("Error deleting TCP source:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete TCP source" },
      { status: 500 }
    );
  }
}
