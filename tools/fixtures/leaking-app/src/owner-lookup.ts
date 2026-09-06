// The same mistake through an index rather than a dot.
export function reach(owner: Record<string, string>): string {
  return owner['phone'] ?? owner["email"];
}
