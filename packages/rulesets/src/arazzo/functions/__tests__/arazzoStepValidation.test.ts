import arazzoStepValidation from '../arazzoStepValidation';
import type { IFunctionResult } from '@stoplight/spectral-core';

type SourceDescription = {
  name: string;
  url: string;
  type?: string;
};

type ArazzoSpecification = {
  workflows: Workflow[];
  sourceDescriptions?: SourceDescription[];
  components?: {
    parameters?: Record<string, unknown>;
    successActions?: Record<string, SuccessAction>;
    failureActions?: Record<string, FailureAction>;
    [key: string]: unknown;
  };
};

type Workflow = {
  workflowId: string;
  steps: Step[];
  successActions?: (SuccessAction | ReusableObject)[];
  failureActions?: (FailureAction | ReusableObject)[];
  outputs?: Record<string, string>;
};

type Step = {
  stepId: string;
  operationId?: string;
  operationPath?: string;
  workflowId?: string;
  outputs?: Record<string, string>;
  onSuccess?: (SuccessAction | ReusableObject)[];
  onFailure?: (FailureAction | ReusableObject)[];
};

type SuccessAction = {
  name: string;
  type: string;
  workflowId?: string;
  stepId?: string;
  criteria?: Criterion[];
};

type FailureAction = {
  name: string;
  type: string;
  workflowId?: string;
  stepId?: string;
  criteria?: Criterion[];
};

type Criterion = {
  context?: string;
  condition: string;
  type?: 'simple' | 'regex' | 'jsonpath' | 'xpath' | CriterionExpressionType;
};

type CriterionExpressionType = {
  type: 'jsonpath' | 'xpath';
  version: string;
};

type ReusableObject = {
  reference: string;
};

const runRule = (target: ArazzoSpecification): IFunctionResult[] => {
  return arazzoStepValidation(target, null);
};

describe('arazzoStepValidation', () => {
  test('should not report any errors for valid operationId, operationPath, and workflowId', () => {
    const results = runRule({
      workflows: [
        {
          workflowId: 'workflow1',
          steps: [
            {
              stepId: 'step1',
              operationId: '$sourceDescriptions.validSource.operationId',
            },
            {
              stepId: 'step2',
              operationPath: '{$sourceDescriptions.validSource.url}#/paths/~1pet~1findByStatus',
            },
            {
              stepId: 'step3',
              workflowId: '$sourceDescriptions.validSource.workflowId',
            },
          ],
        },
      ],
      sourceDescriptions: [{ name: 'validSource', url: 'http://example.com', type: 'arazzo' }],
    });

    expect(results).toHaveLength(0);
  });

  test('should report an error for invalid operationId runtime expression', () => {
    const results = runRule({
      workflows: [
        {
          workflowId: 'workflow1',
          steps: [
            {
              stepId: 'step1',
              operationId: '$invalidSourceDescription.operationId',
            },
          ],
        },
      ],
      sourceDescriptions: [{ name: 'validSource', url: 'http://example.com', type: 'arazzo' }],
    });

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      message: 'Runtime expression "$invalidSourceDescription.operationId" is invalid in step "step1".',
      path: ['workflows', 0, 'steps', 0, 'operationId'],
    });
  });

  test('should report an error for invalid operationPath format', () => {
    const results = runRule({
      workflows: [
        {
          workflowId: 'workflow1',
          steps: [
            {
              stepId: 'step1',
              operationPath: 'invalidOperationPathFormat',
            },
          ],
        },
      ],
      sourceDescriptions: [{ name: 'validSource', url: 'http://example.com', type: 'arazzo' }],
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      message:
        'OperationPath "invalidOperationPathFormat" must be a valid runtime expression following the format "{$sourceDescriptions.<name>.url}#<json-pointer>".',
      path: ['workflows', 0, 'steps', 0, 'operationPath'],
    });
  });

  test('should report an error for invalid workflowId runtime expression', () => {
    const results = runRule({
      workflows: [
        {
          workflowId: 'workflow1',
          steps: [
            {
              stepId: 'step1',
              workflowId: '$invalidSourceDescription.workflowId',
            },
          ],
        },
      ],
      sourceDescriptions: [{ name: 'validSource', url: 'http://example.com', type: 'arazzo' }],
    });

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      message: 'Runtime expression "$invalidSourceDescription.workflowId" is invalid in step "step1".',
      path: ['workflows', 0, 'steps', 0, 'workflowId'],
    });
  });

  test('should report an error for missing source description in operationPath', () => {
    const results = runRule({
      workflows: [
        {
          workflowId: 'workflow1',
          steps: [
            {
              stepId: 'step1',
              operationPath: '{$sourceDescriptions.missingSource.url}#foo',
            },
          ],
        },
      ],
      sourceDescriptions: [{ name: 'validSource', url: 'http://example.com', type: 'arazzo' }],
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      message:
        'Source description "missingSource" not found for operationPath "{$sourceDescriptions.missingSource.url}#foo" in step "step1".',
      path: ['workflows', 0, 'steps', 0, 'operationPath'],
    });
  });
});
