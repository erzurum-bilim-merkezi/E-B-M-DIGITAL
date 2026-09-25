/** Field ids are `field-<stepId|kit>-<key>` so the validation panel can focus them ("Git"). */
export function fieldId(scope: string, key: string) {
  return `field-${scope}-${key}`.replace(/[^a-zA-Z0-9_-]/g, '-')
}
