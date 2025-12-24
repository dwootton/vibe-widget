import React from 'react';

export interface WidgetProps {
  model?: any;
  interactive?: boolean;
}

export interface NavItem {
  label: string;
  href: string;
}

export interface FeatureCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  codeSnippet?: string;
  href?: string;
}
