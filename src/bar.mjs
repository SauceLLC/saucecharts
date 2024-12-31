import * as common from './common.mjs';


export class BarChart extends common.Chart {

    init(options={}) {
        this._yMin = options.yMin;
        this._yMax = options.yMax;
        this._xMin = options.xMin;
        this._xMax = options.xMax;
        this.hidePoints = options.hidePoints;
        this._pointsMap = new Map();
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

    setElement(el, options) {
        super.setElement(el, options);
        const defs = el.querySelector('svg.sc-root > defs');
        const pathId = `path-def-${this.id}`;
        // XXX try to use css background-iamge linage grad with rect and kill sc-data.sc-area if works
        defs.insertAdjacentHTML('beforeend', `
            <clipPath data-sc-id="${this.id}" id="${pathId}-clip">
                <path class="sc-data sc-area"/>
            </clipPath>
        `);
        this._plotRegionEl.innerHTML = `
            <foreignObject class="sc-css-background" clip-path="url(#${pathId}-clip)"
                           width="100%" height="100%">
                <div class="sc-visual-data-area"></div>
            </foreignObject>
            <g class="sc-bars"></g>
        `;
        this._barsEl = this._plotRegionEl.querySelector(`g.sc-bars`);
        this._pathAreaEl = defs.querySelector(`[data-sc-id="${this.id}"] path.sc-data.sc-area`);
    }

    onPointeroverForTooltips(ev) {
        const circle = ev.target.closest('rect.sc-data-point');
        if (!circle) {
            return;
        }
        const point = circle.pointWRef.deref();
        let title = circle.querySelector('title');
        if (!title) {
            title = common.createSVGElement('title');
            circle.append(title);
        }
        title.textContent = point.tooltipFormat();
    }

    reset() {
        super.reset();
        this._reset();
    }

    _reset() {
        this._pathAreaEl.removeAttribute('d');
        this._barsEl.innerHTML = '';
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
        this._renderDoLayout({coords, normalized});
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

    _renderDoLayout({coords, normalized}) {
        //this._pathAreaEl.setAttribute('d', this._makePath(coords, {closed: true}));
        for (let i = 0; i < coords.length; i++) {
            const [x, y] = coords[i];
            this._barsEl.innerHTML +=
                `<rect class="sc-bar sc-visual-data-bar" data-index="${i} x="${x}"
                       width="40" height="${y}"/>`;
        }
    }
}
