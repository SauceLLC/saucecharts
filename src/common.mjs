
let globalIdCounter = 0;


export function createSVGElement(tag) {
    return document.createElementNS('http://www.w3.org/2000/svg', tag);
}


export class Chart {
    constructor(options={}) {
        this.init(options);
        this.id = globalIdCounter++;
        this.title = options.title;
        this.color = options.color;
        this.padding = options.padding || [0, 0, 0, 0];
        this.onTooltip = options.onTooltip;
        this._onPointeroverForTooltipsBound = this.onPointeroverForTooltips.bind(this);
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

    onPointeroverForTooltips() {
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
        const {width, height} = this._rootSvgEl.getBoundingClientRect();
        if (!width || !height) {
            this._boxWidth = null;
            this._boxHeight = null;
            this._plotWidth = null;
            this._plotHeight = null;
            return;
        }
        const pixelScale = 1; //devicePixelRatio || 1;
        const ar = width / height;
        if (ar > 1) {
            this._boxWidth = Math.round(width * pixelScale);
            this._boxHeight = Math.round(this._boxWidth / ar);
        } else {
            this._boxHeight = Math.round(height * pixelScale);
            this._boxWidth = Math.round(this._boxHeight * ar);
        }
        const hPad = (this.padding[1] + this.padding[3]) * pixelScale;
        const vPad = (this.padding[0] + this.padding[2]) * pixelScale;
        this._plotWidth = Math.max(0, this._boxWidth - hPad);
        this._plotHeight = Math.max(0, this._boxHeight - vPad);
        const xOfft = this.padding[3] * pixelScale;
        const yOfft = this.padding[0] * pixelScale;
        this._rootSvgEl.setAttribute('viewBox', `0 0 ${this._boxWidth} ${this._boxHeight}`);
        this._plotRegionEl.setAttribute('x', xOfft);
        this._plotRegionEl.setAttribute('y', yOfft);
        this._plotRegionEl.setAttribute('width', this._plotWidth);
        this._plotRegionEl.setAttribute('height', this._plotHeight);
    }

    setElement(el, {merge}={}) {
        const old = this.el;
        this.el = el;
        if (old) {
            this._resizeObserver.disconnect();
            old.removeEventListener('pointerover', this._onPointeroverForTooltipsBound);
        }
        if (!merge) {
            el.innerHTML =
                `<div class="saucechart sc-wrap resize-observer" style="position:relative;">
                    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none"
                         class="sc-root" style="position:absolute; top:0; left:0; width:100%; height:100%;">
                        <defs></defs>
                    </svg>
                </div>`;
        }
        const defs = el.querySelector('svg.sc-root > defs');
        if (!defs) {
            throw new Error('Existing merge target element is not compatible');
        }
        el.querySelector('svg.sc-root').insertAdjacentHTML(
            'beforeend',
            `<svg data-sc-id="${this.id}" class="sc-plot-region"></svg>`);
        if (this.title) {
            el.querySelector(':scope > .sc-wrap').insertAdjacentHTML(
                'beforeend',
                `<div data-sc-id="${this.id}" class="sc-title">${this.title}</div>`);
        }
        const qs = `[data-sc-id="${this.id}"]`;
        this._rootSvgEl = el.querySelector(`svg.sc-root`);
        this._plotRegionEl = el.querySelector(`${qs}.sc-plot-region`);
        if (this.color) {
            this._plotRegionEl.style.setProperty('--color', this.color);
        }
        this._adjustSize();
        el.addEventListener('pointerover', this._onPointeroverForTooltipsBound);
        this._resizeObserver.observe(el.querySelector('.resize-observer'));
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

    toCoordinate({x, y}) {
        return [
            (x - (this._xMinCalculated)) * this._xScale,
            this._plotHeight - ((y - (this._yMinCalculated)) * this._yScale)
        ];
    }

    fromCoordinate([x, y]) {
        return {
            x: x / this._xScale + this._xMinCalculated,
            y: (this._plotHeight - y) / this._yScale + this._yMinCalculated
        };
    }

    reset() {
        if (this.data) {
            this.data.length = 0;
        }
    }

    makePath(coords, {closed}={}) {
        if (!coords.length) {
            return '';
        }
        const start = closed ? `\nM 0 ${this._plotHeight}\nL` : '\nM ';
        const end = closed ? `\nL ${this._plotWidth} ${this._plotHeight}\nZ` : '';
        return start + coords.map(c => `${c[0]} ${c[1]}`).join('\nL ') + end;
    }
}
