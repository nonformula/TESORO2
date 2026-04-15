from __future__ import annotations

from typing import Dict, List
import pandas as pd


def detect_recurring_charges(transactions: pd.DataFrame, min_occurrences: int = 3) -> List[Dict]:
    """
    Very basic recurring detector:
    groups by merchant and looks for repeated outflows with similar amounts
    """
    df = transactions.copy()
    df["date"] = pd.to_datetime(df["date"])
    df = df[df["direction"] == "outflow"]

    findings = []

    for merchant, group in df.groupby("merchant"):
        if len(group) < min_occurrences:
            continue

        group = group.sort_values("date")
        amount_std = group["amount"].std() if len(group) > 1 else 0
        avg_amount = group["amount"].mean()

        day_gaps = group["date"].diff().dt.days.dropna()
        if day_gaps.empty:
            continue

        avg_gap = day_gaps.mean()

        frequency = None
        if 25 <= avg_gap <= 35:
            frequency = "monthly"
        elif 10 <= avg_gap <= 18:
            frequency = "biweekly"
        elif 5 <= avg_gap <= 9:
            frequency = "weekly"

        if frequency:
            findings.append({
                "merchant": merchant,
                "avg_amount": float(round(avg_amount, 2)),
                "amount_std": float(round(0 if pd.isna(amount_std) else amount_std, 2)),
                "occurrences": int(len(group)),
                "frequency": frequency,
                "last_seen": str(group["date"].max().date())
            })

    return findings