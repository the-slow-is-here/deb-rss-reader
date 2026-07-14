import { Injectable, signal } from '@angular/core';

export interface ToastMsg {
  text: string;
  type: 'success' | 'error';
  id: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<ToastMsg[]>([]);
  private nextId = 0;

  show(msg: string, type: 'success' | 'error' = 'success'): void {
    const id = this.nextId++;
    this.toasts.update(t => [...t, { text: msg, type, id }]);
    setTimeout(() => this.dismiss(id), 3800);
  }

  dismiss(id: number): void {
    this.toasts.update(t => t.filter(x => x.id !== id));
  }
}
