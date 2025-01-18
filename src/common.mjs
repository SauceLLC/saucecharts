import * as color from './color.mjs';

let globalIdCounter = 0;


export function createSVGElement(tag, attrs) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    if (attrs) {
        for (const [k, v] of Object.entries(attrs)) {
            el.setAttribute(k, v);
        }
    }
    return el;
}


export class Chart {

    constructor(options={}) {
        this.init(options);
        this.id = globalIdCounter++;
        this.yMin = this._yMinOption = options.yMin;
        this.yMax = this._yMaxOption = options.yMax;
        this.xMin = this._xMinOption = options.xMin;
        this.xMax = this._xMaxOption = options.xMax;
        this.childCharts = [];
        this.title = options.title;
        this.color = options.color;
        this.xAxisOptions = options.xAxis || {};
        this.yAxisOptions = options.yAxis || {};
        this.padding = options.padding || [0, 0, 0, 0];
        this.tooltipPadding = options.tooltipPadding || [0, 0, 0, 0];
        this.tooltipPosition = options.tooltipPosition || 'leftright';
        this.disableAnimation = options.disableAnimation;
        this.darkMode = options.darkMode;
        this.tooltipLinger = options.tooltipLinger ?? 800;
        this._tooltipState = {};
        this._gradients = new Set();
        if (options.onTooltip) {
            this.onTooltip = options.onTooltip.bind(this);
        }
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
            this._updateTooltip();
        }, {passive: true});
    }

    init(options) {
    }

    addGradient(gradient) {
        if (!(gradient instanceof color.Gradient)) {
            gradient = color.Gradient.fromObject(gradient);
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

    onResize() {
        const hasAnim = !this.el.classList.contains('disable-animation');
        if (hasAnim) {
            this.el.classList.add('disable-animation');
        }
        try {
            this._adjustSize();
            if (this.data) {
                this.render();
            }
        } finally {
            if (hasAnim) {
                this.el.offsetWidth;
                this.el.classList.remove('disable-animation');
            }
        }
    }

    _adjustSize() {
        this.devicePixelRatio = devicePixelRatio || 1;
        const {width, height} = this._rootSvgEl.getBoundingClientRect();
        if (!width || !height) {
            this._boxWidth = null;
            this._boxHeight = null;
            this._plotWidth = null;
            this._plotHeight = null;
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
        if (this._xAxisEl) {
            this._drawXAxis();
        }
        if (this._yAxisEl) {
            this._drawYAxis();
        }
        if (this.isParentChart()) {
            this._rootSvgEl.setAttribute('viewBox', `0 0 ${this._boxWidth} ${this._boxHeight}`);
            this.el.style.setProperty('--dpr', this.devicePixelRatio);
        }
    }

    _drawXAxis() {
        this._drawAxis('horizontal', this._xAxisEl, this.xAxisOptions);
    }

    _drawYAxis() {
        this._drawAxis('vertical', this._yAxisEl, this.yAxisOptions);
    }

    _drawAxis(orientation, el, options) {
        const vert = orientation === 'vertical';
        const baseline = el.querySelector('line.baseline');
        const top = this._plotInset[0];
        const left = this._plotInset[3];
        const right = left + this._plotWidth;
        const bottom = top + this._plotHeight;
        if (vert) {
            el.classList.toggle('right', !!options.right);
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
            ticks = 2 + trackLength / (vert ? 100 : 180) | 0;
        }
        const gap = trackLength / (ticks - 1);
        const tickLen = options.tickLength ?? 10;
        const format = options.label || this.onAxisLabel.bind(this);
        const existingTicks = el.querySelectorAll('line.tick');
        const existingLabels = el.querySelectorAll('text.label');
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
                tick = createSVGElement('line', {class: 'tick'});
                el.append(tick);
            }
            tick.setAttribute('x1', x1);
            tick.setAttribute('x2', x2);
            tick.setAttribute('y1', y1);
            tick.setAttribute('y2', y2);
            let label = existingLabels[visualCount];
            if (!label) {
                label = createSVGElement('text', {class: 'label'});
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
            el.innerHTML = `
                <svg version="1.1" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none"
                     class="sc-root" style="position:absolute; top:0; left:0; width:100%; height:100%;">
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
        this._tooltipBoxEl = el.querySelector('.sc-tooltip-box');
        this._plotRegionEl = createSVGElement('g', {'data-id': this.id, class: 'sc-plot-region'});
        if (this.color) {
            this._plotRegionEl.style.setProperty('--color', this.color);
            this._computedColor = null;
        }
        this._rootSvgEl.querySelector('.sc-plot-regions').append(this._plotRegionEl);
        if (this.title) {
            el.insertAdjacentHTML('beforeend',
                                  `<div data-sc-id="${this.id}" class="sc-title">${this.title}</div>`);
        }
        if (!this.xAxisOptions.disabled) {
            this._xAxisEl = createSVGElement('g', {class: 'sc-axis x-axis'});
            this._xAxisEl.innerHTML = `<line class="baseline"></line>`;
            this._rootSvgEl.append(this._xAxisEl);
        }
        if (!this.yAxisOptions.disabled) {
            this._yAxisEl = createSVGElement('g', {class: 'sc-axis y-axis'});
            this._yAxisEl.innerHTML = `<line class="baseline"></line>`;
            this._rootSvgEl.append(this._yAxisEl);
        }
        if (this.disableAnimation) {
            this.el.classList.add('disable-animation');
        }
        let darkMode = this.darkMode;
        if (darkMode === undefined) {
            const currentColor = getComputedStyle(el).getPropertyValue('color');
            const c = color.parse(currentColor);
            darkMode = c.l >= 0.5;
        }
        this.el.classList.toggle('darkmode', darkMode);
        this._adjustSize();
        this._resizeObserver.observe(el);
        if (this.isParentChart()) {
            el.addEventListener('pointerenter', this._onPointerEnterBound);
        }
    }

    getColor() {
        if (!this._computedColor) {
            this._computedColor = getComputedStyle(this._plotRegionEl).getPropertyValue('--color');
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
        return `
            <div class="sc-tooltip-entry" data-chart-id="${this.id}"
                 style="--color:${chart.getColor()};">
                <key>${entry.x.toFixed(2)}:</key><value>${entry.y.toFixed(2)}</value>
            </div>
        `;
    }

    onAxisLabel({orientation, index, ticks}) {
        let range;
        if (orientation === 'vertical') {
            range = this.yMax - this.yMin;
        } else {
            range = this.xMax - this.xMin;
        }
        const number = range * (index / (ticks - 1));
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
        const state = this._establishTooltipState();
        if (state.pointerActive) {
            return;
        }
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
        this._setTooltipPosition({x: ev.x});
        this.showTooltip();
    }

    hideTooltip({x, y, index}={}) {
        const state = this._tooltipState;
        if (!state.visible) {
            return;
        }
        this._tooltipGroupEl.classList.remove('active');
        state.positionerEl?.classList.remove('active');
        state.visible = false;
    }

    showTooltip({x, y, index}={}) {
        const state = this._tooltipState;
        if (state.visible) {
            return;
        }
        const hasAnim = !this.el.classList.contains('disable-animation');
        if (hasAnim) {
            this.el.classList.add('disable-animation');
        }
        try {
            state.positionerEl.classList.add('active');
            this._tooltipGroupEl.classList.add('active');
            state.visible = true;
        } finally {
            if (hasAnim) {
                this.el.offsetWidth;
                this.el.classList.remove('disable-animation');
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
            positionerEl: this.el.querySelector('.sc-tooltip-positioner'),
            lastDrawSig: undefined,
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

    _setTooltipPosition({x, y, index}) {
        Object.assign(this._tooltipState, {x, y, index});
        this._updateTooltip();
    }

    updateVisibleTooltip() {
        const chart = this.isParentChart() ? this : this.parentChart;
        if (chart && chart._tooltipState.visible) {
            chart._updateTooltip();
        }
    }

    _updateTooltip() {
        const tooltips = [];
        const state = this._tooltipState;
        let drawSig = state.scrollOffsets.join();
        const xRef = state.index != null ? this.getMidpointX(state.index) : state.x;
        for (let i = 0; i < state.charts.length; i++) {
            const chart = state.charts[i];
            const xSearch = (xRef - state.chartPlotOffsets[i][0] + state.scrollOffsets[0]) *
                this.devicePixelRatio;
            const index = chart.findNearestIndexFromXCoord(xSearch);
            if (index === undefined) {
                continue;
            }
            const entry = chart._renderData[index];
            let html;
            if (entry.tooltip) {
                html = entry.tooltip({entry, index, chart});
            } else if (chart.onTooltip) {
                html = chart.onTooltip({entry, index, chart});
            }
            const coordinates = chart.getMidpointCoordinates(index);
            tooltips.push({chart, index, entry, coordinates, html});
            drawSig += ` ${i} ${index} ${coordinates[0]} ${coordinates[1]}`;
        }
        if (drawSig !== state.lastDrawSig) {
            state.lastDrawSig = drawSig;
            this._drawTooltip(tooltips);
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
        const bottom = this._boxHeight - this.tooltipPadding[2] * this.devicePixelRatio;
        const centerX = tooltips.reduce((agg, o) => agg + o.coordinates[0], 0) / tooltips.length;
        const centerY = top + (bottom - top) / 2;
        let vertLine = this._tooltipGroupEl.querySelector('path.line.vertical');
        const existingHLines = this._tooltipGroupEl.querySelectorAll('path.line.horizontal');
        const existingDots = this._tooltipGroupEl.querySelectorAll('circle.dot');
        const posEl = state.positionerEl;
        if (!vertLine) {
            vertLine = createSVGElement('path', {class: 'line vertical'});
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
                dot = createSVGElement('circle', {class: 'dot'});
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
                    horizLine = createSVGElement('path', {class: 'line horizontal'});
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
        posEl.dataset.hAlign = hAlign;
        posEl.dataset.vAlign = vAlign;
        const f = 1 / this.devicePixelRatio;
        const offset = state.chartPlotOffsets[0];
        posEl.style.setProperty('--x-offset', `${offset[0] - state.scrollOffsets[0]}px`);
        posEl.style.setProperty('--y-offset', `${offset[1] - state.scrollOffsets[1]}px`);
        posEl.style.setProperty('--x-left', `${minX * f}px`);
        posEl.style.setProperty('--x-right', `${maxX * f}px`);
        posEl.style.setProperty('--x-center', `${centerX * f}px`);
        posEl.style.setProperty('--y-center', `${centerY * f}px`);
        posEl.style.setProperty('--y-top', `${Math.min(minY, top) * f}px`);
        posEl.style.setProperty('--y-bottom', `${Math.max(maxY, bottom) * f}px`);
    }

    findNearestIndexFromXCoord(searchX) {
        if (!this._renderData || !this._renderData.length) {
            return;
        }
        const len = this._renderData.length;
        let left = 0;
        let right = len - 1;
        for (let i = (len * 0.5) | 0;; i = ((right - left) * 0.5 + left) | 0) {
            const x = this.getMidpointX(i);
            if (x > searchX) {
                right = i;
            } else if (x < searchX) {
                left = i;
            } else {
                return i;
            }
            if (right - left <= 1) {
                const lDist = searchX - this.getMidpointX(left);
                const rDist = this.getMidpointX(right) - searchX;
                return lDist < rDist ? left : right;
            }
        }
    }

    setData(data) {
        this.data = data;
        this.render();
    }

    normalizeData(data) {
        let norm;
        if (!data.length) {
            norm = [];
        } else if (Array.isArray(data[0])) {
            // [[x, y], [x1, y1], ...]
            norm = data.map(([x, y]) => ({x: x || 0, y: y || 0}));
        } else if (typeof data[0] === 'object') {
            // [{x, y, ...}, {x, y, ...}, ...]
            norm = data.map(o => ({...o, x: o.x || 0, y: o.y || 0}));
        } else {
            // [y, y1, ...]
            norm = data.map((y, x) => ({x, y: y || 0}));
        }
        norm.sort((a, b) => a.x - b.x);
        return norm;
    }

    render() {
        if (!this.el || !this._boxWidth || !this._boxHeight) {
            return;
        }
        if (!this.data || !this.data.length) {
            this.doReset();
            return;
        }
        const scaleBefore = [this.xMin, this.xMax, this.yMin, this.yMax].join();
        this.doRender(this.beforeRender());
        const scaleAfter = [this.xMin, this.xMax, this.yMin, this.yMax].join();
        if (scaleAfter !== scaleBefore) {
            if (this._xAxisEl) {
                this._drawXAxis();
            }
            if (this._yAxisEl) {
                this._drawYAxis();
            }
        }
        this.afterRender();
    }

    beforeRender() {
        const data = this.normalizeData(this.data);
        if (this._yMinOption == null || this._yMaxOption == null) {
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
            if (this._yMinOption == null) {
                this.yMin = min;
            }
            if (this._yMaxOption == null) {
                this.yMax = max;
            }
        }
        if (this._xMinOption == null) {
            this.xMin = data[0].x;
        }
        if (this._xMaxOption == null) {
            this.xMax = data[data.length - 1].x;
        }
        this._renderData = data;
        return {data};
    }

    doRender(options) {
        // subclass
    }

    afterRender() {
        this.updateVisibleTooltip();
    }

    toCoordinates(o) {
        return [this.toX(o.x), this.toY(o.y)];
    }

    toX(value) {
        return (value - this.xMin) *
            (this._plotWidth / (this.xMax - this.xMin)) +
            this._plotInset[3];
    }

    toScaleX(value) {
        return value * (this._plotWidth / (this.xMax - this.xMin));
    }

    toY(value) {
        return this._plotHeight + this._plotInset[0] -
            ((value - this.yMin) * (this._plotHeight / (this.yMax - this.yMin)));
    }

    toScaleY(value) {
        return value * (this._plotHeight / (this.yMax - this.yMin));
    }

    fromCoordinates(xy) {
        return {
            x: this.fromX(xy[0]),
            y: this.fromY(xy[1]),
        };
    }

    fromX(value) {
        return (value - this._plotInset[3]) /
            (this._plotWidth / (this.xMax - this.xMin)) +
            this.xMin;
    }

    fromY(value) {
        return (this._plotHeight - value + this._plotInset[0]) /
            (this._plotHeight / (this.yMax - this.yMin)) +
            this.yMin;
    }

    getMidpointOffsetX(index) {
        // Subclasses can use to move tooltip anchoring
        return 0;
    }

    getMidpointX(index) {
        return this.toX(this._renderData[index].x) + this.getMidpointOffsetX(index);
    }

    getMidpointCoordinates(index) {
        return [
            this.toX(this._renderData[index].x) + this.getMidpointOffsetX(index),
            this.toY(this._renderData[index].y)
        ];
    }

    reset() {
        if (this.data) {
            this.data.length = 0;
        }
        for (const x of this._gradients) {
            x.el.remove();
        }
        this._gradients.clear();
        this.doReset();
    }

    doReset() {
        // subclass
    }

    makePath(coords, {css, closed}={}) {
        if (!coords.length) {
            return '';
        }
        const sep = css ? ' ' : '\n';
        const start = closed ?
            `${sep}M ${this._plotInset[3]} ${this._plotHeight + this._plotInset[0]}${sep}L ` :
            `${sep}M `;
        const end = closed ?
            `${sep}L ${this._plotWidth + this._plotInset[3]} ` +
                `${this._plotHeight + this._plotInset[0]}${sep}Z` :
            '';
        const join = `${sep}L `;
        const path = start + coords.map(c => `${c[0]} ${c[1]}`).join(join) + end;
        return css ? `path('${path}')` : path;
    }
}
