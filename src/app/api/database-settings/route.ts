/**
 * Database Settings API Routes
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const CONVERTER_API_URL = process.env.CONVERTER_API_URL || "http://localhost:50004";

/**
 * Notify converter service to reload remote DB settings
 */
async function notifyConverterReload() {
  try {
    await fetch(`${CONVERTER_API_URL}/api/remote-db/reload`, {
      method: "POST",
    });
  } catch (error) {
    console.error("[DB Settings] Failed to notify converter:", error);
  }
}

// GET - Get database settings
export async function GET() {
  try {
    const settings = await db.converterSettings.findMany();
    const settingsMap: Record<string, string> = {};

    for (const setting of settings) {
      settingsMap[setting.key] = setting.value;
    }

    return NextResponse.json({
      success: true,
      data: {
        // Remote database connection
        useRemoteDb: settingsMap.useRemoteDb === "true",
        remoteDbType: settingsMap.remoteDbType || "mysql",
        remoteDbHost: settingsMap.remoteDbHost || "",
        remoteDbPort: settingsMap.remoteDbPort || "3306",
        remoteDbName: settingsMap.remoteDbName || "",
        remoteDbUser: settingsMap.remoteDbUser || "",
        remoteDbPassword: settingsMap.remoteDbPassword || "",
        remoteDbPoolSize: settingsMap.remoteDbPoolSize || "10",
        remoteDbOfflineCacheSizeMb: settingsMap.remoteDbOfflineCacheSizeMb || "10",

        // Logging settings
        logCommands: settingsMap.logCommands === "true",
        loggedCommands: settingsMap.loggedCommands || "all",
      },
    });
  } catch (error) {
    console.error("Error fetching database settings:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch database settings" },
      { status: 500 }
    );
  }
}

// POST - Update database settings
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const settings = [
      { key: "useRemoteDb", value: body.useRemoteDb ? "true" : "false" },
      { key: "remoteDbType", value: body.remoteDbType || "mysql" },
      { key: "remoteDbHost", value: body.remoteDbHost || "" },
      { key: "remoteDbPort", value: body.remoteDbPort || "3306" },
      { key: "remoteDbName", value: body.remoteDbName || "" },
      { key: "remoteDbUser", value: body.remoteDbUser || "" },
      { key: "remoteDbPassword", value: body.remoteDbPassword || "" },
      { key: "remoteDbPoolSize", value: body.remoteDbPoolSize || "10" },
      { key: "remoteDbOfflineCacheSizeMb", value: String(Math.min(20, Math.max(1, parseInt(body.remoteDbOfflineCacheSizeMb) || 10))) },
      { key: "logCommands", value: body.logCommands ? "true" : "false" },
      { key: "loggedCommands", value: body.loggedCommands || "all" },
    ];

    for (const setting of settings) {
      await db.converterSettings.upsert({
        where: { key: setting.key },
        update: { value: setting.value },
        create: { key: setting.key, value: setting.value },
      });
    }

    // Notify converter service to reload settings
    await notifyConverterReload();

    return NextResponse.json({ success: true, message: "Settings saved and converter notified" });
  } catch (error) {
    console.error("Error saving database settings:", error);
    return NextResponse.json(
      { success: false, error: "Failed to save database settings" },
      { status: 500 }
    );
  }
}
