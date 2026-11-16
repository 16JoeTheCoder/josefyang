#!/bin/bash
# Usage: auth-403.sh [base]   expects every protected route to return 403 w/o valid token
B=${1:-http://localhost:8788}
G="aaa.bbb.ccc"
EXPECT403=(
/api/admin/bootstrap /api/admin/pages/home /api/admin/pages/home/publish /api/admin/builds /api/admin/builds/x /api/admin/builds/x/publish /api/admin/builds/x/unpublish /api/admin/builds/x/upgrade
/api/admin/templates /api/admin/settings /api/admin/settings/contacts /api/admin/settings/publish /api/admin/cv /api/admin/devlog /api/admin/devlog/x /api/admin/milestones /api/admin/milestones/x
/api/admin/media /api/admin/media/x/usage /api/admin/media/x/replace /api/admin/media/x /api/admin/versions /api/admin/versions/1/restore /api/admin/health /api/admin/analytics
/admin /admin/ /admin/anything /admin/a/b /preview /preview/ /preview/about /preview/projects /api/admin /api/admin/ /api/admin/nonexistent
/api//admin/bootstrap /api/admin/../admin/bootstrap /api/admin/%2e%2e/admin/bootstrap /api%2Fadmin/bootstrap /api/admin%2Fbootstrap /api/%61dmin/bootstrap /%61dmin /pre%76iew/ /preview%2Fabout /admin%2F /admin//x /preview//about /api/admin/bootstrap/ /api/admin/bootstrap// /api/admin/bootstrap%2F /api/admin/bootstrap%00 /api/admin/./bootstrap /admin/.. /admin%2e /Admin /PREVIEW/ /API/admin/bootstrap /api/Admin/bootstrap "/admin;x" /admin./ /admin%20 /api/admin%3Fx
)
for p in "${EXPECT403[@]}"; do
  for m in GET POST PATCH DELETE; do
    for h in none garbage; do
      args=(-s -o /dev/null -w "%{http_code}" -X $m --path-as-is -H "Origin: $B" -H "Content-Type: application/json" -d '{}')
      [ $h = garbage ] && args+=(-H "Cf-Access-Jwt-Assertion: $G")
      c=$(curl "${args[@]}" "$B$p")
      [ "$c" != 403 ] && echo "$m $p [$h] -> $c"
    done
  done
done
echo done
