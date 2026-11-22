import { Mail } from "lucide-react";
import type { SOSEmailNotice } from "@/lib/terrapulseClient";

const labels: Record<SOSEmailNotice["status"], string> = {
  manual: "Send the exercise summary from your Gmail account.",
  queued: "Email summary queued for the exercise inbox.",
  sending: "Submitting the summary to the mail server.",
  accepted: "The mail server accepted the exercise summary.",
  failed: "Automatic email failed. You can send the summary manually.",
  uncertain: "Email delivery is unconfirmed. Check the exercise inbox before following up.",
  cancelled: "Email forwarding closed for this request.",
};

export default function SosEmailStatus({ notice, requestId }: { notice: SOSEmailNotice; requestId?: string }) {
  const draft = notice.draft;
  const query = draft && new URLSearchParams({ view: "cm", fs: "1", to: draft.to, su: draft.subject, body: draft.body });
  return <div className="tp-email-status">
    <Mail size={17} aria-hidden="true" /><div>{requestId && <small>{requestId}</small>}
      <p>{labels[notice.status]}</p>
      {query && <a className="tp-button" href={`https://mail.google.com/mail/?${query}`} target="_blank" rel="noreferrer">Open Gmail draft</a>}
    </div>
  </div>;
}
