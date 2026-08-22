"use client";

import { GovernanceError } from "@/components/app";

export default function ReportError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <GovernanceError {...props} surface="the board report" />;
}
