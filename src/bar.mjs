import * as common from './common.mjs';
import * as color from './color.mjs';


export class BarChart extends common.Chart {

    init(options={}) {
        this._barsMap = new Map();
        this.barSpacing = options.barSpacing ?? 10;
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
            const ref = this.data[index];
            let bar = this._barsMap.get(ref);
            if (bar) {
                remBars.delete(bar);
            } else {
                bar = {ref};
                bar.element = common.createSVGElement('path', {
                    class: 'sc-bar sc-visual-data-bar',
                    fill: `url(#${this._bgGradient.id})`
                });
                manifest.add.push([bar.element, attrs]);
                this._barsMap.set(ref, bar);
            }
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

    _makeBarPath(x, y, width, height) {
        const radius = Math.min(this.barRadius, width * 0.5, height);
        return `
            M ${x}, ${y + height}
            v ${-height + radius}
            q 0, ${-radius} ${radius}, ${-radius}
            h ${width - 2 * radius}
            q ${radius}, 0 ${radius}, ${radius}
            v ${height - radius} z
        `;
    }

    _renderDoLayout({manifest}) {
        for (let i = 0; i < manifest.remove.length; i++) {
            manifest.remove[i].remove();
        }
        for (let i = 0; i < manifest.add.length; i++) {
            const [element, attrs] = manifest.add[i];
            if (!this.disableAnimation) {
                const centerX = attrs.x + attrs.width / 2;
                const bottom = this._plotHeight + this._plotInset[0];
                element.setAttribute('d', this._makeBarPath(centerX, bottom, 0, 0));
            }
            this._barsEl.append(element);
        }
        if (!this.disableAnimation && manifest.add.length) {
            this._rootSvgEl.clientWidth;
        }
        for (let i = 0; i < manifest.update.length; i++) {
            const [element, attrs] = manifest.update[i];
            const width = Math.max(0, attrs.width - this.barSpacing);
            const height = Math.max(0, attrs.height);
            const x = attrs.x + this.barSpacing / 2;
            element.setAttribute('d', this._makeBarPath(x, attrs.y, width, height));
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
