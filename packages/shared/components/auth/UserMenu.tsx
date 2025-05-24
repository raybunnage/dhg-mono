import React from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { User, LogOut, Settings, ChevronDown } from 'lucide-react';

export interface UserMenuProps {
  user: {
    email?: string;
    name?: string;
    avatar?: string;
  } | null;
  onSignOut: () => void;
  onOpenSettings?: () => void;
  children?: React.ReactNode;
}

export const UserMenu: React.FC<UserMenuProps> = ({
  user,
  onSignOut,
  onOpenSettings,
  children
}) => {
  if (!user) return null;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
          {user.avatar ? (
            <img
              src={user.avatar}
              alt={user.name || user.email || 'User'}
              className="w-8 h-8 rounded-full"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
              <User className="w-4 h-4 text-gray-600" />
            </div>
          )}
          <span className="text-sm font-medium">{user.name || user.email}</span>
          <ChevronDown className="w-4 h-4 text-gray-500" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="min-w-[220px] bg-white rounded-md shadow-lg p-1 animate-slide-down"
          sideOffset={5}
        >
          <div className="px-3 py-2 border-b border-gray-100">
            <p className="text-sm font-medium">{user.name || 'User'}</p>
            <p className="text-xs text-gray-500">{user.email}</p>
          </div>

          {children}

          {onOpenSettings && (
            <DropdownMenu.Item
              className="flex items-center px-3 py-2 text-sm hover:bg-gray-100 focus:bg-gray-100 cursor-pointer rounded"
              onSelect={onOpenSettings}
            >
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </DropdownMenu.Item>
          )}

          <DropdownMenu.Separator className="h-px bg-gray-100 my-1" />

          <DropdownMenu.Item
            className="flex items-center px-3 py-2 text-sm hover:bg-gray-100 focus:bg-gray-100 cursor-pointer rounded text-red-600"
            onSelect={onSignOut}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};