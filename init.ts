#!/usr/bin/env bun
/**
 * RMonitor Converter - Initializer
 * Запустите этот скрипт после установки приложения для инициализации базы данных
 * и создания администратора по умолчанию.
 * 
 * Usage: 
 *   bun run init.ts              - Interactive mode
 *   bun run init.ts --defaults   - Use default values (non-interactive)
 */

import * as readline from "readline";
import * as fs from "fs";
import * as path from "path";

// ============================================
// Configuration
// ============================================

const DEFAULT_ADMIN_EMAIL = "admin@rmonitor.local";
const DEFAULT_ADMIN_PASSWORD = "admin";
const DEFAULT_ADMIN_NAME = "Administrator";

// Parse command line args
const args = process.argv.slice(2);
const useDefaults = args.includes("--defaults") || args.includes("-d") || args.includes("--non-interactive");

// ============================================
// Utilities
// ============================================

function question(rl: readline.ReadLine, prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer.trim());
    });
  });
}

function log(message: string, type: "info" | "success" | "error" | "warn" = "info") {
  const colors = {
    info: "\x1b[36m",
    success: "\x1b[32m",
    error: "\x1b[31m",
    warn: "\x1b[33m",
  };
  const reset = "\x1b[0m";
  console.log(`${colors[type]}${message}${reset}`);
}

function runCommand(cmd: string[], cwd?: string): { success: boolean; output: string } {
  try {
    const result = Bun.spawnSync(cmd, {
      cwd: cwd || process.cwd(),
      stdout: "pipe",
      stderr: "pipe",
    });

    const stdout = result.stdout?.toString() || "";
    const stderr = result.stderr?.toString() || "";
    const output = stdout + stderr;
    return { success: result.exitCode === 0, output };
  } catch (error) {
    return { success: false, output: String(error) };
  }
}

// ============================================
// Initialization Steps
// ============================================

async function checkPrerequisites(): Promise<boolean> {
  log("\n📋 Checking prerequisites...", "info");

  // Check if .env exists
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) {
    log("⚠️  .env file not found, creating default...", "warn");
    fs.writeFileSync(envPath, `DATABASE_URL="file:./db/custom.db"\n`);
    log("✅ Created .env with default database path", "success");
  }

  // Check if prisma schema exists
  const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");
  if (!fs.existsSync(schemaPath)) {
    log("❌ Prisma schema not found!", "error");
    return false;
  }

  // Ensure db directory exists
  const dbDir = path.join(process.cwd(), "db");
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    log("✅ Created database directory", "success");
  }

  log("✅ Prerequisites check passed", "success");
  return true;
}

async function installDependencies(): Promise<boolean> {
  log("\n📚 Installing dependencies...", "info");

  // Main project
  log("🔄 Installing main project dependencies...", "info");
  const mainResult = runCommand(["bun", "install"]);

  if (!mainResult.success) {
    log("❌ Failed to install main dependencies", "error");
    console.log(mainResult.output);
    return false;
  }
  log("✅ Main dependencies installed", "success");

  // Converter service
  const converterPath = path.join(process.cwd(), "mini-services", "converter-service");
  if (fs.existsSync(converterPath)) {
    log("🔄 Installing converter service dependencies...", "info");
    const converterResult = runCommand(["bun", "install"], converterPath);

    if (converterResult.success) {
      log("✅ Converter service dependencies installed", "success");
    } else {
      log("⚠️  Converter service install warning", "warn");
    }
  }

  return true;
}

async function setupDatabase(): Promise<boolean> {
  log("\n📦 Setting up database...", "info");

  // Generate Prisma client
  log("🔄 Generating Prisma client...", "info");
  const genResult = runCommand(["bun", "run", "db:generate"]);

  if (!genResult.success) {
    log("⚠️  Prisma generate warning (may be OK)", "warn");
  } else {
    log("✅ Prisma client generated", "success");
  }

  // Push schema to database
  log("🔄 Creating database tables...", "info");
  const pushResult = runCommand(["bun", "run", "db:push"]);

  if (!pushResult.success) {
    log("❌ Failed to setup database", "error");
    console.log(pushResult.output);
    return false;
  }

  log("✅ Database tables created", "success");
  return true;
}

async function createAdminUser(rl?: readline.ReadLine): Promise<void> {
  log("\n🔐 Setting up administrator account...", "info");

  // Dynamic import of Prisma
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  try {
    // Check if admin already exists
    const existingAdmin = await prisma.adminUser.findFirst();
    if (existingAdmin) {
      log("✅ Administrator already exists", "success");
      log(`   Email: ${existingAdmin.email}`, "info");
      return;
    }

    let finalEmail = DEFAULT_ADMIN_EMAIL;
    let finalName = DEFAULT_ADMIN_NAME;
    let finalPassword = DEFAULT_ADMIN_PASSWORD;

    // Interactive mode
    if (rl && !useDefaults) {
      log("\nPlease provide administrator credentials:", "info");
      log("(Press Enter to use defaults)\n", "info");

      const email = await question(rl, `Email [${DEFAULT_ADMIN_EMAIL}]: `);
      const name = await question(rl, `Name [${DEFAULT_ADMIN_NAME}]: `);
      const password = await question(rl, `Password [${DEFAULT_ADMIN_PASSWORD}]: `);

      finalEmail = email || DEFAULT_ADMIN_EMAIL;
      finalName = name || DEFAULT_ADMIN_NAME;
      finalPassword = password || DEFAULT_ADMIN_PASSWORD;
    } else {
      log("Using default credentials (--defaults mode)", "info");
    }

    // Generate salt first
    const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Hash password + salt (must match auth route logic)
    const encoder = new TextEncoder();
    const data = encoder.encode(finalPassword + salt);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    // Create admin
    await prisma.adminUser.create({
      data: {
        email: finalEmail,
        name: finalName,
        passwordHash: `${salt}:${hash}`,
        role: "superadmin",
        isActive: true,
      },
    });

    log("\n✅ Administrator created successfully!", "success");
    log(`   Email: ${finalEmail}`, "info");
    log(`   Password: ${"*".repeat(finalPassword.length)}`, "info");
    log("\n⚠️  Please save these credentials securely!", "warn");
  } finally {
    await prisma.$disconnect();
  }
}

async function createDefaultRole(): Promise<void> {
  log("\n👤 Creating default role...", "info");

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  try {
    const existingRole = await prisma.wsClientRole.findFirst({
      where: { isDefault: true },
    });

    if (existingRole) {
      log("✅ Default role already exists", "success");
      return;
    }

    await prisma.wsClientRole.create({
      data: {
        name: "default",
        description: "Default role for WebSocket clients",
        canSend: false,
        canReceive: true,
        allowedCommands: "all",
        maxConnections: 10,
        rateLimit: 100,
        isDefault: true,
      },
    });

    log("✅ Created default role", "success");
  } finally {
    await prisma.$disconnect();
  }
}

// ============================================
// Main
// ============================================

async function main() {
  console.log("\n" + "=".repeat(60));
  console.log("  RMonitor Converter - Initializer");
  console.log("=".repeat(60) + "\n");

  if (useDefaults) {
    log("Running in non-interactive mode (--defaults)", "info");
  }

  let rl: readline.ReadLine | undefined;

  if (!useDefaults) {
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  try {
    // Step 1: Prerequisites
    if (!(await checkPrerequisites())) {
      process.exit(1);
    }

    // Step 2: Install dependencies
    if (!(await installDependencies())) {
      process.exit(1);
    }

    // Step 3: Setup database
    if (!(await setupDatabase())) {
      process.exit(1);
    }

    // Step 4: Create default role
    await createDefaultRole();

    // Step 5: Create admin user
    await createAdminUser(rl);

    // Done
    console.log("\n" + "=".repeat(60));
    log("🎉 Initialization complete!", "success");
    console.log("=".repeat(60) + "\n");

    log("Next steps:", "info");
    log("  1. Start the converter service:", "info");
    log("     cd mini-services/converter-service && bun run dev &", "info");
    log("", "info");
    log("  2. Start the web panel:", "info");
    log("     bun run dev", "info");
    log("", "info");
    log("  3. Open http://localhost:3000 in your browser", "info");
    log("", "info");
    log("  4. Login with your administrator credentials", "info");
  } catch (error) {
    log("\n❌ Initialization failed!", "error");
    console.error(error);
    process.exit(1);
  } finally {
    rl?.close();
  }
}

main();
