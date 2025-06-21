(function() {
    'use strict';

    let _lastNavLink;
    let _lastAnchor;
    function highlightCurrentTarget(options) {
        options = options || {};
        if (_lastNavLink) {
            _lastNavLink.classList.remove('target');
        }
        if (_lastAnchor) {
            _lastAnchor.classList.remove('target');
        }
        const urn = location.pathname.split(/\//).slice(-1)[0] + location.hash;
        if (urn === 'index.html') {
            return;
        }
        const navLink = document.querySelector(`nav a[href="${urn}"`);
        if (navLink) {
            navLink.classList.add('target');
            navLink.scrollIntoView({
                block: 'center',
                behavior: options.scrollSmooth ? 'smooth' : 'instant'
            });
            _lastNavLink = navLink;
        }
        const anchor = document.getElementById(location.hash.slice(1));
        if (anchor) {
            anchor.classList.add('target');
            _lastAnchor = anchor;
        }
    }

    window.addEventListener('load', () => highlightCurrentTarget({scrollSmooth: false}));
    window.addEventListener('hashchange', () => highlightCurrentTarget({scrollSmooth: true}));
})();
