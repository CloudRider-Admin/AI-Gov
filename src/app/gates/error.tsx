"use client";

import { GovernanceError } from "@/components/app";

export default function GatesError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <GovernanceError {...props} surface="the governance gates board" />;
}
