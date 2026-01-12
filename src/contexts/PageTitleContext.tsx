import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

interface PageTitleContextType {
  title: string;
  subtitle?: string;
  setPageTitle: (title: string, subtitle?: string) => void;
  clearPageTitle: () => void;
}

const PageTitleContext = createContext<PageTitleContextType | undefined>(undefined);

export function PageTitleProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState<string | undefined>(undefined);

  const setPageTitle = useCallback((newTitle: string, newSubtitle?: string) => {
    setTitle(newTitle);
    setSubtitle(newSubtitle);
  }, []);

  const clearPageTitle = useCallback(() => {
    setTitle('');
    setSubtitle(undefined);
  }, []);

  return (
    <PageTitleContext.Provider value={{ title, subtitle, setPageTitle, clearPageTitle }}>
      {children}
    </PageTitleContext.Provider>
  );
}

export function usePageTitle() {
  const context = useContext(PageTitleContext);
  if (context === undefined) {
    throw new Error('usePageTitle must be used within a PageTitleProvider');
  }
  return context;
}

/**
 * Hook for pages to set their title in the AppHeader
 * Title is set on mount and cleared on unmount
 */
export function useSetPageTitle(title: string, subtitle?: string) {
  const { setPageTitle, clearPageTitle } = usePageTitle();

  useEffect(() => {
    setPageTitle(title, subtitle);
    return () => clearPageTitle();
  }, [title, subtitle, setPageTitle, clearPageTitle]);
}
