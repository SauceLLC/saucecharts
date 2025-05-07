import * as common from './common.mjs';
import * as colorMod from './color.mjs';


export class LineChart extends common.Chart {

    init(options={}) {
        this.hidePoints = options.hidePoints;
        this.brush = options.brush || {};
        this.segments = [];
        this._segmentEls = new Map();
        this._segmentFills = new Map();
        this._gcQueue = [];
        this._brushState = {};
        this._onPointerDownBound = this.onPointerDown.bind(this);
    }

    setSegments(segments, options={}) {
        this.segments = segments;
        if (options.render !== false) {
            this.render();
        }
    }

    beforeSetElement(el) {
        const old = this.el;
        if (old) {
            old.removeEventListener('pointerdown', this._onPointerDownBound);
        }
        el.classList.add('sc-linechart');
    }

    afterSetElement(el) {
        if (this._bgGradient) {
            this.removeGradient(this._bgGradient);
        }
        el.addEventListener('pointerdown', this._onPointerDownBound);
        const fill = colorMod.parse(this.getColor());
        this._bgGradient = this.addGradient({
            type: 'linear',
            colors: [
                fill.adjustAlpha(-0.7).adjustLight(-0.2),
                fill.adjustAlpha(-0.14),
            ]
        });
        const areaClipId = `clip-${this.id}`;
        const lineClipId = `line-clip-${this.id}`;
        const markerLineClipId = `marker-line-clip-${this.id}`;
        const markerId = `marker-${this.id}`;
        const markerSize = 40; // Abstract units
        const defs = common.createSVG({
            name: 'defs',
            children: [{
                name: 'clipPath',
                id: lineClipId,
                children: [{
                    name: 'rect',
                    class: ['sc-line-clip']
                }]
            }, {
                name: 'clipPath',
                id: markerLineClipId,
                children: [{
                    name: 'rect',
                    class: ['sc-marker-line-clip']
                }]
            }, {
                name: 'clipPath',
                id: areaClipId,
                children: [{
                    name: 'path',
                    class: ['sc-data', 'sc-area']
                }]
            }, this.hidePoints ? undefined : {
                name: 'marker',
                id: markerId,
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
            }].filter(x => x)
        });
        this._backgroundEl = common.createSVG({
            name: 'g',
            class: 'sc-background',
            attrs: {
                'clip-path': `url(#${areaClipId})`,
            },
            children: [{
                name: 'rect',
                class: 'sc-visual-data-area',
                attrs: {
                    fill: `url(#${this._bgGradient.id})`,
                },
            }]
        });
        this._lineEl = common.createSVG({
            name: 'path',
            class: ['sc-data', 'sc-line', 'sc-visual-data-line'],
            attrs: {
                'clip-path': `url(#${lineClipId})`,
            }
        });
        this._markerLineEl = this.hidePoints ? undefined : common.createSVG({
            name: 'path',
            class: ['sc-data', 'sc-line', 'sc-visual-data-line-markers'],
            attrs: {
                'clip-path': `url(#${markerLineClipId})`,
                'marker-start': `url(#${markerId})`,
                'marker-mid': `url(#${markerId})`,
                'marker-end': `url(#${markerId})`,
            }
        });
        this._areaEl = defs.querySelector('path.sc-area');
        this._plotRegionEl.replaceChildren(defs, this._backgroundEl, this._lineEl, this._markerLineEl);
        if (!this.brush.disabled) {
            const groupEl = common.createSVG({name: 'g', class: ['sc-brush']});
            this._brushMaskEl = common.createSVG({
                name: 'rect',
                class: ['sc-brush-mask']
            });
            this._brushHandleLeftEl = common.createSVG({
                name: 'line',
                class: ['sc-brush-handle', 'sc-left']
            });
            this._brushHandleRightEl = common.createSVG({
                name: 'line',
                class: ['sc-brush-handle', 'sc-right']
            });
            groupEl.append(this._brushMaskEl, this._brushHandleLeftEl, this._brushHandleRightEl);
            this._plotRegionEl.append(groupEl);
        }
        this._tooltipGroupEl = this._rootSvgEl.querySelector(':scope > .sc-tooltip');
    }

    doReset() {
        this._lineEl.removeAttribute('d');
        if (this._markerLineEl) {
            this._markerLineEl.removeAttribute('d');
        }
        this._areaEl.removeAttribute('d');
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
                const pathLine = this.makePath(prev);
                this._lineEl.setAttribute('d', pathLine);
                if (this._markerLineEl) {
                    this._markerLineEl.setAttribute('d', pathLine);
                }
                this._areaEl.setAttribute('d', this.makePath(prev, {closed: true}));
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
        const linePath = this.makePath(coords);
        this._lineEl.setAttribute('d', linePath);
        if (this._markerLineEl) {
            this._markerLineEl.setAttribute('d', linePath);
        }
        this._areaEl.setAttribute('d', this.makePath(coords, {closed: true}));
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

    showBrush() {
        const state = this._brushState;
        if (state.visible) {
            return;
        }
        this.el.classList.add('sc-brush-active');
        state.visible = true;
    }

    hideBrush() {
        const state = this._brushState;
        if (!state.visible) {
            return;
        }
        this.el.classList.remove('sc-brush-active');
        state.visible = false;
    }

    onPointerDown(ev) {
        if (this._tooltipState.pointerActive) {
            //console.debug("pointer active: abort");
            //this._tooltipState.pointerAborter.abort();
            //this.hideTooltip();
        }
        const state = this._establishBrushState();
        if (state.pointerActive || !this._renderData || !this._renderData.length) {
            debugger; // XXX can happen?
            return;
        }
        const x = (ev.x - state.chartPlotOffset[0] + state.scrollOffsets[0]) * this.devicePixelRatio;
        const y = (ev.y - state.chartPlotOffset[1] + state.scrollOffsets[1]) * this.devicePixelRatio;
        if (x < this._plotBox[3] || x > this._plotBox[1] || y < this._plotBox[0] || y > this._plotBox[2]) {
            console.warn("NO", x, y, this._plotBox);
            if (state.visible) {
                this.hideBrush();
            }
            return;
        }
        const pointerId = ev.pointerId;
        state.pointerId = pointerId;
        state.x1 = state.x2 = x;
        state.pointerActive = true;
        state.pointerAborter = new AbortController();
        const signal = state.pointerAborter.signal;
        signal.addEventListener('abort', () => {
            console.warn("canc brush");
            state.pointerActive = false;
            if (state.pointerId === pointerId && state.x1 === state.x2) {
                this.hideBrush();
            }
        });
        // Cancel-esc pointer events are sloppy and unreliable (proven).  Kitchen sink...
        addEventListener('pointercancel', () => state.pointerAborter.abort(), {signal});
        addEventListener('pointerup', () => state.pointerAborter.abort(), {signal});
        let af;
        document.addEventListener('pointermove', ev => {
            cancelAnimationFrame(af);
            state.x2 = (ev.x - state.chartPlotOffset[0] + state.scrollOffsets[0]) * this.devicePixelRatio;
            af = requestAnimationFrame(() => this._updateBrush());
        }, {signal});
        this._updateBrush();
        this.showBrush();
    }

    _updateBrush() {
        const state = this._brushState;
        let {x1, x2} = state;
        if (this.brush.snap) {
            x1 = this.findNearestFromXCoord(x1)?.x;
            x2 = this.findNearestFromXCoord(x2)?.x;
        }
        if (x1 == null || x2 == null) {
            console.log("NOPE");
            return;
        }
        if (x1 > x2) {
            [x1, x2] = [x2, x1];
        }
        if (x1 < this._plotBox[3]) {
            x1 = this._plotBox[3];
        }
        if (x2 > this._plotBox[1]) {
            x2 = this._plotBox[1];
        }
        const top = this._plotInset[0];
        const bottom = this._boxHeight - this._plotInset[2];
        this._brushMaskEl.setAttribute('y', top);
        this._brushMaskEl.setAttribute('height', bottom - top);
        this._brushMaskEl.setAttribute('x', x1);
        this._brushMaskEl.setAttribute('width', x2 - x1);
        this._brushHandleLeftEl.setAttribute('y1', top);
        this._brushHandleLeftEl.setAttribute('y2', bottom);
        this._brushHandleLeftEl.setAttribute('x1', x1);
        this._brushHandleLeftEl.setAttribute('x2', x1);
        this._brushHandleRightEl.setAttribute('y1', top);
        this._brushHandleRightEl.setAttribute('y2', bottom);
        this._brushHandleRightEl.setAttribute('x1', x2);
        this._brushHandleRightEl.setAttribute('x2', x2);
    }

    _establishBrushState() {
        const scrollOffsets = [scrollX, scrollY];
        const plotRect = this.el.getBoundingClientRect();
        Object.assign(this._brushState, {
            scrollOffsets,
            lastDrawSig: undefined, // XXX
            chartPlotOffset: [plotRect.x + scrollOffsets[0], plotRect.y + scrollOffsets[1]]
        });
        return this._brushState;
    }

    afterRender(...args) {
        super.afterRender(...args);
        if (this._brushState.visible) {
            this._updateBrush();
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
