import { redirect } from "next/navigation";

/**
 * The public pricing page is currently hidden. The full implementation is
 * preserved in `_pricingPageDisabled.tsx` (not routed) and can be restored by
 * moving it back to `page.tsx`. Until then, `/pricing` sends visitors home.
 */
export default function PricingPage() {
  redirect("/");
}
