/**
 * Standard Schema V1 interface.
 */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly "~standard": {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (value: unknown) => StandardSchemaResult<Output> | Promise<StandardSchemaResult<Output>>;
    readonly types?: {
      readonly input: Input;
      readonly output: Output;
    };
  };
}

/**
 * Result representation for Standard Schema validation execution.
 */
export type StandardSchemaResult<Output> =
  | {
      readonly value: Output;
      readonly issues?: undefined;
    }
  | {
      readonly issues: ReadonlyArray<{
        readonly message: string;
        readonly path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }>;
      }>;
    };

/**
 * Structural contract matching legacy Zod schemas lacking ~standard.
 */
export interface ZodLikeSchema<Output = unknown, Input = unknown> {
  _output?: Output;
  _input?: Input;
  safeParse(value: unknown):
    | { success: true; data: Output }
    | { success: false; error: { issues?: ReadonlyArray<{ message: string; path?: (string | number)[] }> } | unknown };
}

/**
 * Plain validator or parser function contract.
 */
export type FunctionValidator<Output = unknown> = (value: never) => Output;

/**
 * Polymorphic type validator representation.
 */
export type TypeValidator<Output = unknown, Input = unknown> =
  | StandardSchemaV1<Input, Output>
  | ZodLikeSchema<Output, Input>
  | FunctionValidator<Output>;

/**
 * Infers the output type from any supported validator shape.
 */
export type InferOutput<T> =
  T extends { readonly "~standard": { readonly types?: { readonly output: infer O } } }
    ? O
    : T extends StandardSchemaV1<unknown, infer O>
      ? O
      : T extends { _output: infer O }
        ? O
        : T extends (...args: never[]) => infer O
          ? O
          : unknown;

/**
 * Infers the input type from any supported validator shape.
 */
export type InferInput<T> =
  T extends { readonly "~standard": { readonly types?: { readonly input: infer I } } }
    ? I
    : T extends StandardSchemaV1<infer I, unknown>
      ? I
      : T extends { _input: infer I }
        ? I
        : unknown;

/**
 * Standardized validation issue structure.
 */
export interface ValidationIssue {
  message: string;
  path?: string;
}

/**
 * Discriminated result representation for schema validation execution.
 */
export type ValidationResult<T> =
  | {
      readonly success: true;
      readonly data: T;
      readonly issues?: never;
    }
  | {
      readonly success: false;
      readonly data?: never;
      readonly issues: ReadonlyArray<ValidationIssue>;
    };

/**
 * Error thrown when schema validation encounters issues during parse operations.
 */
export class SchemaValidationError extends Error {
  public readonly issues: ReadonlyArray<ValidationIssue>;

  public constructor(issues: ReadonlyArray<ValidationIssue>) {
    super(`Validation failed: ${issues.map((i) => i.message).join("; ")}`);
    this.name = "SchemaValidationError";
    this.issues = issues;
  }
}