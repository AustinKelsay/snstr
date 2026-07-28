/** Validate a case-insensitive hexadecimal wire value at an exact width. */
export function isHexOfLength(value: unknown, length: number): value is string {
  return (
    typeof value === "string" &&
    value.length === length &&
    /^[0-9a-f]+$/i.test(value)
  );
}

/** Validate a lowercase hexadecimal wire value at an exact width. */
export function isLowercaseHexOfLength(
  value: unknown,
  length: number,
): value is string {
  return (
    typeof value === "string" &&
    value.length === length &&
    /^[0-9a-f]+$/.test(value)
  );
}

/** Measure a wire string by its UTF-8 representation rather than UTF-16 units. */
export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}
