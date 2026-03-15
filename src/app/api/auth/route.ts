/**
 * Auth API Routes
 * Login, Logout, Session
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { randomBytes, createHash } from "crypto";

// Session expiry time (24 hours)
const SESSION_EXPIRY = 24 * 60 * 60 * 1000;

// Hash password with salt
function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const passwordSalt = salt || randomBytes(16).toString("hex");
  const hash = createHash("sha256")
    .update(password + passwordSalt)
    .digest("hex");
  return { hash, salt: passwordSalt };
}

// Verify password
function verifyPassword(password: string, hash: string, salt: string): boolean {
  const { hash: newHash } = hashPassword(password, salt);
  return newHash === hash;
}

// Generate session token
function generateSessionToken(
  userId: string,
  email: string,
  name: string,
  role: string
): string {
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY);
  const sessionData = JSON.stringify({
    userId,
    email,
    name,
    role,
    expiresAt: expiresAt.toISOString(),
  });
  return Buffer.from(sessionData).toString("base64");
}

// Parse session from token
function parseSession(token: string): {
  userId: string;
  email: string;
  name: string;
  role: string;
  expiresAt: string;
} | null {
  try {
    return JSON.parse(Buffer.from(token, "base64").toString("utf-8"));
  } catch {
    return null;
  }
}

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Cookie",
  "Access-Control-Allow-Credentials": "true",
};

// Handle OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

// GET - Check session status
export async function GET(request: NextRequest) {
  const sessionToken = request.cookies.get("session_token")?.value;

  if (!sessionToken) {
    return NextResponse.json(
      { success: true, authenticated: false, user: null },
      { headers: corsHeaders }
    );
  }

  const session = parseSession(sessionToken);

  if (!session || new Date(session.expiresAt) < new Date()) {
    return NextResponse.json(
      { success: true, authenticated: false, user: null },
      { headers: corsHeaders }
    );
  }

  // Verify user still exists
  const user = await db.adminUser.findUnique({
    where: { id: session.userId },
  });

  if (!user || !user.isActive) {
    return NextResponse.json(
      { success: true, authenticated: false, user: null },
      { headers: corsHeaders }
    );
  }

  return NextResponse.json(
    {
      success: true,
      authenticated: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    },
    { headers: corsHeaders }
  );
}

// POST - Login, Logout
export async function POST(request: NextRequest) {
  const body = await request.json();
  const action = body.action;

  switch (action) {
    case "login": {
      const { email, password } = body;

      if (!email || !password) {
        return NextResponse.json(
          { success: false, error: "Email and password required" },
          { status: 400, headers: corsHeaders }
        );
      }

      const user = await db.adminUser.findUnique({ where: { email } });

      if (!user || !user.isActive) {
        return NextResponse.json(
          { success: false, error: "Invalid credentials" },
          { status: 401, headers: corsHeaders }
        );
      }

      // Check password
      if (!user.passwordHash) {
        return NextResponse.json(
          { success: false, error: "Account not initialized. Run init.ts first." },
          { status: 401, headers: corsHeaders }
        );
      }

      const [salt, hash] = user.passwordHash.split(":");
      if (!verifyPassword(password, hash, salt)) {
        return NextResponse.json(
          { success: false, error: "Invalid credentials" },
          { status: 401, headers: corsHeaders }
        );
      }

      // Update last login
      await db.adminUser.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      // Generate session token
      const token = generateSessionToken(user.id, user.email, user.name, user.role);

      const response = NextResponse.json(
        {
          success: true,
          user: { id: user.id, email: user.email, name: user.name, role: user.role },
        },
        { headers: corsHeaders }
      );

      response.cookies.set("session_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        expires: new Date(Date.now() + SESSION_EXPIRY),
        path: "/",
      });

      return response;
    }

    case "logout": {
      const response = NextResponse.json({ success: true }, { headers: corsHeaders });
      response.cookies.delete("session_token");
      return response;
    }

    default:
      return NextResponse.json(
        { success: false, error: "Invalid action" },
        { status: 400, headers: corsHeaders }
      );
  }
}
