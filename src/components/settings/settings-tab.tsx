"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Settings, Database, Server, Wifi, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

interface ServiceInfo {
  webPanel: {
    port: number;
    status: string;
  };
  converterService: {
    wsPort: number;
    apiPort: number;
    status: string;
  };
  database: {
    type: string;
    status: string;
  };
}

export function SettingsTab() {
  const [serviceInfo, setServiceInfo] = useState<ServiceInfo>({
    webPanel: { port: 3000, status: "running" },
    converterService: { wsPort: 50003, apiPort: 50004, status: "unknown" },
    database: { type: "SQLite", status: "connected" },
  });

  useEffect(() => {
    // Check converter service status
    fetch("/api/converter/health?XTransformPort=50004")
      .then((res) => res.json())
      .then((data) => {
        setServiceInfo((prev) => ({
          ...prev,
          converterService: { ...prev.converterService, status: data.success ? "running" : "offline" },
        }));
      })
      .catch(() => {
        setServiceInfo((prev) => ({
          ...prev,
          converterService: { ...prev.converterService, status: "offline" },
        }));
      });
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
          <p className="text-muted-foreground">System configuration and information</p>
        </div>
      </div>

      {/* Service Status */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Web Panel</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Port {serviceInfo.webPanel.port}</div>
            <div className="flex items-center gap-2 mt-2">
              <div
                className={`w-2 h-2 rounded-full ${serviceInfo.webPanel.status === "running" ? "bg-green-500" : "bg-red-500"}`}
              />
              <p className="text-xs text-muted-foreground capitalize">{serviceInfo.webPanel.status}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Converter Service</CardTitle>
            <Wifi className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              WS: {serviceInfo.converterService.wsPort}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <div
                className={`w-2 h-2 rounded-full ${serviceInfo.converterService.status === "running" ? "bg-green-500" : "bg-red-500"}`}
              />
              <p className="text-xs text-muted-foreground capitalize">
                {serviceInfo.converterService.status}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Database</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{serviceInfo.database.type}</div>
            <div className="flex items-center gap-2 mt-2">
              <div
                className={`w-2 h-2 rounded-full ${serviceInfo.database.status === "connected" ? "bg-green-500" : "bg-red-500"}`}
              />
              <p className="text-xs text-muted-foreground capitalize">{serviceInfo.database.status}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Architecture */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Architecture Overview
          </CardTitle>
          <CardDescription>System components and data flow</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-muted">
              <h4 className="font-semibold mb-2">Data Flow</h4>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline">RMonitor TCP</Badge>
                <span>→</span>
                <Badge variant="outline">Converter</Badge>
                <span>→</span>
                <Badge variant="outline">WebJSON</Badge>
                <span>→</span>
                <Badge variant="outline">WS Clients</Badge>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-muted">
              <h4 className="font-semibold mb-2">Supported Commands</h4>
              <div className="flex flex-wrap gap-2">
                {["$I", "$E", "$B", "$C", "$A", "$COMP", "$G", "$H", "$J", "$F", "$DPD", "$DPF", "$DSI"].map(
                  (cmd) => (
                    <Badge key={cmd} variant="secondary">
                      {cmd}
                    </Badge>
                  )
                )}
              </div>
            </div>

            <div className="p-4 rounded-lg bg-muted">
              <h4 className="font-semibold mb-2">WebSocket Connection</h4>
              <code className="text-xs bg-background px-2 py-1 rounded block">
                ws://localhost:{serviceInfo.converterService.wsPort}?apiKey=YOUR_API_KEY
              </code>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>System Actions</CardTitle>
          <CardDescription>Manage system state</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              await fetch("/api/converter/cache/clear?XTransformPort=50004", { method: "POST" });
            }}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Clear Cache
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
