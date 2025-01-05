
import * as common from './common.mjs';


export class LineChart extends common.Chart {

    init(options={}) {
        this.hidePoints = options.hidePoints;
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
            <foreignObject class="sc-css-background" clip-path="url(#${pathClipId})"
                           width="100%" height="100%">
                <div class="sc-visual-data-area"></div>
            </foreignObject>
            <path class="sc-data sc-line sc-visual-data-line"
                  marker-start="url(#${pathMarkerId})"
                  marker-mid="url(#${pathMarkerId})"
                  marker-end="url(#${pathMarkerId})"/>
        `;
        this._pathLineEl = this._plotRegionEl.querySelector(`path.sc-data.sc-line`);
        this._pathAreaEl = defs.querySelector(`[data-sc-id="${this.id}"] path.sc-data.sc-area`);
        this._setBackgroundPos();
    }

    _adjustSize() {
        super._adjustSize();
        this._setBackgroundPos();
    }

    _setBackgroundPos() {
        const bgObj = this._plotRegionEl.querySelector('foreignObject.sc-css-background');
        if (!bgObj) {
            return;
        }
        bgObj.setAttribute('x', this._plotInset[3]);
        bgObj.setAttribute('y', this._plotInset[0]);
        bgObj.setAttribute('height', this._boxHeight - this._plotInset[0] - this._plotInset[2]);
        bgObj.setAttribute('width', this._boxWidth - this._plotInset[1] - this._plotInset[3]);
    }

    doReset() {
        this._pathLineEl.removeAttribute('d');
        this._pathAreaEl.removeAttribute('d');
        this._prevCoords = null;
        this._prevData = null;
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
        if (this._prevCoords) {
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

    _renderDoLayout({coords, needForceLayout}) {
        this._pathLineEl.setAttribute('d', this.makePath(coords));
        this._pathAreaEl.setAttribute('d', this.makePath(coords, {closed: true}));
    }
}
