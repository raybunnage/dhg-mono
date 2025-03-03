import { toast as hotToast } from 'react-hot-toast';

type ToastType = 'success' | 'error' | 'default' | 'destructive';

interface ToastOptions {
  title: string;
  description: string;
  variant?: ToastType;
  duration?: number;
}

export function useToast() {
  const toast = (options: ToastOptions) => {
    const { title, description, variant = 'default', duration = 3000 } = options;
    
    const message = `${title}: ${description}`;
    
    if (variant === 'destructive' || variant === 'error') {
      hotToast.error(message, { duration });
    } else if (variant === 'success') {
      hotToast.success(message, { duration });
    } else {
      hotToast(message, { duration });
    }
  };
  
  return { toast };
}

export { hotToast as toast };