/**
 * TCP Sources API Routes
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const CONVERTER_API_PORT = 50004;

// Notify converter service about source changes
async function notifyConverter(action: "add" | "remove" | "update", source: { id: string; name: string; host: string; port: number; isEnabled?: boolean; autoReconnect?: boolean; reconnectDelay?: number; sendEnabled?: boolean; trustedOnly?: boolean }) {
  try {
    if (action === "add") {
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

// GET - List all TCP sources
export async function GET() {
  try {
    const sources = await db.tcpSource.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        trustedSources: true,
        _count: {
          select: { wsServerMappings: true },
        },
      },
    });

    return NextResponse.json({ success: true, data: sources });
  } catch (error) {
    console.error("Error fetching TCP sources:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch TCP sources" },
      { status: 500 }
    );
  }
}

// POST - Create new TCP source
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const source = await db.tcpSource.create({
      data: {
        name: body.name,
        host: body.host,
        port: body.port,
        isEnabled: body.isEnabled ?? true,
        autoReconnect: body.autoReconnect ?? true,
        reconnectDelay: body.reconnectDelay ?? 5000,
        sendEnabled: body.sendEnabled ?? false,
        trustedOnly: body.trustedOnly ?? false,
        description: body.description,
      },
    });

    // Notify converter service
    await notifyConverter("add", {
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
    console.error("Error creating TCP source:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create TCP source" },
      { status: 500 }
    );
  }
}
