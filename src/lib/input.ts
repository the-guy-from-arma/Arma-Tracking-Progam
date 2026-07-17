export function text(value: unknown, max = 500) { return typeof value === "string" ? value.replace(/[<>\u0000]/g, "").trim().slice(0, max) : ""; }
export function email(value: unknown) { return text(value, 254).toLowerCase(); }
export function publicUser<T extends { passwordHash?: string }>(user: T) { const { passwordHash: _, ...safe } = user; return safe; }
