import "dotenv/config";

const baseUrl = process.env.APP_URL ?? "http://localhost:3000";
const username = process.env.ADMIN_USERNAME;
const password = process.env.SMOKE_ADMIN_PASSWORD;

if (!username || !password) {
  throw new Error("Set ADMIN_USERNAME and SMOKE_ADMIN_PASSWORD before running smoke:auth.");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, options = {}) {
  const response = await fetch(new URL(path, baseUrl), {
    redirect: "manual",
    ...options,
  });
  return response;
}

function getCookie(response) {
  const values =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie")].filter(Boolean);
  const session = values.find((value) => value.startsWith("bylucky_admin_session="));
  return session?.split(";", 1)[0] ?? null;
}

const home = await request("/");
assert(home.status === 200, `GET / returned ${home.status}`);
const homeText = await home.text();
assert(homeText.includes("ByLucky"), "GET / did not render the brand.");

const protectedRedirect = await request("/admin");
assert(protectedRedirect.status === 307, `Unauthenticated /admin returned ${protectedRedirect.status}`);
assert(
  protectedRedirect.headers.get("location")?.includes("/admin/login") === true,
  "Unauthenticated /admin did not redirect to login.",
);

const missingOrigin = await request("/api/admin/auth/login", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ username, password }),
});
assert(missingOrigin.status === 403, `Missing Origin returned ${missingOrigin.status}`);

const invalid = await request("/api/admin/auth/login", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    origin: baseUrl,
  },
  body: JSON.stringify({ username, password: `${password}-wrong` }),
});
assert(invalid.status === 401, `Invalid credentials returned ${invalid.status}`);
const invalidPayload = await invalid.json();
assert(invalidPayload.ok === false, "Invalid credentials did not use the error envelope.");
assert(invalidPayload.error.code === "INVALID_CREDENTIALS", "Unexpected invalid login code.");

const login = await request("/api/admin/auth/login", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    origin: baseUrl,
  },
  body: JSON.stringify({ username, password }),
});
assert(login.status === 200, `Valid credentials returned ${login.status}`);
const cookie = getCookie(login);
assert(cookie, "Login did not issue a session cookie.");

const session = await request("/api/admin/auth/session", {
  headers: { cookie },
});
assert(session.status === 200, `Session endpoint returned ${session.status}`);
const sessionPayload = await session.json();
assert(sessionPayload.ok === true && sessionPayload.data.authenticated === true, "Session was not authenticated.");

const dashboard = await request("/admin", {
  headers: { cookie },
});
assert(dashboard.status === 200, `Authenticated /admin returned ${dashboard.status}`);
const dashboardText = await dashboard.text();
assert(dashboardText.includes("管理总览"), "Authenticated dashboard did not render.");
assert(dashboard.headers.get("x-robots-tag")?.includes("noindex") === true, "Admin robots header is missing.");

const logout = await request("/api/admin/auth/logout", {
  method: "POST",
  headers: {
    origin: baseUrl,
    cookie,
  },
});
assert(logout.status === 200, `Logout returned ${logout.status}`);

const afterLogout = await request("/admin", {
  headers: { cookie },
});
assert(afterLogout.status === 307, `Post-logout /admin returned ${afterLogout.status}`);

process.stdout.write("Auth smoke test passed: public page, origin check, login, session, protection, and logout.\n");
