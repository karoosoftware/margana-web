export function dispatchUsage(name: string, data?: any) {
  try {
    window.dispatchEvent(new CustomEvent('margana-usage', { detail: { name, data } }))
  } catch (_) {
    // ignore
  }
}
