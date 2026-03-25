/**
 * Role by ID API Routes
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const CONVERTER_API_URL = process.env.CONVERTER_API_URL || "http://localhost:50004";

/**
 * Notify converter service about role update
 */
async function notifyConverterRoleUpdate(roleId: string, updates: {
  name?: string;
  allowedCommands?: string;
  canSend?: boolean;
  canReceive?: boolean;
  maxConnections?: number;
}) {
  try {
    const allowedCommands = updates.allowedCommands === "all" 
      ? "all" 
      : (updates.allowedCommands || "").split(",").filter(Boolean);

    await fetch(`${CONVERTER_API_URL}/api/roles/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roleId,
        roleName: updates.name,
        allowedCommands,
        canSend: updates.canSend,
        canReceive: updates.canReceive,
        maxConnections: updates.maxConnections,
      }),
    });
  } catch (error) {
    console.error("[Roles API] Failed to notify converter:", error);
  }
}

// GET - Get single role
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const role = await db.wsClientRole.findUnique({
      where: { id },
      include: {
        apiKeys: true,
      },
    });

    if (!role) {
      return NextResponse.json({ success: false, error: "Role not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: role });
  } catch (error) {
    console.error("Error fetching role:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch role" },
      { status: 500 }
    );
  }
}

// PUT - Update role
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();

    const role = await db.wsClientRole.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        canSend: body.canSend,
        canReceive: body.canReceive,
        allowedCommands: body.allowedCommands,
        maxConnections: body.maxConnections,
        rateLimit: body.rateLimit,
        isDefault: body.isDefault,
      },
    });

    // Notify converter service to update connected clients with this role
    await notifyConverterRoleUpdate(id, {
      name: role.name,
      allowedCommands: role.allowedCommands,
      canSend: role.canSend,
      canReceive: role.canReceive,
      maxConnections: role.maxConnections,
    });

    return NextResponse.json({ success: true, data: role });
  } catch (error) {
    console.error("Error updating role:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update role" },
      { status: 500 }
    );
  }
}

// DELETE - Delete role
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await db.wsClientRole.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Role deleted" });
  } catch (error) {
    console.error("Error deleting role:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete role" },
      { status: 500 }
    );
  }
}
