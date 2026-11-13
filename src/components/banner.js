import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CloseIcon } from '@chakra-ui/icons';

const BANNERS_URL = 'https://api.boilerexams.com/v3/banners/?site=boilerclasses';
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
  const bannerRef = useRef(null);

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

  // Full-height pages subtract --banner-height so the banner doesn't push them into a scroll
  useEffect(() => {
    const element = bannerRef.current;
    if (!element) return;
    const root = document.documentElement;
    const update = () => root.style.setProperty('--banner-height', `${element.offsetHeight}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--banner-height');
    };
  }, [banner]);

  if (!banner) return null;

  const dismiss = () => {
    setBanners(rest);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...readDismissed(), banner.id]));
  };

  // The theme toggle is fixed at top-4 right-4 (32px), so the banner is at least 64px tall to
  // center on it, and the dismiss button sits just left of it at the same height
  return (
    <div
      ref={bannerRef}
      className="relative flex min-h-[4rem] w-full items-center bg-background-secondary text-primary text-sm md:text-base py-3 px-4 md:px-24"
    >
      <p className="w-full whitespace-normal text-left md:text-center md:[text-wrap:balance]">
        {/* On phones, keeps the first two lines clear of the dismiss button and theme toggle */}
        <span
          aria-hidden="true"
          className={`float-right h-6 md:hidden ${banner.dismissible ? 'w-20' : 'w-10'}`}
        />
        {banner.segments.map((segment, index) => (
          <Segment key={index} segment={segment} />
        ))}
      </p>
      {banner.dismissible && (
        <button
          type="button"
          aria-label="Dismiss banner"
          onClick={dismiss}
          className="absolute right-14 top-4 flex h-8 w-8 items-center justify-center rounded-full text-secondary hover:bg-background hover:text-primary"
        >
          <CloseIcon boxSize={3} />
        </button>
      )}
    </div>
  );
}
