import { useSyncExternalStore } from "react";

export type ToastVariant =
  | "default"
  | "destructive"
  | "warning"
  | "success"
  | "info";

interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
}

let toasts: Toast[] = [];
let nextId = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn();
}

function getSnapshot(): Toast[] {
  return toasts;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function dismissToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function clearToasts() {
  toasts = [];
  emit();
}

function addToast(args: {
  title?: string;
  description?: string;
  variant?: Toast["variant"];
}) {
  const id = String(++nextId);
  toasts = [...toasts, { id, ...args }];
  emit();
  // Auto-dismiss after 5s
  setTimeout(() => dismissToast(id), 5000);
}

export function useToastStore(): Toast[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useToast() {
  return { toast: addToast };
}
