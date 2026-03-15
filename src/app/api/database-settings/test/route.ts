/**
 * Database Connection Test API
 */

import { NextRequest, NextResponse } from "next/server";

interface TestResult {
  success: boolean;
  message: string;
  tablesFound?: string[];
  rmonitorTablesFound?: string[];
  error?: string;
}

async function testMySQL(config: {
  host: string;
  port: string;
  database: string;
  user: string;
  password: string;
}): Promise<TestResult> {
  const mysql = await import("mysql2/promise");

  let connection;
  try {
    connection = await mysql.createConnection({
      host: config.host,
      port: parseInt(config.port) || 3306,
      database: config.database,
      user: config.user,
      password: config.password,
      connectTimeout: 10000,
    });

    // Get all tables
    const [tables] = await connection.execute(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?",
      [config.database]
    );

    const tableNames = (tables as { TABLE_NAME: string }[]).map((t) => t.TABLE_NAME);

    // Check for RMonitor tables (RMonitor_*)
    const rmonitorTables = tableNames.filter((t) => t.startsWith("RMonitor_"));

    await connection.end();

    return {
      success: true,
      message: `Connected successfully! Found ${tableNames.length} tables.`,
      tablesFound: tableNames.slice(0, 20), // Limit to first 20
      rmonitorTablesFound: rmonitorTables,
    };
  } catch (error) {
    if (connection) {
      try {
        await connection.end();
      } catch {}
    }
    throw error;
  }
}

async function testPostgreSQL(config: {
  host: string;
  port: string;
  database: string;
  user: string;
  password: string;
}): Promise<TestResult> {
  const { Client } = await import("pg");

  const client = new Client({
    host: config.host,
    port: parseInt(config.port) || 5432,
    database: config.database,
    user: config.user,
    password: config.password,
    connectionTimeoutMillis: 10000,
  });

  try {
    await client.connect();

    // Get all tables
    const result = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
    );

    const tableNames = result.rows.map((r) => r.table_name);

    // Check for RMonitor tables (RMonitor_*)
    const rmonitorTables = tableNames.filter((t) => t.startsWith("RMonitor_"));

    await client.end();

    return {
      success: true,
      message: `Connected successfully! Found ${tableNames.length} tables.`,
      tablesFound: tableNames.slice(0, 20),
      rmonitorTablesFound: rmonitorTables,
    };
  } catch (error) {
    try {
      await client.end();
    } catch {}
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      type,
      host,
      port,
      database,
      user,
      password,
    } = body;

    if (!host || !database) {
      return NextResponse.json(
        { success: false, error: "Host and database name are required" },
        { status: 400 }
      );
    }

    const config = {
      host,
      port: port || (type === "postgresql" ? "5432" : "3306"),
      database,
      user: user || "",
      password: password || "",
    };

    let result: TestResult;

    if (type === "postgresql") {
      result = await testPostgreSQL(config);
    } else {
      result = await testMySQL(config);
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("Database connection test failed:", error);

    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        success: false,
        error: `Connection failed: ${errorMessage}`,
      },
      { status: 200 } // Return 200 but with success: false
    );
  }
}
