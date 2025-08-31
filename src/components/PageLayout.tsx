import { ReactNode } from 'react';

interface PageLayoutProps {
  title: string;
  description?: string;
  children: ReactNode;
  maxWidth?: 'default' | 'narrow' | 'wide';
}

export default function PageLayout({ 
  title, 
  description, 
  children, 
  maxWidth = 'default' 
}: PageLayoutProps) {
  const getMaxWidth = () => {
    switch (maxWidth) {
      case 'narrow':
        return 'max-w-4xl';
      case 'wide':
        return 'max-w-7xl';
      default:
        return 'max-w-6xl';
    }
  };

  return (
    <div className={`${getMaxWidth()} mx-auto px-4 py-8`}>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{title}</h1>
        {description && (
          <p className="text-gray-600 text-lg">{description}</p>
        )}
      </div>
      
      {/* Page Content */}
      <div className="space-y-6">
        {children}
      </div>
    </div>
  );
}