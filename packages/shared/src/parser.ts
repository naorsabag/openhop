import YAML from "yaml";
import { validateFlow, type ValidationResult } from "./validator.js";

/**
 * Parse a YAML string and validate it as a FlowScope flow.
 */
export function parseFlowYaml(yamlString: string): ValidationResult {
  let parsed: unknown;
  try {
    parsed = YAML.parse(yamlString);
  } catch (err: any) {
    return {
      success: false,
      errors: [{ path: "", message: `YAML parse error: ${err.message}` }],
    };
  }
  return validateFlow(parsed);
}

/**
 * Parse a JSON string and validate it as a FlowScope flow.
 */
export function parseFlowJson(jsonString: string): ValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err: any) {
    return {
      success: false,
      errors: [{ path: "", message: `JSON parse error: ${err.message}` }],
    };
  }
  return validateFlow(parsed);
}
