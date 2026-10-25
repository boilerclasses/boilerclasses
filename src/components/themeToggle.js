import React, { useEffect, useState } from 'react';
import { MoonIcon, SunIcon } from '@chakra-ui/icons';
import { readTheme, saveTheme } from '@/lib/theme';

const ThemeToggle = () => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const storedTheme = readTheme();
      if (storedTheme) {
        return storedTheme === 'dark';
      }
      // dark theme by default
      return true;
    }
    return true;
  });

  // copy a preference saved before the shared cookie existed into it
  useEffect(() => {
    const storedTheme = readTheme();
    if (storedTheme) saveTheme(storedTheme);
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    // handle system theme changes if no saved preference
    const handleSystemThemeChange = (e) => {
      if (!readTheme()) {
        setIsDarkMode(e.matches);
      }
    };

    mediaQuery.addEventListener('change', handleSystemThemeChange);

    if (isDarkMode) {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }

    const themeChangeEvent = new CustomEvent('themeChange', {
      detail: { theme: isDarkMode ? 'dark' : 'light' }
    });
    window.dispatchEvent(themeChangeEvent);

    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, [isDarkMode]);

  // toggle theme and update localstorage
  const toggleTheme = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    saveTheme(newTheme ? 'dark' : 'light');
  };

  return (
    <button
      onClick={toggleTheme}
      className="fixed top-4 right-4 z-50
                 p-3 rounded-full
                 bg-background
                 shadow-lg hover:shadow-xl
                 border border-[rgb(var(--background-secondary-color))]
                 hover:bg-background-secondary
                 transition-all duration-300
                 flex items-center justify-center
                 w-8 h-8"
    >
      {isDarkMode ?
        <SunIcon fontSize={[12, 16]} color={`rgb(var(--text-color))`} /> :
        <MoonIcon fontSize={[12, 16]} color={`rgb(var(--text-color))`} />
      }
    </button>
  );
};

export default ThemeToggle;