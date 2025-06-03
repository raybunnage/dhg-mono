import React from 'react';
import { AlertCircle, CheckCircle, Clock, GitMerge, XCircle, AlertTriangle } from 'lucide-react';

interface MergeStatusBadgeProps {
  status: 'pending' | 'ready' | 'in_progress' | 'merged' | 'failed' | 'conflicts';
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

export function MergeStatusBadge({ 
  status, 
  size = 'md', 
  showIcon = true,
  className = ''
}: MergeStatusBadgeProps) {
  const config = {
    pending: {
      icon: Clock,
      text: 'Pending',
      bgColor: 'bg-gray-100',
      textColor: 'text-gray-700',
      iconColor: 'text-gray-500'
    },
    ready: {
      icon: CheckCircle,
      text: 'Ready',
      bgColor: 'bg-green-100',
      textColor: 'text-green-700',
      iconColor: 'text-green-600'
    },
    in_progress: {
      icon: GitMerge,
      text: 'In Progress',
      bgColor: 'bg-blue-100',
      textColor: 'text-blue-700',
      iconColor: 'text-blue-600'
    },
    merged: {
      icon: CheckCircle,
      text: 'Merged',
      bgColor: 'bg-purple-100',
      textColor: 'text-purple-700',
      iconColor: 'text-purple-600'
    },
    failed: {
      icon: XCircle,
      text: 'Failed',
      bgColor: 'bg-red-100',
      textColor: 'text-red-700',
      iconColor: 'text-red-600'
    },
    conflicts: {
      icon: AlertTriangle,
      text: 'Conflicts',
      bgColor: 'bg-orange-100',
      textColor: 'text-orange-700',
      iconColor: 'text-orange-600'
    }
  };

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5'
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  const { icon: Icon, text, bgColor, textColor, iconColor } = config[status];

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 font-medium rounded-full
        ${bgColor} ${textColor} ${sizeClasses[size]} ${className}
      `}
    >
      {showIcon && <Icon className={`${iconSizes[size]} ${iconColor}`} />}
      <span>{text}</span>
    </span>
  );
}