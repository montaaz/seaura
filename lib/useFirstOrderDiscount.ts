"use client";

import { useEffect, useState } from "react";

/**
 * Looks up whether `email` still qualifies for the one-time first-order
 * discount, so the storefront can show it before checkout.
 *
 * Preview only. `createOrder` re-checks eligibility server-side and recomputes
 * the total, so a stale or forged answer here cannot grant a discount.
 *
 * The lookup is debounced, since checkout calls this while the address is
 * still being typed.
 */
export function useFirstOrderDiscount(email: string | null | undefined, debounceMs = 500) {
    const [eligible, setEligible] = useState(false);
    const [percent, setPercent] = useState(10);
    const [checking, setChecking] = useState(false);

    useEffect(() => {
        const trimmed = (email || "").trim();
        if (!trimmed || !trimmed.includes("@")) {
            setEligible(false);
            setChecking(false);
            return;
        }

        let cancelled = false;
        setChecking(true);
        const timer = setTimeout(async () => {
            try {
                const res = await fetch("/api/graphql", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        query: `query($email: String!) { firstOrderDiscount(email: $email) { eligible percent } }`,
                        variables: { email: trimmed },
                    }),
                });
                const data = await res.json();
                if (cancelled) return;
                const result = data.data?.firstOrderDiscount;
                setEligible(!!result?.eligible);
                if (result?.percent) setPercent(result.percent);
            } catch {
                if (!cancelled) setEligible(false);
            } finally {
                if (!cancelled) setChecking(false);
            }
        }, debounceMs);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [email, debounceMs]);

    /** Discount value for a given merchandise subtotal, rounded to cents. */
    const discountFor = (subtotal: number) =>
        eligible ? Number(((subtotal * percent) / 100).toFixed(2)) : 0;

    return { eligible, percent, checking, discountFor };
}
