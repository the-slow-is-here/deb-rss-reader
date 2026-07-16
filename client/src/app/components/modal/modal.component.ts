import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { LocaleService } from '../../services/locale.service';

@Component({
  selector: 'app-modal',
  standalone: true,
  templateUrl: './modal.component.html',
  styleUrls: ['./modal.component.css']
})
export class ModalComponent {
  readonly localeService = inject(LocaleService);
  @Input() visible = false;
  @Input() message = '';
  @Input() title = 'Remove Feed';
  @Input() confirmLabel = 'Remove';
  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  onOverlayClick(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('modal-overlay')) this.cancel.emit();
  }
}
