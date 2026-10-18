import React from 'react';
import Link from 'next/link';

import {
    Image,
    useDisclosure
} from '@chakra-ui/react'
import FeedbackModal from '@/components/feedbackModal';


const Footer = () => {
    const { isOpen, onOpen, onClose } = useDisclosure();

    return (
        <div className='grid justify-center py-5 relative'>
            <h1 className='mx-2 text-tertiary text-sm text-center break-words'>
                <span className='flex items-center justify-center'>
                    <a href='https://github.com/boilerclasses/boilerclasses' target="_black" rel="noopener noreferrer" className='text-tertiary flex items-center gap-1 underline decoration-dashed decoration-1 underline-offset-2'>
                        <Image src="https://icones.pro/wp-content/uploads/2021/06/icone-github-grise.png" alt="" boxSize={4} />
                        BoilerClasses
                    </a>
                    <span className='mx-2'>|</span>
                    <span className='flex items-center gap-1'>
                        Maintained by
                        <Image src="/boilerexams-mark.png" alt="" boxSize={4} />
                        <a href='https://boilerexams.com' target="_blank" rel="noopener noreferrer" className='text-tertiary underline decoration-dashed decoration-1 underline-offset-2'>Boilerexams</a>
                    </span>
                </span>
                An <Link href={`/dir`}>unofficial catalog</Link> for Purdue courses made by Purdue students. We'd love to hear your <button onClick={onOpen} className='underline decoration-dashed decoration-1 underline-offset-2'>feedback</button>!
                <br />
                Want to help build it? <a href='https://boilerexams.com/apply' target="_blank" rel="noopener noreferrer" className='underline decoration-dashed decoration-1 underline-offset-2'>Join the team</a>!
                {/* Inspired by <a href='https://classes.wtf/' target='_blank' rel='noopener noreferrer' className='underline decoration-dashed decoration-1 underline-offset-2'>classes.wtf</a><br /> */}
            </h1>
            <FeedbackModal isOpen={isOpen} onClose={onClose} />
        </div>
    );
};

export default Footer;
