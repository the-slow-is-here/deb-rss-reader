import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  templateUrl: './toast.component.html',
  styleUrls: ['./toast.component.css']
})
export class ToastComponent implements OnInit, OnDestroy {
  readonly toastService = inject(ToastService);
  private handler: ((e: Event) => void) | null = null;

  ngOnInit(): void {
    this.handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      this.toastService.show(detail.message, detail.type);
    };
    document.addEventListener('app-toast', this.handler);
  }

  ngOnDestroy(): void {
    if (this.handler) document.removeEventListener('app-toast', this.handler);
  }
}
