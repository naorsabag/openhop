import YAML from 'yaml'
import { validateFlow, type ValidationResult } from './validator.js'

/**
 * Parse a YAML string and validate it as a OpenHop flow.
 */
export function parseFlowYaml(yamlString: string): ValidationResult {
  let parsed: unknown
  try {
    parsed = YAML.parse(yamlString)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      errors: [{ path: '', message: `YAML parse error: ${message}` }],
    }
  }
  return validateFlow(parsed)
}

/**
 * Parse a JSON string and validate it as a OpenHop flow.
 */
export function parseFlowJson(jsonString: string): ValidationResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonString)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      errors: [{ path: '', message: `JSON parse error: ${message}` }],
    }
  }
  return validateFlow(parsed)
}
