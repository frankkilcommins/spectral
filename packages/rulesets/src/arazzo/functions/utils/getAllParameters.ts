import { isPlainObject } from '@stoplight/json';
import arazzoRuntimeExpressionValidation from '../arazzoRuntimeExpressionValidation';

type Parameter = {
  name: string;
  in?: string;
  value?: unknown;
};

type Workflow = {
  workflowId: string;
  steps: Step[];
  parameters?: (Parameter | ReusableObject)[];
  components?: { parameters?: Record<string, Parameter> };
};

type ArazzoSpecification = {
  workflows: Workflow[];
  sourceDescriptions?: SourceDescription[];
  components?: {
    parameters?: Record<string, Parameter>;
    successActions?: Record<string, SuccessAction>;
    failureActions?: Record<string, FailureAction>;
    [key: string]: unknown;
  };
};

type SourceDescription = {
  name: string;
  url: string;
  type?: string;
};

type FailureAction = {
  name: string;
  type: string;
  workflowId?: string;
  stepId?: string;
  retryAfter?: number;
  retryLimit?: number;
  criteria?: Criterion[];
};

type SuccessAction = {
  name: string;
  type: string;
  workflowId?: string;
  stepId?: string;
  criteria?: Criterion[];
};

type Criterion = {
  condition: string;
};

type ReusableObject = {
  reference: string;
};

type Step = {
  stepId: string;
  parameters?: (Parameter | ReusableObject)[];
  onFailure?: (FailureAction | ReusableObject)[];
};

const resolveReusableParameter = (
  reusableObject: ReusableObject,
  arazzoSpec: ArazzoSpecification,
): Parameter | undefined => {
  const refPath = reusableObject.reference.replace('$components.parameters.', '');
  return arazzoSpec.components?.parameters?.[refPath];
};

function isParameter(param: unknown): param is Parameter {
  if (typeof param === 'object' && param !== null) {
    const obj = param as Record<string, unknown>;
    return typeof obj.name === 'string' && (typeof obj.in === 'string' || obj.in === undefined);
  }
  return false;
}

export default function getAllParameters(step: Step, workflow: Workflow, arazzoSpec: ArazzoSpecification): Parameter[] {
  const resolvedParameters: Parameter[] = [];
  const resolvedStepParameters: Parameter[] = [];

  const processReusableParameter = (param: ReusableObject): Parameter => {
    const paramName = param.reference;

    if (!arazzoRuntimeExpressionValidation(param.reference, arazzoSpec)) {
      return { name: `masked-invalid-reusable-parameter-reference-${paramName}` };
    }

    const resolvedParam = resolveReusableParameter(param, arazzoSpec);

    if (!resolvedParam) {
      return { name: `masked-unresolved-parameter-reference-${paramName}` };
    }

    return resolvedParam;
  };

  const resolveParameters = (params: (Parameter | ReusableObject)[], targetArray: Parameter[]): void => {
    params.forEach(param => {
      let paramToPush: Parameter;

      if (isPlainObject(param) && 'reference' in param) {
        paramToPush = processReusableParameter(param);
      } else {
        paramToPush = param;
      }

      if (isParameter(paramToPush)) {
        const isDuplicate = targetArray.some(
          existingParam =>
            isParameter(existingParam) &&
            isParameter(paramToPush) &&
            existingParam.name === paramToPush.name &&
            (existingParam.in ?? '') === (paramToPush.in ?? ''),
        );

        if (isDuplicate) {
          paramToPush = {
            ...paramToPush,
            name: `masked-duplicate-${String(paramToPush.name)}`,
          };
        }

        targetArray.push(paramToPush);
      }
    });
  };

  // Process workflow-level parameters
  if (workflow.parameters != null) {
    resolveParameters(workflow.parameters, resolvedParameters);
  }

  // Process step-level parameters
  if (step.parameters != null) {
    resolveParameters(step.parameters, resolvedStepParameters);
  }

  // Merge step parameters into workflow parameters, overriding duplicates
  resolvedStepParameters.forEach(param => {
    const existingParamIndex = resolvedParameters.findIndex(
      p => isParameter(p) && p.name === param.name && (p.in ?? '') === (param.in ?? ''),
    );
    if (existingParamIndex !== -1) {
      resolvedParameters[existingParamIndex] = param;
    } else {
      resolvedParameters.push(param);
    }
  });

  return resolvedParameters;
}
