import React from 'react';
import { Heading, Description } from './Typography';

interface PageHeaderProps {
  title: string;
  description?: string;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  className = ''
}) => {
  return (
    <div className={`mb-8 ${className}`}>
      <Heading level={1} className="mb-2">
        {title}
      </Heading>
      {description && (
        <Description className="text-base">
          {description}
        </Description>
      )}
    </div>
  );
};