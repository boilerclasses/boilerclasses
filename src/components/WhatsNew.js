import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Modal, ModalBody, ModalCloseButton, ModalContent, ModalOverlay, useDisclosure } from '@chakra-ui/react';
import { BlockDemo, CalendarDemo, PickDemo, SeatsDemo } from '@/components/whatsNew/demos';

// Shown once per browser. Change RELEASE for the next announcement and everyone sees it again.
const RELEASE = 'schedule-redesign';
const SEEN_KEY = 'seenWhatsNew';

const FEATURES = [
  {
    title: 'Pick sections on the calendar',
    text: 'Open a course and every section shows up at its real time. Click one to pick it, and anything that clashes is outlined in red.',
    Demo: PickDemo,
  },
  {
    title: 'Block off your own time',
    text: 'Save time for work, clubs or the gym right on the calendar, and plan your classes around it.',
    Demo: BlockDemo,
  },
  {
    title: 'Open seats and your CRNs',
    text: "See live open seats and each class's average GPA while you pick, then copy all your CRNs for registration at once.",
    Demo: SeatsDemo,
  },
  {
    title: 'Straight into your calendar',
    text: 'Add your schedule to Google, Apple or Outlook Calendar. It skips breaks and holidays and includes your final and evening exams.',
    Demo: CalendarDemo,
  },
];

const FeatureCard = ({ title, text, Demo }) => (
  <div className='flex flex-col overflow-hidden rounded-xl border border-[rgb(var(--background-secondary-color))] bg-background'>
    <div className='px-4 pt-4 pb-3'>
      <h3 className='text-sm font-semibold text-primary'>{title}</h3>
      <p className='mt-1 text-xs leading-relaxed text-secondary'>{text}</p>
    </div>
    {/* the card's text already says what the preview shows */}
    <div aria-hidden className='pointer-events-none relative mx-3 mb-3 h-40 select-none overflow-hidden rounded-lg border border-[rgb(var(--background-secondary-color))] bg-background'>
      <Demo />
    </div>
  </div>
);

// What's New popup announcing the rebuilt Schedule Assistant, shown on whichever page a
// student lands on first.
const WhatsNew = () => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { pathname } = useRouter();
  const onSchedule = pathname.startsWith('/schedule');

  useEffect(() => {
    try {
      if (localStorage.getItem(SEEN_KEY) !== RELEASE) onOpen();
    } catch {
      // without storage it would show on every visit, so it isn't shown at all
    }
  }, [onOpen]);

  const close = () => {
    try {
      localStorage.setItem(SEEN_KEY, RELEASE);
    } catch {
      // nothing to remember it in; it closes all the same
    }
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={close} size={{ base: 'full', md: '4xl' }} isCentered scrollBehavior='inside'>
      <ModalOverlay bg='blackAlpha.600' backdropFilter='blur(3px)' />
      <ModalContent
        bg='rgb(var(--background-color))'
        color='rgb(var(--text-color))'
        borderRadius={{ base: 0, md: 'xl' }}
        overflow='hidden'
        mx={{ base: 0, md: 6 }}
      >
        <div className='bg-gradient-to-r from-red-800 to-yellow-600 px-6 py-5 text-white'>
          <div className='flex items-center gap-3 pr-8'>
            <img src='/boilerclasses-FULL.png' alt='' className='h-9 w-9' />
            <h2 className='text-xl font-bold md:text-2xl'>Meet the new Schedule Assistant</h2>
          </div>
          <p className='mt-2 text-sm text-white/85'>We rebuilt it from the ground up. Here&apos;s what you can do now.</p>
        </div>
        <ModalCloseButton color='white' top={4} />

        <ModalBody p={0} bg='rgb(var(--background-secondary-color) / 0.35)'>
          <div className='grid grid-cols-1 gap-4 p-5 md:grid-cols-2'>
            {FEATURES.map(feature => <FeatureCard key={feature.title} {...feature} />)}
          </div>
        </ModalBody>

        <div className='flex justify-end gap-2 border-t border-[rgb(var(--background-secondary-color))] px-5 py-4'>
          {onSchedule ? (
            <button onClick={close} className='rounded-full bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700 transition'>
              Start planning
            </button>
          ) : (
            <>
              <button onClick={close} className='rounded-full px-4 py-2 text-sm text-secondary hover:bg-background-secondary transition'>
                Maybe later
              </button>
              <Link href='/schedule' onClick={close} className='rounded-full bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700 transition'>
                Try the Schedule Assistant
              </Link>
            </>
          )}
        </div>
      </ModalContent>
    </Modal>
  );
};

export default WhatsNew;
