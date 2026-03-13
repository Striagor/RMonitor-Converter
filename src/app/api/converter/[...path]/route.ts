/**
 * Proxy API route to converter service
 */

import { NextRequest, NextResponse } from "next/server";

const CONVERTER_API_PORT = 50004;

// Check if converter service is available
async function checkConverterHealth(): Promise<boolean> {
  try {
    const response = await fetch(
      `http://localhost:${CONVERTER_API_PORT}/api/health`,
      { signal: AbortSignal.timeout(2000) }
    );
    return response.ok;
  } catch {
    return false;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const searchParams = request.nextUrl.searchParams;
  const endpoint = path.join("/");

  try {
    const response = await fetch(
      `http://localhost:${CONVERTER_API_PORT}/api/${endpoint}?${searchParams}`,
      { signal: AbortSignal.timeout(5000) }
    );

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: `Converter service error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Proxy error:", error);
    const isOffline = !await checkConverterHealth();
    return NextResponse.json(
      {
        success: false,
        error: "Converter service unavailable",
        offline: isOffline
      },
      { status: 503 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const endpoint = path.join("/");

  // Parse body only if there's content
  let body = {};
  try {
    const text = await request.text();
    if (text.trim()) {
      body = JSON.parse(text);
    }
  } catch {
    // Empty or invalid JSON, use empty object
  }

  try {
    const response = await fetch(
      `http://localhost:${CONVERTER_API_PORT}/api/${endpoint}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000)
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText || `HTTP ${response.status}` };
      }
      return NextResponse.json(
        { success: false, ...errorData },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Proxy error:", error);
    const isOffline = !await checkConverterHealth();
    return NextResponse.json(
      {
        success: false,
        error: "Converter service unavailable",
        offline: isOffline
      },
      { status: 503 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const endpoint = path.join("/");

  try {
    const response = await fetch(
      `http://localhost:${CONVERTER_API_PORT}/api/${endpoint}`,
      {
        method: "DELETE",
        signal: AbortSignal.timeout(5000)
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: `Converter service error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Proxy error:", error);
    const isOffline = !await checkConverterHealth();
    return NextResponse.json(
      {
        success: false,
        error: "Converter service unavailable",
        offline: isOffline
      },
      { status: 503 }
    );
  }
}
