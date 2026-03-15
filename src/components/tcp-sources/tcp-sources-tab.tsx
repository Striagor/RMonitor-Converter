"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Play,
  Square,
  Trash2,
  RefreshCw,
  Server,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

interface TcpSource {
  id: string;
  name: string;
  host: string;
  port: number;
  isEnabled: boolean;
  autoReconnect: boolean;
  reconnectDelay: number;
  sendEnabled: boolean;
  trustedOnly: boolean;
  description: string | null;
  status: string;
  lastConnectedAt: string | null;
  createdAt: string;
}

interface SourceStatus {
  sourceId: string;
  status: string;
  lastConnectedAt?: string;
  error?: string;
}

export function TcpSourcesTab() {
  const [sources, setSources] = useState<TcpSource[]>([]);
  const [statuses, setStatuses] = useState<SourceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [converterOnline, setConverterOnline] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<TcpSource | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    host: "",
    port: 50000,
    isEnabled: true,
    autoReconnect: true,
    reconnectDelay: 5000,
    sendEnabled: false,
    trustedOnly: false,
    description: "",
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch from database
      const dbRes = await fetch("/api/tcp-sources");
      const dbData = await dbRes.json();
      if (dbData.success) {
        setSources(dbData.data);
      }

      // Fetch status from converter
      const statusRes = await fetch("/api/converter/tcp/sources?XTransformPort=50004");

      if (!statusRes.ok) {
        const errorData = await statusRes.json();
        if (errorData.offline) {
          setConverterOnline(false);
          setStatuses([]);
        } else {
          setConverterOnline(true);
        }
        return;
      }

      const statusData = await statusRes.json();
      setConverterOnline(true);

      if (statusData.success) {
        setStatuses(statusData.data);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      setConverterOnline(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getSourceStatus = (sourceId: string): SourceStatus | undefined => {
    return statuses.find((s) => s.sourceId === sourceId);
  };

  const handleCreate = async () => {
    try {
      const res = await fetch("/api/tcp-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("TCP source created");
        setDialogOpen(false);
        resetForm();
        fetchData();
      } else {
        toast.error(data.error || "Failed to create source");
      }
    } catch (error) {
      toast.error("Failed to create TCP source");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/tcp-sources/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.success("TCP source deleted");
        fetchData();
      } else {
        toast.error(data.error || "Failed to delete source");
      }
    } catch (error) {
      toast.error("Failed to delete TCP source");
    }
  };

  const handleConnect = async (id: string) => {
    if (!converterOnline) {
      toast.error("Converter service is offline. Start it first.");
      return;
    }
    try {
      const res = await fetch(`/api/converter/tcp/sources/${id}/connect?XTransformPort=50004`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Connecting...");
        setTimeout(fetchData, 1000);
      } else {
        toast.error(data.error || "Failed to connect");
      }
    } catch (error) {
      toast.error("Failed to connect");
    }
  };

  const handleDisconnect = async (id: string) => {
    if (!converterOnline) {
      toast.error("Converter service is offline.");
      return;
    }
    try {
      const res = await fetch(`/api/converter/tcp/sources/${id}/disconnect?XTransformPort=50004`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Disconnected");
        fetchData();
      } else {
        toast.error(data.error || "Failed to disconnect");
      }
    } catch (error) {
      toast.error("Failed to disconnect");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      host: "",
      port: 50000,
      isEnabled: true,
      autoReconnect: true,
      reconnectDelay: 5000,
      sendEnabled: false,
      trustedOnly: false,
      description: "",
    });
    setEditingSource(null);
  };

  const openEditDialog = (source: TcpSource) => {
    setEditingSource(source);
    setFormData({
      name: source.name,
      host: source.host,
      port: source.port,
      isEnabled: source.isEnabled,
      autoReconnect: source.autoReconnect,
      reconnectDelay: source.reconnectDelay,
      sendEnabled: source.sendEnabled,
      trustedOnly: source.trustedOnly,
      description: source.description || "",
    });
    setDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingSource) return;

    try {
      const res = await fetch(`/api/tcp-sources/${editingSource.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("TCP source updated");
        setDialogOpen(false);
        resetForm();
        fetchData();
      } else {
        toast.error(data.error || "Failed to update source");
      }
    } catch (error) {
      toast.error("Failed to update TCP source");
    }
  };

  const getStatusBadge = (sourceId: string) => {
    if (!converterOnline) {
      return (
        <Badge variant="outline" className="flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          offline
        </Badge>
      );
    }

    const status = getSourceStatus(sourceId);
    const statusValue = status?.status || "unknown";

    const variants: Record<string, { variant: "default" | "destructive" | "secondary" | "outline"; icon: typeof CheckCircle }> = {
      connected: { variant: "default", icon: CheckCircle },
      connecting: { variant: "secondary", icon: Loader2 },
      disconnected: { variant: "outline", icon: XCircle },
      error: { variant: "destructive", icon: XCircle },
    };

    const config = variants[statusValue] || { variant: "outline", icon: XCircle };

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <config.icon className={`h-3 w-3 ${statusValue === "connecting" ? "animate-spin" : ""}`} />
        {statusValue}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">TCP Sources</h2>
          <p className="text-muted-foreground">Manage RMonitor TCP server connections</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                Add Source
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingSource ? "Edit TCP Source" : "Add TCP Source"}</DialogTitle>
                <DialogDescription>
                  Configure connection to RMonitor TCP server
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="My RMonitor Server"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="host">Host</Label>
                    <Input
                      id="host"
                      value={formData.host}
                      onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                      placeholder="192.168.1.100"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="port">Port</Label>
                    <Input
                      id="port"
                      type="number"
                      value={formData.port}
                      onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) || 50000 })}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Optional description"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="isEnabled">Enabled</Label>
                  <Switch
                    id="isEnabled"
                    checked={formData.isEnabled}
                    onCheckedChange={(checked) => setFormData({ ...formData, isEnabled: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="autoReconnect">Auto Reconnect</Label>
                  <Switch
                    id="autoReconnect"
                    checked={formData.autoReconnect}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, autoReconnect: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="sendEnabled">Allow Send Back</Label>
                  <Switch
                    id="sendEnabled"
                    checked={formData.sendEnabled}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, sendEnabled: checked })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="reconnectDelay">Reconnect Delay (ms)</Label>
                  <Input
                    id="reconnectDelay"
                    type="number"
                    value={formData.reconnectDelay}
                    onChange={(e) =>
                      setFormData({ ...formData, reconnectDelay: parseInt(e.target.value) || 5000 })
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={editingSource ? handleUpdate : handleCreate}>
                  {editingSource ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Offline Warning */}
      {!converterOnline && (
        <Card className="border-orange-500 bg-orange-50 dark:bg-orange-950">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              <div>
                <p className="font-medium text-orange-700 dark:text-orange-400">
                  Converter Service Offline
                </p>
                <p className="text-sm text-orange-600 dark:text-orange-500">
                  TCP connections require the converter service. Start it with: <code className="px-1 py-0.5 bg-orange-100 dark:bg-orange-900 rounded">cd mini-services/converter-service && bun run dev</code>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            TCP Sources
          </CardTitle>
          <CardDescription>RMonitor server connections</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : sources.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No TCP sources configured. Click "Add Source" to create one.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Host:Port</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Auto Reconnect</TableHead>
                  <TableHead>Send Back</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sources.map((source) => {
                  const status = getSourceStatus(source.id);
                  return (
                    <TableRow key={source.id}>
                      <TableCell className="font-medium">{source.name}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {source.host}:{source.port}
                      </TableCell>
                      <TableCell>{getStatusBadge(source.id)}</TableCell>
                      <TableCell>
                        <Badge variant={source.autoReconnect ? "default" : "secondary"}>
                          {source.autoReconnect ? "Yes" : "No"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={source.sendEnabled ? "default" : "secondary"}>
                          {source.sendEnabled ? "Yes" : "No"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!converterOnline ? (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled
                              title="Converter service offline"
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                          ) : status?.status === "connected" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDisconnect(source.id)}
                            >
                              <Square className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleConnect(source.id)}
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(source)}
                          >
                            Edit
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="sm">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete TCP Source</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{source.name}"? This action
                                  cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(source.id)}
                                  className="bg-destructive text-destructive-foreground"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
