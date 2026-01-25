'use client';

import { useState, useEffect, useCallback } from 'react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

let toastId = 0;
const listeners: ((toasts: Toast[]) => void)[] = [];
let toasts: Toast[] = [];

function updateToasts(newToasts: Toast[]) {
  toasts = newToasts;
  listeners.forEach((listener) => listener(toasts));
}

export function toast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  const id = String(++toastId);
  const newToast: Toast = { id, message, type };
  updateToasts([...toasts, newToast]);

  setTimeout(() => {
    updateToasts(toasts.filter((t) => t.id !== id));
  }, 5000);
}

export function Toaster() {
  const [currentToasts, setCurrentToasts] = useState<Toast[]>([]);

  useEffect(() => {
    listeners.push(setCurrentToasts);
    return () => {
      const index = listeners.indexOf(setCurrentToasts);
      if (index > -1) listeners.splice(index, 1);
    };
  }, []);

  const removeToast = useCallback((id: string) => {
    updateToasts(toasts.filter((t) => t.id !== id));
  }, []);

  if (currentToasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {currentToasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium animate-in slide-in-from-right-5 ${
            t.type === 'success'
              ? 'bg-green-500'
              : t.type === 'error'
              ? 'bg-red-500'
              : 'bg-gray-800'
          }`}
        >
          <span>{t.message}</span>
          <button
            onClick={() => removeToast(t.id)}
            className="ml-2 opacity-70 hover:opacity-100"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
