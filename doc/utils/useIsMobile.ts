import { useEffect, useState } from 'react';

/**
 * useIsMobile - tracks whether viewport matches provided media query
 */
export const useIsMobile = (query = '(max-width: 768px)') => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia(query);
    const updateMatch = () => setIsMobile(mediaQuery.matches);
    updateMatch();

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', updateMatch);
    } else {
      // Safari < 14
      // eslint-disable-next-line deprecation/deprecation
      mediaQuery.addListener(updateMatch);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', updateMatch);
      } else {
        // eslint-disable-next-line deprecation/deprecation
        mediaQuery.removeListener(updateMatch);
      }
    };
  }, [query]);

  return isMobile;
};
