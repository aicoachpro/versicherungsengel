"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mail, RefreshCw, ChevronDown, ChevronUp, ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface InboundEmail {
  id: number;
  accountId: number;
  messageId: string;
  fromAddress: string;
  fromName: string | null;
  subject: string | null;
  body: string | null;
  receivedAt: string | null;
  processedAt: string | null;
  leadId: number | null;
  status: string;
  errorMessage: string | null;
}

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Ausstehend", variant: "secondary" },
  processing: { label: "Verarbeitung", variant: "outline" },
  done: { label: "Erledigt", variant: "default" },
  skipped: { label: "Übersprungen", variant: "outline" },
  error: { label: "Fehler", variant: "destructive" },
};

export default function EmailInboxPage() {
  const [emails, setEmails] = useState<InboundEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchEmails = useCallback(async () => {
    try {
      const res = await fetch("/api/email-inbox");
      if (res.ok) {
        const data = await res.json();
        setEmails(data);
      }
    } catch {
      // API noch nicht verfuegbar
    }
  }, []);

  const refreshEmails = useCallback(async () => {
    setLoading(true);
    try {
      const refreshRes = await fetch("/api/email-inbox/refresh", { method: "POST" });
      if (refreshRes.ok) {
        const data = await refreshRes.json();
        const newMails = (data?.poll?.newEmails as number | undefined) ?? 0;
        const processed = (data?.process?.processed as number | undefined) ?? 0;
        if (newMails > 0) {
          toast.success(`${newMails} neue Mail${newMails === 1 ? "" : "s"} abgeholt, ${processed} verarbeitet`);
        } else if (processed > 0) {
          toast.success(`${processed} pendente Mail${processed === 1 ? "" : "s"} verarbeitet`);
        } else {
          toast.info("Keine neuen E-Mails");
        }
      } else {
        toast.error("Abholung fehlgeschlagen");
      }
    } catch {
      toast.error("Abholung fehlgeschlagen");
    }
    await fetchEmails();
    setLoading(false);
  }, [fetchEmails]);

  const deleteEmail = async (id: number) => {
    await fetch(`/api/email-inbox?id=${id}`, { method: "DELETE" });
    toast.success("E-Mail gelöscht");
    setEmails((prev) => prev.filter((e) => e.id !== id));
  };

  useEffect(() => {
    // Initial nur aus DB laden — ohne IMAP zu pollen
    setLoading(true);
    fetchEmails().finally(() => setLoading(false));
  }, [fetchEmails]);

  const filtered = filter === "all" ? emails : emails.filter((e) => e.status === filter);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex flex-col h-full">
      <Header
        title="E-Mail-Eingang"
        actions={
          <Button variant="outline" size="sm" onClick={refreshEmails} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Wird abgeholt..." : "Mails abholen"}
          </Button>
        }
      />
      <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-4">
        {/* Filter */}
        <div className="flex items-center gap-3">
          <Select value={filter} onValueChange={(v) => { if (v) setFilter(v); }}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Status filtern" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Status</SelectItem>
              <SelectItem value="pending">Ausstehend</SelectItem>
              <SelectItem value="processing">Verarbeitung</SelectItem>
              <SelectItem value="done">Erledigt</SelectItem>
              <SelectItem value="error">Fehler</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">
            {filtered.length} E-Mail{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Eingehende E-Mails
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading && emails.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Laden...</p>
            ) : filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Keine E-Mails vorhanden
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-36">Zeitpunkt</TableHead>
                      <TableHead>Von</TableHead>
                      <TableHead>Betreff</TableHead>
                      <TableHead className="w-28">Status</TableHead>
                      <TableHead className="w-24">Lead</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((email) => {
                      const statusInfo = STATUS_LABELS[email.status] || STATUS_LABELS.pending;
                      const isExpanded = expandedId === email.id;
                      return (
                        <>
                          <TableRow
                            key={email.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => setExpandedId(isExpanded ? null : email.id)}
                          >
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatDate(email.receivedAt)}
                            </TableCell>
                            <TableCell className="max-w-48 truncate">
                              {email.fromName ? (
                                <span>
                                  <span className="font-medium">{email.fromName}</span>
                                  <span className="text-muted-foreground text-xs ml-1">
                                    &lt;{email.fromAddress}&gt;
                                  </span>
                                </span>
                              ) : (
                                email.fromAddress
                              )}
                            </TableCell>
                            <TableCell className="max-w-64 truncate">
                              {email.subject || "—"}
                            </TableCell>
                            <TableCell>
                              <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                            </TableCell>
                            <TableCell>
                              {email.leadId ? (
                                <Link
                                  href={`/pipeline/${email.leadId}`}
                                  className="inline-flex items-center gap-1 text-primary hover:underline text-sm"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  #{email.leadId}
                                  <ExternalLink className="h-3 w-3" />
                                </Link>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={(e) => { e.stopPropagation(); deleteEmail(email.id); }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              )}
                            </TableCell>
                          </TableRow>
                          {isExpanded && (
                            <TableRow key={`${email.id}-detail`}>
                              <TableCell colSpan={6} className="bg-muted/30">
                                <div className="space-y-2 py-2">
                                  {email.errorMessage && (
                                    <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
                                      <p className="text-sm font-medium text-destructive">Fehler</p>
                                      <p className="text-xs text-destructive/80 mt-1">
                                        {email.errorMessage}
                                      </p>
                                    </div>
                                  )}
                                  {email.body && (
                                    <div>
                                      <p className="text-xs font-medium text-muted-foreground mb-1">
                                        E-Mail-Text (Auszug):
                                      </p>
                                      <p className="text-xs whitespace-pre-wrap bg-background rounded-md p-3 border max-h-48 overflow-y-auto">
                                        {email.body.substring(0, 1000)}
                                        {email.body.length > 1000 && "..."}
                                      </p>
                                    </div>
                                  )}
                                  {email.processedAt && (
                                    <p className="text-xs text-muted-foreground">
                                      Verarbeitet: {formatDate(email.processedAt)}
                                    </p>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
