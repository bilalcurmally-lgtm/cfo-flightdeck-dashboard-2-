import type { ReviewPreset } from "../finance/review-presets";
import { reviewPresetLabel } from "../finance/review-presets";
import type { PeriodSummary } from "../finance/summary";
import type { PeriodGrain } from "../finance/types";
import { trendGrainLabel } from "../ui/controls";
import { buildTrendSvg } from "./trend-svg";

export interface VisibleTrendSvgOptions {
  periods: PeriodSummary[];
  trendGrain: PeriodGrain;
  sourceName: string;
  reviewPreset: ReviewPreset;
  currency: string;
}

export function buildVisibleTrendSvg(options: VisibleTrendSvgOptions): string {
  return buildTrendSvg(options.periods, {
    title: `${trendGrainLabel(options.trendGrain)} Trend`,
    subtitle: `${options.sourceName} · ${reviewPresetLabel(options.reviewPreset)}`,
    currency: options.currency
  });
}
