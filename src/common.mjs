import * as color from './color.mjs';

let globalIdCounter = 0;


export function createSVGElement(tag) {
    return document.createElementNS('http://www.w3.org/2000/svg', tag);
}


export class Chart {

    constructor(options={}) {
        this.init(options);
        this.id = globalIdCounter++;
        this.yMin = this._yMin = options.yMin;
        this.yMax = this._yMax = options.yMax;
        this.xMin = this._xMin = options.xMin;
        this.xMax = this._xMax = options.xMax;
        this.childCharts = [];
        this.title = options.title;
        this.color = options.color;
        this.padding = options.padding || [0, 0, 0, 0];
        this.tooltipPadding = options.tooltipPadding || [0, 0, 0, 0];
        this.tooltipPosition = options.tooltipPosition || 'leftright';
        this.disableAnimation = options.disableAnimation;
        this.darkMode = options.darkMode;
        this.tooltipLinger = options.tooltipLinger ?? 2000;
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
        if (!this.disableAnimation) {
            this.el.classList.add('disable-animation');
        }
        try {
            this._adjustSize();
            if (this.data) {
                this.render();
                this.el.clientWidth;
            }
        } finally {
            if (!this.disableAnimation) {
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
        if (this.isParentChart()) {
            this._rootSvgEl.setAttribute('viewBox', `0 0 ${this._boxWidth} ${this._boxHeight}`);
            this._rootSvgEl.style.setProperty('--dpr', this.devicePixelRatio);
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
        this._plotRegionEl = createSVGElement('g');
        this._plotRegionEl.dataset.id = this.id;
        this._plotRegionEl.classList.add('sc-plot-region');
        if (this.color) {
            this._plotRegionEl.style.setProperty('--color', this.color);
            this._computedColor = null;
        }
        this._rootSvgEl.querySelector('.sc-plot-regions').append(this._plotRegionEl);
        if (this.title) {
            el.insertAdjacentHTML('beforeend',
                                  `<div data-sc-id="${this.id}" class="sc-title">${this.title}</div>`);
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
        for (const x of this.childCharts) {
            x._computedColor = null;
        }
        this._computedColor = null;
    }

    onTooltip(entry, index, chart) {
        return `
            <div class="sc-tooltip-entry" data-chart-id="${this.id}"
                 style="--color:${chart.getColor()};">
                <key>${entry.x.toFixed(2)}:</key><value>${entry.y.toFixed(2)}</value>
            </div>
        `;
    }

    onPointerEnter(ev) {
        if (this._activePointerMove) {
            return;
        }
        const el = this.el;
        const doneCtrl = new AbortController();
        const positionerEl = this.el.querySelector('.sc-tooltip-positioner');
        const charts = [this, ...this.childCharts];
        let chartPlotOffsets;
        let lastMoveEvent = ev;
        let lastDrawSig;
        let lastFrameTime;
        const scrollOffsets = [scrollX, scrollY];
        this._activePointerMove = ev => {
            const frameTime = document.timeline.currentTime;
            ev = ev && ev.type === 'pointermove' ? ev : lastMoveEvent;
            if (!ev || frameTime === lastFrameTime) {
                return;
            }
            lastMoveEvent = ev;
            lastFrameTime = frameTime;
            const tooltips = [];
            let drawSig = scrollOffsets.join();
            for (let i = 0; i < charts.length; i++) {
                const chart = charts[i];
                const xSearch = (ev.x - chartPlotOffsets[i][0] + scrollOffsets[0]) * this.devicePixelRatio;
                const index = chart.findNearestIndexFromXCoord(xSearch);
                if (index === undefined) {
                    continue;
                }
                const entry = chart._renderData[index];
                let html;
                if (entry.tooltip) {
                    html = entry.tooltip(entry, index, chart);
                } else if (chart.onTooltip) {
                    html = chart.onTooltip(entry, index, chart);
                }
                const coordinates = chart.getMidpointCoordinates(index);
                tooltips.push({chart, index, entry, coordinates, html});
                drawSig += ` ${i} ${index} ${coordinates[0]} ${coordinates[1]}`;
            }
            if (drawSig !== lastDrawSig) {
                lastDrawSig = drawSig;
                this._drawTooltip(tooltips, positionerEl, chartPlotOffsets[0], scrollOffsets);
            }
        };
        const onDone = () => {
            doneCtrl.abort();
            this._activePointerMove = null;
            setTimeout(() => {
                if (!this._activePointerMove) {
                    this._tooltipGroupEl.classList.remove('active');
                    positionerEl.classList.remove('active');
                }
            }, this.tooltipLinger);
        };
        const signal = doneCtrl.signal;
        // Cancel-esc pointer events are sloppy and unreliable (proven).  Kitchen sink...
        addEventListener('pointercancel', onDone, {signal});
        addEventListener('pointerout', ev => !el.contains(ev.target) && onDone(), {signal});
        el.addEventListener('pointerleave', onDone, {signal});
        el.addEventListener('pointermove', this._activePointerMove, {signal});
        addEventListener('scroll', ev => {
            scrollOffsets[0] = scrollX;
            scrollOffsets[1] = scrollY;
            this._activePointerMove();
        }, {signal, passive: true});
        chartPlotOffsets = charts.map(x => {
            const plotRect = x.el.getBoundingClientRect();
            // XXX still unsure about using scroll offsets here...
            return [plotRect.x + scrollOffsets[0], plotRect.y + scrollOffsets[1]];
        });
        this._activePointerMove();
        positionerEl.offsetWidth;
        positionerEl.classList.add('active');
        this._tooltipGroupEl.classList.add('active');
    }

    _drawTooltip(tooltips, positionerEl, offset, scrollOffsets) {
        const box = this._tooltipBoxEl;
        if (!tooltips.length) {
            box.innerHTML = '';
            return;
        }
        const top = this.tooltipPadding[0] * this.devicePixelRatio;
        const bottom = this.tooltipPadding[2] * this.devicePixelRatio;
        const left = this.tooltipPadding[3] * this.devicePixelRatio;
        const centerX = tooltips.reduce((agg, o) => agg + o.coordinates[0], 0) / tooltips.length;
        let vertLine = this._tooltipGroupEl.querySelector('path.line.vertical');
        const existingHLines = this._tooltipGroupEl.querySelectorAll('path.line.horizontal');
        const existingDots = this._tooltipGroupEl.querySelectorAll('circle.dot');
        if (!vertLine) {
            vertLine = createSVGElement('path');
            vertLine.classList.add('line', 'vertical');
            this._tooltipGroupEl.append(vertLine);
        }
        vertLine.setAttribute('d', `M ${centerX + left}, ${this._boxHeight - bottom} V ${top}`);
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
                dot.classList.add('dot');
                this._tooltipGroupEl.prepend(dot);
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
            if (Math.abs(x - (centerX + left)) > 1) {
                let horizLine = existingHLines[i];
                if (!horizLine) {
                    horizLine = createSVGElement('path');
                    horizLine.classList.add('line', 'horizontal');
                    this._tooltipGroupEl.prepend(horizLine);
                }
                horizLine.setAttribute('d', `M ${centerX + left} ${y} H ${x}`);
                extraCount++;
            }
        }
        for (let i = extraCount; i < existingHLines.length; i++) {
            existingHLines[i].remove();
        }
        for (let i = tooltips.length; i < existingDots.length; i++) {
            existingDots[i].remove();
        }
        let anchorX = centerX;
        const anchorY = top;
        const tp = this.tooltipPosition;
        if (typeof tp === 'function') {
            box.style.setProperty('inset', this.tooltipPostion({
                chart: this,
                minX,
                minY,
                maxX,
                maxY,
                tooltips
            }));
        } else if (tp.match(/left|right/)) {
            let right;
            if (tp === 'leftright') {
                right = centerX >= this._boxWidth * 0.5;
            } else {
                right = tp === 'right';
            }
            anchorX = right ? minX : maxX;
            box.classList.toggle('right', right);
        } // XXX WIP
        const x = anchorX / this.devicePixelRatio + offset[0] - scrollOffsets[0];
        const y = Math.max(0, anchorY / this.devicePixelRatio + offset[1] - scrollOffsets[1]);
        positionerEl.style.setProperty('translate', `${x}px ${y}px`);
        box.innerHTML = tooltips.map(x => x.html).join('');
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
        this.doRender(this.beforeRender());
        this.afterRender();
    }

    beforeRender() {
        const data = this.normalizeData(this.data);
        if (this._yMin == null || this._yMax == null) {
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
            if (this._yMin == null) {
                this.yMin = min;
            }
            if (this._yMax == null) {
                this.yMax = max;
            }
        }
        if (this._xMin == null) {
            this.xMin = data[0].x;
        }
        if (this._xMax == null) {
            this.xMax = data[data.length - 1].x;
        }
        this._renderData = data;
        return {data};
    }

    doRender(options) {
        // subclass
    }

    afterRender() {
        if (this._activePointerMove) {
            this._activePointerMove();
        }
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
