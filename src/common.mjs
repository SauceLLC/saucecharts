import * as colorMod from './color.mjs';

let globalIdCounter = 0;


export function createSVGElement(tag) {
    return document.createElementNS('http://www.w3.org/2000/svg', tag);
}


export function getStyleValue(el, key, type) {
    const raw = getComputedStyle(el).getPropertyValue(key);
    if (!type) {
        return raw;
    } else if (type === 'number') {
        return parseFloat(raw);
    } else if (type === 'time') {
        return parseFloat(raw) * (raw.endsWith('ms') ? 1 : 1000);
    }
}


export function requestIdle(cb, timeout=400) {
    if (window.requestIdleCallback) {
        return requestIdleCallback(cb, {timeout});
    } else {
        return setTimeout(cb, timeout / 2);
    }
}


export function cancelIdle(id) {
    if (window.requestIdleCallback) {
        return cancelIdleCallback(id);
    } else {
        return clearTimeout(id);
    }
}


// Ported from https://github.com/joshcarr/largest-triangle-three-buckets.js
// See: https://github.com/sveinn-steinarsson/flot-downsample
function largestTriangleThreeBuckets(inData, outLen) {
    if (!outLen || outLen >= inData.length) {
        return inData;
    }
    const outData = [inData[0]];
    const every = (inData.length - 2) / (outLen - 2);
    let a = 0;
    let nextA;
    let maxAreaPoint;
    for (let i = 0; i < outLen - 2; i++) {
        const bStart = ((i + 1) * every | 0) + 1;
        const bEnd = Math.min(inData.length, ((i + 2) * every | 0) + 1);
        const bFactor = 1 / (bEnd - bStart);
        let avgX = 0, avgY = 0;
        for (let ii = bStart; ii < bEnd; ii++) {
            avgX += inData[ii].x * bFactor;
            avgY += inData[ii].y * bFactor;
        }
        const rangeFrom = ((i + 0) * every | 0) + 1;
        const rangeTo = ((i + 1) * every | 0) + 1;
        const aX = inData[a].x;
        const aY = inData[a].y;
        const aXAvgDist = aX - avgX;
        const ayAvgDist = avgY - aY;
        let maxArea = -1;
        for (let ii = rangeFrom; ii < rangeTo; ii++) {
            const area = Math.abs((aXAvgDist * (inData[ii].y - aY)) - (ayAvgDist * (aX - inData[ii].x)));
            if (area > maxArea) {
                maxArea = area;
                maxAreaPoint = inData[ii];
                nextA = i;
            }
        }
        outData.push(maxAreaPoint);
        a = nextA;
    }
    outData.push(inData[inData.length - 1]);
    return outData;
}


const resample = largestTriangleThreeBuckets;


export class Chart {

    constructor(options={}) {
        this.init(options);
        this.id = globalIdCounter++;
        this.yMin = options.yMin;
        this.yMax = options.yMax;
        this.xMin = options.xMin;
        this.xMax = options.xMax;
        this.childCharts = [];
        this.title = options.title;
        this.color = options.color;
        this.tooltip = options.tooltip || {};
        this.xAxis = options.xAxis || {};
        this.yAxis = options.yAxis || {};
        this.padding = options.padding || [0, 0, 0, 0];
        this.tooltipPadding = options.tooltipPadding || [this.padding[0], this.padding[2]];
        this.tooltipPosition = options.tooltipPosition || 'leftright';
        this.disableAnimation = options.disableAnimation;
        this.darkMode = options.darkMode;
        this.tooltipLinger = options.tooltipLinger ?? 800;
        this._tooltipState = {};
        this._gradients = new Set();
        this._onPointerEnterBound = this.onPointerEnter.bind(this);
        this._resizeObserver = new ResizeObserver(this.onResize.bind(this));
        if (options.el) {
            this.setElement(options.el, {merge: options.merge});
        }
        if (options.data) {
            this.setData(options.data);
        }
        window.addEventListener('scroll', ev => {
            if (!this._tooltipState.visible) {
                return;
            }
            const offsets = this._tooltipState.scrollOffsets;
            offsets[0] = scrollX;
            offsets[1] = scrollY;
            this._updateTooltip({disableAnimation: true});
        }, {passive: true});
    }

    init(options) {
    }

    addGradient(gradient) {
        if (!(gradient instanceof colorMod.Gradient)) {
            gradient = colorMod.Gradient.fromObject(gradient);
        }
        gradient.render();
        this._gradients.add(gradient);
        this._defsEl.append(gradient.el);
        return gradient;
    }

    removeGradient(gradient) {
        this._gradients.delete(gradient);
        gradient.el.remove();
    }

    onResize(entries) {
        for (let i = 0; i < entries.length; i++) {
            const x = entries[i];
            if (x.target === this._tooltipBoxEl) {
                requestAnimationFrame(() => this._onResizeTooltip(x));
            } else if (x.target === this.el) {
                requestAnimationFrame(() => this._onResizeContainer(x));
            }
        }
    }

    _onResizeTooltip(entry) {
        const minChange = 10;
        const courseWidth = Math.ceil(entry.borderBoxSize[0].inlineSize / minChange) * minChange;
        this._tooltipPositionerEl.style.setProperty('--course-width', `${courseWidth}px`);
    }

    _onResizeContainer(resize) {
        const hasAnim = !this.el.classList.contains('sc-disable-animation');
        if (hasAnim) {
            this.el.classList.add('sc-disable-animation');
        }
        try {
            this._adjustSize(resize.contentRect.width, resize.contentRect.height);
            if (this.data) {
                this.render({disableAnimation: true, forceAxis: true});
            }
        } finally {
            if (hasAnim) {
                this.el.offsetWidth;
                this.el.classList.remove('sc-disable-animation');
            }
        }
    }

    _adjustSize(width, height) {
        this.devicePixelRatio = devicePixelRatio || 1;
        if (width === undefined) {
            ({width, height} = this._rootSvgEl.getBoundingClientRect());
        }
        if (!width || !height) {
            this._boxWidth = null;
            this._boxHeight = null;
            this._plotWidth = null;
            this._plotHeight = null;
            this._plotInset = [0, 0, 0, 0];
            return;
        }
        const ar = width / height;
        if (ar > 1) {
            this._boxWidth = Math.round(width * this.devicePixelRatio);
            this._boxHeight = Math.round(this._boxWidth / ar);
        } else {
            this._boxHeight = Math.round(height * this.devicePixelRatio);
            this._boxWidth = Math.round(this._boxHeight * ar);
        }
        this._plotInset = this.padding.map(x => x * this.devicePixelRatio);
        const hPad = this._plotInset[1] + this._plotInset[3];
        const vPad = this._plotInset[0] + this._plotInset[2];
        this._plotWidth = Math.max(0, this._boxWidth - hPad);
        this._plotHeight = Math.max(0, this._boxHeight - vPad);
        if (this.isParentChart()) {
            this._rootSvgEl.setAttribute('viewBox', `0 0 ${this._boxWidth} ${this._boxHeight}`);
            this.el.style.setProperty('--dpr', this.devicePixelRatio);
        }
        if (this._tooltipState.visible) {
            this._establishTooltipState();
        }
    }

    _drawXAxis() {
        this._drawAxis('horizontal', this._xAxisEl, this.xAxis);
    }

    _drawYAxis() {
        this._drawAxis('vertical', this._yAxisEl, this.yAxis);
    }

    _drawAxis(orientation, el, options) {
        const vert = orientation === 'vertical';
        const baseline = el.querySelector('line.sc-baseline');
        const top = this._plotInset[0];
        const left = this._plotInset[3];
        const right = left + this._plotWidth;
        const bottom = top + this._plotHeight;
        if (vert) {
            el.classList.toggle('sc-right', !!options.right);
            baseline.setAttribute('x1', options.align === 'right' ? right : left);
            baseline.setAttribute('x2', options.align === 'right' ? right : left);
            baseline.setAttribute('y1', top);
            baseline.setAttribute('y2', bottom);
        } else {
            baseline.setAttribute('x1', left);
            baseline.setAttribute('x2', right);
            baseline.setAttribute('y1', bottom);
            baseline.setAttribute('y2', bottom);
        }
        let ticks = options.ticks;
        const trackLength = vert ? this._plotHeight : this._plotWidth;
        if (ticks == null) {
            ticks = 2 + Math.floor((trackLength / devicePixelRatio) / (vert ? 100 : 200));
        }
        const gap = trackLength / (ticks - 1);
        const tickLen = options.tickLength ?? 10;
        const format = options.label || this.onAxisLabel.bind(this);
        const existingTicks = el.querySelectorAll('line.sc-tick');
        const existingLabels = el.querySelectorAll('text.sc-label');
        let visualCount = 0;
        for (let i = options.showFirst ? 0 : 1; i < ticks; i++) {
            let x1, x2, y1, y2;
            if (vert) {
                x1 = options.align === 'right' ? right : left;
                x2 = x1 + tickLen * (options.align === 'right' ? -1 : 1);
                y1 = y2 = bottom - i * gap;
            } else {
                x1 = x2 = left + i * gap;
                y1 = bottom;
                y2 = bottom - tickLen;
            }
            let tick = existingTicks[visualCount];
            if (!tick) {
                tick = createSVGElement('line');
                tick.classList.add('sc-tick');
                el.append(tick);
            }
            tick.setAttribute('x1', x1);
            tick.setAttribute('x2', x2);
            tick.setAttribute('y1', y1);
            tick.setAttribute('y2', y2);
            let label = existingLabels[visualCount];
            if (!label) {
                label = createSVGElement('text');
                label.classList.add('sc-label');
                el.append(label);
            }
            label.setAttribute('x', x1);
            label.setAttribute('y', y1);
            label.setAttribute('data-pct', i / (ticks - 1));
            label.textContent = format({orientation, index: i, ticks, trackLength, options});
            visualCount++;
        }
        for (let i = visualCount; i < existingTicks.length; i++) {
            existingTicks[i].remove();
        }
        for (let i = visualCount; i < existingLabels.length; i++) {
            existingLabels[i].remove();
        }
    }

    setElement(el, {merge}={}) {
        const old = this.el;
        this.el = el;
        if (old) {
            this._resizeObserver.disconnect();
            old.removeEventListener('pointerenter', this._onPointerEnterBound);
        }
        if (!merge) {
            el.classList.add('saucechart', 'sc-wrap');
            el.classList.toggle('sc-disable-animation', !!this.disableAnimation);
            let darkMode = this.darkMode;
            if (darkMode === undefined) {
                const c = colorMod.parse(getStyleValue(el, 'color'));
                darkMode = c.l >= 0.5;
            }
            this.el.classList.toggle('sc-darkmode', darkMode);
            el.innerHTML = `
                <svg version="1.1" xmlns="http://www.w3.org/2000/svg"
                     preserveAspectRatio="none" class="sc-root">
                    <defs></defs>
                    <g class="sc-plot-regions"></g>
                    <g class="sc-tooltip"></g>
                </svg>
                <div class="sc-tooltip-positioner">
                    <div class="sc-tooltip-box-wrap">
                        <div class="sc-tooltip-box"></div>
                    </div>
                </div>`;

            el.parentSauceChart = this;
            this.childCharts.length = 0;
        } else {
            el.parentSauceChart.addChart(this);
        }
        this._rootSvgEl = el.querySelector('svg.sc-root');
        this._defsEl = this._rootSvgEl.querySelector('defs');
        this._tooltipGroupEl = this._rootSvgEl.querySelector('.sc-tooltip');
        this._tooltipPositionerEl = el.querySelector('.sc-tooltip-positioner'),
        this._tooltipBoxEl = el.querySelector('.sc-tooltip-box');
        this._plotRegionEl = createSVGElement('g');
        this._plotRegionEl.classList.add('sc-plot-region');
        this._plotRegionEl.dataset.id = this.id;
        if (this.color) {
            this._plotRegionEl.style.setProperty('--color', this.color);
            this._computedColor = null;
        }
        this._rootSvgEl.querySelector('.sc-plot-regions').append(this._plotRegionEl);
        if (this.title) {
            el.insertAdjacentHTML('beforeend',
                                  `<div data-sc-id="${this.id}" class="sc-title">${this.title}</div>`);
        }
        if (!this.xAxis.disabled) {
            this._xAxisEl = createSVGElement('g');
            this._xAxisEl.classList.add('sc-axis', 'sc-x-axis');
            this._xAxisEl.innerHTML = `<line class="sc-baseline"></line>`;
            this._rootSvgEl.append(this._xAxisEl);
        }
        if (!this.yAxis.disabled) {
            this._yAxisEl = createSVGElement('g');
            this._yAxisEl.classList.add('sc-axis', 'sc-y-axis');
            this._yAxisEl.innerHTML = `<line class="sc-baseline"></line>`;
            this._rootSvgEl.append(this._yAxisEl);
        }
        this._resizeObserver.observe(this._tooltipBoxEl);
        this._resizeObserver.observe(el);
        if (this.isParentChart() && !this.tooltip.disabled) {
            el.addEventListener('pointerenter', this._onPointerEnterBound);
        }
        // Let subclass do work before/after this method but always before adjustSize..
        queueMicrotask(() => this._adjustSize());
    }

    getColor() {
        if (!this._computedColor) {
            this._computedColor = getStyleValue(this._plotRegionEl, '--color');
        }
        return this._computedColor;
    }

    isParentChart() {
        return this.el?.parentSauceChart === this;
    }

    addChart(chart) {
        if (!this.isParentChart()) {
            throw new TypeError("Improper use of addChart");
        }
        this.childCharts.push(chart);
        chart.parentChart = this;
        for (const x of this.childCharts) {
            x._computedColor = null;
        }
        this._computedColor = null;
    }

    onTooltip({entry, chart}) {
        if (this.tooltip.format) {
            return this.tooltip.format.apply(this, arguments);
        } else {
            return `
                <div class="sc-tooltip-entry" data-chart-id="${this.id}"
                     style="--color:${entry.color || chart.getColor()};">
                    <key>${entry.index}:</key><value>${entry.y.toFixed(2)}</value>
                </div>
            `;
        }
    }

    onAxisLabel({orientation, index, ticks}) {
        let range;
        let start;
        if (orientation === 'vertical') {
            start = this._yMin;
            range = this._yMax - this._yMin;
        } else {
            start = this._xMin;
            range = this._xMax - this._xMin;
        }
        const number = start + (range * (index / (ticks - 1)));
        if (isNaN(number)) {
            return '';
        }
        if (range <= 1) {
            return number.toLocaleString(undefined, {maximumFractionDigits: 2, minimumFractionDigits: 2});
        } else if (range < 100) {
            return number.toLocaleString(undefined, {maximumFractionDigits: 1});
        } else {
            return number.toLocaleString(undefined, {useGrouping: 'min2', maximumFractionDigits: 0});
        }
    }

    onPointerEnter(ev) {
        if (this._tooltipState.pointerActive || !this.data?.length) {
            return;
        }
        const state = this._establishTooltipState();
        const pointerId = ev.pointerId;
        state.pointerActive = true;
        state.pointerAborter = new AbortController();
        state.pointerId = pointerId;
        const onDone = () => {
            state.pointerAborter.abort();
            state.pointerActive = false;
            if (state.pointerId === pointerId) {
                setTimeout(() => {
                    if (!this._tooltipState.pointerActive) {
                        this.hideTooltip();
                    }
                }, this.tooltipLinger);
            }
        };
        const signal = state.pointerAborter.signal;
        // Cancel-esc pointer events are sloppy and unreliable (proven).  Kitchen sink...
        addEventListener('pointercancel', onDone, {signal});
        addEventListener('pointerout', ev => !this.el.contains(ev.target) && onDone(), {signal});
        this.el.addEventListener('pointerleave', onDone, {signal});
        let af;
        this.el.addEventListener('pointermove', ev => {
            cancelAnimationFrame(af);
            af = requestAnimationFrame(() => this._setTooltipPosition({x: ev.x}));
        }, {signal});
        this._setTooltipPosition({x: ev.x, disableAnimation: true});
        this.showTooltip();
    }

    hideTooltip({x, y, index}={}) {
        const state = this._tooltipState;
        if (!state.visible) {
            return;
        }
        this.el.classList.remove('sc-tooltip-active');
        state.visible = false;
    }

    showTooltip({x, y, index}={}) {
        const state = this._tooltipState;
        if (state.visible) {
            return;
        }
        const posEl = this._tooltipPositionerEl;
        const hasAnim = !posEl.classList.contains('sc-disable-animation') &&
            !this.el.classList.contains('sc-disable-animation');
        if (hasAnim) {
            posEl.classList.add('sc-disable-animation');
        }
        try {
            this.el.classList.add('sc-tooltip-active');
            state.visible = true;
        } finally {
            if (hasAnim) {
                posEl.offsetWidth;
                posEl.classList.remove('sc-disable-animation');
            }
        }
    }

    _establishTooltipState() {
        const charts = [this, ...this.childCharts];
        const scrollOffsets = [scrollX, scrollY];
        let positionCallback, hAlign, vAlign;
        if (typeof this.tooltipPosition === 'function') {
            positionCallback = this.tooltipPosition;
        } else {
            let tp = this.tooltipPosition;
            if (typeof tp === 'string') {
                tp = tp.split(/\s+/);
            }
            hAlign = tp.find(x => ['left', 'center', 'right', 'leftright'].includes(x));
            vAlign = tp.find(x => ['above', 'top', 'middle', 'bottom', 'below'].includes(x)) || 'top';
            if (vAlign && !hAlign) {
                hAlign = {
                    below: 'center',
                    above: 'center',
                }[vAlign] || 'leftright';
            }
        }
        Object.assign(this._tooltipState, {
            charts,
            scrollOffsets,
            positionCallback,
            hAlign,
            vAlign,
            lastDrawSig: undefined,
            hasDrawn: false,
            chartPlotOffsets: charts.map(x => {
                const plotRect = x.el.getBoundingClientRect();
                return [plotRect.x + scrollOffsets[0], plotRect.y + scrollOffsets[1]];
            })
        });
        return this._tooltipState;
    }

    setTooltipPosition(options) {
        this._establishTooltipState();
        return this._setTooltipPosition(options);
    }

    _setTooltipPosition({x, y, index, disableAnimation}) {
        Object.assign(this._tooltipState, {x, y, index});
        this._updateTooltip({disableAnimation});
    }

    updateVisibleTooltip(options) {
        const chart = this.isParentChart() ? this : this.parentChart;
        if (chart && chart._tooltipState.visible) {
            chart._updateTooltip(options);
        }
    }

    _updateTooltip(options={}) {
        const tooltips = [];
        const state = this._tooltipState;
        let drawSig = state.scrollOffsets.join();
        const xRef = state.index != null ? this.toX(this.normalizedData[state.index].x) : state.x;
        for (let i = 0; i < state.charts.length; i++) {
            const chart = state.charts[i];
            const xSearch = (xRef - state.chartPlotOffsets[i][0] + state.scrollOffsets[0]) *
                this.devicePixelRatio;
            const entry = chart.findNearestFromXCoord(xSearch);
            if (entry === undefined) {
                continue;
            }
            let html;
            if (entry.tooltip) {
                html = entry.tooltip({entry, chart});
            } else if (chart.onTooltip) {
                html = chart.onTooltip({entry, chart});
            }
            const coordinates = [chart.getMidpointX(entry), chart.toY(entry.y)];
            tooltips.push({chart, entry, coordinates, html});
            drawSig += ` ${i} ${entry.index} ${coordinates[0]} ${coordinates[1]}`;
        }
        if (drawSig !== state.lastDrawSig) {
            state.lastDrawSig = drawSig;
            const posEl = this._tooltipPositionerEl;
            const disableAnim = (options.disableAnimation || !state.hasDrawn) &&
                (!posEl.classList.contains('sc-disable-animation') &&
                 !this.el.classList.contains('sc-disable-animation'));
            if (disableAnim) {
                posEl.classList.add('sc-disable-animation');
            }
            try {
                this._drawTooltip(tooltips);
            } finally {
                if (disableAnim) {
                    posEl.offsetWidth;
                    posEl.classList.remove('sc-disable-animation');
                }
            }
        }
    }

    _drawTooltip(tooltips) {
        const box = this._tooltipBoxEl;
        if (!tooltips.length) {
            box.innerHTML = '';
            return;
        }
        const state = this._tooltipState;
        const top = this.tooltipPadding[0] * this.devicePixelRatio;
        const bottom = this._boxHeight - this.tooltipPadding[1] * this.devicePixelRatio;
        const centerX = tooltips.reduce((agg, o) => agg + o.coordinates[0], 0) / tooltips.length;
        const centerY = top + (bottom - top) / 2;
        let vertLine = this._tooltipGroupEl.querySelector('.sc-line.sc-vertical');
        const existingHLines = this._tooltipGroupEl.querySelectorAll('.sc-line.sc-horizontal');
        const existingDots = this._tooltipGroupEl.querySelectorAll('circle.sc-highlight-dot');
        if (!vertLine) {
            vertLine = createSVGElement('path');
            vertLine.classList.add('sc-line', 'sc-vertical');
            this._tooltipGroupEl.append(vertLine);
        }
        vertLine.setAttribute('d', `M ${centerX}, ${bottom} V ${top}`);
        let minX = this._boxWidth;
        let minY = this._boxHeight;
        let maxX = 0;
        let maxY = 0;
        let extraCount = 0;
        for (let i = 0; i < tooltips.length; i++) {
            const [x, y] = tooltips[i].coordinates;
            let dot = existingDots[i];
            if (!dot) {
                dot = createSVGElement('circle');
                dot.classList.add('sc-highlight-dot');
                this._tooltipGroupEl.append(dot);
            }
            dot.setAttribute('cx', x);
            dot.setAttribute('cy', y);
            if (x > maxX) {
                maxX = x;
            }
            if (x < minX) {
                minX = x;
            }
            if (y > maxY) {
                maxY = y;
            }
            if (y < minY) {
                minY = y;
            }
            if (Math.abs(x - centerX) > 1) {
                let horizLine = existingHLines[i];
                if (!horizLine) {
                    horizLine = createSVGElement('path');
                    horizLine.classList.add('sc-line', 'sc-horizontal');
                    this._tooltipGroupEl.prepend(horizLine);
                }
                horizLine.setAttribute(
                    'd', `M ${x}, ${y} L ${centerX}, ${Math.min(bottom, Math.max(y, top))}`);
                extraCount++;
            }
        }
        for (let i = extraCount; i < existingHLines.length; i++) {
            existingHLines[i].remove();
        }
        for (let i = tooltips.length; i < existingDots.length; i++) {
            existingDots[i].remove();
        }
        let vAlign, hAlign;
        if (state.positionCallback) {
            [vAlign, hAlign] = state.positionCallback({
                chart: this,
                minX,
                minY,
                maxX,
                maxY,
                tooltips
            });
        } else {
            hAlign = state.hAlign === 'leftright' ?
                (centerX >= this._boxWidth * 0.5 ? 'left' : 'right') :
                state.hAlign;
            vAlign = state.vAlign;
        }
        box.innerHTML = tooltips.map(x => x.html).join('');
        const posEl = this._tooltipPositionerEl;
        posEl.dataset.hAlign = hAlign;
        posEl.dataset.vAlign = vAlign;
        const f = 1 / this.devicePixelRatio;
        const offtX = state.chartPlotOffsets[0][0] - state.scrollOffsets[0];
        const offtY = state.chartPlotOffsets[0][1] - state.scrollOffsets[1];
        posEl.style.setProperty('--x-left', `${minX * f + offtX}px`);
        posEl.style.setProperty('--x-right', `${maxX * f + offtX}px`);
        posEl.style.setProperty('--x-center', `${centerX * f + offtX}px`);
        posEl.style.setProperty('--y-center', `${centerY * f + offtY}px`);
        posEl.style.setProperty('--y-top', `${Math.min(minY, top) * f + offtY}px`);
        posEl.style.setProperty('--y-bottom', `${Math.max(maxY, bottom) * f + offtY}px`);
        state.hasDrawn = true;
    }

    findNearestFromXCoord(searchX) {
        if (!this._renderData || !this._renderData.length) {
            return;
        }
        const len = this._renderData.length;
        let left = 0;
        let right = len - 1;
        for (let i = (len * 0.5) | 0;; i = ((right - left) * 0.5 + left) | 0) {
            const entry = this._renderData[i];
            const x = this.getMidpointX(entry);
            if (x > searchX) {
                right = i;
            } else if (x < searchX) {
                left = i;
            } else {
                return this._renderData[i];
            }
            if (right - left <= 1) {
                const lDist = searchX - this.getMidpointX(this._renderData[left]);
                const rDist = this.getMidpointX(this._renderData[right]) - searchX;
                return this._renderData[lDist < rDist ? left : right];
            }
        }
    }

    setData(data, options={}) {
        this.data = data;
        this.normalizedData = this.normalizeData(data);
        if (options.render !== false) {
            this.render(options);
        }
    }

    normalizeData(data) {
        const norm = new Array(data.length);
        if (!data.length) {
            return norm;
        }
        if (Array.isArray(data[0])) {
            // [[x, y], [x1, y1], ...]
            for (let i = 0; i < data.length; i++) {
                norm[i] = {index: i, x: data[i][0] || 0, y: data[i][1] || 0};
            }
        } else if (typeof data[0] === 'object') {
            // [{x, y, ...}, {x, y, ...}, ...]
            for (let i = 0; i < data.length; i++) {
                const o = data[i];
                norm[i] = {...o, index: i, x: o.x || 0, y: o.y || 0};
            }
        } else {
            // [y, y1, ...]
            for (let i = 0; i < data.length; i++) {
                norm[i] = {index: i, x: i, y: data[i] || 0};
            }
        }
        return norm;
    }

    render(options={}) {
        if (!this.el || !this._boxWidth || !this._boxHeight) {
            return;
        }
        if (!this.data || !this.data.length) {
            this.doReset();
            return;
        }
        options.disableAnimation = options.disableAnimation || this.disableAnimation;
        const manifest = this.beforeRender(options);
        const beforeScale = options.forceAxis || [this._xMin, this._xMax, this._yMin, this._yMax].join();
        this.adjustScale(manifest);
        this.doRender(manifest, options);
        if (options.forceAxis || [this._xMin, this._xMax, this._yMin, this._yMax].join() !== beforeScale) {
            if (this._xAxisEl) {
                this._drawXAxis();
            }
            if (this._yAxisEl) {
                this._drawYAxis();
            }
        }
        this.afterRender(manifest, options);
    }

    beforeRender(options) {
        let data = this.normalizedData;
        const resampling = data.length > this._plotWidth * 1.5;
        if (resampling) {
            data = resample(data, this._plotWidth | 0);
        }
        this._renderData = data;
        return {data, resampling};
    }

    adjustScale({data}) {
        this._xMin = this.xMin;
        this._xMax = this.xMax;
        this._yMin = this.yMin;
        this._yMax = this.yMax;
        if (this.yMin == null || this.yMax == null) {
            let min = Infinity;
            let max = -Infinity;
            for (let i = 0; i < data.length; i++) {
                const v = data[i].y;
                if (v < min) {
                    min = v;
                }
                if (v > max) {
                    max = v;
                }
            }
            if (this.yMin == null) {
                this._yMin = min;
            }
            if (this.yMax == null) {
                this._yMax = max;
            }
        }
    }

    doRender(manifest, options) {
        throw new Error("subclass impl required");
    }

    afterRender(manifest, options) {
        this.updateVisibleTooltip();
    }

    toX(value) {
        return (value - this._xMin) *
            (this._plotWidth / (this._xMax - this._xMin)) +
            this._plotInset[3];
    }

    toScaleX(value) {
        return value * (this._plotWidth / (this._xMax - this._xMin));
    }

    toY(value) {
        return this._plotHeight + this._plotInset[0] -
            ((value - this._yMin) * (this._plotHeight / (this._yMax - this._yMin)));
    }

    toScaleY(value) {
        return value * (this._plotHeight / (this._yMax - this._yMin));
    }

    fromX(value) {
        return (value - this._plotInset[3]) /
            (this._plotWidth / (this._xMax - this._xMin)) +
            this._xMin;
    }

    fromY(value) {
        return (this._plotHeight - value + this._plotInset[0]) /
            (this._plotHeight / (this._yMax - this._yMin)) +
            this._yMin;
    }

    getMidpointX(entry) {
        return this.toX(entry.x);
    }

    reset() {
        if (this.data) {
            this.data.length = 0;
        }
        this._renderData = null;
        for (const x of this._gradients) {
            x.el.remove();
        }
        this._gradients.clear();
        this.doReset();
    }

    doReset() {}

    makePath(coords, {css, closed}={}) {
        if (!coords.length) {
            return '';
        }
        let path = closed ?
            `M ${coords[0][0]},${this._plotHeight + this._plotInset[0]} V ${coords[0][1]}` :
            `M ${coords[0][0]},${coords[0][1]}`;
        for (let i = 1; i < coords.length; i++) {
            const [x, y] = coords[i];
            path += ` L ${x},${y}`;
        }
        if (closed) {
            path += ` V ${this._plotHeight + this._plotInset[0]} Z`;
        }
        return css ? `path('${path}')` : path;
    }
}
