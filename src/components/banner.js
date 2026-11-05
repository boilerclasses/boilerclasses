import { useEffect, useState } from 'react';
import Link from 'next/link';

const BANNERS_URL = 'https://api.boilerexams.com/banners/?site=boilerclasses';
const DISMISSED_KEY = 'dismissedBanners';

const linkClass = 'font-semibold underline text-primary hover:text-secondary';

function readDismissed() {
  try {
    const stored = JSON.parse(localStorage.getItem(DISMISSED_KEY));
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function Segment({ segment }) {
  if (!segment.href) return <span>{segment.text}</span>;

  if (segment.href.startsWith('/')) {
    return <Link className={linkClass} href={segment.href}>{segment.text}</Link>;
  }

  return (
    <a className={linkClass} href={segment.href} target="_blank" rel="noopener noreferrer">
      {segment.text}
    </a>
  );
}

export default function Banner() {
  const [banners, setBanners] = useState([]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(BANNERS_URL, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : []))
      .then((json) => {
        const dismissed = readDismissed();
        setBanners(json.filter((banner) => !dismissed.includes(banner.id)));
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const [banner, ...rest] = banners;
  if (!banner) return null;

  const dismiss = () => {
    setBanners(rest);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...readDismissed(), banner.id]));
  };

  return (
    <div className="relative flex w-full items-center justify-center bg-background-secondary text-primary text-sm md:text-base py-3 pl-4 pr-24">
      <p className="whitespace-normal text-center">
        {banner.segments.map((segment, index) => (
          <Segment key={index} segment={segment} />
        ))}
      </p>
      {banner.dismissible && (
        <button
          type="button"
          aria-label="Dismiss banner"
          onClick={dismiss}
          className="absolute right-16 top-1/2 -translate-y-1/2 px-2 text-secondary hover:text-primary"
        >
          ✕
        </button>
      )}
    </div>
  );
}
