import * as common from './common.mjs';


export class BarChart extends common.Chart {

    init(options={}) {
        this._yMin = options.yMin;
        this._yMax = options.yMax;
        this._xMin = options.xMin;
        this._xMax = options.xMax;
        this._barsMap = new Map();
        this.barSpacing = options.barSpacing != null ? options.barSpacing : 4;
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
        this._plotRegionEl.innerHTML = `<g class="sc-bars"></g>`;
        this._barsEl = this._plotRegionEl.querySelector(`g.sc-bars`);
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
        this._barsEl.innerHTML = '';
        this._barsMap.clear();
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
        const manifest = this._renderBeforeLayout({coords, normalized});
        this._renderDoLayout({coords, manifest});
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
            this._yMinCalculated -= 1;
        }
        this._yScale = this._plotHeight / this._yRange;
        this._xMinCalculated = this._xMin != null ? this._xMin : normalized[0].x;
        this._xMaxCalculated = this._xMax != null ? this._xMax : normalized[normalized.length - 1].x;
        this._xRange = this._xMaxCalculated - this._xMinCalculated;
        if (!this._xRange) {
            this._xRange = 1;
            this._xMaxCalculated += 1;
        }
        this._xScale = this._plotWidth / this._xRange;
        const coords = normalized.map(this.toCoordinate.bind(this));
        return {coords, normalized};
    }

    _renderBeforeLayout({coords, normalized}) {
        const remBars = new Set(this._barsMap.values());
        const manifest = {
            add: [],
            remove: [],
            update: [],
        };
        const xyMin = this.toCoordinate({x: this.xMin, y: this.yMin});
        const xyMax = this.toCoordinate({x: this.xMax, y: this.yMax});
        for (let index = 0; index < coords.length; index++) {
            const coord = coords[index];
            const ref = this.data[index];
            let bar = this._barsMap.get(ref);
            if (bar) {
                remBars.delete(bar);
            } else {
                const nd = normalized[index];
                bar = {ref};
                bar.tooltipFormat = nd.tooltip ?
                    nd.tooltip.bind(this, nd, bar) :
                    this.onTooltip ?
                        this.onTooltip.bind(this, nd, bar) :
                        () => nd.y.toLocaleString();
                bar.element = common.createSVGElement('foreignObject');
                bar.element.classList.add('sc-bar', 'sc-visual-data-bar');
                manifest.add.push(bar);
                this._barsMap.set(ref, bar);
            }
            bar.element.dataset.index = index;
            const attrs = {
                width: coords.length === 1 ?
                    xyMax[0] - xyMin[0] :
                    index < coords.length - 1 ?
                        coords[index + 1][0] - coord[0] :
                        xyMax[0] - coord[0],
                height: (xyMin[1] - xyMax[1]) - coord[1],
                x: coord[0],
                y: coord[1],
            };
            const sig = JSON.stringify(attrs);
            if (bar.sig !== sig) {
                manifest.update.push([bar, attrs]);
                bar.sig = sig;
            }
        }
        for (const x of remBars) {
            manifest.remove.push(x);
        }
        return manifest;
    }

    _renderDoLayout({coords, manifest}) {
        for (const x of manifest.remove) {
            x.element.remove();
        }
        for (const x of manifest.add) {
            this._barsEl.append(x.element);
        }
        for (const [{element}, attrs] of manifest.update) {
            element.setAttribute('width', Math.max(0, attrs.width - this.barSpacing));
            element.setAttribute('height', attrs.height);
            element.setAttribute('x', attrs.x + this.barSpacing / 2);
            element.setAttribute('y', attrs.y);
        }
    }
}
