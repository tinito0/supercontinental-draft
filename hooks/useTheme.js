import { useState, useEffect, useCallback } from 'react';

const THEME_KEY = 'scl_theme';

export function useTheme() {
  const [theme, setThemeState] = useState(() => {
    if (typeof window === 'undefined') return 'dark';
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'light' || saved === 'dark') return saved;
      return document.documentElement.classList.contains('dark') ? 'dark' : 'dark';
    } catch {
      return 'dark';
    }
  });

  const applyTheme = useCallback((newTheme) => {
    const isDark = newTheme === 'dark';
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
    try {
      localStorage.setItem(THEME_KEY, newTheme);
    } catch {
      // ignore localstorage errors
    }
    setThemeState(newTheme);
    window.dispatchEvent(new CustomEvent('scl-theme-change', { detail: newTheme }));
  }, []);

  const toggleTheme = useCallback(() => {
    applyTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, applyTheme]);

  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === THEME_KEY && (e.newValue === 'light' || e.newValue === 'dark')) {
        applyTheme(e.newValue);
      }
    };
    const handleCustom = (e) => {
      if (e.detail && e.detail !== theme) {
        setThemeState(e.detail);
      }
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('scl-theme-change', handleCustom);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('scl-theme-change', handleCustom);
    };
  }, [theme, applyTheme]);

  return {
    theme,
    isDark: theme === 'dark',
    toggleTheme,
    setTheme: applyTheme,
  };
}
