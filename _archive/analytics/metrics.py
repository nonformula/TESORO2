from __future__ import annotations

from dataclasses import dataclass
from typing import Dict
import pandas as pd


@dataclass
class MetricResults:
    monthly_income: float
    monthly_spend: float
    monthly_savings: float
    savings_rate: float
    avg_transaction_size: float
    discretionary_spend: float
    fixed_spend: float


def calculate_metrics(transactions: pd.DataFrame) -> Dict:
    """
    Expected columns:
    - date
    - amount
    - direction ('inflow' or 'outflow')
    - category
    - is_discretionary (bool)
    - is_fixed (bool)
    """

    df = transactions.copy()
    df["date"] = pd.to_datetime(df["date"])

    income = df.loc[df["direction"] == "inflow", "amount"].sum()
    spend = df.loc[df["direction"] == "outflow", "amount"].sum()
    savings = income - spend
    savings_rate = (savings / income) if income > 0 else 0.0

    outflows = df.loc[df["direction"] == "outflow", "amount"]
    avg_transaction_size = float(outflows.mean()) if not outflows.empty else 0.0

    discretionary_spend = df.loc[
        (df["direction"] == "outflow") & (df["is_discretionary"] == True),
        "amount"
    ].sum()

    fixed_spend = df.loc[
        (df["direction"] == "outflow") & (df["is_fixed"] == True),
        "amount"
    ].sum()

    by_category = (
        df.loc[df["direction"] == "outflow"]
        .groupby("category", dropna=False)["amount"]
        .sum()
        .sort_values(ascending=False)
        .to_dict()
    )

    return {
        "summary": MetricResults(
            monthly_income=float(income),
            monthly_spend=float(spend),
            monthly_savings=float(savings),
            savings_rate=float(round(savings_rate, 4)),
            avg_transaction_size=float(round(avg_transaction_size, 2)),
            discretionary_spend=float(discretionary_spend),
            fixed_spend=float(fixed_spend),
        ).__dict__,
        "spend_by_category": by_category,
    }