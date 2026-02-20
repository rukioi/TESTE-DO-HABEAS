import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { apiService } from "@/services/apiService";

export function ScheduledNotificationEditDialog({ open, onOpenChange, notification, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; notification: any | null; onSaved: (n: any) => void }) {
  const [message, setMessage] = useState(notification?.message || "");
  const [date, setDate] = useState(notification?.scheduledDate || "");
  const [time, setTime] = useState(notification?.scheduledTime || "");

  if (!notification) return null;

  const handleSave = async () => {
    try {
      const patch: any = { message };
      if (date && time) {
        patch.scheduledDate = date;
        patch.scheduledTime = time;
        patch.status = "scheduled";
      }
      const resp = await apiService.updateScheduledNotification(notification.id, patch);
      onSaved(resp?.scheduled || { ...notification, message, scheduledDate: date, scheduledTime: time });
      onOpenChange(false);
    } catch {
      alert("Erro ao salvar notificação");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar Notificação</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Mensagem</Label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} className="min-h-32" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data (opcional)</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label>Hora (opcional)</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Salvar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
