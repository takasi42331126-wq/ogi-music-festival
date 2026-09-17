function unauthorized() {
  return new Response("管理画面の表示には認証が必要です。", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Check-in Admin", charset="UTF-8"',
      "Cache-Control": "no-store"
    }
  });
}

function parseBasicAuth(header) {
  if (!header.startsWith("Basic ")) {
    return null;
  }

  try {
    const decoded = atob(header.slice(6).trim());
    const separator = decoded.indexOf(":");
    if (separator === -1) {
      return null;
    }
    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1)
    };
  } catch {
    return null;
  }
}

export async function onRequest(context) {
  const expected = context.env?.CHECKIN_ADMIN_TOKEN;
  if (!expected) {
    return new Response("CHECKIN_ADMIN_TOKEN が設定されていません。", {
      status: 500,
      headers: {
        "Cache-Control": "no-store"
      }
    });
  }

  const credentials = parseBasicAuth(context.request.headers.get("Authorization") ?? "");
  if (credentials?.username === "admin" && credentials.password === expected) {
    return context.next();
  }

  return unauthorized();
}
