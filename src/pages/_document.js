import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  // set initial theme right away
  return (
    <Html lang="en">
      <Head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // keep in sync with readTheme in src/lib/theme.js
                function getInitialTheme() {
                  const match = document.cookie.match(/(?:^|; )theme=(light|dark)/)
                  return (match && match[1]) || localStorage.getItem('theme') || 'dark'
                }
                document.documentElement.classList.add(getInitialTheme());
              })()
            `,
          }}
        />
      </Head>
      <body className='bg-neutral-50 dark:bg-neutral-950'>
        <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-P8N23MSR"
          height="0" width="0" style={{display:"none",visibility:"hidden"}}></iframe></noscript>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
