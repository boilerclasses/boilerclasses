import * as Sentry from '@sentry/nextjs';
import Error from 'next/error';

// Next's default error page, plus reporting the error that rendered it.
export default function CustomError({ statusCode }) {
  return <Error statusCode={statusCode} />;
}

CustomError.getInitialProps = async (context) => {
  await Sentry.captureUnderscoreErrorException(context);
  return Error.getInitialProps(context);
};
