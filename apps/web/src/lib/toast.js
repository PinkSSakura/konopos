import { toast } from 'sonner';

/** Drop-in replacement for antd `message` using sonner. */
export const message = {
  success(content, duration) {
    toast.success(String(content), duration != null ? { duration: duration * 1000 } : undefined);
  },
  error(content, duration) {
    toast.error(String(content), duration != null ? { duration: duration * 1000 } : undefined);
  },
  warning(content, duration) {
    toast.warning(String(content), duration != null ? { duration: duration * 1000 } : undefined);
  },
  info(content, duration) {
    toast.info(String(content), duration != null ? { duration: duration * 1000 } : undefined);
  },
  loading(content, duration) {
    return toast.loading(String(content), duration != null ? { duration: duration * 1000 } : undefined);
  },
};

export { toast };
