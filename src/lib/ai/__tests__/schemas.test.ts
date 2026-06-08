import { describe, expect, it } from 'vitest';

import {
  ARTIFACT_STATUS_VALUES,
  DEPLOYMENT_TYPE_VALUES,
  DOCUMENT_TYPE_VALUES,
  EU_AI_ACT_CLASSIFICATION_VALUES,
  FRAMEWORK_CITATION_VALUES,
  LAUNCH_DECISION_VALUES,
  MODEL_TYPE_VALUES,
  PLAYBOOK_FRAMEWORK_VALUES,
  PRIORITY_VALUES,
  REQUIRED_APPROVER_VALUES,
  RISK_LEVEL_VALUES,
  RISK_TIER_VALUES,
  TASK_OWNER_VALUES,
  TASK_PRIORITY_VALUES,
  artifactStatusEnum,
  deploymentTypeEnum,
  documentTypeEnum,
  euAIActClassificationEnum,
  frameworkCitationEnum,
  launchDecisionEnum,
  modelTypeEnum,
  playbookFrameworkEnum,
  priorityEnum,
  requiredApproverEnum,
  riskLevelEnum,
  riskTierEnum,
  taskOwnerEnum,
  taskPriorityEnum,
} from '../schemas';
import type {
  DeploymentType,
  DocumentType,
  EUAIActClassification,
  FrameworkCitation,
  LaunchDecision,
  ModelType,
  PlaybookFramework,
  RequiredApprover,
  RequiredArtifact,
  RiskTierLabel,
  TaskOwner,
  TaskPriority,
} from '@/types/documents';
import type { Priority, RiskLevel } from '@/types/advisor';

/**
 * Phase 5 — schema/type sync guard.
 *
 * Each block does two checks:
 *   1. **TS compile check** — assigns the runtime `*_VALUES[number]`
 *      to its TS union counterpart and back. If the union and the array
 *      drift apart, `tsc` will reject the file.
 *   2. **Runtime check** — the Zod enum's `.options` is the same
 *      sorted set as the constant. Catches accidental ordering or
 *      duplication issues that wouldn't fail type-check.
 *
 * Adding a new value? Add it to `*_VALUES` and the matching TS union
 * — both, and these tests stay green.
 */

function assertEnumMatchesValues(
  name: string,
  enumOptions: readonly string[],
  values: readonly string[]
) {
  expect(
    [...enumOptions].sort(),
    `${name}: zod enum.options should match ${name}_VALUES`
  ).toEqual([...values].sort());
}

describe('schemas — Phase 5 sync guard', () => {
  describe('Zod enum.options matches the *_VALUES constant', () => {
    it('documentTypeEnum', () => {
      assertEnumMatchesValues('DOCUMENT_TYPE', documentTypeEnum.options, DOCUMENT_TYPE_VALUES);
    });

    it('playbookFrameworkEnum', () => {
      assertEnumMatchesValues(
        'PLAYBOOK_FRAMEWORK',
        playbookFrameworkEnum.options,
        PLAYBOOK_FRAMEWORK_VALUES
      );
    });

    it('riskTierEnum', () => {
      assertEnumMatchesValues('RISK_TIER', riskTierEnum.options, RISK_TIER_VALUES);
    });

    it('riskLevelEnum', () => {
      assertEnumMatchesValues('RISK_LEVEL', riskLevelEnum.options, RISK_LEVEL_VALUES);
    });

    it('modelTypeEnum', () => {
      assertEnumMatchesValues('MODEL_TYPE', modelTypeEnum.options, MODEL_TYPE_VALUES);
    });

    it('deploymentTypeEnum', () => {
      assertEnumMatchesValues('DEPLOYMENT_TYPE', deploymentTypeEnum.options, DEPLOYMENT_TYPE_VALUES);
    });

    it('euAIActClassificationEnum', () => {
      assertEnumMatchesValues(
        'EU_AI_ACT_CLASSIFICATION',
        euAIActClassificationEnum.options,
        EU_AI_ACT_CLASSIFICATION_VALUES
      );
    });

    it('requiredApproverEnum', () => {
      assertEnumMatchesValues(
        'REQUIRED_APPROVER',
        requiredApproverEnum.options,
        REQUIRED_APPROVER_VALUES
      );
    });

    it('launchDecisionEnum', () => {
      assertEnumMatchesValues('LAUNCH_DECISION', launchDecisionEnum.options, LAUNCH_DECISION_VALUES);
    });

    it('taskOwnerEnum', () => {
      assertEnumMatchesValues('TASK_OWNER', taskOwnerEnum.options, TASK_OWNER_VALUES);
    });

    it('taskPriorityEnum', () => {
      assertEnumMatchesValues('TASK_PRIORITY', taskPriorityEnum.options, TASK_PRIORITY_VALUES);
    });

    it('priorityEnum', () => {
      assertEnumMatchesValues('PRIORITY', priorityEnum.options, PRIORITY_VALUES);
    });

    it('frameworkCitationEnum', () => {
      assertEnumMatchesValues(
        'FRAMEWORK_CITATION',
        frameworkCitationEnum.options,
        FRAMEWORK_CITATION_VALUES
      );
    });

    it('artifactStatusEnum', () => {
      assertEnumMatchesValues('ARTIFACT_STATUS', artifactStatusEnum.options, ARTIFACT_STATUS_VALUES);
    });
  });

  describe('TS unions match the *_VALUES constants (compile-time)', () => {
    // Each `void` block forces the compiler to verify both directions of the
    // union. If either side gains/loses a value, tsc fails — the runtime test
    // is just a backup. The blocks compile to nothing at runtime.
    it('document types', () => {
      void ((): void => {
        const a: DocumentType = DOCUMENT_TYPE_VALUES[0];
        const b: (typeof DOCUMENT_TYPE_VALUES)[number] = a;
        void b;
      });
      // Sanity: the runtime arity should be 36
      // (11 generic + 9 policies + 14 checklists + 2 flagship Phase 3).
      expect(DOCUMENT_TYPE_VALUES.length).toBe(36);
    });

    it('playbook frameworks', () => {
      void ((): void => {
        const a: PlaybookFramework = PLAYBOOK_FRAMEWORK_VALUES[0];
        const b: (typeof PLAYBOOK_FRAMEWORK_VALUES)[number] = a;
        void b;
      });
      expect(PLAYBOOK_FRAMEWORK_VALUES.length).toBe(6);
    });

    it('risk tier label', () => {
      void ((): void => {
        const a: RiskTierLabel = RISK_TIER_VALUES[0];
        const b: (typeof RISK_TIER_VALUES)[number] = a;
        void b;
      });
    });

    it('risk level (advisor)', () => {
      void ((): void => {
        const a: RiskLevel = RISK_LEVEL_VALUES[0];
        const b: (typeof RISK_LEVEL_VALUES)[number] = a;
        void b;
      });
    });

    it('model type', () => {
      void ((): void => {
        const a: ModelType = MODEL_TYPE_VALUES[0];
        const b: (typeof MODEL_TYPE_VALUES)[number] = a;
        void b;
      });
    });

    it('deployment type', () => {
      void ((): void => {
        const a: DeploymentType = DEPLOYMENT_TYPE_VALUES[0];
        const b: (typeof DEPLOYMENT_TYPE_VALUES)[number] = a;
        void b;
      });
    });

    it('EU AI Act classification', () => {
      void ((): void => {
        const a: EUAIActClassification = EU_AI_ACT_CLASSIFICATION_VALUES[0];
        const b: (typeof EU_AI_ACT_CLASSIFICATION_VALUES)[number] = a;
        void b;
      });
    });

    it('required approver', () => {
      void ((): void => {
        const a: RequiredApprover = REQUIRED_APPROVER_VALUES[0];
        const b: (typeof REQUIRED_APPROVER_VALUES)[number] = a;
        void b;
      });
    });

    it('launch decision', () => {
      void ((): void => {
        const a: LaunchDecision = LAUNCH_DECISION_VALUES[0];
        const b: (typeof LAUNCH_DECISION_VALUES)[number] = a;
        void b;
      });
    });

    it('task owner', () => {
      void ((): void => {
        const a: TaskOwner = TASK_OWNER_VALUES[0];
        const b: (typeof TASK_OWNER_VALUES)[number] = a;
        void b;
      });
    });

    it('task priority', () => {
      void ((): void => {
        const a: TaskPriority = TASK_PRIORITY_VALUES[0];
        const b: (typeof TASK_PRIORITY_VALUES)[number] = a;
        void b;
      });
    });

    it('advisor priority', () => {
      void ((): void => {
        const a: Priority = PRIORITY_VALUES[0];
        const b: (typeof PRIORITY_VALUES)[number] = a;
        void b;
      });
    });

    it('framework citation source', () => {
      void ((): void => {
        const a: FrameworkCitation['framework'] = FRAMEWORK_CITATION_VALUES[0];
        const b: (typeof FRAMEWORK_CITATION_VALUES)[number] = a;
        void b;
      });
    });

    it('artifact status', () => {
      void ((): void => {
        const a: RequiredArtifact['status'] = ARTIFACT_STATUS_VALUES[0];
        const b: (typeof ARTIFACT_STATUS_VALUES)[number] = a;
        void b;
      });
    });
  });
});
