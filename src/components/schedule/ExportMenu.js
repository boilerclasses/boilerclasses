import React, { useState } from 'react';
import {
  Menu, MenuButton, MenuItem, MenuList, Modal, ModalBody, ModalCloseButton, ModalContent,
  ModalHeader, ModalOverlay, Spinner, useDisclosure, useToast,
} from '@chakra-ui/react';
import { IoMdCalendar, IoMdDownload, IoMdImage, IoMdLink, IoMdShare, IoMdDocument } from 'react-icons/io';

const MENU_STYLE = { bg: 'rgb(var(--background-color))', borderColor: 'rgb(var(--background-secondary-color))' };
const ITEM_STYLE = { bg: 'transparent', _hover: { bg: 'rgb(var(--background-secondary-color))' }, fontSize: 'sm' };

const copy = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

// Subscribe links for each calendar app. All of them re-fetch the feed, so exams and
// room changes show up without doing anything.
const CalendarDialog = ({ isOpen, onClose, feedUrl, termName, hasBlocks }) => {
  const toast = useToast();
  const [withBlocks, setWithBlocks] = useState(true);
  const url = withBlocks || !hasBlocks ? feedUrl : `${feedUrl}&blocks=0`;
  const webcal = url.replace(/^https?:/, 'webcal:');
  const apps = [
    { label: 'Google Calendar', href: `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}` },
    { label: 'Apple Calendar', href: webcal },
    { label: 'Outlook', href: `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(url)}&name=${encodeURIComponent(`${termName} classes`)}` },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered size='md'>
      <ModalOverlay bg='blackAlpha.500' />
      <ModalContent bg='rgb(var(--background-color))' color='rgb(var(--text-color))'>
        <ModalHeader fontSize='lg'>Add to your calendar</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6} className='flex flex-col gap-4 text-sm'>
          <p className='text-secondary'>
            Classes repeat every week and skip Purdue&apos;s breaks and holidays. Final and evening exams are
            included, and subscribing keeps them up to date as the registrar publishes them.
          </p>
          {hasBlocks && (
            <label className='flex items-center gap-2 cursor-pointer'>
              <input type='checkbox' checked={withBlocks} onChange={(e) => setWithBlocks(e.target.checked)} />
              Include my personal blocks
            </label>
          )}
          <div className='grid grid-cols-3 gap-2'>
            {apps.map(app => (
              <a
                key={app.label}
                href={app.href}
                target='_blank'
                rel='noreferrer'
                className='rounded-lg border border-[rgb(var(--background-secondary-color))] px-2 py-2 text-center text-xs font-medium hover:bg-background-secondary transition'
              >
                {app.label}
              </a>
            ))}
          </div>
          <div className='flex gap-2'>
            <button
              onClick={async () => toast({
                title: (await copy(url)) ? 'Calendar link copied' : 'Could not copy the link',
                status: 'success', duration: 2000, position: 'top',
              })}
              className='flex-1 flex items-center justify-center gap-1 rounded-lg bg-background-secondary px-3 py-2 text-xs font-medium hover:brightness-110 transition'
            >
              <IoMdLink /> Copy subscription link
            </button>
            <a
              href={`${url}&download=1`}
              className='flex-1 flex items-center justify-center gap-1 rounded-lg bg-background-secondary px-3 py-2 text-xs font-medium hover:brightness-110 transition'
            >
              <IoMdDownload /> Download .ics
            </a>
          </div>
          <p className='text-xs text-tertiary'>
            The link holds the sections you have picked now. If you change them, add the new link and remove the old calendar.
          </p>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

// Image, share link, calendar and PDF exports for the plan.
const ExportMenu = ({ shareUrl, feedUrl, termName, hasBlocks, disabled, onImage, onPdf }) => {
  const toast = useToast();
  const calendar = useDisclosure();
  const [busy, setBusy] = useState(false);

  const saveImage = async () => {
    setBusy(true);
    try {
      await onImage();
    } catch (error) {
      console.error(error);
      toast({ title: 'Could not save the image', status: 'error', duration: 3000, position: 'top' });
    } finally {
      setBusy(false);
    }
  };

  const copyShare = async () => toast({
    title: (await copy(shareUrl)) ? 'Share link copied' : 'Could not copy the link',
    description: 'Anyone with the link can see this schedule and copy it into their planner.',
    status: 'success', duration: 3000, position: 'top',
  });

  return (
    <>
      <Menu placement='bottom-end'>
        <MenuButton
          disabled={disabled}
          className='flex items-center gap-1.5 rounded-full bg-background-opposite px-3.5 py-1.5 text-sm font-medium text-opposite hover:opacity-90 transition disabled:opacity-40'
        >
          <span className='flex items-center gap-1.5'>
            {busy ? <Spinner size='xs' /> : <IoMdShare />} Export
          </span>
        </MenuButton>
        <MenuList {...MENU_STYLE} color='rgb(var(--text-color))' zIndex={40} minW='220px'>
          <MenuItem {...ITEM_STYLE} icon={<IoMdImage />} onClick={saveImage}>Save as image</MenuItem>
          <MenuItem {...ITEM_STYLE} icon={<IoMdLink />} onClick={copyShare}>Copy share link</MenuItem>
          <MenuItem {...ITEM_STYLE} icon={<IoMdCalendar />} onClick={calendar.onOpen}>Add to calendar app…</MenuItem>
          <MenuItem {...ITEM_STYLE} icon={<IoMdDocument />} onClick={onPdf}>Download PDF</MenuItem>
        </MenuList>
      </Menu>
      <CalendarDialog
        isOpen={calendar.isOpen}
        onClose={calendar.onClose}
        feedUrl={feedUrl}
        termName={termName}
        hasBlocks={hasBlocks}
      />
    </>
  );
};

export default ExportMenu;
