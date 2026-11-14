/**
 * dashboardTab.js — "Tableau de bord": charts, filters, exports, live updates
 *
 * The dashboard draws itself (dashboard/Dashboard.js) and keeps a live stream
 * open: close() stops it when another tab opens or the book closes.
 */

import { Dashboard } from '../dashboard/Dashboard.js';

export const dashboardTab = {
  id: 'dashboard',
  label: 'Tableau de bord',
  wide: true,
  dashboard: null,

  async open(view) {
    this.dashboard = new Dashboard(view.body);
    await this.dashboard.mount();
    return null; // already drawn
  },

  close() {
    this.dashboard?.destroy();
    this.dashboard = null;
  },
};
