import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { MailboxIntegration } from "@/components/mail/MailboxIntegration";
import { WebmailView } from "@/components/mail/WebmailView";

export default function MailPage() {
  const { user } = useAuth();
  const [view, setView] = useState<"integration" | "webmail">("integration");
  const [hasInitialSwitched, setHasInitialSwitched] = useState(false);
  const [openComposer, setOpenComposer] = useState(false);
 
  const { data: mailboxes = [], isLoading } = useQuery({
    queryKey: ["connected-mailboxes", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const data = await api.get<any[]>('/email/mailboxes');
      return data || [];
    },
    enabled: !!user,
  });
 
  // Auto-switch to webmail view if mailboxes exist on initial load
  useEffect(() => {
    if (!isLoading && mailboxes.length > 0 && !hasInitialSwitched) {
      setView("webmail");
      setHasInitialSwitched(true);
    }
  }, [mailboxes.length, isLoading, hasInitialSwitched]);

  if (view === "webmail" && mailboxes.length > 0) {
    return (
      <WebmailView
        mailboxes={mailboxes}
        onBackToIntegration={() => setView("integration")}
        initialOpenComposer={openComposer}
      />
    );
  }

  return (
    <MailboxIntegration
      onMailboxConnected={() => {
        setOpenComposer(false);
        setView("webmail");
      }}
      onComposeClick={() => {
        setOpenComposer(true);
        setView("webmail");
      }}
    />
  );
}


