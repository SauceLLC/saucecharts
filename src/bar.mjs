import * as common from './common.mjs';
import * as color from './color.mjs';


export class BarChart extends common.Chart {

    init(options={}) {
        this._barsMap = new Map();
        this.barSpacing = options.barSpacing ?? 6;
        this.barRadius = options.barRadius ?? 3;
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

    normalizeData(data) {
        // Convert to width and height to center-x and top-y..
        const norm = new Array(data.length);
        if (!data.length) {
            return norm;
        }
        if (Array.isArray(data[0])) {
            // [[width, y], [width, y], ...]
            const width = data[0][0] || 0;
            norm[0] = {width, x: width / 2, y: data[0][1] || 0};
            let offt = width;
            for (let i = 1; i < data.length; i++) {
                const o = data[i];
                const width = o[0] || 0;
                offt += width;
                norm[i] = {width, x: offt - (width / 2), y: o[1] || 0};
            }
        } else if (typeof data[0] === 'object') {
            // [{width, y, ...}, {width, y, ...}, ...]
            const width = data[0].width || 0;
            norm[0] = {...data[0], width, x: width / 2, y: data[0].y || 0};
            let offt = width;
            for (let i = 1; i < data.length; i++) {
                const o = data[i];
                const width = o.width || 0;
                offt += width;
                norm[i] = {...o, width, x: offt - (width / 2), y: o.y || 0};
            }
        } else {
            // [y, y1, ...]
            for (let i = 0; i < data.length; i++) {
                norm[i] = {width: 1, x: i + 0.5, y: data[i] || 0};
            }
        }
        return norm;
    }

    adjustScale(manifest) {
        super.adjustScale(manifest);
        if (this.yMax === this.yMin) {
            this.yMin -= 1;
        }
        if (this._xMinOption == null) {
            this.xMin = 0;
        }
        if (this._xMaxOption == null) {
            this.xMax = manifest.data.reduce((agg, x) => agg + x.width, 0);
        }
    }

    _renderBeforeLayout({data}) {
        let offt = this.xMin;
        const coords = data.map(o =>
            [[this.toX(offt), this.toX(offt += o.width)], this.toY(o.y)]);
        const remBars = new Set(this._barsMap.values());
        const manifest = {
            add: [],
            remove: [],
            update: [],
        };
        const yMinCoord = this.toY(Math.max(0, this.yMin));
        for (let index = 0; index < coords.length; index++) {
            const coord = coords[index];
            const attrs = {
                width: coord[0][1] - coord[0][0],
                height: yMinCoord - coord[1],
                x: coord[0][0],
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
        const radius = Math.min(this.barRadius, width * 0.5, Math.abs(height));
        if (height >= 0) {
            return `
                M ${x}, ${y + height}
                v ${-height + radius}
                q 0, ${-radius} ${radius}, ${-radius}
                h ${width - (2 * radius)}
                q ${radius}, 0 ${radius}, ${radius}
                v ${height - radius} z
            `;
        } else {
            return `
                M ${x}, ${y + height}
                v ${-height - radius}
                q 0, ${radius} ${radius}, ${radius}
                h ${width - (2 * radius)}
                q ${radius}, 0 ${radius}, ${-radius}
                v ${height + radius} z
            `;
        }
    }

    _renderDoLayout({manifest}) {
        for (let i = 0; i < manifest.remove.length; i++) {
            manifest.remove[i].remove();
        }
        for (let i = 0; i < manifest.add.length; i++) {
            const [element, attrs] = manifest.add[i];
            if (!this.disableAnimation) {
                const centerX = attrs.x + attrs.width / 2;
                const bottom = attrs.y + attrs.height;
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
            const x = attrs.x + this.barSpacing / 2;
            element.setAttribute('d', this._makeBarPath(x, attrs.y, width, attrs.height));
        }
    }
}
