import * as common from './common.mjs';


export class BarChart extends common.Chart {

    init(options={}) {
        this._barsMap = new Map();
        this.barSpacing = options.barSpacing != null ? options.barSpacing : 4;
    }

    setElement(el, options) {
        super.setElement(el, options);
        this._plotRegionEl.innerHTML = `<g class="sc-bars"></g>`;
        this._barsEl = this._plotRegionEl.querySelector(`g.sc-bars`);
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
        const {data} = this.beforeRender();
        const manifest = this._renderBeforeLayout({data});
        this._renderDoLayout({manifest});
    }

    beforeRender() {
        const r = super.beforeRender();
        if (this.yMax === this.yMin) {
            this.yMin -= 1;
        }
        if (this.xMax === this.xMin) {
            this.xMax += 1;
        }
        return r;
    }

    _renderBeforeLayout({data}) {
        const coords = data.map(this.toCoordinates.bind(this));
        const remBars = new Set(this._barsMap.values());
        const manifest = {
            add: [],
            remove: [],
            update: [],
        };
        const xMinCoord = this.toX(this.xMin);
        const yMinCoord = this.toY(this.yMin);
        const xMaxCoord = this.toX(this.xMax);
        for (let index = 0; index < coords.length; index++) {
            const coord = coords[index];
            const ref = this.data[index];
            let bar = this._barsMap.get(ref);
            if (bar) {
                remBars.delete(bar);
            } else {
                const nd = data[index];
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
                    xMaxCoord - xMinCoord :
                    index < coords.length - 1 ?
                        coords[index + 1][0] - coord[0] :
                        xMaxCoord - coord[0],
                height: yMinCoord - coord[1],
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

    _renderDoLayout({manifest}) {
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
