/**
 * Feature flags for API sections. Sections still under migration from the
 * legacy system stay off until their data import is verified.
 */
export const features: Record<string, boolean> = {
  users: true,
  products: true,
  orders: false,
  admin: true,
}
