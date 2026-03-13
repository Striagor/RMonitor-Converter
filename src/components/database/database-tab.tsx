"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Database, RefreshCw, Save, Check, X, Loader2, TestTube, AlertCircle, CheckCircle, Table, Wifi, WifiOff, HardDrive } from "lucide-react";
import { toast } from "sonner";
import { ALL_COMMAND_IDS } from "@/shared/types";

interface DatabaseSettings {
  useRemoteDb: boolean;
  remoteDbType: string;
  remoteDbHost: string;
  remoteDbPort: string;
  remoteDbName: string;
  remoteDbUser: string;
  remoteDbPassword: string;
  remoteDbPoolSize: string;
  remoteDbOfflineCacheSizeMb: string;
  logCommands: boolean;
  loggedCommands: string;
}

interface RemoteDbStatus {
  connected: boolean;
  enabled: boolean;
  type: "mysql" | "postgresql" | null;
  host: string;
  database: string;
  poolSize: number;
  activeConnections: number;
  lastError: string | null;
  commandsLogged: number;
  tablesCreated: string[];
  offlineCacheSize: number;
  offlineCacheCount: number;
}

interface TestResult {
  success: boolean;
  message: string;
  tablesFound?: string[];
  rmonitorTablesFound?: string[];
  error?: string;
}

// Use /api/converter/ prefix to proxy through Next.js to converter service

export function DatabaseTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [dbStatus, setDbStatus] = useState<RemoteDbStatus | null>(null);
  const [formData, setFormData] = useState<DatabaseSettings>({
    useRemoteDb: false,
    remoteDbType: "mysql",
    remoteDbHost: "",
    remoteDbPort: "3306",
    remoteDbName: "",
    remoteDbUser: "",
    remoteDbPassword: "",
    remoteDbPoolSize: "10",
    remoteDbOfflineCacheSizeMb: "10",
    logCommands: true,
    loggedCommands: "all",
  });

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/database-settings");
      const data = await res.json();
      if (data.success) {
        setFormData({
          ...data.data,
          remoteDbPoolSize: data.data.remoteDbPoolSize || "10",
          remoteDbOfflineCacheSizeMb: data.data.remoteDbOfflineCacheSizeMb || "10",
        });
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
      toast.error("Failed to fetch database settings");
    } finally {
      setLoading(false);
    }
  };

  const fetchDbStatus = async () => {
    try {
      const res = await fetch("/api/converter/remote-db/status");
      const data = await res.json();
      if (data.success) {
        setDbStatus(data.data);
      }
    } catch (error) {
      console.error("Error fetching DB status:", error);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchDbStatus();
    
    // Poll status every 5 seconds
    const interval = setInterval(fetchDbStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/database-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Database settings saved and applied. No restart needed.");
        // Refresh status after saving
        setTimeout(fetchDbStatus, 1000);
      } else {
        toast.error(data.error || "Failed to save settings");
      }
    } catch {
      toast.error("Failed to save database settings");
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    if (!formData.remoteDbHost) {
      toast.error("Please enter a database host");
      return;
    }
    if (!formData.remoteDbName) {
      toast.error("Please enter a database name");
      return;
    }

    setTesting(true);
    setTestResult(null);
    setShowTestDialog(true);

    try {
      const res = await fetch("/api/database-settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: formData.remoteDbType,
          host: formData.remoteDbHost,
          port: formData.remoteDbPort,
          database: formData.remoteDbName,
          user: formData.remoteDbUser,
          password: formData.remoteDbPassword,
        }),
      });

      const data: TestResult = await res.json();
      setTestResult(data);

      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.error || "Connection test failed");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Connection test failed";
      setTestResult({ success: false, message: errorMessage, error: errorMessage });
      toast.error(errorMessage);
    } finally {
      setTesting(false);
    }
  };

  const toggleCommand = (cmd: string) => {
    if (formData.loggedCommands === "all") {
      // Switch to selective mode without this command
      const newCommands = ALL_COMMAND_IDS.filter((c) => c !== cmd).join(",");
      setFormData({ ...formData, loggedCommands: newCommands });
    } else {
      const commands = formData.loggedCommands ? formData.loggedCommands.split(",") : [];
      const updated = commands.includes(cmd)
        ? commands.filter((c) => c !== cmd)
        : [...commands, cmd];
      setFormData({ ...formData, loggedCommands: updated.join(",") });
    }
  };

  const isCommandSelected = (cmd: string): boolean => {
    if (formData.loggedCommands === "all") return true;
    return formData.loggedCommands.split(",").includes(cmd);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Database Settings</h2>
          <p className="text-muted-foreground">Configure remote database and logging options</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { fetchSettings(); fetchDbStatus(); }} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Settings
          </Button>
        </div>
      </div>

      {/* Connection Status Card */}
      {dbStatus && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              {dbStatus.connected ? (
                <>
                  <Wifi className="h-5 w-5 text-green-500" />
                  <span>Connected to Remote Database</span>
                </>
              ) : dbStatus.enabled ? (
                <>
                  <WifiOff className="h-5 w-5 text-yellow-500" />
                  <span>Remote Database Not Connected (Using Offline Cache)</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-5 w-5 text-muted-foreground" />
                  <span>Remote Database Disabled</span>
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Type:</span>
                <span className="ml-2 font-medium">{dbStatus.type?.toUpperCase() || "N/A"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Host:</span>
                <span className="ml-2 font-medium">{dbStatus.host || "N/A"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Database:</span>
                <span className="ml-2 font-medium">{dbStatus.database || "N/A"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Pool Size:</span>
                <span className="ml-2 font-medium">{dbStatus.poolSize}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Commands Logged:</span>
                <span className="ml-2 font-medium">{dbStatus.commandsLogged}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Tables Created:</span>
                <span className="ml-2 font-medium">{dbStatus.tablesCreated.length}</span>
              </div>
              {!dbStatus.connected && dbStatus.enabled && (
                <>
                  <div>
                    <span className="text-muted-foreground">Offline Cache:</span>
                    <span className="ml-2 font-medium text-yellow-600">{dbStatus.offlineCacheCount} commands ({dbStatus.offlineCacheSize.toFixed(2)} MB)</span>
                  </div>
                </>
              )}
              {dbStatus.lastError && (
                <div className="col-span-2">
                  <span className="text-red-500">Last Error:</span>
                  <span className="ml-2 text-red-500 text-xs">{dbStatus.lastError}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Remote Database Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Remote Database Connection
          </CardTitle>
          <CardDescription>
            Configure connection to MySQL or PostgreSQL for data logging
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable Remote DB */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">Use Remote Database</Label>
              <p className="text-sm text-muted-foreground">
                Enable to log data to MySQL or PostgreSQL instead of local SQLite
              </p>
            </div>
            <Switch
              checked={formData.useRemoteDb}
              onCheckedChange={(checked) => setFormData({ ...formData, useRemoteDb: checked })}
            />
          </div>

          {formData.useRemoteDb && (
            <>
              {/* Database Type */}
              <div className="grid gap-2">
                <Label htmlFor="dbType">Database Type</Label>
                <Select
                  value={formData.remoteDbType}
                  onValueChange={(value) => setFormData({ ...formData, remoteDbType: value })}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mysql">MySQL</SelectItem>
                    <SelectItem value="postgresql">PostgreSQL</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Connection Details */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="host">Host *</Label>
                  <Input
                    id="host"
                    value={formData.remoteDbHost}
                    onChange={(e) => setFormData({ ...formData, remoteDbHost: e.target.value })}
                    placeholder="db.example.com"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="port">Port</Label>
                  <Input
                    id="port"
                    value={formData.remoteDbPort}
                    onChange={(e) => setFormData({ ...formData, remoteDbPort: e.target.value })}
                    placeholder={formData.remoteDbType === "postgresql" ? "5432" : "3306"}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="dbName">Database Name *</Label>
                  <Input
                    id="dbName"
                    value={formData.remoteDbName}
                    onChange={(e) => setFormData({ ...formData, remoteDbName: e.target.value })}
                    placeholder="rmonitor_data"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="dbUser">Username</Label>
                  <Input
                    id="dbUser"
                    value={formData.remoteDbUser}
                    onChange={(e) => setFormData({ ...formData, remoteDbUser: e.target.value })}
                    placeholder="rmonitor_user"
                  />
                </div>
              </div>

              {/* Password, Pool Size and Offline Cache */}
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="dbPassword">Password</Label>
                  <Input
                    id="dbPassword"
                    type="password"
                    value={formData.remoteDbPassword}
                    onChange={(e) =>
                      setFormData({ ...formData, remoteDbPassword: e.target.value })
                    }
                    placeholder="••••••••"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="poolSize">Connection Pool Size</Label>
                  <Input
                    id="poolSize"
                    type="number"
                    min="1"
                    max="100"
                    value={formData.remoteDbPoolSize}
                    onChange={(e) =>
                      setFormData({ ...formData, remoteDbPoolSize: e.target.value })
                    }
                    placeholder="10"
                  />
                  <p className="text-xs text-muted-foreground">
                    Concurrent connections (1-100)
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="offlineCacheSize">Offline Cache Size (MB)</Label>
                  <div className="flex items-center gap-3">
                    <Slider
                      id="offlineCacheSize"
                      min={1}
                      max={20}
                      step={1}
                      value={[parseInt(formData.remoteDbOfflineCacheSizeMb) || 10]}
                      onValueChange={(value) =>
                        setFormData({ ...formData, remoteDbOfflineCacheSizeMb: String(value[0]) })
                      }
                      className="flex-1"
                    />
                    <span className="w-8 text-sm font-medium">{formData.remoteDbOfflineCacheSizeMb}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Cache size when DB offline (1-20 MB)
                  </p>
                </div>
              </div>

              {/* Test Connection */}
              <Button variant="outline" onClick={testConnection} disabled={testing}>
                {testing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <TestTube className="h-4 w-4 mr-2" />
                )}
                Test Connection
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Command Logging */}
      <Card>
        <CardHeader>
          <CardTitle>Command Logging</CardTitle>
          <CardDescription>
            Select which RMonitor commands should be logged to the database
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable Logging */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">Enable Command Logging</Label>
              <p className="text-sm text-muted-foreground">
                Record received commands to the database for analysis and audit
              </p>
            </div>
            <Switch
              checked={formData.logCommands}
              onCheckedChange={(checked) => setFormData({ ...formData, logCommands: checked })}
            />
          </div>

          {formData.logCommands && (
            <>
              {/* Log All Commands */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Log All Commands</Label>
                  <p className="text-sm text-muted-foreground">
                    Record all command types to the database
                  </p>
                </div>
                <Switch
                  checked={formData.loggedCommands === "all"}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, loggedCommands: checked ? "all" : "" })
                  }
                />
              </div>

              {/* Selective Command Selection */}
              {formData.loggedCommands !== "all" && (
                <div className="space-y-3">
                  <Label>Select Commands to Log</Label>
                  <div className="flex flex-wrap gap-2">
                    {ALL_COMMAND_IDS.map((cmd) => (
                      <Badge
                        key={cmd}
                        variant={isCommandSelected(cmd) ? "default" : "outline"}
                        className="cursor-pointer text-sm px-3 py-1"
                        onClick={() => toggleCommand(cmd)}
                      >
                        {isCommandSelected(cmd) ? (
                          <Check className="h-3 w-3 mr-1" />
                        ) : (
                          <X className="h-3 w-3 mr-1 opacity-50" />
                        )}
                        ${cmd}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Offline Cache Info */}
      {formData.useRemoteDb && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              Offline Cache
            </CardTitle>
            <CardDescription>
              When database is temporarily unavailable, commands are cached locally
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                If the remote database connection is lost, the system will automatically cache commands in memory.
                When the connection is restored, all cached commands will be written to the database.
              </p>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div className="p-3 rounded-lg bg-muted">
                  <h4 className="font-semibold mb-1">Automatic Failover</h4>
                  <p className="text-muted-foreground">No data loss during temporary network issues</p>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <h4 className="font-semibold mb-1">Configurable Size</h4>
                  <p className="text-muted-foreground">Cache size from 1 to 20 MB - oldest data discarded if exceeded</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Tables Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Table className="h-5 w-5" />
            Database Tables
          </CardTitle>
          <CardDescription>
            Each command type will be stored in its own table: RMonitor_{"{Id}"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              When logging is enabled, the following tables will be created automatically:
            </p>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div className="p-3 rounded-lg bg-muted">
                <h4 className="font-semibold mb-1 font-mono">RMonitor_A, RMonitor_COMP</h4>
                <p className="text-muted-foreground">Competitor registration data</p>
              </div>
              <div className="p-3 rounded-lg bg-muted">
                <h4 className="font-semibold mb-1 font-mono">RMonitor_G, RMonitor_H, RMonitor_J</h4>
                <p className="text-muted-foreground">Timing and position data</p>
              </div>
              <div className="p-3 rounded-lg bg-muted">
                <h4 className="font-semibold mb-1 font-mono">RMonitor_DPD, RMonitor_DPF, RMonitor_DSI</h4>
                <p className="text-muted-foreground">Decoder and speed data</p>
              </div>
              <div className="p-3 rounded-lg bg-muted">
                <h4 className="font-semibold mb-1 font-mono">RMonitor_F</h4>
                <p className="text-muted-foreground">Race status and flags</p>
              </div>
              <div className="p-3 rounded-lg bg-muted">
                <h4 className="font-semibold mb-1 font-mono">RMonitor_I</h4>
                <p className="text-muted-foreground">Session initialization</p>
              </div>
              <div className="p-3 rounded-lg bg-muted">
                <h4 className="font-semibold mb-1 font-mono">RMonitor_B, RMonitor_C, RMonitor_E</h4>
                <p className="text-muted-foreground">Configuration data</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Tables are created automatically when settings are saved with remote database enabled.
              Each table includes a timestamp, source_id, and the raw JSON data.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Test Connection Dialog */}
      <AlertDialog open={showTestDialog} onOpenChange={setShowTestDialog}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {testing ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Testing Connection...
                </>
              ) : testResult?.success ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Connection Successful
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  Connection Failed
                </>
              )}
            </AlertDialogTitle>
          </AlertDialogHeader>
          <div className="py-4">
            {testing ? (
              <p className="text-sm text-muted-foreground">Attempting to connect to the database...</p>
            ) : testResult ? (
              <div className="space-y-3">
                <p className="text-sm">{testResult.message}</p>
                {testResult.error && (
                  <div className="p-2 bg-red-50 dark:bg-red-950 rounded text-sm text-red-600 dark:text-red-400">
                    {testResult.error}
                  </div>
                )}
                {testResult.tablesFound && testResult.tablesFound.length > 0 && (
                  <div>
                    <span className="text-sm font-medium">Tables found ({testResult.tablesFound.length}):</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {testResult.tablesFound.slice(0, 10).map((table) => (
                        <Badge key={table} variant="outline" className="text-xs">
                          {table}
                        </Badge>
                      ))}
                      {testResult.tablesFound.length > 10 && (
                        <Badge variant="outline" className="text-xs">
                          +{testResult.tablesFound.length - 10} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
                {testResult.rmonitorTablesFound && testResult.rmonitorTablesFound.length > 0 && (
                  <div>
                    <span className="text-sm font-medium text-green-600 dark:text-green-400">
                      RMonitor tables found:
                    </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {testResult.rmonitorTablesFound.map((table) => (
                        <Badge key={table} variant="default" className="text-xs bg-green-500">
                          {table}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
          <AlertDialogFooter>
            <AlertDialogAction>Close</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
