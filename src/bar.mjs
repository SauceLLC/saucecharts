import * as common from './common.mjs';
import * as color from './color.mjs';


export class BarChart extends common.Chart {

    init(options={}) {
        this._barsMap = new Map();
        this.barSpacing = options.barSpacing ?? 4;
        this.barRadius = options.barRadius ?? 4;
    }

    setElement(el, options) {
        super.setElement(el, options);
        this._plotRegionEl.innerHTML = `<g class="sc-bars"></g>`;
        this._barsEl = this._plotRegionEl.querySelector(`g.sc-bars`);
        if (this._bgGradient) {
            this.removeGradient(this._bgGradient);
        }
        const fill = color.parse(this.getColor());
        this._bgGradient = this.addGradient({
            type: 'linear',
            colors: [
                fill.lighten(-0.2).alpha(0.2),
                fill.alpha(0.8),
            ]
        });
    }

    doReset() {
        this._barsEl.innerHTML = '';
        this._barsMap.clear();
    }

    doRender({data}) {
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
                bar = {ref};
                bar.element = common.createSVGElement('path');
                bar.element.classList.add('sc-bar', 'sc-visual-data-bar');
                bar.element.setAttribute('fill', `url(#${this._bgGradient.id})`);
                manifest.add.push(bar.element);
                this._barsMap.set(ref, bar);
            }
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
            const sig = `${attrs.width} ${attrs.height} ${attrs.x} ${attrs.y}`;
            if (bar.sig !== sig) {
                manifest.update.push([bar.element, attrs]);
                bar.sig = sig;
            }
        }
        for (const x of remBars) {
            manifest.remove.push(x.element);
            this._barsMap.delete(x.ref);
            x.ref = undefined;
        }
        return manifest;
    }

    _renderDoLayout({manifest}) {
        for (let i = 0; i < manifest.remove.length; i++) {
            manifest.remove[i].remove();
        }
        const pad = this.barSpacing * 0.5;
        for (let i = 0; i < manifest.update.length; i++) {
            const [element, attrs] = manifest.update[i];
            const radius = Math.min(this.barRadius, attrs.width * 0.5, attrs.height);
            const width = attrs.width - (2 * radius) - (2 * pad);
            if (width <= 0 || attrs.height <= 0) {
                element.removeAttribute('d');
            } else {
                element.setAttribute('d', `
                    M ${attrs.x + pad}, ${attrs.y + attrs.height}
                    v ${-attrs.height + radius}
                    q 0, ${-radius} ${radius}, ${-radius}
                    h ${width}
                    q ${radius}, 0 ${radius}, ${radius}
                    v ${attrs.height - radius} z
                `);
            }
        }
        for (let i = 0; i < manifest.add.length; i++) {
            this._barsEl.append(manifest.add[i]);
        }
    }

    getMidpointOffsetX(index) {
        if (!this._renderData || !this._renderData.length) {
            return 0;
        }
        const width = this._renderData.length === 1 ?
            this.xMax - this.xMin :
            index < this._renderData.length - 1 ?
                this._renderData[index + 1].x - this._renderData[index].x :
                this.xMax - this._renderData[index].x;
        return this.toScaleX(width / 2);
    }
}
