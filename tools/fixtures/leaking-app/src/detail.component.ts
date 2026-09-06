// A manifest is not the only door. This file alone decides the design system, whatever
// package.json happens to say at the time.
import { MatButtonModule } from '@angular/material/button';
import { A11yModule } from '@angular/cdk/a11y';

export const imports = [MatButtonModule, A11yModule];
