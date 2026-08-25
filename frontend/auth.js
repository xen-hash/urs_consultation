// Session storage for the signed tokens the API now issues.
//
// Before this, "being logged in" meant having a JSON blob in sessionStorage —
// the server never checked anything, so hand-writing that blob was enough to
// become an administrator. The profile here is only for rendering; the token is
// the part that grants access, and the server re-verifies it on every request.

const KEYS = { student: "urs.student", teacher: "urs.teacher", admin: "urs.admin" };
export const ROLES = Object.keys(KEYS);

function read(role) {
  try {
    const raw = sessionStorage.getItem(KEYS[role]);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null; // Corrupt entry — treat it as signed out.
  }
}

/** Store a session and clear the other two: one signed-in role at a time. */
export function setSession(role, token, profile) {
  ROLES.filter(r => r !== role).forEach(r => sessionStorage.removeItem(KEYS[r]));
  sessionStorage.setItem(KEYS[role], JSON.stringify({ token, profile }));
}

/** The stored profile for `role`, or null. Never returns the bare token. */
export function getSession(role) {
  const entry = read(role);
  return entry?.token ? entry.profile : null;
}

export function getToken(role) {
  if (role) return read(role)?.token || null;
  for (const r of ROLES) {
    const entry = read(r);
    if (entry?.token) return entry.token;
  }
  return null;
}

/** Which role is currently signed in, if any. */
export function currentRole() {
  return ROLES.find(r => read(r)?.token) || null;
}

/** Merge fields into the stored profile — used after a photo or name change. */
export function patchProfile(role, patch) {
  const entry = read(role);
  if (!entry) return null;
  const profile = { ...entry.profile, ...patch };
  sessionStorage.setItem(KEYS[role], JSON.stringify({ ...entry, profile }));
  return profile;
}

export function clearSession(role) {
  if (role) sessionStorage.removeItem(KEYS[role]);
  else ROLES.forEach(r => sessionStorage.removeItem(KEYS[r]));
}

/** Where to send someone whose session just went away. */
export function loginPathFor(role) {
  return role === "admin" ? "/dean" : role === "student" ? "/student" : "/teacher";
}
