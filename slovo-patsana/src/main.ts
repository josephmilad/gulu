import { App } from './game/App';
import { MenuMode } from './game/MenuMode';
import { SelectMode } from './game/SelectMode';
import { FreeRoamMode } from './game/FreeRoamMode';
import { h, uiRoot } from './ui/dom';
import { loadAssets } from './core/assets';

const loading = h('div', 'loading', 'ЗАГРУЗКА РАЙОНА…');
uiRoot().append(loading);

loadAssets((p, label) => (loading.textContent = `ЗАГРУЗКА: ${label}… ${Math.round(p * 100)}%`)).then((assets) =>
  setTimeout(() => {
    loading.textContent = 'СТРОИМ РАЙОН…';
    const app = new App(document.getElementById('game') as HTMLCanvasElement, assets);
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
