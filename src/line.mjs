import * as common from './common.mjs';
import * as colorMod from './color.mjs';


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

    afterSetElement(el) {
        if (this._bgGradient) {
            this.removeGradient(this._bgGradient);
        }
        const fill = colorMod.parse(this.getColor());
        this._bgGradient = this.addGradient({
            type: 'linear',
            colors: [
                fill.adjustAlpha(-0.7).adjustLight(-0.2),
                fill.adjustAlpha(-0.14),
            ]
        });

        const pathClipId = `path-clip-${this.id}`;
        const pathMarkerId = `path-marker-${this.id}`;
        const markerSize = this.hidePoints ? 0 : 20; // Abstract units based on 'markerUnits'
        const defs = common.createSVG({
            name: 'defs',
            children: [{
                name: 'clipPath',
                id: pathClipId,
                children: [{
                    name: 'path',
                    class: ['sc-data', 'sc-area']
                }]
            }, {
                name: 'marker',
                id: pathMarkerId,
                class: 'sc-line-marker',
                attrs: {
                    markerUnits: 'userSpaceOnUse',
                    refX: markerSize / 2,
                    refY: markerSize / 2,
                    markerHeight: markerSize,
                    markerWidth: markerSize,
                },
                children: [{
                    name: 'circle',
                    class: 'sc-dot',
                    attrs: {
                        cx: markerSize / 2,
                        cy: markerSize / 2,
                    }
                }]
            }]
        });
        this._backgroundEl = common.createSVG({
            name: 'g',
            class: 'sc-background',
            attrs: {
                'clip-path': `url(#${pathClipId})`,
            },
            children: [{
                name: 'rect',
                class: 'sc-visual-data-area',
                attrs: {
                    fill: `url(#${this._bgGradient.id})`,
                },
            }]
        });
        this._pathLineEl = common.createSVG({
            name: 'path',
            class: ['sc-data', 'sc-line', 'sc-visual-data-line'],
            attrs: {
                'marker-start': `url(#${pathMarkerId})`,
                'marker-mid': `url(#${pathMarkerId})`,
                'marker-end': `url(#${pathMarkerId})`,
            }
        });
        this._pathAreaEl = defs.querySelector('path.sc-area');
        this._plotRegionEl.replaceChildren(defs, this._backgroundEl, this._pathLineEl);
    }

    adjustSize(...args) {
        super.adjustSize(...args);
        const rect = this._backgroundEl.querySelector('rect.sc-visual-data-area');
        rect.setAttribute('x', this._plotInset[3]);
        rect.setAttribute('y', this._plotInset[0]);
        rect.setAttribute('width', this._plotWidth);
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

    doLayout(manifest) {
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
                el = common.createSVG({
                    name: 'rect',
                    class: ['sc-visual-data-segment'],
                    attrs: {
                        x: (x + width / 2 > plotCenterX) ? x + width : x,
                        y,
                        width: 0,
                        height,
                    }
                });
                this._segmentEls.set(s, el);
                forceLayout = true;
                segmentAdds.push({el});
            } else {
                unclaimedSegmentEls.delete(s);
            }
            let gradient;
            if (s.color) {
                if (!this._segmentFills.has(s.color)) {
                    const fill = colorMod.parse(s.color);
                    gradient = this.addGradient((fill instanceof colorMod.Gradient) ? fill : {
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
        if (segmentRemoves.length) {
            for (const {el, x} of segmentRemoves) {
                el.setAttribute('x', x);
                el.setAttribute('width', 0);
            }
            this._gcQueue.push(
                [document.timeline.currentTime, () => segmentRemoves.forEach(({el}) => el.remove())]);
        }
        if (gradientRemoves.length) {
            this._gcQueue.push(
                [document.timeline.currentTime, () => gradientRemoves.forEach(x => this.removeGradient(x))]);
        }
        if (this._gcQueue.length) {
            this._schedGC();
        }
    }

    _schedGC() {
        if (this._gcTimeout) {
            return;
        }
        this._gcTimeout = setTimeout(() => {
            common.requestIdle(() => {
                this._gcTimeout = null;
                this._gc();
            });
        }, 1100);
    }

    _gc() {
        const animDur = common.getStyleValue(this.el, '--transition-duration', 'time') || 0;
        const expiration = document.timeline.currentTime - animDur - 100;
        for (const [ts, cb] of Array.from(this._gcQueue)) {
            if (ts > expiration) {
                break;
            }
            this._gcQueue.shift();
            try {
                cb();
            } catch(e) {
                console.error('Garbage collection error:', e);
            }
        }
        if (this._gcQueue.length) {
            setTimeout(() => this._schedGC(), this._gcQueue[0][0] - expiration);
        }
    }
}
