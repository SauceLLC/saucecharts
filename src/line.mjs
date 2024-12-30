
let globalIdCounter = 0;

function createSVGElement(tag) {
    return document.createElementNS('http://www.w3.org/2000/svg', tag);
}


export class LineChart {

    constructor(options={}) {
        this.id = globalIdCounter++;
        this._yMin = options.yMin;
        this._yMax = options.yMax;
        this._xMin = options.xMin;
        this._xMax = options.xMax;
        this.title = options.title;
        this.color = options.color;
        this.hidePoints = options.hidePoints;
        this.padding = options.padding || [0, 0, 0, 0];
        this.onTooltip = options.onTooltip;
        this.onPointeroverForTooltips = this._onPointeroverForTooltips.bind(this);
        this._pointsMap = new Map();
        this._resizeObserver = new ResizeObserver(
            requestAnimationFrame.bind(null, this._adjustSize.bind(this)));
        if (options.data) {
            this.setData(options.data);
        }
        if (options.el) {
            this.setElement(options.el, {merge: options.merge});
        }
    }

    get yMin() {
        return this._yMin != null ? this._yMin : this._yMinCalculated;
    }

    get yMax() {
        return this._yMax != null ? this._yMax : this._yMaxCalculated;
    }

    get xMin() {
        return this._xMin != null ? this._xMin : this._xMinCalculated;
    }

    get xMax() {
        return this._xMax != null ? this._xMax : this._xMaxCalculated;
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
        this._rootSvgEl.classList.add('disable-animation');
        try {
            this._rootSvgEl.setAttribute('viewBox', `0 0 ${this._boxWidth} ${this._boxHeight}`);
            this._plotRegionEl.setAttribute('x', xOfft);
            this._plotRegionEl.setAttribute('y', yOfft);
            this._plotRegionEl.setAttribute('width', this._plotWidth);
            this._plotRegionEl.setAttribute('height', this._plotHeight);
            this.render();
            this._rootSvgEl.clientWidth;
        } finally {
            this._rootSvgEl.classList.remove('disable-animation');
        }
    }

    setElement(el, {merge}={}) {
        const old = this.el;
        this.el = el;
        if (old) {
            this._resizeObserver.disconnect();
            old.removeEventListener('pointerover', this.onPointeroverForTooltips);
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
        const pathId = `path-def-${this.id}`;
        defs.insertAdjacentHTML('beforeend', `
            <clipPath data-sc-id="${this.id}" id="${pathId}-clip">
                <path class="sc-data-def sc-area"/>
            </clipPath>`);
        el.querySelector('svg.sc-root').insertAdjacentHTML('beforeend', `
            <svg data-sc-id="${this.id}" class="sc-plot-region">
                <foreignObject class="sc-css-background" clip-path="url(#${pathId}-clip)"
                               width="100%" height="100%">
                    <div class="sc-visual-data-area"></div>
                </foreignObject>
                <path class="sc-data-def sc-line sc-visual-data-line"/>
                <g class="sc-points"></g>
            </svg>`);
        if (this.title) {
            el.querySelector(':scope > .sc-wrap').insertAdjacentHTML(
                'beforeend',
                `<div data-sc-id="${this.id}" class="sc-title">${this.title}</div>`);
        }
        const qs = `[data-sc-id="${this.id}"]`;
        this._rootSvgEl = el.querySelector(`svg.sc-root`);
        this._plotRegionEl = el.querySelector(`${qs}.sc-plot-region`);
        this._pointsEl = el.querySelector(`${qs} g.sc-points`);
        this._pathLineDefEl = el.querySelector(`${qs} path.sc-data-def.sc-line`);
        this._pathAreaDefEl = el.querySelector(`${qs} path.sc-data-def.sc-area`);
        if (this.color) {
            this._plotRegionEl.style.setProperty('--color', this.color);
        }
        this._adjustSize();
        el.addEventListener('pointerover', this.onPointeroverForTooltips);
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

    _onPointeroverForTooltips(ev) {
        const circle = ev.target.closest('circle.sc-data-point');
        if (!circle) {
            return;
        }
        const point = circle.pointWRef.deref();
        let title = circle.querySelector('title');
        if (!title) {
            title = createSVGElement('title');
            circle.append(title);
        }
        title.textContent = point.tooltipFormat();
    }

    reset() {
        if (this.data) {
            this.data.length = 0;
        }
        this._reset();
    }

    _reset() {
        this._pathLineDefEl.removeAttribute('d');
        this._pathAreaDefEl.removeAttribute('d');
        this._pointsEl.innerHTML = '';
        this._pointsMap.clear();
        this._prevCoords = null;
        this._prevNormalized = null;
    }

    render() {
        if (!this.el || !this._boxWidth || !this._boxHeight) {
            return;
        }
        if (!this.data || !this.data.length) {
            this._reset();
            return;
        }
        const {coords, normalized} = this._renderData();
        const {needForceLayout, ...layoutOptions} = this._renderBeforeLayout({coords, normalized});
        if (needForceLayout) {
            this._plotRegionEl.clientWidth;
        }
        this._renderDoLayout({coords, ...layoutOptions});
        this._prevCoords = coords;
        this._prevNormalized = normalized;
    }

    _renderData() {
        const normalized = this.normalizeData(this.data);
        let yND;
        this._yMinCalculated = this._yMin != null ? this._yMin :
            Math.min(...(yND = normalized.map(o => o.y)));
        this._yMaxCalculated = this._yMax != null ? this._yMax :
            Math.max(...(yND || normalized.map(o => o.y)));
        this._yRange = this._yMaxCalculated - this._yMinCalculated;
        if (!this._yRange) {
            this._yRange = 1;
            this._yMinCalculated -= 0.5;
            this._yMaxCalculated += 0.5;
        }
        this._yScale = this._plotHeight / this._yRange;
        this._xMinCalculated = this._xMin != null ? this._xMin : normalized[0].x;
        this._xMaxCalculated = this._xMax != null ? this._xMax : normalized[normalized.length - 1].x;
        this._xRange = this._xMaxCalculated - this._xMinCalculated;
        if (!this._xRange) {
            this._xRange = 1;
            this._xMinCalculated -= 0.5;
            this._xMaxCalculated += 0.5;
        }
        this._xScale = this._plotWidth / this._xRange;
        const coords = normalized.map(o => [
            (o.x - (this._xMinCalculated)) * this._xScale,
            this._plotHeight - ((o.y - (this._yMinCalculated)) * this._yScale)
        ]);
        return {coords, normalized};
    }

    _renderBeforeLayout({coords, normalized}) {
        let needForceLayout = false;
        const pointUpdates = [];
        const remPoints = new Set(this._pointsMap.values());
        const newPointEls = [];
        for (let index = 0; index < coords.length; index++) {
            const coord = coords[index];
            const ref = this.data[index];
            let point = this._pointsMap.get(ref);
            if (point) {
                remPoints.delete(point);
            } else {
                const nd = normalized[index];
                point = {ref};
                point.tooltipFormat = nd.tooltip ?
                    nd.tooltip.bind(this, nd, point) :
                    this.onTooltip ?
                        this.onTooltip.bind(this, nd, point) :
                        () => nd.y.toLocaleString();
                if (!this.hidePoints) {
                    const circle = createSVGElement('circle');
                    circle.classList.add('sc-data-point');
                    point.circle = circle;
                    circle.pointWRef = new WeakRef(point);
                    newPointEls.push(circle);
                }
                this._pointsMap.set(ref, point);
                // Look for some animation opportunities...
                if (this._prevNormalized) {
                    let beginCoord;
                    const maxSearch = 10;
                    if (index >= coords.length / 2) {
                        // right-to-left movement...
                        const edge = this._prevNormalized[this._prevNormalized.length - 1];
                        for (let i = 0; i < Math.min(maxSearch, normalized.length); i++) {
                            const n = normalized[normalized.length - 1 - i];
                            if (n.x === edge.x && n.y === edge.y) {
                                beginCoord = this._prevCoords[this._prevCoords.length - 1];
                                break;
                            }
                        }
                    } else {
                        // left-to-right movement...
                        const edge = this._prevNormalized[0];
                        for (let i = 0; i < Math.min(maxSearch, normalized.length); i++) {
                            const n = normalized[i];
                            if (n.x === edge.x && n.y === edge.y) {
                                beginCoord = this._prevCoords[0];
                                break;
                            }
                        }
                    }
                    if (!beginCoord) {
                        beginCoord = [coord[0], this._plotHeight];
                    }
                    if (point.circle) {
                        point.circle.setAttribute('cx', beginCoord[0]);
                        point.circle.setAttribute('cy', beginCoord[1]);
                        needForceLayout = true;
                    }
                }
            }
            const sig = coord.join();
            if (point.sig !== sig) {
                if (point.circle) {
                    pointUpdates.push([point, coord]);
                }
                point.sig = sig;
            }
        }
        if (this._prevCoords) {
            // We can use CSS to animate the transition but we have to use a little hack
            // because it only animates when the path has the same number (or more) points.
            if (this._prevCoords.length !== coords.length) {
                const identityIdx = normalized.length / 2 | 0;
                const identity = normalized[identityIdx];
                const prevIdentityIdx = this._prevNormalized.findIndex(o =>
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
                this._pathLineDefEl.setAttribute('d', this._makePath(prev));
                this._pathAreaDefEl.setAttribute('d', this._makePath(prev, {closed: true}));
                needForceLayout = true;
            }
        }
        for (const x of remPoints) {
            this._pointsMap.delete(x.ref);
            if (x.circle) {
                x.circle.remove();
            }
        }
        this._pointsEl.append(...newPointEls);
        return {pointUpdates, needForceLayout};
    }

    _renderDoLayout({coords, pointUpdates, needForceLayout}) {
        this._pathLineDefEl.setAttribute('d', this._makePath(coords));
        this._pathAreaDefEl.setAttribute('d', this._makePath(coords, {closed: true}));
        for (let i = 0; i < pointUpdates.length; i++) {
            const [point, coord] = pointUpdates[i];
            if (point.circle) {
                point.circle.setAttribute('cx', coord[0]);
                point.circle.setAttribute('cy', coord[1]);
            }
        }
    }

    _makePath(coords, {closed}={}) {
        if (!coords.length) {
            return '';
        }
        const start = closed ? `\nM 0 ${this._plotHeight}\nL` : '\nM ';
        const end = closed ? `\nL ${this._plotWidth} ${this._plotHeight}\nZ` : '';
        return start + coords.map(c => `${c[0]} ${c[1]}`).join('\nL ') + end;
    }
}
