import type { ClassificationOverride } from "./classification-overrides";
import type { TransactionRecord } from "./types";

export type ClassificationRuleField =
  | "account"
  | "counterparty"
  | "description"
  | "head"
  | "subcategory";

export interface ClassificationRule {
  id: string;
  field: ClassificationRuleField;
  contains: string;
  override: ClassificationOverride;
  enabled: boolean;
  label?: string;
}

export interface ClassificationRuleApplication {
  overrides: Map<string, ClassificationOverride>;
  matchedRecordIds: Set<string>;
  matchedRuleIds: Set<string>;
}

export function applyClassificationRules(
  records: readonly TransactionRecord[],
  rules: readonly ClassificationRule[]
): Map<string, ClassificationOverride> {
  return applyClassificationRulesWithMatches(records, rules).overrides;
}

export function applyClassificationRulesWithMatches(
  records: readonly TransactionRecord[],
  rules: readonly ClassificationRule[]
): ClassificationRuleApplication {
  const overrides = new Map<string, ClassificationOverride>();
  const matchedRecordIds = new Set<string>();
  const matchedRuleIds = new Set<string>();
  const activeRules = rules.filter((rule) => rule.enabled && rule.contains.trim());

  if (activeRules.length === 0) return { overrides, matchedRecordIds, matchedRuleIds };

  for (const record of records) {
    for (const rule of activeRules) {
      if (!fieldValue(record, rule.field).toLowerCase().includes(rule.contains.toLowerCase())) {
        continue;
      }

      matchedRecordIds.add(record.id);
      matchedRuleIds.add(rule.id);
      overrides.set(record.id, {
        ...overrides.get(record.id),
        ...rule.override
      });
    }
  }

  return { overrides, matchedRecordIds, matchedRuleIds };
}

function fieldValue(record: TransactionRecord, field: ClassificationRuleField): string {
  return String(record[field] ?? "");
}
