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
import { Plus, Trash2, RefreshCw, Wifi, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface WsServer {
  id: string;
  name: string;
  port: number;
  isEnabled: boolean;
  useSSL: boolean;
  sslCertPath: string | null;
  sslKeyPath: string | null;
  maxClients: number;
  heartbeatInterval: number;
  description: string | null;
  status: string;
  createdAt: string;
}

export function WsServersTab() {
  const [servers, setServers] = useState<WsServer[]>([]);
  const [wsStatus, setWsStatus] = useState<{ clientCount: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    port: 50003,
    isEnabled: true,
    useSSL: false,
    sslCertPath: "",
    sslKeyPath: "",
    maxClients: 100,
    heartbeatInterval: 30000,
    description: "",
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ws-servers");
      const data = await res.json();
      if (data.success) {
        setServers(data.data);
      }

      // Fetch WS status from converter
      const statusRes = await fetch("/api/converter/ws/status?XTransformPort=50004");
      const statusData = await statusRes.json();
      if (statusData.success) {
        setWsStatus(statusData.data);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to fetch WS servers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async () => {
    try {
      const res = await fetch("/api/ws-servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("WS server created");
        setDialogOpen(false);
        resetForm();
        fetchData();
      } else {
        toast.error(data.error || "Failed to create server");
      }
    } catch (error) {
      toast.error("Failed to create WS server");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/ws-servers/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.success("WS server deleted");
        fetchData();
      } else {
        toast.error(data.error || "Failed to delete server");
      }
    } catch (error) {
      toast.error("Failed to delete WS server");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      port: 50003,
      isEnabled: true,
      useSSL: false,
      sslCertPath: "",
      sslKeyPath: "",
      maxClients: 100,
      heartbeatInterval: 30000,
      description: "",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">WS/WSS Servers</h2>
          <p className="text-muted-foreground">Manage WebSocket server instances</p>
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
                Add Server
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add WS/WSS Server</DialogTitle>
                <DialogDescription>Configure WebSocket server for clients</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Main WS Server"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="port">Port</Label>
                  <Input
                    id="port"
                    type="number"
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                  />
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
                  <Label htmlFor="useSSL">Use SSL (WSS)</Label>
                  <Switch
                    id="useSSL"
                    checked={formData.useSSL}
                    onCheckedChange={(checked) => setFormData({ ...formData, useSSL: checked })}
                  />
                </div>
                {formData.useSSL && (
                  <>
                    <div className="grid gap-2">
                      <Label htmlFor="sslCertPath">SSL Certificate Path</Label>
                      <Input
                        id="sslCertPath"
                        value={formData.sslCertPath}
                        onChange={(e) => setFormData({ ...formData, sslCertPath: e.target.value })}
                        placeholder="/path/to/cert.pem"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="sslKeyPath">SSL Key Path</Label>
                      <Input
                        id="sslKeyPath"
                        value={formData.sslKeyPath}
                        onChange={(e) => setFormData({ ...formData, sslKeyPath: e.target.value })}
                        placeholder="/path/to/key.pem"
                      />
                    </div>
                  </>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="maxClients">Max Clients</Label>
                    <Input
                      id="maxClients"
                      type="number"
                      value={formData.maxClients}
                      onChange={(e) =>
                        setFormData({ ...formData, maxClients: parseInt(e.target.value) })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="heartbeatInterval">Heartbeat (ms)</Label>
                    <Input
                      id="heartbeatInterval"
                      type="number"
                      value={formData.heartbeatInterval}
                      onChange={(e) =>
                        setFormData({ ...formData, heartbeatInterval: parseInt(e.target.value) })
                      }
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Status Card */}
      {wsStatus && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wifi className="h-5 w-5" />
              Live Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="text-3xl font-bold">{wsStatus.clientCount}</div>
              <div className="text-muted-foreground">Connected Clients</div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>WS/WSS Servers</CardTitle>
          <CardDescription>WebSocket server configurations</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : servers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No WS servers configured. The converter service runs on port 50003 by default.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Port</TableHead>
                  <TableHead>SSL</TableHead>
                  <TableHead>Max Clients</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {servers.map((server) => (
                  <TableRow key={server.id}>
                    <TableCell className="font-medium">{server.name}</TableCell>
                    <TableCell className="font-mono">{server.port}</TableCell>
                    <TableCell>
                      <Badge variant={server.useSSL ? "default" : "secondary"}>
                        {server.useSSL ? "WSS" : "WS"}
                      </Badge>
                    </TableCell>
                    <TableCell>{server.maxClients}</TableCell>
                    <TableCell>
                      <Badge variant={server.isEnabled ? "default" : "secondary"}>
                        {server.isEnabled ? "Running" : "Stopped"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete WS Server</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{server.name}"? This action cannot be
                              undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(server.id)}
                              className="bg-destructive text-destructive-foreground"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
