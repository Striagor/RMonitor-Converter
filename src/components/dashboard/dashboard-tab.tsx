"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Activity,
  Server,
  Wifi,
  Users,
  Database,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";

interface ConverterStatus {
  tcpConnections: number;
  wsConnections: number;
  cacheStats: Record<string, number>;
  online: boolean;
}

export function DashboardTab() {
  const [status, setStatus] = useState<ConverterStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch health check
      const healthRes = await fetch("/api/converter/health?XTransformPort=50004");
      const healthData = await healthRes.json();

      if (!healthRes.ok || healthData.offline) {
        setStatus({
          tcpConnections: 0,
          wsConnections: 0,
          cacheStats: {},
          online: false,
        });
        setError("Converter service offline. Start it with: cd mini-services/converter-service && bun run dev");
        return;
      }

      // Fetch WS status
      const wsRes = await fetch("/api/converter/ws/status?XTransformPort=50004");
      const wsData = await wsRes.json();

      // Fetch cache stats
      const cacheRes = await fetch("/api/converter/cache/stats?XTransformPort=50004");
      const cacheData = await cacheRes.json();

      // Fetch TCP sources
      const tcpRes = await fetch("/api/converter/tcp/sources?XTransformPort=50004");
      const tcpData = await tcpRes.json();

      if (wsData.success && cacheData.success && tcpData.success) {
        const tcpConnected = tcpData.data?.filter(
          (s: { status: string }) => s.status === "connected"
        ).length;

        setStatus({
          tcpConnections: tcpConnected || 0,
          wsConnections: wsData.data?.clientCount || 0,
          cacheStats: cacheData.data || {},
          online: true,
        });
      } else {
        setError("Failed to fetch status");
      }
    } catch (err) {
      setStatus({
        tcpConnections: 0,
        wsConnections: 0,
        cacheStats: {},
        online: false,
      });
      setError("Converter service not available");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const stats = [
    {
      title: "TCP Connections",
      value: status?.tcpConnections ?? "-",
      description: "Active RMonitor sources",
      icon: Server,
      color: status?.online ? "text-blue-500" : "text-gray-400",
    },
    {
      title: "WebSocket Clients",
      value: status?.wsConnections ?? "-",
      description: "Connected WS clients",
      icon: Wifi,
      color: status?.online ? "text-green-500" : "text-gray-400",
    },
    {
      title: "Cache Entries",
      value: status?.cacheStats
        ? Object.values(status.cacheStats).reduce((a, b) => a + b, 0)
        : "-",
      description: "Cached messages",
      icon: Database,
      color: status?.online ? "text-purple-500" : "text-gray-400",
    },
    {
      title: "Service Status",
      value: status?.online ? "Online" : "Offline",
      description: status?.online ? "Converter service running" : "Start converter service",
      icon: status?.online ? CheckCircle : XCircle,
      color: status?.online ? "text-green-500" : "text-red-500",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">
            Overview of your RMonitor Converter service
          </p>
        </div>
        <Button onClick={fetchStatus} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Offline Warning */}
      {status && !status.online && (
        <Card className="border-orange-500 bg-orange-50 dark:bg-orange-950">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              <div>
                <p className="font-medium text-orange-700 dark:text-orange-400">
                  Converter Service Offline
                </p>
                <p className="text-sm text-orange-600 dark:text-orange-500">
                  Start the converter service: <code className="px-1 py-0.5 bg-orange-100 dark:bg-orange-900 rounded">cd mini-services/converter-service && bun run dev</code>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Cache Details */}
      {status?.online && status.cacheStats && Object.keys(status.cacheStats).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Cache Statistics
            </CardTitle>
            <CardDescription>Cached message types for client initialization</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {Object.entries(status.cacheStats).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between p-3 rounded-lg bg-muted">
                  <span className="font-mono text-sm">${key}</span>
                  <Badge variant="secondary">{value as number}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common operations</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={!status?.online}
            onClick={async () => {
              await fetch("/api/converter/cache/clear?XTransformPort=50004", { method: "POST" });
              fetchStatus();
            }}
          >
            Clear Cache
          </Button>
        </CardContent>
      </Card>

      {/* Architecture Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Architecture
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="p-4 rounded-lg bg-muted">
              <h4 className="font-semibold mb-2">Web Panel</h4>
              <p className="text-muted-foreground">Next.js on port 3000</p>
              <p className="text-muted-foreground">Management interface</p>
            </div>
            <div className="p-4 rounded-lg bg-muted">
              <h4 className="font-semibold mb-2">Converter Service</h4>
              <p className="text-muted-foreground">Bun on port 50003 (WS)</p>
              <p className="text-muted-foreground">Management API on 50004</p>
            </div>
            <div className="p-4 rounded-lg bg-muted">
              <h4 className="font-semibold mb-2">Data Flow</h4>
              <p className="text-muted-foreground">TCP (RMonitor) → WebJSON</p>
              <p className="text-muted-foreground">WebJSON → TCP (optional)</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
