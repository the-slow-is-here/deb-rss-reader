import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthService } from './services/auth.service';
import { LocaleService } from './services/locale.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class App {
  readonly authService = inject(AuthService);
  readonly localeService = inject(LocaleService);

  constructor() {
    this.authService.check();
  }
}

