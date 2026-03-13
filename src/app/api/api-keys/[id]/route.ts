/**
 * API Key by ID Routes
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { wsApi } from "@/lib/services/converter-service";

// DELETE - Delete API key
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Get the key before deleting
    const apiKey = await db.apiKey.findUnique({
      where: { id },
    });

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "API key not found" },
        { status: 404 }
      );
    }

    await db.apiKey.delete({
      where: { id },
    });

    // Notify converter service to remove the key
    await wsApi.removeApiKey(apiKey.key);

    return NextResponse.json({ success: true, message: "API key deleted" });
  } catch (error) {
    console.error("Error deleting API key:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete API key" },
      { status: 500 }
    );
  }
}

// PUT - Update API key
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();

    const apiKey = await db.apiKey.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        isActive: body.isActive,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      },
      include: {
        role: true,
      },
    });

    // Notify converter service about the update
    if (apiKey.isActive && apiKey.role) {
      // Register/update the key
      await wsApi.registerApiKey({
        apiKey: apiKey.key,
        roleId: apiKey.roleId,
        roleName: apiKey.role.name,
        allowedCommands: apiKey.role.allowedCommands === "all" ? "all" : apiKey.role.allowedCommands.split(","),
        canSend: apiKey.role.canSend,
        canReceive: apiKey.role.canReceive,
      });
    } else {
      // Remove the key if deactivated
      await wsApi.removeApiKey(apiKey.key);
    }

    return NextResponse.json({ success: true, data: apiKey });
  } catch (error) {
    console.error("Error updating API key:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update API key" },
      { status: 500 }
    );
  }
}
