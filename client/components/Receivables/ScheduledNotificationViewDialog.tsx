import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Calendar, MessageSquare } from "lucide-react";

export function ScheduledNotificationViewDialog({ open, onOpenChange, notification }: { open: boolean; onOpenChange: (o: boolean) => void; notification: any | null }) {
  if (!notification) return null;
  const statusBadge =
    notification.status === "agendada" ? "bg-blue-100 text-blue-800" :
      notification.status === "enviada" ? "bg-green-100 text-green-800" :
        "bg-yellow-100 text-yellow-800";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Notificação
          </DialogTitle>
          <DialogDescription>Detalhes da notificação agendada ou enviada</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge className={statusBadge}>
              {notification.status === "agendada" ? "📅 Agendada" : notification.status === "enviada" ? "✅ Enviada" : "⏳ Pendente"}
            </Badge>
            <span className="text-sm text-muted-foreground">via WhatsApp</span>
          </div>
          <div className="text-sm">
            <p><strong>Telefone:</strong> {notification.clientPhone}</p>
            {notification.invoiceId && <p><strong>Fatura:</strong> {notification.invoiceId}</p>}
            {notification.isScheduled && notification.scheduledDate && notification.scheduledTime && (
              <p className="flex items-center gap-2"><Calendar className="h-4 w-4" /> Agendado para {notification.scheduledDate} às {notification.scheduledTime}</p>
            )}
            <p><strong>Criado em:</strong> {notification.createdAt?.toLocaleString?.("pt-BR") || ""}</p>
          </div>
          <div className="bg-muted/30 p-3 rounded text-sm">
            <p className="font-medium mb-1">Mensagem:</p>
            <p className="whitespace-pre-wrap break-words">{notification.message}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

