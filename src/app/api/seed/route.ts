/**
 * Seed initial admin user
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

export async function GET() {
  try {
    // Check if admin already exists
    const existingAdmin = await db.adminUser.findFirst();

    if (existingAdmin) {
      return NextResponse.json({
        success: true,
        message: "Admin user already exists",
        user: { email: existingAdmin.email, name: existingAdmin.name },
      });
    }

    // Create default admin
    const { hash, salt } = hashPassword("admin");

    const admin = await db.adminUser.create({
      data: {
        email: "admin@rmonitor.local",
        name: "Administrator",
        passwordHash: `${salt}:${hash}`,
        role: "superadmin",
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Default admin created",
      user: { email: admin.email, name: admin.name },
      defaultPassword: "admin",
    });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create admin user" },
      { status: 500 }
    );
  }
}
