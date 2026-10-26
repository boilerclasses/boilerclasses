import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

// A small card pinned beside an element (a calendar block), closed by Escape or a click
// outside. Flips to the other side or above when it would leave the window.
const FloatingCard = ({ anchor, onClose, width = 288, children }) => {
  const ref = useRef(null);
  const [position, setPosition] = useState(null);

  useLayoutEffect(() => {
    if (!anchor || !ref.current) return;
    const place = () => {
      const rect = anchor.getBoundingClientRect();
      const card = ref.current.getBoundingClientRect();
      const margin = 8;
      let left = rect.right + margin;
      if (left + width > window.innerWidth - margin) left = rect.left - width - margin;
      if (left < margin) left = Math.min(window.innerWidth - width - margin, Math.max(margin, rect.left));
      let top = rect.top;
      if (top + card.height > window.innerHeight - margin) top = window.innerHeight - card.height - margin;
      setPosition({ left, top: Math.max(margin, top) });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchor, width]);

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    const onDown = (event) => {
      if (ref.current?.contains(event.target) || anchor?.contains(event.target)) return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    // after the click that opened the card has finished
    const timer = setTimeout(() => window.addEventListener('pointerdown', onDown), 0);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [anchor, onClose]);

  return (
    <div
      ref={ref}
      role='dialog'
      className='fixed z-[60] rounded-xl border border-[rgb(var(--background-secondary-color))] bg-background shadow-2xl text-primary'
      style={{ width, left: position?.left ?? -9999, top: position?.top ?? -9999 }}
    >
      {children}
    </div>
  );
};

export default FloatingCard;
