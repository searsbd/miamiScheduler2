import { Routes } from '@angular/router';
import { Home } from './pages/home/home';

export const routes: Routes = [
    { path: '', component: Home, pathMatch: 'full' },
    { path: '**', redirectTo: '', pathMatch: 'full' }
];
