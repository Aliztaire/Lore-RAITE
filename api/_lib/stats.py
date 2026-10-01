import numpy as np
import pandas as pd
try:
    import pingouin as pg
except ImportError:
    pg = None

from fastapi import FastAPI
from pydantic import BaseModel
from scipy import stats
from typing import List, Optional, Dict


class ResearchData(BaseModel):
    groups: Dict[str, List[Optional[float]]]
    criteria_min: Optional[float] = None
    criteria_max: Optional[float] = None
    purpose: str = "independent"


def clean_group(raw_data, min_val, max_val):
    report = {
        "initial_count": len(raw_data),
        "missing_removed": 0,
        "criteria_removed": 0,
        "outliers_removed": 0,
        "final_count": 0,
        "outliers": []
    }

    cleaned_1 = [x for x in raw_data if x is not None and not np.isnan(x)]
    report["missing_removed"] = len(raw_data) - len(cleaned_1)

    cleaned_2 = []
    for x in cleaned_1:
        if min_val is not None and x < min_val: continue
        if max_val is not None and x > max_val: continue
        cleaned_2.append(x)
    report["criteria_removed"] = len(cleaned_1) - len(cleaned_2)

    # Only apply IQR outlier removal when there are enough points
    # that losing a few won't drop below the minimum needed for tests
    if len(cleaned_2) >= 8:
        q1, q3 = np.percentile(cleaned_2, [25, 75])
        iqr = q3 - q1
        lower_bound = q1 - 1.5 * iqr
        upper_bound = q3 + 1.5 * iqr

        final_data = []
        for x in cleaned_2:
            if x < lower_bound or x > upper_bound:
                report["outliers"].append(x)
            else:
                final_data.append(x)

        # Safety: if outlier removal leaves too few points, keep the cleaned data as-is
        if len(final_data) < 3:
            report["outliers_removed"] = 0
            report["outliers"] = []
            report["final_count"] = len(cleaned_2)
            return cleaned_2, report

        report["outliers_removed"] = len(cleaned_2) - len(final_data)
        report["final_count"] = len(final_data)
        return final_data, report
    else:
        report["final_count"] = len(cleaned_2)
        return cleaned_2, report


def clean_pairwise_groups(clean_dict, min_val, max_val):
    keys = list(clean_dict.keys())
    if len(keys) != 2:
        return clean_dict, {}

    k1, k2 = keys[0], keys[1]
    g1_raw = clean_dict[k1]
    g2_raw = clean_dict[k2]

    report_dict = {
        k1: {"initial_count": len(g1_raw), "missing_removed": 0, "criteria_removed": 0, "outliers_removed": 0, "final_count": 0, "outliers": []},
        k2: {"initial_count": len(g2_raw), "missing_removed": 0, "criteria_removed": 0, "outliers_removed": 0, "final_count": 0, "outliers": []}
    }

    paired_1, paired_2 = [], []
    for a, b in zip(g1_raw, g2_raw):
        if a is not None and b is not None and not np.isnan(a) and not np.isnan(b):
            paired_1.append(a)
            paired_2.append(b)

    missing_count = len(g1_raw) - len(paired_1)
    report_dict[k1]["missing_removed"] = missing_count
    report_dict[k2]["missing_removed"] = missing_count

    filtered_1, filtered_2 = [], []
    for a, b in zip(paired_1, paired_2):
        if min_val is not None and (a < min_val or b < min_val): continue
        if max_val is not None and (a > max_val or b > max_val): continue
        filtered_1.append(a)
        filtered_2.append(b)

    crit_count = len(paired_1) - len(filtered_1)
    report_dict[k1]["criteria_removed"] = crit_count
    report_dict[k2]["criteria_removed"] = crit_count

    report_dict[k1]["final_count"] = len(filtered_1)
    report_dict[k2]["final_count"] = len(filtered_2)

    return {k1: filtered_1, k2: filtered_2}, report_dict


async def analyze_data(data: ResearchData):
    if not data.groups:
        return {"error": "No groups provided."}

    active_groups = {k: v for k, v in data.groups.items() if v and isinstance(v, list) and len(v) > 0}
    if len(active_groups) < 2:
        return {"error": "At least two groups are required for analysis."}

    cleaned_groups = {}
    reports = {}

    if data.purpose in ['correlation', 'paired'] and len(active_groups) == 2:
        cleaned_groups, reports = clean_pairwise_groups(active_groups, data.criteria_min, data.criteria_max)
    else:
        for name, vals in active_groups.items():
            g_clean, g_rep = clean_group(vals, data.criteria_min, data.criteria_max)
            cleaned_groups[name] = g_clean
            reports[name] = g_rep

    for name, g in cleaned_groups.items():
        if len(g) < 3:
            return {
                "error": f'"{name}" has only {len(g)} usable data point{"s" if len(g) != 1 else ""} after cleaning. '
                         f'Each group needs at least 3 valid values. '
                         f'Check for missing values, extreme exclusion criteria, or simply add more data points.'
            }

    group_stats = []
    for name, vals in cleaned_groups.items():
        mean_val = float(np.mean(vals))
        std_val = float(np.std(vals, ddof=1))
        group_stats.append({
            "name": name,
            "mean": round(mean_val, 4),
            "std": round(std_val, 4),
            "count": len(vals)
        })

    logic_steps = {}
    test_name = ""
    stat = 0.0
    p = 1.0
    post_hoc = None

    if data.purpose == 'correlation':
        keys = list(cleaned_groups.keys())
        gA, gB = cleaned_groups[keys[0]], cleaned_groups[keys[1]]

        _, p_norm_a = stats.shapiro(gA)
        _, p_norm_b = stats.shapiro(gB)
        logic_steps[f"normality_p_({keys[0]})"] = float(round(p_norm_a, 4))
        logic_steps[f"normality_p_({keys[1]})"] = float(round(p_norm_b, 4))

        is_normal = (p_norm_a >= 0.05) and (p_norm_b >= 0.05)

        if is_normal:
            test_name = "Pearson Correlation"
            res = stats.pearsonr(gA, gB)
            stat = res.statistic
            p = res.pvalue
        else:
            test_name = "Spearman Correlation"
            res = stats.spearmanr(gA, gB)
            stat = res.statistic
            p = res.pvalue

    elif data.purpose == 'paired':
        keys = list(cleaned_groups.keys())
        gA, gB = cleaned_groups[keys[0]], cleaned_groups[keys[1]]

        diffs = [a - b for a, b in zip(gA, gB)]
        _, p_norm_diff = stats.shapiro(diffs)
        logic_steps["normality_p_diff"] = float(round(p_norm_diff, 4))

        is_normal = (p_norm_diff >= 0.05)

        if is_normal:
            test_name = "Paired T-test"
            res = stats.ttest_rel(gA, gB)
            stat = res.statistic
            p = res.pvalue
        else:
            test_name = "Wilcoxon Signed-Rank"
            res = stats.wilcoxon(gA, gB)
            stat = res.statistic
            p = res.pvalue

    else:
        if not pg:
            return {"error": "Pingouin library not installed on the server backend. Please run 'pip install pingouin pandas'."}

        group_keys = list(cleaned_groups.keys())
        rows = []
        for k, vals in cleaned_groups.items():
            for v in vals:
                rows.append({'value': float(v), 'group': k})
        df = pd.DataFrame(rows)

        try:
            homog_res = pg.homoscedasticity(data=df, dv='value', group='group', method='levene')
            p_homog = homog_res['pval'].iloc[0]
            logic_steps["homogeneity_p"] = float(round(p_homog, 4))
            is_homogenous = p_homog >= 0.05

            norm_res = pg.normality(data=df, dv='value', group='group', method='shapiro')
            is_normal = all(norm_res['normal'])
            for idx, row in norm_res.iterrows():
                logic_steps[f"normality_p_({idx})"] = float(round(row['pval'], 4))

            if is_normal and is_homogenous:
                test_name = "ANOVA (One-Way)" if len(group_keys) > 2 else "Independent T-test"
                anova = pg.anova(data=df, dv='value', between='group')
                p = anova['p-unc'].iloc[0]
                stat = anova['F'].iloc[0]
                if len(group_keys) > 2:
                    ph = pg.pairwise_tukey(data=df, dv='value', between='group')
                    post_hoc = ph[['A', 'B', 'p-tukey']].rename(columns={'p-tukey': 'p_value'}).to_dict('records')
            elif is_normal and not is_homogenous:
                test_name = "Welch's ANOVA" if len(group_keys) > 2 else "Welch's T-test"
                welch = pg.welch_anova(data=df, dv='value', between='group')
                p = welch['p-unc'].iloc[0]
                stat = welch['F'].iloc[0]
                if len(group_keys) > 2:
                    ph = pg.pairwise_gameshowell(data=df, dv='value', between='group')
                    post_hoc = ph[['A', 'B', 'pval']].rename(columns={'pval': 'p_value'}).to_dict('records')
            else:
                test_name = "Kruskal-Wallis ANOVA" if len(group_keys) > 2 else "Mann-Whitney U"
                kw = pg.kruskal(data=df, dv='value', between='group')
                p = kw['p-unc'].iloc[0]
                stat = kw['H'].iloc[0]
                if len(group_keys) > 2:
                    ph = pg.pairwise_dunn(data=df, dv='value', between='group')
                    post_hoc = ph[['A', 'B', 'pval']].rename(columns={'pval': 'p_value'}).to_dict('records')
        except Exception as e:
            test_name = f"Error analyzing data: {e}"

    return {
        "cleaning_report": reports,
        "group_stats": group_stats,
        "logic_steps": logic_steps,
        "recommended_test": str(test_name),
        "statistic": float(round(stat, 4)) if not np.isnan(stat) else 0.0,
        "p_value": float(round(p, 4)) if not np.isnan(p) else 1.0,
        "significant": bool(p < 0.05),
        "post_hoc": post_hoc
    }


def create_app() -> FastAPI:
    app = FastAPI()

    # Catch-all: this file is bound 1:1 to a single Vercel route (/api/analyze),
    # so any path the platform forwards here — "/" or the full original path —
    # resolves to the same handler.
    @app.post("/{full_path:path}")
    async def analyze(data: ResearchData):
        return await analyze_data(data)

    return app
