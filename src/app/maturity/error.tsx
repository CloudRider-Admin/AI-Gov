"use client";

import { GovernanceError } from "@/components/app";

export default function MaturityError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <GovernanceError {...props} surface="your maturity score" />;
}
