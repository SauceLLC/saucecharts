import * as common from './common.mjs';
import * as color from './color.mjs';


export class LineChart extends common.Chart {

    init(options={}) {
        this.hidePoints = options.hidePoints;
        this.segments = [];
        this._segmentEls = new Map();
        this._segmentFills = new Map();
        this._gcQueue = [];
    }

    setSegments(segments, options={}) {
        this.segments = segments;
        if (options.render !== false) {
            this.render();
        }
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
            <g clip-path="url(#${pathClipId})" class="sc-background">
                <rect class="sc-visual-data-area"/>
            </g>
            <path class="sc-data sc-line sc-visual-data-line"
                  marker-start="url(#${pathMarkerId})"
                  marker-mid="url(#${pathMarkerId})"
                  marker-end="url(#${pathMarkerId})"/>
        `;
        this._backgroundEl = this._plotRegionEl.querySelector('.sc-background');
        if (this._bgGradient) {
            this.removeGradient(this._bgGradient);
        }
        const fill = color.parse(this.getColor());
        this._bgGradient = this.addGradient({
            type: 'linear',
            colors: [
                fill.adjustAlpha(-0.7).adjustLight(-0.2),
                fill.adjustAlpha(-0.14),
            ]
        });
        this._backgroundRectEl = this._backgroundEl.querySelector('rect.sc-visual-data-area');
        this._backgroundRectEl.setAttribute('fill', `url(#${this._bgGradient.id})`);
        this._pathLineEl = this._plotRegionEl.querySelector(`path.sc-data.sc-line`);
        this._pathAreaEl = defs.querySelector(`[data-sc-id="${this.id}"] path.sc-data.sc-area`);
    }

    _adjustSize(...args) {
        super._adjustSize(...args);
        const rect = this._backgroundRectEl;
        rect.setAttribute('x', this._plotInset[3]);
        rect.setAttribute('y', this._plotInset[0]);
        rect.setAttribute('width', this._boxWidth - this._plotInset[1] - this._plotInset[3]);
        rect.setAttribute('width2', this._plotWidth);
        rect.setAttribute('height', this._plotHeight);
    }

    doReset() {
        this._pathLineEl.removeAttribute('d');
        this._pathAreaEl.removeAttribute('d');
        this._prevCoords = null;
        this._prevData = null;
        this.segments.length = 0;
        this._segmentEls.clear();
        for (const x of this._segmentFills.values()) {
            this.removeGradient(x.gradient);
        }
        this._segmentFills.clear();
    }

    adjustScale(manifest) {
        super.adjustScale(manifest);
        const data = manifest.data;
        if (this.xMin == null) {
            this._xMin = data[0].x;
        }
        if (this.xMax == null) {
            this._xMax = data[data.length - 1].x;
        }
        if (this._xMax === this._xMin) {
            this._xMin -= 0.5;
            this._xMax += 0.5;
        }
        if (this._yMax === this._yMin) {
            this._yMin -= 0.5;
            this._yMax += 0.5;
        }
    }

    doRender(manifest) {
        const layouts = this._renderBeforeLayout(manifest);
        this._renderDoLayout(layouts);
        this._prevCoords = layouts.coords;
        this._prevData = manifest.data;
    }

    _renderBeforeLayout({data, disableAnimation}) {
        const coords = data.map(o => [this.toX(o.x), this.toY(o.y)]);
        let forceLayout = false;
        if (!disableAnimation && this._prevCoords) {
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
                forceLayout = true;
            }
        }
        const plotCenterX = this._plotWidth / 2 + this._plotInset[3];
        const unclaimedSegmentEls = new Map(this._segmentEls);
        const unclaimedFills = new Map(this._segmentFills);
        const segmentAdds = [];
        const segmentUpdates = [];
        for (let i = 0; i < this.segments.length; i++) {
            const s = this.segments[i];
            const x = s.x != null ? this.toX(s.x) : this._plotInset[3];
            const y = s.y != null ? this.toY(s.y) : this._plotInset[0];
            const width = s.width != null ?
                this.toScaleX(s.width) :
                this._plotWidth - (x - this._plotInset[3]);
            const height = s.height != null ?
                this.toScaleY(s.height) :
                this._plotHeight - (y - this._plotInset[0]);
            let el = this._segmentEls.get(s);
            if (!el) {
                el = common.createSVGElement('rect');
                el.classList.add('sc-visual-data-segment');
                if (x + width / 2 > plotCenterX) {
                    el.setAttribute('x', x + width);
                } else {
                    el.setAttribute('x', x);
                }
                el.setAttribute('y', y);
                el.setAttribute('width', 0);
                el.setAttribute('height', height);
                this._segmentEls.set(s, el);
                forceLayout = true;
                segmentAdds.push({el});
            } else {
                unclaimedSegmentEls.delete(s);
            }
            let gradient;
            if (s.color) {
                if (!this._segmentFills.has(s.color)) {
                    const fill = color.parse(s.color);
                    gradient = this.addGradient((fill instanceof color.Gradient) ? fill : {
                        type: 'linear',
                        colors: [
                            fill.adjustAlpha(-0.7).adjustLight(-0.2),
                            fill.adjustAlpha(-0.14),
                        ]
                    });
                    this._segmentFills.set(s.color, {gradient});
                } else {
                    unclaimedFills.delete(s.color);
                    gradient = this._segmentFills.get(s.color).gradient;
                }
            }
            segmentUpdates.push({el, x, y, width, height, gradient});
        }
        const segmentRemoves = [];
        if (unclaimedSegmentEls.size) {
            for (const [k, el] of unclaimedSegmentEls) {
                let x = Number(el.getAttribute('x'));
                const width = Number(el.getAttribute('width'));
                if (x + width / 2 > plotCenterX) {
                    x += width;
                }
                this._segmentEls.delete(k);
                segmentRemoves.push({el, x});
            }
        }
        const gradientRemoves = [];
        if (unclaimedFills.size) {
            for (const [k, {gradient}] of unclaimedFills) {
                this._segmentFills.delete(k);
                gradientRemoves.push(gradient);
            }
        }
        return {forceLayout, coords, segmentAdds, segmentUpdates, segmentRemoves, gradientRemoves};
    }

    _renderDoLayout({coords, forceLayout, segmentAdds, segmentUpdates, segmentRemoves, gradientRemoves}) {
        for (let i = 0; i < segmentAdds.length; i++) {
            this._backgroundEl.append(segmentAdds[i].el);
        }
        if (forceLayout) {
            this._plotRegionEl.clientWidth;
        }
        this._pathLineEl.setAttribute('d', this.makePath(coords));
        this._pathAreaEl.setAttribute('d', this.makePath(coords, {closed: true}));
        for (let i = 0; i < segmentUpdates.length; i++) {
            const o = segmentUpdates[i];
            o.el.setAttribute('x', o.x);
            o.el.setAttribute('y', o.y);
            o.el.setAttribute('width', o.width);
            o.el.setAttribute('height', o.height);
            if (o.gradient) {
                o.el.setAttribute('fill', `url(#${o.gradient.id})`);
            }
        }
        const gc = [];
        if (segmentRemoves.length) {
            for (const {el, x} of segmentRemoves) {
                el.setAttribute('x', x);
                el.setAttribute('width', 0);
            }
            gc.push(() => segmentRemoves.forEach(({el}) => el.remove()));
        }
        if (gradientRemoves.length) {
            gc.push(() => gradientRemoves.forEach(x => this.removeGradient(x)));
        }
        if (gc.length) {
            const animDur = common.getStyleValue(this.el, '--transition-duration', 'time') || 0;
            setTimeout(() => {
                this._gcQueue.push(...gc);
                this._schedGC();
            }, animDur + 100);
        }
    }

    _schedGC() {
        if (this._gcTimeout) {
            return;
        }
        this._gcTimeout = common.requestIdle(() => {
            this._gcTimeout = null;
            this._gc();
        });
    }

    _gc() {
        while (this._gcQueue.length) {
            const cb = this._gcQueue.shift();
            try {
                cb();
            } catch(e) {
                console.error('Garbage collection error:', e);
            }
        }
    }
}
