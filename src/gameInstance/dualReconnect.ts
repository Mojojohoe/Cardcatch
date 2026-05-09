/** Split local test — persist room JSON so toggling panels can resume the same Peer id + identities. */
export function dualReconnectStorageKey(instanceId: string) {
  return `cc_dual_session_${instanceId}_v2`;
}

export function wipeDualReconnectSnapshots() {
  try {
    sessionStorage.removeItem(dualReconnectStorageKey('p1'));
    sessionStorage.removeItem(dualReconnectStorageKey('p2'));
  } catch {
    /* quota / privacy mode */
  }
}
