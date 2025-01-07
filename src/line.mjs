
import * as common from './common.mjs';

const isIE6 = true; ///^((?!chrome|android).)*safari/i.test(navigator.userAgent);


export class LineChart extends common.Chart {

    init(options={}) {
        this.hidePoints = options.hidePoints;
        this.segments = [];
        this._segmentEls = new Map();
    }

    setSegments(segments) {
        this.segments = segments;
        this.render();
    }

    setElement(el, options) {
        super.setElement(el, options);
        const defs = el.querySelector('svg.sc-root > defs');
        const pathClipId = `path-clip-${this.id}`;
        const pathMarkerId = `path-marker-${this.id}`;
        const maxMarkerSize = this.hidePoints ? 0 : 20; // Abstract units based on 'markerUnits'
        defs.insertAdjacentHTML('beforeend', `
            <clipPath data-sc-id="${this.id}" id="${pathClipId}">
                <path class="sc-data sc-area"/>
            </clipPath>
            <marker class="sc-line-marker" id="${pathMarkerId}" markerUnits="userSpaceOnUse"
                    refX="${maxMarkerSize / 2}" refY="${maxMarkerSize / 2}"
                    markerHeight="${maxMarkerSize}" markerWidth="${maxMarkerSize}">
                <circle class="sc-dot" cx="${maxMarkerSize / 2}" cy="${maxMarkerSize / 2}"/> 
            </marker>
        `);
        this._plotRegionEl.innerHTML = `
            <${isIE6 ? 'g' : 'foreignObject'} clip-path="url(#${pathClipId})" class="sc-css-background">
                <${isIE6 ? 'rect' : 'div'} class="sc-visual-data-area"></${isIE6 ? 'rect' : 'div'}>
            </${isIE6 ? 'g' : 'foreignObject'}>
            <path class="sc-data sc-line sc-visual-data-line"
                  marker-start="url(#${pathMarkerId})"
                  marker-mid="url(#${pathMarkerId})"
                  marker-end="url(#${pathMarkerId})"/>
        `;
        this._backgroundEl = this._plotRegionEl.querySelector('.sc-css-background');
        this._pathLineEl = this._plotRegionEl.querySelector(`path.sc-data.sc-line`);
        this._pathAreaEl = defs.querySelector(`[data-sc-id="${this.id}"] path.sc-data.sc-area`);
        this._setBackgroundPos();
    }

    _adjustSize() {
        super._adjustSize();
        this._setBackgroundPos();
    }

    _setBackgroundPos() {
        const el = this._backgroundEl;
        if (!el) {
            return;
        }
        el.setAttribute('x', this._plotInset[3]);
        el.setAttribute('y', this._plotInset[0]);
        el.setAttribute('height', this._boxHeight - this._plotInset[0] - this._plotInset[2]);
        el.setAttribute('width', this._boxWidth - this._plotInset[1] - this._plotInset[3]);
    }

    doReset() {
        this._pathLineEl.removeAttribute('d');
        this._pathAreaEl.removeAttribute('d');
        this._prevCoords = null;
        this._prevData = null;
        this.segments.length = 0;
        this._segmentEls.clear();
    }

    beforeRender() {
        const r = super.beforeRender();
        if (this.yMax === this.yMin) {
            this.yMin -= 0.5;
            this.yMax += 0.5;
        }
        if (this.xMax === this.xMin) {
            this.xMin -= 0.5;
            this.xMax += 0.5;
        }
        return r;
    }

    doRender({data}) {
        const {needForceLayout, coords, ...layoutOptions} = this._renderBeforeLayout({data});
        if (needForceLayout) {
            this._plotRegionEl.clientWidth;
        }
        this._renderDoLayout({coords, ...layoutOptions});
        this._prevCoords = coords;
        this._prevData = data;
    }

    _renderBeforeLayout({data}) {
        const coords = data.map(this.toCoordinates.bind(this));
        let needForceLayout = false;
        if (!this.disableAnimation && this._prevCoords) {
            // We can use CSS to animate the transition but we have to use a little hack
            // because it only animates when the path has the same number (or more) points.
            if (this._prevCoords.length !== coords.length) {
                const identityIdx = data.length / 2 | 0;
                const identity = data[identityIdx];
                const prevIdentityIdx = this._prevData.findIndex(o =>
                    o.x === identity.x && o.y === identity.y);
                const ltr = prevIdentityIdx === -1 || identityIdx <= prevIdentityIdx;
                const prev = Array.from(this._prevCoords);
                if (ltr) {
                    while (prev.length > coords.length) {
                        prev.shift();
                    }
                    while (prev.length < coords.length) {
                        prev.push(prev[prev.length - 1]);
                    }
                } else {
                    while (prev.length > coords.length) {
                        prev.pop();
                    }
                    while (prev.length < coords.length) {
                        prev.unshift(prev[0]);
                    }
                }
                this._pathLineEl.setAttribute('d', this.makePath(prev));
                this._pathAreaEl.setAttribute('d', this.makePath(prev, {closed: true}));
                needForceLayout = true;
            }
        }
        return {needForceLayout, coords};
    }

    _renderDoLayout({coords}) {
        this._pathLineEl.setAttribute('d', this.makePath(coords));
        this._pathAreaEl.setAttribute('d', this.makePath(coords, {closed: true}));
        if (this.segments.length) {
            const unclaimed = new Set(this._segmentEls.keys());
            for (let i = 0; i < this.segments.length; i++) {
                const s = this.segments[i];
                let el = this._segmentEls.get(s);
                if (!el) {
                    if (isIE6) {
                        el = common.createSVGElement('rect');
                    } else {
                        el = document.createElement('div');
                    }
                    el.classList.add('sc-visual-data-segment');
                    this._backgroundEl.querySelector('.sc-visual-data-area')
                        .insertAdjacentElement('afterend', el);
                    this._segmentEls.set(s, el);
                } else {
                    unclaimed.delete(s);
                }
                const x = s.x != null ? this.toX(s.x) - this._plotInset[3] : 0;
                const y = s.y != null ? this.toY(s.y) - this._plotInset[0] : 0;
                const width = s.width != null ? this.toScaleX(s.width) : this._plotWidth - x;
                const height = s.height != null ? this.toScaleY(s.height) : this._plotHeight - y;
                el.style.setProperty('translate', `${x}px ${y}px`);
                el.style.setProperty('width', `${width}px`);
                el.style.setProperty('height', `${height}px`);
                if (s.color) {
                    el.style.setProperty('--color', s.color);
                }
            }
            if (unclaimed.size) {
                for (const x of unclaimed) {
                    this._segmentEls.get(x).remove();
                    this._segmentEls.delete(x);
                }
            }
        }
    }
}
