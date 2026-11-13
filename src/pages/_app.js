import '@/styles/globals.css'

import { ChakraProvider, extendTheme } from '@chakra-ui/react'
import { CacheProvider } from '@chakra-ui/next-js';
import { MultiSelectTheme } from 'chakra-multiselect'

import Head from "next/head";
import Script from 'next/script';

import Footer from '@/components/footer';
import Banner from '@/components/banner';
import dynamic from 'next/dynamic'
import { RouteHistoryProvider } from '@/hooks/useRouteHistory';

// Set server side rendering to false
const ThemeToggle = dynamic(() => import('../components/themeToggle'), {
  ssr: false
})


const theme = extendTheme({
  components: {
    MultiSelect: MultiSelectTheme
  }
})

export default function App({ Component, pageProps }) {
  return (
    <RouteHistoryProvider>
      <ChakraProvider theme={theme}>
        <ThemeToggle />
        {/* <!-- Google tag (gtag.js) --> */}
        <Script
          async
          src={`https://www.googletagmanager.com/gtag/js?id=G-48L6TGYD2L`}
        />
        <Script
          id='google-analytics-config'
          dangerouslySetInnerHTML={{
            __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-48L6TGYD2L', {
              page_path: window.location.pathname,
            });
          `
          }}
        />
        <Script id="google-tab-manager">
          {`
            (function(w,d,s,l,i){w[l] = w[l] || [];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','GTM-P8N23MSR');
          `}
        </Script>

        <Head>
          <title>BoilerClasses</title>
        </Head>

        <Banner />
        <Component {...pageProps} />

        {/* <Footer /> */}
      </ChakraProvider>
    </RouteHistoryProvider>
  )
}
