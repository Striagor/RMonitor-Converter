/**
 * API Keys Routes
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { randomUUID } from "crypto";
import { wsApi } from "@/lib/services/converter-service";

// GET - List all API keys
export async function GET() {
  try {
    const keys = await db.apiKey.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        role: true,
      },
    });

    return NextResponse.json({ success: true, data: keys });
  } catch (error) {
    console.error("Error fetching API keys:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch API keys" },
      { status: 500 }
    );
  }
}

// POST - Create new API key
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Generate API key if not provided
    const key = body.key || `rm_${randomUUID().replace(/-/g, "")}`;

    const apiKey = await db.apiKey.create({
      data: {
        key,
        name: body.name,
        description: body.description,
        roleId: body.roleId,
        isActive: body.isActive ?? true,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      },
      include: {
        role: true,
      },
    });

    // Notify converter service about new API key
    if (apiKey.isActive && apiKey.role) {
      try {
        await wsApi.registerApiKey({
          apiKey: apiKey.key,
          roleId: apiKey.roleId,
          roleName: apiKey.role.name,
          allowedCommands: apiKey.role.allowedCommands === "all" ? "all" : apiKey.role.allowedCommands.split(","),
          canSend: apiKey.role.canSend,
          canReceive: apiKey.role.canReceive,
        });
      } catch (err) {
        console.error("[API Keys] Failed to notify converter:", err);
        // Continue even if converter notification fails
      }
    }

    return NextResponse.json({ success: true, data: apiKey });
  } catch (error) {
    console.error("Error creating API key:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create API key" },
      { status: 500 }
    );
  }
}
