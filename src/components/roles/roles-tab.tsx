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
import { Plus, Trash2, RefreshCw, Shield, Loader2, Edit } from "lucide-react";
import { toast } from "sonner";
import { ALL_COMMAND_IDS } from "@/shared/types";

interface Role {
  id: string;
  name: string;
  description: string | null;
  canSend: boolean;
  canReceive: boolean;
  allowedCommands: string;
  maxConnections: number;
  rateLimit: number;
  isDefault: boolean;
  createdAt: string;
  _count?: { apiKeys: number };
}

export function RolesTab() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    canSend: false,
    canReceive: true,
    allowedCommands: "all" as string,
    maxConnections: 10,
    rateLimit: 100,
    isDefault: false,
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/roles");
      const data = await res.json();
      if (data.success) {
        setRoles(data.data);
      }
    } catch (error) {
      console.error("Error fetching roles:", error);
      toast.error("Failed to fetch roles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async () => {
    try {
      const res = await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Role created");
        setDialogOpen(false);
        resetForm();
        fetchData();
      } else {
        toast.error(data.error || "Failed to create role");
      }
    } catch (error) {
      toast.error("Failed to create role");
    }
  };

  const handleUpdate = async () => {
    if (!editingRole) return;

    try {
      const res = await fetch(`/api/roles/${editingRole.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Role updated");
        setDialogOpen(false);
        resetForm();
        fetchData();
      } else {
        toast.error(data.error || "Failed to update role");
      }
    } catch (error) {
      toast.error("Failed to update role");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/roles/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.success("Role deleted");
        fetchData();
      } else {
        toast.error(data.error || "Failed to delete role");
      }
    } catch (error) {
      toast.error("Failed to delete role");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      canSend: false,
      canReceive: true,
      allowedCommands: "all",
      maxConnections: 10,
      rateLimit: 100,
      isDefault: false,
    });
    setEditingRole(null);
  };

  const openEditDialog = (role: Role) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      description: role.description || "",
      canSend: role.canSend,
      canReceive: role.canReceive,
      allowedCommands: role.allowedCommands,
      maxConnections: role.maxConnections,
      rateLimit: role.rateLimit,
      isDefault: role.isDefault,
    });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Roles</h2>
          <p className="text-muted-foreground">Manage WebSocket client roles and permissions</p>
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
                Add Role
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingRole ? "Edit Role" : "Add Role"}</DialogTitle>
                <DialogDescription>Configure role permissions for WebSocket clients</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
                <div className="grid gap-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="admin"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Role description"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="canReceive">Can Receive Data</Label>
                    <Switch
                      id="canReceive"
                      checked={formData.canReceive}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, canReceive: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="canSend">Can Send Commands</Label>
                    <Switch
                      id="canSend"
                      checked={formData.canSend}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, canSend: checked })
                      }
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Allowed Commands</Label>
                  <div className="flex items-center gap-2 mb-2">
                    <Switch
                      checked={formData.allowedCommands === "all"}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, allowedCommands: checked ? "all" : "" })
                      }
                    />
                    <Label>Allow All Commands</Label>
                  </div>
                  {formData.allowedCommands !== "all" && (
                    <div className="flex flex-wrap gap-2 p-3 border rounded-lg">
                      {ALL_COMMAND_IDS.map((cmd) => (
                        <Badge
                          key={cmd}
                          variant={
                            formData.allowedCommands.includes(cmd) ? "default" : "outline"
                          }
                          className="cursor-pointer"
                          onClick={() => {
                            const current = formData.allowedCommands
                              ? formData.allowedCommands.split(",")
                              : [];
                            const updated = current.includes(cmd)
                              ? current.filter((c) => c !== cmd)
                              : [...current, cmd];
                            setFormData({ ...formData, allowedCommands: updated.join(",") });
                          }}
                        >
                          ${cmd}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="maxConnections">Max Connections</Label>
                    <Input
                      id="maxConnections"
                      type="number"
                      value={formData.maxConnections}
                      onChange={(e) =>
                        setFormData({ ...formData, maxConnections: parseInt(e.target.value) })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="rateLimit">Rate Limit (msg/min)</Label>
                    <Input
                      id="rateLimit"
                      type="number"
                      value={formData.rateLimit}
                      onChange={(e) =>
                        setFormData({ ...formData, rateLimit: parseInt(e.target.value) })
                      }
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="isDefault">Default Role</Label>
                  <Switch
                    id="isDefault"
                    checked={formData.isDefault}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, isDefault: checked })
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={editingRole ? handleUpdate : handleCreate}>
                  {editingRole ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Roles
          </CardTitle>
          <CardDescription>WebSocket client role configurations</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : roles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No roles configured. Click "Add Role" to create one.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Can Receive</TableHead>
                  <TableHead>Can Send</TableHead>
                  <TableHead>Commands</TableHead>
                  <TableHead>Max Conn</TableHead>
                  <TableHead>API Keys</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium">
                      {role.name}
                      {role.isDefault && (
                        <Badge variant="secondary" className="ml-2">
                          Default
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={role.canReceive ? "default" : "secondary"}>
                        {role.canReceive ? "Yes" : "No"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={role.canSend ? "default" : "secondary"}>
                        {role.canSend ? "Yes" : "No"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {role.allowedCommands === "all" ? (
                          <Badge variant="outline">All</Badge>
                        ) : (
                          role.allowedCommands.split(",").map((cmd) => (
                            <Badge key={cmd} variant="outline">
                              ${cmd}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{role.maxConnections}</TableCell>
                    <TableCell>{role._count?.apiKeys || 0}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEditDialog(role)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Role</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{role.name}"? This will also
                                delete all API keys using this role.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(role.id)}
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
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
