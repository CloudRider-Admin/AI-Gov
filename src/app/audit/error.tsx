"use client";

import { GovernanceError } from "@/components/app";

export default function AuditError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <GovernanceError {...props} surface="the audit trail" />;
}
