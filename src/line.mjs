
import * as common from './common.mjs';


export class LineChart extends common.Chart {

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
            <path class="sc-data sc-line sc-visual-data-line"/>
            <g class="sc-points"></g>
        `;
        this._pointsEl = this._plotRegionEl.querySelector(`g.sc-points`);
        this._pathLineEl = this._plotRegionEl.querySelector(`path.sc-data.sc-line`);
        this._pathAreaEl = defs.querySelector(`[data-sc-id="${this.id}"] path.sc-data.sc-area`);
    }

    onPointeroverForTooltips(ev) {
        const circle = ev.target.closest('circle.sc-data-point');
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
        this._pathLineEl.removeAttribute('d');
        this._pathAreaEl.removeAttribute('d');
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
                    const circle = common.createSVGElement('circle');
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
                this._pathLineEl.setAttribute('d', this.makePath(prev));
                this._pathAreaEl.setAttribute('d', this.makePath(prev, {closed: true}));
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
        this._pathLineEl.setAttribute('d', this.makePath(coords));
        this._pathAreaEl.setAttribute('d', this.makePath(coords, {closed: true}));
        for (let i = 0; i < pointUpdates.length; i++) {
            const [point, coord] = pointUpdates[i];
            if (point.circle) {
                point.circle.setAttribute('cx', coord[0]);
                point.circle.setAttribute('cy', coord[1]);
            }
        }
    }
}
