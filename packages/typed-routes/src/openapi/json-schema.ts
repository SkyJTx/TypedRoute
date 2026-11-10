/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { isRecord } from "~/middleware/route-meta";
import type { JsonSchemaObject } from "~/types/openapi";

const OPTIONAL_VALIBOT_TYPES = new Set([
  "optional",
  "exact_optional",
  "nullish",
  "undefinedable",
]);

function isOptionalValibotSchema(schema: Record<string, unknown>): boolean {
  return typeof schema.type === "string" && OPTIONAL_VALIBOT_TYPES.has(schema.type);
}

function applyValibotPipeMetadata(
  pipe: readonly unknown[],
  baseSchema: JsonSchemaObject,
): JsonSchemaObject {
  const result: JsonSchemaObject = { ...baseSchema };
  for (let i = 0; i < pipe.length; i++) {
    const item = pipe[i];
    if (!isRecord(item) || typeof item.type !== "string") {
      continue;
    }
    switch (item.type) {
      case "min_length":
        if (typeof item.requirement === "number") {
          if (result.type === "array") {
            result.minItems = item.requirement;
          } else {
            result.minLength = item.requirement;
          }
        }
        break;
      case "max_length":
        if (typeof item.requirement === "number") {
          if (result.type === "array") {
            result.maxItems = item.requirement;
          } else {
            result.maxLength = item.requirement;
          }
        }
        break;
      case "length":
        if (typeof item.requirement === "number") {
          if (result.type === "array") {
            result.minItems = item.requirement;
            result.maxItems = item.requirement;
          } else {
            result.minLength = item.requirement;
            result.maxLength = item.requirement;
          }
        }
        break;
      case "min_value":
        if (typeof item.requirement === "number") {
          result.minimum = item.requirement;
        }
        break;
      case "max_value":
        if (typeof item.requirement === "number") {
          result.maximum = item.requirement;
        }
        break;
      case "integer":
      case "safe_integer":
        result.type = "integer";
        break;
      case "email":
        result.format = "email";
        break;
      case "url":
        result.format = "uri";
        break;
      case "uuid":
        result.format = "uuid";
        break;
      case "iso_date":
        result.format = "date";
        break;
      case "iso_timestamp":
      case "iso_date_time":
        result.format = "date-time";
        break;
      case "regex":
        if (item.requirement instanceof RegExp) {
          result.pattern = item.requirement.source;
        }
        break;
      case "description":
        if (typeof item.description === "string") {
          result.description = item.description;
        }
        break;
      case "title":
        if (typeof item.title === "string") {
          result.title = item.title;
        }
        break;
      default:
        break;
    }
  }
  return result;
}

function convertValibotSchema(schema: Record<string, unknown>): JsonSchemaObject {
  const schemaType = schema.type as string;
  let base: JsonSchemaObject = {};

  switch (schemaType) {
    case "string":
      base = { type: "string" };
      break;
    case "number":
      base = { type: "number" };
      break;
    case "bigint":
      base = { type: "integer", format: "int64" };
      break;
    case "boolean":
      base = { type: "boolean" };
      break;
    case "null":
      base = { type: "null" };
      break;
    case "any":
    case "unknown":
      base = {};
      break;
    case "literal": {
      const lit = schema.literal;
      base = {
        const: lit,
        ...(typeof lit === "string" || typeof lit === "number" || typeof lit === "boolean"
          ? { type: typeof lit }
          : {}),
      };
      break;
    }
    case "picklist": {
      const opts = Array.isArray(schema.options) ? schema.options : [];
      const firstType = opts.length > 0 ? typeof opts[0] : undefined;
      base = {
        ...(firstType === "string" || firstType === "number" ? { type: firstType } : {}),
        enum: [...opts],
      };
      break;
    }
    case "enum": {
      const enumObj = isRecord(schema.enum) ? Object.values(schema.enum) : [];
      base = { enum: enumObj };
      break;
    }
    case "array": {
      base = {
        type: "array",
        items: schemaToJsonSchema(schema.item),
      };
      break;
    }
    case "object":
    case "strict_object":
    case "loose_object": {
      const entries = isRecord(schema.entries) ? schema.entries : {};
      const properties: Record<string, JsonSchemaObject> = {};
      const required: string[] = [];
      const keys = Object.keys(entries);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const propSchema = entries[key];
        properties[key] = schemaToJsonSchema(propSchema);
        if (!isRecord(propSchema) || !isOptionalValibotSchema(propSchema)) {
          required.push(key);
        }
      }
      base = {
        type: "object",
        properties,
        ...(required.length > 0 ? { required } : {}),
        ...(schemaType === "strict_object" ? { additionalProperties: false } : {}),
      };
      break;
    }
    case "record": {
      base = {
        type: "object",
        additionalProperties: schemaToJsonSchema(schema.value),
      };
      break;
    }
    case "union":
    case "variant": {
      const options = Array.isArray(schema.options) ? schema.options : [];
      base = {
        anyOf: options.map((opt) => schemaToJsonSchema(opt)),
      };
      break;
    }
    case "intersect": {
      const options = Array.isArray(schema.options) ? schema.options : [];
      base = {
        allOf: options.map((opt) => schemaToJsonSchema(opt)),
      };
      break;
    }
    case "optional":
    case "exact_optional":
    case "undefinedable": {
      const inner = schemaToJsonSchema(schema.wrapped);
      if (schema.default !== undefined && typeof schema.default !== "function") {
        base = { ...inner, default: schema.default };
      } else {
        base = inner;
      }
      break;
    }
    case "nullable": {
      const inner = schemaToJsonSchema(schema.wrapped);
      if (typeof inner.type === "string") {
        base = { ...inner, type: [inner.type, "null"] };
      } else {
        base = { anyOf: [inner, { type: "null" }] };
      }
      break;
    }
    case "nullish": {
      const inner = schemaToJsonSchema(schema.wrapped);
      const nullable: JsonSchemaObject =
        typeof inner.type === "string"
          ? { ...inner, type: [inner.type, "null"] }
          : { anyOf: [inner, { type: "null" }] };
      if (schema.default !== undefined && typeof schema.default !== "function") {
        base = { ...nullable, default: schema.default };
      } else {
        base = nullable;
      }
      break;
    }
    default:
      base = {};
      break;
  }

  if (Array.isArray(schema.pipe) && schema.pipe.length > 1) {
    return applyValibotPipeMetadata(schema.pipe.slice(1), base);
  }
  return base;
}

function isOptionalZodSchema(schema: unknown): boolean {
  if (!isRecord(schema)) return false;
  const def = isRecord(schema._def) ? schema._def : isRecord(schema.def) ? schema.def : undefined;
  if (!def) return false;
  const typeName = (def.typeName ?? def.type) as string | undefined;
  return (
    typeName === "ZodOptional" ||
    typeName === "optional" ||
    typeName === "ZodDefault" ||
    typeName === "default"
  );
}

function convertZodSchema(schema: Record<string, unknown>): JsonSchemaObject {
  const def = (isRecord(schema._def) ? schema._def : schema.def) as Record<string, unknown>;
  const typeName = (def.typeName ?? def.type) as string | undefined;
  const description =
    typeof schema.description === "string"
      ? schema.description
      : typeof def.description === "string"
        ? def.description
        : undefined;

  let base: JsonSchemaObject = {};

  switch (typeName) {
    case "ZodString":
    case "string":
      base = { type: "string" };
      break;
    case "ZodNumber":
    case "number":
      base = { type: "number" };
      break;
    case "ZodBoolean":
    case "boolean":
      base = { type: "boolean" };
      break;
    case "ZodArray":
    case "array":
      base = {
        type: "array",
        items: schemaToJsonSchema(def.type ?? def.element),
      };
      break;
    case "ZodLiteral":
    case "literal": {
      const val = def.value ?? (Array.isArray(def.values) ? def.values[0] : undefined);
      base = {
        const: val,
        ...(typeof val === "string" || typeof val === "number" || typeof val === "boolean"
          ? { type: typeof val }
          : {}),
      };
      break;
    }
    case "ZodEnum":
    case "enum": {
      const vals = Array.isArray(def.values)
        ? def.values
        : isRecord(def.entries)
          ? Object.values(def.entries)
          : [];
      base = { type: "string", enum: [...vals] };
      break;
    }
    case "ZodObject":
    case "object": {
      const rawShape = typeof def.shape === "function" ? def.shape() : def.shape;
      const shape = isRecord(rawShape) ? rawShape : {};
      const properties: Record<string, JsonSchemaObject> = {};
      const required: string[] = [];
      const keys = Object.keys(shape);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const fieldSchema = shape[key];
        properties[key] = schemaToJsonSchema(fieldSchema);
        if (!isOptionalZodSchema(fieldSchema)) {
          required.push(key);
        }
      }
      base = {
        type: "object",
        properties,
        ...(required.length > 0 ? { required } : {}),
      };
      break;
    }
    case "ZodRecord":
    case "record":
      base = {
        type: "object",
        additionalProperties: schemaToJsonSchema(def.valueType),
      };
      break;
    case "ZodUnion":
    case "union": {
      const opts = Array.isArray(def.options) ? def.options : [];
      base = { anyOf: opts.map((opt) => schemaToJsonSchema(opt)) };
      break;
    }
    case "ZodOptional":
    case "optional":
      base = schemaToJsonSchema(def.innerType);
      break;
    case "ZodDefault":
    case "default": {
      const inner = schemaToJsonSchema(def.innerType);
      const defaultVal =
        typeof def.defaultValue === "function" ? def.defaultValue() : def.defaultValue;
      base = defaultVal !== undefined ? { ...inner, default: defaultVal } : inner;
      break;
    }
    case "ZodNullable":
    case "nullable": {
      const inner = schemaToJsonSchema(def.innerType);
      base =
        typeof inner.type === "string"
          ? { ...inner, type: [inner.type, "null"] }
          : { anyOf: [inner, { type: "null" }] };
      break;
    }
    default:
      base = {};
      break;
  }

  if (description !== undefined) {
    return { ...base, description };
  }
  return base;
}

/**
 * Converts a supported validator (`StandardSchemaV1`, Valibot AST, Zod v3/v4, or custom `toJSONSchema`)
 * into an OpenAPI 3.1 / JSON Schema Draft 2020-12 object.
 */
export function schemaToJsonSchema(validator: unknown): JsonSchemaObject {
  if (!isRecord(validator)) {
    return {};
  }

  if (typeof validator.toJSONSchema === "function") {
    const converted = validator.toJSONSchema();
    if (isRecord(converted)) {
      return converted as JsonSchemaObject;
    }
  }

  if (isRecord(validator.jsonSchema)) {
    return validator.jsonSchema as JsonSchemaObject;
  }

  if (
    (validator.kind === "schema" || isRecord(validator["~standard"])) &&
    typeof validator.type === "string"
  ) {
    return convertValibotSchema(validator);
  }

  if (isRecord(validator._def) || isRecord(validator.def)) {
    return convertZodSchema(validator);
  }

  return {};
}

/**
 * Infers a structural JSON Schema from a runtime JavaScript value (used when probing
 * custom `onValidationError` and `onApiError` handlers that return a `TypedResponse`).
 */
export function inferJsonSchemaFromValue(value: unknown): JsonSchemaObject {
  if (value === null) {
    return { type: "null" };
  }
  if (Array.isArray(value)) {
    const itemSchema = value.length > 0 ? inferJsonSchemaFromValue(value[0]) : {};
    return {
      type: "array",
      items: itemSchema,
    };
  }
  const valueType = typeof value;
  if (valueType === "string") {
    return { type: "string" };
  }
  if (valueType === "number") {
    return { type: Number.isInteger(value) ? "integer" : "number" };
  }
  if (valueType === "boolean") {
    return { type: "boolean" };
  }
  if (isRecord(value)) {
    const properties: Record<string, JsonSchemaObject> = {};
    const required: string[] = [];
    const keys = Object.keys(value);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const propVal = value[key];
      if (propVal !== undefined) {
        properties[key] = inferJsonSchemaFromValue(propVal);
        required.push(key);
      }
    }
    return {
      type: "object",
      properties,
      ...(required.length > 0 ? { required } : {}),
    };
  }
  return {};
}
