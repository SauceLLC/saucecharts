
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

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

    onResize() {
        this._rootSvgEl.classList.add('disable-animation');
        try {
            this._adjustSize();
            if (this.data) {
                this.render();
                this._rootSvgEl.clientWidth;
            }
        } finally {
            this._rootSvgEl.classList.remove('disable-animation');
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
        //const yOfft = this._plotInset[0];
        if (this.isParentChart()) {
            this._rootSvgEl.setAttribute('viewBox', `0 0 ${this._boxWidth} ${this._boxHeight}`);
            this._rootSvgEl.style.setProperty('--dpr', this.devicePixelRatio);
        }
        //this._plotRegionEl.setAttribute('x', xOfft);
        //this._plotRegionEl.setAttribute('y', yOfft);
        //this._plotRegionEl.setAttribute('width', this._plotWidth);
        //this._plotRegionEl.setAttribute('height', this._plotHeight);
    }

    setElement(el, {merge}={}) {
        const old = this.el;
        this.el = el;
        if (old) {
            this._resizeObserver.disconnect();
            old.removeEventListener('pointerenter', this._onPointerEnterBound);
        }
        if (!merge) {
            el.innerHTML =
                `<div class="saucechart sc-wrap resize-observer" style="position:relative;">
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
                    </div>
                </div>`;
            el.parentSauceChart = this;
            this.childCharts.length = 0;
        } else {
            el.parentSauceChart.addChart(this);
        }
        this._rootSvgEl = el.querySelector(`svg.sc-root`);
        this._tooltipGroup = this._rootSvgEl.querySelector(`.sc-tooltip`);
        this._plotRegionEl = createSVGElement('g');
        this._plotRegionEl.dataset.id = this.id;
        this._plotRegionEl.classList.add('sc-plot-region');
        if (this.color) {
            this._plotRegionEl.style.setProperty('--color', this.color);
            this._computedColor = null;
        }
        this._rootSvgEl.querySelector('.sc-plot-regions').append(this._plotRegionEl);
        if (this.title) {
            el.querySelector(':scope > .sc-wrap').insertAdjacentHTML(
                'beforeend',
                `<div data-sc-id="${this.id}" class="sc-title">${this.title}</div>`);
        }
        this._adjustSize();
        this._resizeObserver.observe(el.querySelector('.resize-observer'));
        if (this.isParentChart()) {
            el.addEventListener('pointerover', this._onPointerEnterBound);
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
        this._tooltipGroup.classList.add('active');
        const positionerEl = this.el.querySelector('.sc-tooltip-positioner');
        positionerEl.classList.add('active');
        const charts = [this, ...this.childCharts];
        const refs = charts.map(x => {
            const plotRect = x.el.getBoundingClientRect();
            return [plotRect.x + scrollX, plotRect.y + scrollY];
        });
        let lastMoveEvent;
        this._activePointerMove = ev => {
            ev = ev && ev.type === 'pointermove' ? ev : lastMoveEvent;
            if (!ev) {
                return;
            }
            const tooltips = [];
            for (const [i, chart] of charts.entries()) {
                const xSearch = (ev.x - refs[i][0] + scrollX) * this.devicePixelRatio;
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
                tooltips.push({chart, index, entry, html});
            }
            if (tooltips.length) {
                this._drawTooltip(tooltips, positionerEl, refs[0]);
            }
            lastMoveEvent = ev;
        };
        const el = this.el;
        const onDone = () => {
            el.removeEventListener('pointercancel', onDone);
            el.removeEventListener('pointerleave', onDone);
            el.removeEventListener('pointermove', this._activePointerMove);
            removeEventListener('scroll', this._activePointerMove, {passive: true});
            this._activePointerMove = null;
            this._tooltipGroup.classList.remove('active');
            positionerEl.classList.remove('active');
        };
        addEventListener('scroll', this._activePointerMove, {passive: true});
        el.addEventListener('pointermove', this._activePointerMove);
        el.addEventListener('pointercancel', onDone);
        el.addEventListener('pointerleave', onDone);
    }

    _drawTooltip(tooltips, positionerEl, offset) {
        const box = positionerEl.querySelector('.sc-tooltip-box');
        const centerX = tooltips.reduce((agg, o) => agg + o.chart.toX(o.entry.x), 0) / tooltips.length;
        for (const x of this._tooltipGroup.querySelectorAll('line,circle')) {
            x.remove(); // XXX optimize this more
        }
        const top = this.tooltipPadding[0] * this.devicePixelRatio;
        const bottom = this.tooltipPadding[2] * this.devicePixelRatio;
        const left = this.tooltipPadding[3] * this.devicePixelRatio;
        const vertLine = createSVGElement('line');
        vertLine.classList.add('vertical');
        vertLine.setAttribute('x1', centerX + left);
        vertLine.setAttribute('x2', centerX + left);
        vertLine.setAttribute('y1', this._boxHeight - bottom);
        vertLine.setAttribute('y2', top);
        this._tooltipGroup.append(vertLine);
        for (const {chart, entry} of tooltips) {
            const xy = chart.toCoordinates(entry);
            const dot = createSVGElement('circle');
            dot.setAttribute('cx', xy[0]);
            dot.setAttribute('cy', xy[1]);
            this._tooltipGroup.prepend(dot);
            if (Math.abs(xy[0] - (centerX + left)) > 1) {
                const horizLine = createSVGElement('line');
                horizLine.classList.add('horizontal');
                horizLine.setAttribute('x1', centerX + left);
                horizLine.setAttribute('x2', xy[0]);
                horizLine.setAttribute('y1', xy[1]);
                horizLine.setAttribute('y2', xy[1]);
                this._tooltipGroup.prepend(horizLine);
            }
        }
        positionerEl.style.setProperty('left', `${centerX / this.devicePixelRatio + offset[0] - scrollX}px`);
        positionerEl.style.setProperty('top', `${top / this.devicePixelRatio + offset[1] - scrollY}px`);
        box.classList.toggle('right', centerX >= this._boxWidth / 2);
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
            const x = this.toX(this._renderData[i].x);
            if (x > searchX) {
                right = i;
            } else if (x < searchX) {
                left = i;
            } else {
                return i;
            }
            if (right - left <= 1) {
                const lDist = searchX - this.toX(this._renderData[left].x);
                const rDist = this.toX(this._renderData[right].x) - searchX;
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

    toY(value) {
        return this._plotHeight + this._plotInset[0] -
            ((value - this.yMin) * (this._plotHeight / (this.yMax - this.yMin)));
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

    reset() {
        if (this.data) {
            this.data.length = 0;
        }
        this.doReset();
    }

    doReset() {
        // subclass
    }

    makePath(coords, {closed}={}) {
        if (!coords.length) {
            return '';
        }
        const start = closed ? `\nM 0 ${this._plotHeight + this._plotInset[0]}\nL` : '\nM ';
        const end = closed ?
            `\nL ${this._plotWidth + this._plotInset[3]} ${this._plotHeight + this._plotInset[0]}\nZ` :
            '';
        return start + coords.map(c => `${c[0]} ${c[1]}`).join('\nL ') + end;
    }
}
