"use client";

import { GovernanceError } from "@/components/app";

export default function ComplianceError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <GovernanceError {...props} surface="your compliance posture" />;
}
