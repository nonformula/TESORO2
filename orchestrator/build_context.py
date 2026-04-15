from __future__ import annotations

from typing import Dict, Any


def build_context(
    user_profile: Dict[str, Any],
    metric_results: Dict[str, Any],
    anomaly_results: list,
    recurring_results: list,
) -> Dict[str, Any]:
    """
    Build a compact packet for the LLM.
    Keep it small, clean, and evidence-first.
    """
    return {
        "user_profile": {
            "income_type": user_profile.get("income_type"),
            "stated_goals": user_profile.get("stated_goals", []),
            "risk_preferences": user_profile.get("risk_preferences"),
            "planning_horizon": user_profile.get("planning_horizon"),
        },
        "financial_summary": metric_results.get("summary", {}),
        "top_categories": metric_results.get("spend_by_category", {}),
        "anomalies": anomaly_results[:20],
        "recurring_patterns": recurring_results[:20],
        "instructions": {
            "focus": [
                "non-obvious patterns",
                "behavioral signals",
                "cash flow timing",
                "strategic opportunities"
            ],
            "avoid": [
                "generic budgeting advice",
                "unsupported psychological claims",
                "repeating obvious dashboard stats"
            ]
        }
    }