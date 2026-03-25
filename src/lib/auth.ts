/**
 * Auth Utilities
 * Password hashing and session management
 */

import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { randomBytes, createHash } from "crypto";

// Session expiry time (24 hours)
const SESSION_EXPIRY = 24 * 60 * 60 * 1000;

// Hash password with salt
export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const passwordSalt = salt || randomBytes(16).toString("hex");
  const hash = createHash("sha256")
    .update(password + passwordSalt)
    .digest("hex");
  return { hash, salt: passwordSalt };
}

// Verify password
export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const { hash: newHash } = hashPassword(password, salt);
  return newHash === hash;
}

// Generate session token
export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

// Session interface
export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

// Create session
export async function createSession(userId: string): Promise<string> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY);

  // Store session in database (we'll use a simple approach with cookies)
  // In production, you'd want to store sessions in Redis or database

  return token;
}

// Get current session
export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session_token")?.value;

  if (!sessionToken) {
    return null;
  }

  try {
    // Decode session data from token
    const sessionData = Buffer.from(sessionToken, "base64").toString("utf-8");
    const session = JSON.parse(sessionData);

    // Check expiry
    if (new Date(session.expiresAt) < new Date()) {
      return null;
    }

    // Verify user still exists and is active
    const user = await db.adminUser.findUnique({
      where: { id: session.userId },
    });

    if (!user || !user.isActive) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  } catch {
    return null;
  }
}

// Set session cookie
export async function setSessionCookie(userId: string, email: string, name: string, role: string): Promise<string> {
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY);

  const sessionData = JSON.stringify({
    userId,
    email,
    name,
    role,
    expiresAt: expiresAt.toISOString(),
  });

  const token = Buffer.from(sessionData).toString("base64");

  const cookieStore = await cookies();
  cookieStore.set("session_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });

  return token;
}

// Clear session
export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete("session_token");
}

// Authenticate user
export async function authenticateUser(email: string, password: string): Promise<SessionUser | null> {
  const user = await db.adminUser.findUnique({
    where: { email },
  });

  if (!user || !user.isActive) {
    return null;
  }

  // For the first user, if no password is set, use default
  if (!user.passwordHash) {
    // First time setup - set default password
    const { hash, salt } = hashPassword("admin");
    await db.adminUser.update({
      where: { id: user.id },
      data: { passwordHash: `${salt}:${hash}` },
    });

    // Verify with default password
    if (password !== "admin") {
      return null;
    }
  } else {
    // Verify password
    const [salt, hash] = user.passwordHash.split(":");
    if (!verifyPassword(password, hash, salt)) {
      return null;
    }
  }

  // Update last login
  await db.adminUser.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

// Check if any admin exists
export async function hasAdminUser(): Promise<boolean> {
  const count = await db.adminUser.count();
  return count > 0;
}

// Create initial admin
export async function createInitialAdmin(email: string, name: string, password: string): Promise<SessionUser> {
  const { hash, salt } = hashPassword(password);

  const user = await db.adminUser.create({
    data: {
      email,
      name,
      passwordHash: `${salt}:${hash}`,
      role: "superadmin",
      isActive: true,
    },
  });

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}
