/* EarthPlay — boot: title screen with a living demo world behind it. */
(function () {
'use strict';
const EP = globalThis.EP;
const $ = s => document.querySelector(s);

function boot() {
    EP.Sprites.init();
    const game = EP.game = new EP.Game();

    // Title screen form
    const form = $('#title-form');
    form.innerHTML = EP.worldFormHTML({});
    EP.bindWorldForm(form);
    $('#btn-create').addEventListener('click', () => { game.audio.ensure(); game.newWorld(EP.readWorldForm(form)); });
    $('#btn-title-load').addEventListener('click', () => { game.audio.ensure(); game.ui.openSaveLoad('load'); });
    const auto = EP.Save.meta('auto');
    const cont = $('#btn-continue');
    if (auto) {
        cont.hidden = false;
        cont.querySelector('small').textContent = `Year ${auto.year} · ${auto.kingdoms} realms`;
        cont.addEventListener('click', () => { game.audio.ensure(); game.loadFrom('auto').catch(e => game.ui.toast(e.message, 'bad')); });
    }
    // Living backdrop
    game.newWorld({ size: 'small', shape: 'continent', life: 'civ', seed: (Math.random() * 1e9) >>> 0 }, true);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
})();
