"use client";

import { GovernanceError } from "@/components/app";

export default function TasksError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <GovernanceError {...props} surface="the remediation tracker" />;
}
