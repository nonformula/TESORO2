from __future__ import annotations

from typing import Dict, List
import pandas as pd


def detect_spend_spikes(transactions: pd.DataFrame, threshold: float = 2.0) -> List[Dict]:
    """
    Simple example:
    flags transactions above threshold * median outflow
    """
    df = transactions.copy()
    df = df[df["direction"] == "outflow"]

    if df.empty:
        return []

    median_spend = df["amount"].median()
    cutoff = median_spend * threshold

    spikes = df[df["amount"] > cutoff]

    results = []
    for _, row in spikes.iterrows():
        results.append({
            "type": "large_transaction",
            "date": str(row["date"]),
            "merchant": row.get("merchant", "unknown"),
            "category": row.get("category", "unknown"),
            "amount": float(row["amount"]),
            "baseline_median": float(median_spend),
            "reason": f"Transaction exceeds {threshold}x median outflow"
        })
    return results


def detect_category_jumps(current_period: pd.DataFrame, prior_period: pd.DataFrame) -> List[Dict]:
    current = (
        current_period[current_period["direction"] == "outflow"]
        .groupby("category")["amount"]
        .sum()
    )
    prior = (
        prior_period[prior_period["direction"] == "outflow"]
        .groupby("category")["amount"]
        .sum()
    )

    joined = pd.concat([current, prior], axis=1).fillna(0)
    joined.columns = ["current", "prior"]

    findings = []
    for category, row in joined.iterrows():
        if row["prior"] == 0 and row["current"] > 0:
            findings.append({
                "type": "new_category_spend",
                "category": category,
                "current": float(row["current"]),
                "prior": float(row["prior"])
            })
        elif row["prior"] > 0:
            pct_change = (row["current"] - row["prior"]) / row["prior"]
            if abs(pct_change) >= 0.3:
                findings.append({
                    "type": "category_change",
                    "category": category,
                    "current": float(row["current"]),
                    "prior": float(row["prior"]),
                    "pct_change": float(round(pct_change, 3))
                })
    return findings