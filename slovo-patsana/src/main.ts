import { App } from './game/App';
import { MenuMode } from './game/MenuMode';
import { SelectMode } from './game/SelectMode';
import { FreeRoamMode } from './game/FreeRoamMode';
import { h, uiRoot } from './ui/dom';

const loading = h('div', 'loading', 'ЗАГРУЗКА РАЙОНА…');
uiRoot().append(loading);

// Let the loading text paint before the heavy city build.
requestAnimationFrame(() =>
  setTimeout(() => {
    const app = new App(document.getElementById('game') as HTMLCanvasElement);
    app.getWorld();
    app.makePortraits();
    loading.remove();

    const menu = (started = true) =>
      app.setMode(new MenuMode(app, (players, mode) => select(players, mode), started));
    const select = (players: 1 | 2, mode: 'free' | 'versus') =>
      app.setMode(new SelectMode(app, players, (ids) => {
        if (mode === 'free') app.setMode(new FreeRoamMode(app, ids[0], () => menu()));
      }, () => menu()));

    menu(false);
    app.start();
    (window as unknown as { app: App }).app = app;
  }, 30),
);
