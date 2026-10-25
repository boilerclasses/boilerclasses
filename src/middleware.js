import { NextResponse } from "next/server";

const subdomains = [
  {
    "subdomain": "schedule"
  }
]

export const config = {
  matcher: [
    "/((?!api/|_next/|_static/|[\\w-]+\\.\\w+).*)",
  ],
};

export default async function middleware(req) {
  const url = new URL(req.url);
  const hostname = req.headers.get("host") || "";

  const allowedDomains = ["localhost:3000", "boilerclasses.com"];

  const isAllowedDomain = hostname === "localhost"
    || hostname.startsWith("localhost:")
    || allowedDomains.some(domain => hostname.includes(domain));

  const subdomain = hostname.split(".")[0];

  if (isAllowedDomain && !subdomains.some(d => d.subdomain === subdomain)) {
    return NextResponse.next();
  }

  const subdomainData = subdomains.find(d => d.subdomain === subdomain);

  // permanently redirect to the same page under a path on the main site, so
  // existing links and bookmarks keep working
  if (subdomainData) {
    // behind Cloudflare and nginx the request itself is plain http
    const protocol = req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
    const path = url.pathname === "/" ? "" : url.pathname;
    const target = `${protocol}://${hostname.slice(subdomain.length + 1)}/${subdomain}${path}${url.search}`;
    return NextResponse.redirect(target, 301);
  }

  return new Response(null, { status: 404 });
}
