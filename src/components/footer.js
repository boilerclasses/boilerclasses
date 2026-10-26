import React from 'react';
import Link from 'next/link';

import {
    Image,
    useDisclosure
} from '@chakra-ui/react'
import FeedbackModal from '@/components/feedbackModal';


const linkStyle = 'underline decoration-dashed decoration-1 underline-offset-2 hover:text-secondary';

// `compact` is for narrow columns (the schedule sidebar): small, left-aligned, and with
// the links spaced apart instead of joined by dots that strand at line ends.
const Footer = ({ compact = false }) => {
    const { isOpen, onOpen, onClose } = useDisclosure();

    if (compact) {
        return (
            <div className='px-1 py-3 text-[11px] leading-relaxed text-tertiary'>
                <p>
                    An <Link href={`/dir`} className={linkStyle}>unofficial catalog</Link> for Purdue courses made by Purdue students,
                    maintained by <a href='https://boilerexams.com' target="_blank" rel="noopener noreferrer" className={linkStyle}>Boilerexams</a>.
                </p>
                <p className='mt-1 flex flex-wrap gap-x-3'>
                    <a href='https://github.com/boilerclasses/boilerclasses' target="_blank" rel="noopener noreferrer" className={linkStyle}>GitHub</a>
                    <button onClick={onOpen} className={linkStyle}>Feedback</button>
                    <a href='https://boilerexams.com/apply' target="_blank" rel="noopener noreferrer" className={linkStyle}>Join the team</a>
                </p>
                <FeedbackModal isOpen={isOpen} onClose={onClose} />
            </div>
        );
    }

    return (
        <div className='grid justify-center py-5 relative'>
            <h1 className='mx-2 text-tertiary text-sm text-center break-words'>
                An <Link href={`/dir`}>unofficial catalog</Link> for Purdue courses made by Purdue students.
                <span className='flex flex-wrap items-center justify-center gap-x-2'>
                    <span className='flex items-center gap-2'>
                        <a href='https://github.com/boilerclasses/boilerclasses' target="_blank" rel="noopener noreferrer" className='text-tertiary flex items-center gap-1 underline decoration-dashed decoration-1 underline-offset-2'>
                            <Image src="https://icones.pro/wp-content/uploads/2021/06/icone-github-grise.png" alt="" boxSize={4} />
                            GitHub
                        </a>
                        <span>·</span>
                        <span className='flex items-center gap-1'>
                            Maintained by
                            <Image src="/boilerexams-mark.png" alt="" boxSize={4} />
                            <a href='https://boilerexams.com' target="_blank" rel="noopener noreferrer" className='text-tertiary underline decoration-dashed decoration-1 underline-offset-2'>Boilerexams</a>
                        </span>
                    </span>
                    {/* hidden on phones, where the two groups wrap onto their own lines */}
                    <span className='hidden sm:inline'>·</span>
                    <span className='flex items-center gap-2'>
                        <button onClick={onOpen} className='underline decoration-dashed decoration-1 underline-offset-2'>Feedback</button>
                        <span>·</span>
                        <a href='https://boilerexams.com/apply' target="_blank" rel="noopener noreferrer" className='underline decoration-dashed decoration-1 underline-offset-2'>Join the team</a>
                    </span>
                </span>
                {/* Inspired by <a href='https://classes.wtf/' target='_blank' rel='noopener noreferrer' className='underline decoration-dashed decoration-1 underline-offset-2'>classes.wtf</a><br /> */}
            </h1>
            <FeedbackModal isOpen={isOpen} onClose={onClose} />
        </div>
    );
};

export default Footer;
