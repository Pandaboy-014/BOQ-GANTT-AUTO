type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

type ToastListener = (toasts: Toast[]) => void;

class ToastManager {
  private listeners: Set<ToastListener> = new Set();
  private toasts: Toast[] = [];

  subscribe(listener: ToastListener) {
    this.listeners.add(listener);
    listener([...this.toasts]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => listener([...this.toasts]));
  }

  show(message: string, type: ToastType = 'info', duration?: number) {
    const id = Math.random().toString(36).substring(2, 9);
    // Default duration is 3500ms for success/info, and 5500ms for error
    const finalDuration = duration ?? (type === 'error' ? 5500 : 3500);

    const toast: Toast = {
      id,
      message,
      type,
      duration: finalDuration,
    };

    this.toasts = [...this.toasts, toast];
    this.notify();

    setTimeout(() => {
      this.dismiss(id);
    }, finalDuration);

    return id;
  }

  dismiss(id: string) {
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.notify();
  }
}

export const toastManager = new ToastManager();

export const showToast = (message: string, type: ToastType = 'info', duration?: number) => {
  return toastManager.show(message, type, duration);
};

export const showErrorToast = (error: any, defaultMessage: string = 'บันทึกไม่สำเร็จ') => {
  console.error("Firebase database operation failed detailed log:", error);
  
  let msg = defaultMessage;
  if (error && typeof error === 'object') {
    const code = error.code || '';
    const message = error.message || '';
    
    if (code === 'permission-denied' || message.includes('permission') || message.includes('Permission')) {
      msg = 'ไม่มีสิทธิ์ทำรายการนี้ (ต้องเป็นผู้แก้ไข)';
    } else if (code === 'unavailable' || code === 'network-request-failed' || message.includes('network') || message.includes('offline') || message.includes('unavailable')) {
      msg = 'เชื่อมต่อไม่ได้ ตรวจสอบอินเทอร์เน็ต';
    } else if (error.message) {
      msg = `${defaultMessage}: ${error.message}`;
    }
  } else if (typeof error === 'string') {
    if (error.includes('permission-denied') || error.includes('Permission')) {
      msg = 'ไม่มีสิทธิ์ทำรายการนี้ (ต้องเป็นผู้แก้ไข)';
    } else if (error.includes('unavailable') || error.includes('network')) {
      msg = 'เชื่อมต่อไม่ได้ ตรวจสอบอินเทอร์เน็ต';
    } else {
      msg = `${defaultMessage}: ${error}`;
    }
  }
  
  return toastManager.show(msg, 'error');
};
