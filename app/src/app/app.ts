import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth/auth.service';
import { RealtimeService } from './core/services/realtime.service';
import { ButtonComponent } from './shared/components';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    ButtonComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  public readonly auth = inject(AuthService);

  /**
   * Injected here and nowhere else, and never read. The hub connection has to follow the
   * session rather than the messages route: the server emails a "you have a new message"
   * nudge to anybody it cannot push to, so a signed-in user sitting on the search page
   * with no connection gets an email instead of a badge. Injecting it in the shell is what
   * makes the connection app-wide. The SignalR client itself is behind a dynamic import,
   * so this costs nothing until somebody signs in.
   */
  private readonly realtime = inject(RealtimeService);
}

