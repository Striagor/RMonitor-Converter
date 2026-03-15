/**
 * Roles API Routes
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET - List all roles
export async function GET() {
  try {
    const roles = await db.wsClientRole.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { apiKeys: true },
        },
      },
    });

    return NextResponse.json({ success: true, data: roles });
  } catch (error) {
    console.error("Error fetching roles:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch roles" },
      { status: 500 }
    );
  }
}

// POST - Create new role
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const role = await db.wsClientRole.create({
      data: {
        name: body.name,
        description: body.description,
        canSend: body.canSend ?? false,
        canReceive: body.canReceive ?? true,
        allowedCommands: body.allowedCommands ?? "all",
        maxConnections: body.maxConnections ?? 10,
        rateLimit: body.rateLimit ?? 100,
        isDefault: body.isDefault ?? false,
      },
    });

    return NextResponse.json({ success: true, data: role });
  } catch (error) {
    console.error("Error creating role:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create role" },
      { status: 500 }
    );
  }
}
