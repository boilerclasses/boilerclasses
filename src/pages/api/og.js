import { NextRequest, NextResponse } from 'next/server'
import { ImageResponse } from 'next/og'
import { Inter } from 'next/font/google'
const inter = Inter({ subsets: ['latin'] })

import { encode } from 'base64-arraybuffer';



export const config = {
  runtime: 'experimental-edge',
}

export default async function handler(req) {
  const { searchParams, protocol, host } = new URL(req.url)
  const sub = searchParams.get('sub') || ''
  const course = searchParams.get('course') || ''
  const title = searchParams.get('title') || ''
  const credits = searchParams.get('credits') || ''
  const sem = searchParams.get('sem') || ''
  const prof = searchParams.get('prof') || ''

  const interSemiBold = await fetch(
    new URL('../../../public/Inter-SemiBold.ttf', 
    
    import.meta.url),
  ).then((res) => res.arrayBuffer());
  
  const interRegular = await fetch(
    new URL('../../../public/Inter-Regular.ttf', 
    
    import.meta.url),
  ).then((res) => res.arrayBuffer());

  const imageData = await fetch(new URL('../../../public/boilerclasses-FULL.png', import.meta.url))
    .then((res) => res.arrayBuffer());

  const base64Image = encode(new Uint8Array(imageData));


  return new ImageResponse(
    (
      <div tw="w-full h-full flex flex-col justify-center items-stretch items-center bg-black">
        <img src={`data:image/png;base64,${base64Image}`} height={200} width={200}/>
        <div tw="bg-black text-white flex flex-col px-16 pb-16 pt-8 items-center">
          <div tw="flex text-5xl w-full mb-4 align-center text-center" style={{ fontWeight: 500 }}>
            {sub} {course}: {title}
          </div>
          {prof == "TBA"
          ?  <div tw="flex text-2xl" style={{ fontWeight: 400 }}>
              {sem} | {credits} Credits
            </div>
          : <div tw="flex text-2xl" style={{ fontWeight: 400 }}>
              {sem} | {credits} Credits | {prof}
            </div>
          }
        </div>
      </div>
    ),
    { 
      width: 1200, 
      height: 628, 
      fonts: [
        {
          name: 'Inter',
          data: interRegular,
          style: 'normal',
          weight: 400,
        },
        {
          name: 'Inter',
          data: interSemiBold,
          style: 'normal',
          weight: 500,
        },
      ]
    }
  )
}