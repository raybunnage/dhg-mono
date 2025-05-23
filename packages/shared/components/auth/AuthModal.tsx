import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { AuthForm, AuthFormProps } from './AuthForm';

export interface AuthModalProps extends Omit<AuthFormProps, 'mode'> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: 'signin' | 'signup' | 'magic-link';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  open,
  onOpenChange,
  mode = 'signin',
  ...authFormProps
}) => {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 animate-fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md animate-scale-in">
          <div className="relative">
            <Dialog.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Dialog.Close>
            <AuthForm mode={mode} {...authFormProps} />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};