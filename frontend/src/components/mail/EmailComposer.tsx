import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Send, Paperclip, ChevronDown, ChevronUp, X } from "lucide-react";
import { api } from '@/lib/api';
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface EmailComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mailboxes: any[];
  replyTo?: any;
  forwardEmail?: any;
}

export function EmailComposer({ open, onOpenChange, mailboxes, replyTo, forwardEmail }: EmailComposerProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [sending, setSending] = useState(false);

  const [form, setForm] = useState({
    mailbox_id: mailboxes[0]?.id || "",
    to: replyTo?.from_email || "",
    cc: "",
    bcc: "",
    subject: replyTo
      ? `Re: ${replyTo.subject}`
      : forwardEmail
      ? `Fwd: ${forwardEmail.subject}`
      : "",
    body: forwardEmail
      ? `\n\n---------- Forwarded message ----------\nFrom: ${forwardEmail.from_email}\nSubject: ${forwardEmail.subject}\n\n${forwardEmail.body || ""}`
      : "",

  });

  const [attachments, setAttachments] = useState<File[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const fileToBase64 = (file: File): Promise<{ filename: string, content: string, type: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve({
          filename: file.name,
          content: base64String,
          type: file.type
        });
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleSend = async () => {
    if (!user) return;
    if (!form.to || !form.subject) {
      toast.error("To and Subject are required");
      return;
    }

    setSending(true);
    try {
      const base64Attachments = await Promise.all(attachments.map(fileToBase64));

      // Send via edge function (real Gmail API / Graph API)
      const data = await api.post<any>('/email/send', {
          mailbox_id: form.mailbox_id,
          to: form.to,
          cc: form.cc || undefined,
          bcc: form.bcc || undefined,
          subject: form.subject,
          body: form.body,
          attachments: base64Attachments,
          in_reply_to: replyTo?.message_id || undefined,
          thread_id: replyTo?.thread_id || undefined,
      });
      if (data?.error) throw new Error(data.error);

      toast.success("Email sent successfully");
      queryClient.invalidateQueries({ queryKey: ["emails"] });
      queryClient.invalidateQueries({ queryKey: ["email-counts"] });
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to send email");
    } finally {
      setSending(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{replyTo ? "Reply" : forwardEmail ? "Forward" : "New Email"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {mailboxes.length > 1 && (
            <div className="space-y-1">
              <Label className="text-xs">From</Label>
              <Select value={form.mailbox_id} onValueChange={(v) => setForm({ ...form, mailbox_id: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {mailboxes.map((mb) => (
                    <SelectItem key={mb.id} value={mb.id}>
                      {mb.email_address}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs">To</Label>
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setShowCcBcc(!showCcBcc)}>
                {showCcBcc ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                CC/BCC
              </Button>
            </div>
            <Input
              placeholder="recipient@example.com"
              value={form.to}
              onChange={(e) => setForm({ ...form, to: e.target.value })}
            />
          </div>

          {showCcBcc && (
            <>
              <div className="space-y-1">
                <Label className="text-xs">CC</Label>
                <Input
                  placeholder="cc@example.com"
                  value={form.cc}
                  onChange={(e) => setForm({ ...form, cc: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">BCC</Label>
                <Input
                  placeholder="bcc@example.com"
                  value={form.bcc}
                  onChange={(e) => setForm({ ...form, bcc: e.target.value })}
                />
              </div>
            </>
          )}

          <div className="space-y-1">
            <Label className="text-xs">Subject</Label>
            <Input
              placeholder="Email subject"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <Textarea
              placeholder="Write your message..."
              className="min-h-[200px] resize-y"
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
            />
          </div>

          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {attachments.map((file, i) => (
                <Badge key={i} variant="secondary" className="pl-2 flex items-center gap-1 group">
                  <span className="max-w-[150px] truncate">{file.name}</span>
                  <button 
                    onClick={() => removeAttachment(i)}
                    className="hover:text-destructive p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-4 mt-6 border-t">
          <div className="flex items-center gap-2">
            <input
              type="file"
              id="file-upload"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-9 w-9 rounded-full hover:bg-primary/10 hover:text-primary transition-all"
              onClick={() => document.getElementById('file-upload')?.click()}
              title="Attach files"
            >
              <Paperclip className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => onOpenChange(false)}
              className="rounded-full px-6"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSend} 
              disabled={sending} 
              className="gradient-primary text-primary-foreground rounded-full px-8 shadow-lg hover:shadow-primary/20 transition-all"
            >
              <Send className="mr-2 h-4 w-4" />
              {sending ? "Sending..." : "Send"}
            </Button>
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}
