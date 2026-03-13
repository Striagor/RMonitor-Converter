import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Public paths that don't require authentication
const PUBLIC_PATHS = [
  "/login",
  "/api/auth",
  "/api/converter/",      // Converter service API proxy (requires its own auth via API keys)
];

// Check if path is public
function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => {
    // For paths ending with /, just check startsWith
    if (path.endsWith("/")) {
      return pathname.startsWith(path);
    }
    // For exact paths, check equality or starts with path + /
    return pathname === path || pathname.startsWith(path + "/");
  });
}

// Check if request is a static file or internal Next.js request
function isStaticOrInternalRequest(pathname: string): boolean {
  return (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/static/") ||
    pathname.includes(".")
  );
}

// Add CORS headers to response
function addCorsHeaders(response: NextResponse): NextResponse {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, Cookie");
  response.headers.set("Access-Control-Allow-Credentials", "true");
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow OPTIONS requests (CORS preflight)
  if (request.method === "OPTIONS") {
    const response = new NextResponse(null, { status: 204 });
    return addCorsHeaders(response);
  }

  // Allow static and internal requests
  if (isStaticOrInternalRequest(pathname)) {
    return NextResponse.next();
  }

  // Check public paths BEFORE checking session
  if (isPublicPath(pathname)) {
    const response = NextResponse.next();
    return addCorsHeaders(response);
  }

  // Check for session token
  const sessionToken = request.cookies.get("session_token")?.value;

  if (!sessionToken) {
    // For API requests, return 401
    if (pathname.startsWith("/api/")) {
      const response = NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
      return addCorsHeaders(response);
    }

    // For page requests, redirect to login
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Validate session
  try {
    const sessionData = JSON.parse(
      Buffer.from(sessionToken, "base64").toString("utf-8")
    );

    // Check if session is expired
    if (new Date(sessionData.expiresAt) < new Date()) {
      if (pathname.startsWith("/api/")) {
        const response = NextResponse.json(
          { success: false, error: "Session expired" },
          { status: 401 }
        );
        return addCorsHeaders(response);
      }

      const loginUrl = new URL("/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
  } catch {
    if (pathname.startsWith("/api/")) {
      const response = NextResponse.json(
        { success: false, error: "Invalid session" },
        { status: 401 }
      );
      return addCorsHeaders(response);
    }

    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.next();
  return addCorsHeaders(response);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
};
