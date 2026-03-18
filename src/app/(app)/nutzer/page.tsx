"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Shield, ShieldCheck } from "lucide-react";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  totpEnabled: number;
  createdAt: string;
}

export default function NutzerPage() {
  const [userList, setUserList] = useState<User[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "user" });
  const [error, setError] = useState("");

  const fetchUsers = useCallback(async () => {
    const res = await fetch("/api/users");
    if (res.ok) setUserList(await res.json());
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const openNew = () => {
    setEditingUser(null);
    setForm({ name: "", email: "", password: "", role: "user" });
    setError("");
    setDialogOpen(true);
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setForm({ name: user.name, email: user.email, password: "", role: user.role });
    setError("");
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (editingUser) {
      const body: Record<string, unknown> = { id: editingUser.id };
      if (form.name !== editingUser.name) body.name = form.name;
      if (form.email !== editingUser.email) body.email = form.email;
      if (form.role !== editingUser.role) body.role = form.role;
      if (form.password) body.password = form.password;

      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Fehler beim Speichern");
        return;
      }
    } else {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, email: form.email, role: form.role }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Fehler beim Erstellen");
        return;
      }
    }

    setDialogOpen(false);
    fetchUsers();
  };

  const handleDelete = async (user: User) => {
    if (!confirm(`Nutzer "${user.name}" wirklich löschen?`)) return;
    const res = await fetch(`/api/users?id=${user.id}`, { method: "DELETE" });
    if (res.ok) {
      fetchUsers();
    } else {
      const data = await res.json();
      alert(data.error || "Fehler beim Löschen");
    }
  };

  return (
    <div className="flex flex-col">
      <Header title="Nutzerverwaltung" />
      <div className="flex items-center justify-between px-6 py-4">
        <p className="text-sm text-muted-foreground">
          {userList.length} Nutzer
        </p>
        <Button onClick={openNew} className="bg-[#003781] hover:bg-[#002a63]">
          <Plus className="mr-2 h-4 w-4" />
          Neuer Nutzer
        </Button>
      </div>
      <div className="px-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>E-Mail</TableHead>
              <TableHead>Rolle</TableHead>
              <TableHead>2FA</TableHead>
              <TableHead>Erstellt</TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {userList.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                    {user.role === "admin" ? (
                      <><ShieldCheck className="mr-1 h-3 w-3" /> Admin</>
                    ) : (
                      <><Shield className="mr-1 h-3 w-3" /> User</>
                    )}
                  </Badge>
                </TableCell>
                <TableCell>
                  {user.totpEnabled ? (
                    <Badge variant="outline" className="text-emerald-600 border-emerald-300">Aktiv</Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {user.createdAt ? new Date(user.createdAt).toLocaleDateString("de-DE") : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(user)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(user)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingUser ? "Nutzer bearbeiten" : "Neuer Nutzer"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>E-Mail *</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            {editingUser && (
              <div className="space-y-2">
                <Label>Neues Passwort (leer = unverändert)</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Nur ausfüllen zum Ändern"
                />
              </div>
            )}
            {!editingUser && (
              <p className="text-sm text-muted-foreground rounded-lg border bg-muted/50 p-3">
                Der Nutzer erhält eine E-Mail mit einem Link, über den er sein Passwort selbst vergeben kann.
              </p>
            )}
            <div className="space-y-2">
              <Label>Rolle</Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm({ ...form, role: v ?? "user" })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button type="submit" className="bg-[#003781] hover:bg-[#002a63]">
                {editingUser ? "Speichern" : "Erstellen"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
