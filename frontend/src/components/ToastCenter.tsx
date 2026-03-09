import { useEffect } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { useUIStore } from '../stores/uiStore';

export default function ToastCenter() {
  const toasts = useUIStore((state) => state.toasts);
  const removeToast = useUIStore((state) => state.removeToast);

  useEffect(() => {
    if (toasts.length === 0) {
      return;
    }

    toasts.forEach((item) => {
      toast[item.type](item.message, {
        toastId: String(item.id),
      });
      removeToast(item.id);
    });
  }, [toasts, removeToast]);

  return (
    <ToastContainer
      position="top-right"
      autoClose={3500}
      hideProgressBar={false}
      newestOnTop
      closeOnClick
      pauseOnHover
      draggable
      theme="dark"
      toastClassName="chipz-toast"
      progressClassName="chipz-toast-progress"
    />
  );
}
