"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, AlertTriangle } from "lucide-react";

interface Insurance {
  id: number;
  bezeichnung: string;
  leadId: number | null;
  leadName: string | null;
  sparte: string | null;
  versicherer: string | null;
  beitrag: number | null;
  zahlweise: string | null;
  ablauf: string | null;
  umfang: string | null;
  notizen: string | null;
  produkt: string | null;
}

export default function VersicherungenPage() {
  const router = useRouter();
  const [insurances, setInsurances] = useState<Insurance[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/insurances")
      .then((res) => res.ok ? res.json() : [])
      .then(setInsurances);
  }, []);

  const filtered = insurances.filter((i) =>
    i.bezeichnung.toLowerCase().includes(search.toLowerCase()) ||
    (i.leadName || "").toLowerCase().includes(search.toLowerCase()) ||
    (i.versicherer || "").toLowerCase().includes(search.toLowerCase()) ||
    (i.sparte || "").toLowerCase().includes(search.toLowerCase()) ||
    (i.produkt || "").toLowerCase().includes(search.toLowerCase())
  );

  const isExpiringSoon = (date: string | null) => {
    if (!date) return false;
    const diff = new Date(date).getTime() - Date.now();
    return diff > 0 && diff < 90 * 24 * 60 * 60 * 1000;
  };

  return (
    <div className="flex flex-col">
      <Header title="Versicherungen" />
      <div className="flex-1 p-6 space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Suchen..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "Vertrag" : "Verträge"}
          </p>
        </div>

        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bezeichnung</TableHead>
                <TableHead>Produkt</TableHead>
                <TableHead>Lead</TableHead>
                <TableHead>Sparte</TableHead>
                <TableHead>Versicherer</TableHead>
                <TableHead>Beitrag</TableHead>
                <TableHead>Zahlweise</TableHead>
                <TableHead>Ablauf</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Keine Versicherungen gefunden
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((ins) => (
                  <TableRow
                    key={ins.id}
                    className={`${isExpiringSoon(ins.ablauf) ? "bg-amber-50" : ""} ${ins.leadId ? "cursor-pointer hover:bg-muted/50" : ""}`}
                    onClick={() => ins.leadId && router.push(`/pipeline/${ins.leadId}`)}
                  >
                    <TableCell className="font-medium">{ins.bezeichnung}</TableCell>
                    <TableCell>{ins.produkt || "—"}</TableCell>
                    <TableCell>
                      {ins.leadName ? (
                        <Badge variant="secondary" className="text-xs">{ins.leadName}</Badge>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      {ins.sparte && <Badge variant="outline">{ins.sparte}</Badge>}
                    </TableCell>
                    <TableCell>{ins.versicherer || "—"}</TableCell>
                    <TableCell>
                      {ins.beitrag
                        ? new Intl.NumberFormat("de-DE", {
                            style: "currency",
                            currency: "EUR",
                          }).format(ins.beitrag)
                        : "—"}
                    </TableCell>
                    <TableCell>{ins.zahlweise || "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {ins.ablauf
                          ? new Date(ins.ablauf).toLocaleDateString("de-DE")
                          : "—"}
                        {isExpiringSoon(ins.ablauf) && (
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
