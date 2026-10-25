// The theme lives in a cookie on the parent domain so boilerclasses.com and
// schedule.boilerclasses.com share it (localStorage is per subdomain).
// localStorage is still read for preferences saved before the cookie existed.

const ONE_YEAR = 60 * 60 * 24 * 365;

// ".boilerclasses.com" for any boilerclasses host; none for localhost or IPs,
// where a host-only cookie is already shared across ports.
function cookieDomain() {
  const host = window.location.hostname;
  const labels = host.split('.');
  if (labels.length < 2 || /^[\d.]+$/.test(host)) return '';
  return `; domain=.${labels.slice(-2).join('.')}`;
}

export function readTheme() {
  const match = document.cookie.match(/(?:^|; )theme=(light|dark)/);
  return (match && match[1]) || localStorage.getItem('theme');
}

export function saveTheme(theme) {
  localStorage.setItem('theme', theme);
  document.cookie = `theme=${theme}; path=/; max-age=${ONE_YEAR}; SameSite=Lax${cookieDomain()}`;
}
