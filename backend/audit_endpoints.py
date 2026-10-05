"""Compare every api.ts call against the routes the running app actually serves.

The payment 404 and the whole '/ledger' group were both invisible to typecheck
and to the unit tests: both sides were internally consistent and simply
disagreed with each other. This walks the client surface and the OpenAPI
document and reports every call that cannot resolve to a route + method.
"""

import json
import re
import urllib.request

API_TS = "../frontend/src/services/api.ts"
OPENAPI = "http://127.0.0.1:8000/openapi.json"

CALL = re.compile(
    r"request\s*(?:<[^;]*?>)?\s*\(\s*"          # request<...>(
    r"(?P<fn>'[^']*')\s*,\s*"                    # 'customer'
    # A backtick path may itself contain a nested template: `/s/${id}${qs ? `?${qs}` : ''}`
    r"(?P<path>'[^']*'|`(?:[^`]|`[^`]*`)*?`)\s*"
    r"(?:,\s*'(?P<method>GET|POST|PUT|DELETE|PATCH)'\s*)?",
    re.S,
)
PATH_PARAM = re.compile(r"\{[^}]*\}")


def strip_interp(p: str, repl: str) -> str:
    """Replace every ${...} with `repl`, counting nested braces.

    Non-greedy `[^}]*` cannot do this: `${qs ? `?${qs}` : ''}` contains a `}`
    from its own nested interpolation, so a flat regex truncates the path and
    invents a route that does not exist.
    """
    out, i = [], 0
    while i < len(p):
        if p[i : i + 2] == "${":
            depth, j = 1, i + 2
            while j < len(p) and depth:
                if p[j : j + 2] == "${":
                    depth += 1
                    j += 2
                elif p[j] == "}":
                    depth -= 1
                    j += 1
                else:
                    j += 1
            out.append(repl)
            i = j
        else:
            out.append(p[i])
            i += 1
    return "".join(out)


def norm(path: str, fn: str) -> str:
    """Turn a client call into the concrete path the server should route.

    Path parameters are collapsed to a single marker because the two sides name
    them differently by convention (`{id}` on the client, `{booking_id}` on the
    server) and that difference routes fine - only the shape has to line up.
    """
    p = path[1:-1] if path[:1] in ("'", "`") else path
    p = strip_interp(p, "{}")                      # `${id}` and `${qs...}` -> `{}`
    p = p.split("?")[0]                            # query params are not routes
    p = PATH_PARAM.sub("{}", p)                    # `{booking_id}` -> `{}`
    p = re.sub(r"(?:\{\})+", "{}", p)              # `{}{}` -> `{}`
    p = re.sub(r"/{2,}", "/", p)
    prefix = "/" + fn.strip("'").lstrip("/") if fn.strip("'") else ""
    full = prefix + p
    return re.sub(r"/{2,}", "/", full).rstrip("/")


def main() -> int:
    with urllib.request.urlopen(OPENAPI, timeout=15) as r:
        spec = json.load(r)
    routes = {
        (PATH_PARAM.sub("{}", path).rstrip("/"), method.upper())
        for path, ops in spec["paths"].items()
        for method in ops
        if method in {"get", "post", "put", "delete", "patch"}
    }

    src = open(API_TS, encoding="utf-8").read()
    # line numbers for actionable output
    calls = []
    for m in CALL.finditer(src):
        line = src.count("\n", 0, m.start()) + 1
        calls.append((line, norm(m.group("path"), m.group("fn")), (m.group("method") or "GET").upper()))

    print(f"client calls: {len(calls)}   server routes: {len(routes)}\n")
    bad = []
    for line, path, method in calls:
        hit = (path, method) in routes
        if not hit:
            # is the path right but the verb wrong?
            verbs = sorted({m for p, m in routes if p == path})
            near = verbs or sorted({m for p, m in routes if p.rstrip("/") == path.rstrip("/")})
            bad.append((line, method, path, near))
        print(f"  {'OK ' if hit else 'BAD'} {method:6} {path}" + ("" if hit else f"   (server has: {','.join(near) or 'nothing'})"))

    print()
    if not bad:
        print("every client call resolves to a real route + method")
        return 0
    print(f"{len(bad)} BROKEN CALL(S):")
    for line, method, path, near in bad:
        print(f"  api.ts:{line}  {method} {path}  -> server: {','.join(near) or 'NO SUCH ROUTE'}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())