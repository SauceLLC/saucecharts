import * as common from './common.mjs';
import * as color from './color.mjs';


export class BarChart extends common.Chart {

    init(options={}) {
        this._barsMap = new Map();
        this.barSpacing = options.barSpacing ?? 6;
        this.barRadius = options.barRadius ?? 3;
        this._barFills = new Map();
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
        for (const x of this._barFills.values()) {
            this.removeGradient(x.gradient);
        }
        this._barFills.clear();

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
            norm[0] = {index: 0, width, x: width / 2, y: data[0][1] || 0};
            let offt = width;
            for (let i = 1; i < data.length; i++) {
                const o = data[i];
                const width = o[0] || 0;
                offt += width;
                norm[i] = {index: i, width, x: offt - (width / 2), y: o[1] || 0};
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
                norm[i] = {...o, index: i, width, x: offt - (width / 2), y: o.y || 0};
            }
        } else {
            // [y, y1, ...]
            for (let i = 0; i < data.length; i++) {
                norm[i] = {index: i, width: 1, x: i + 0.5, y: data[i] || 0};
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
        const unclaimedBars = new Set(this._barsMap.keys());
        const unclaimedFills = new Set(this._barFills.keys());
        const manifest = {
            add: [],
            remove: [],
            update: [],
        };
        const yMinCoord = this.toY(Math.max(0, this.yMin));
        let xOfft = this.xMin;
        for (let index = 0; index < data.length; index++) {
            const entry = data[index];
            const x1 = this.toX(xOfft);
            const x2 = this.toX(xOfft += entry.width);
            const y = this.toY(entry.y);
            // Important: ref must be from this.data so in-place array mutations
            // like appending new records to the existing array can be handled
            // as individual updates.
            const ref = this.data[entry.index];
            const attrs = {
                width: x2 - x1,
                height: yMinCoord - y,
                x: x1,
                y,
            };
            let bar = this._barsMap.get(ref);
            if (bar) {
                unclaimedBars.delete(ref);
            } else {
                const el = common.createSVGElement('path');
                el.classList.add('sc-bar', 'sc-visual-data-bar');
                this._barsMap.set(ref, bar = {el});
                manifest.add.push([el, attrs]);
            }
            if (entry.color) {
                unclaimedFills.delete(entry.color);
                let barFill = this._barFills.get(entry.color);
                if (!barFill) {
                    const fill = color.parse(entry.color);
                    const gradient = this.addGradient((fill instanceof color.Gradient) ? fill : {
                        type: 'linear',
                        colors: [
                            fill.lighten(-0.2).alpha(0.3),
                            fill.alpha(0.86),
                        ]
                    });
                    this._barFills.set(entry.color, barFill = {gradient});
                }
                attrs.fill = `url(#${barFill.gradient.id})`;
            } else {
                attrs.fill = `url(#${this._bgGradient.id})`;
            }
            const sig = `${attrs.width} ${attrs.height} ${attrs.x} ${attrs.y} ${attrs.fill}`;
            if (bar.sig !== sig) {
                manifest.update.push([bar.el, attrs]);
                bar.sig = sig;
            }
        }
        for (const x of unclaimedBars) {
            manifest.remove.push({el: this._barsMap.get(x).el});
            this._barsMap.delete(x);
        }
        for (const x of unclaimedFills) {
            const gradient = this._barFills.get(x).gradient;
            manifest.remove.push({gradient});
            this._barFills.delete(x);
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
            const x = manifest.remove[i];
            if (x.el) {
                x.el.remove();
            }
            if (x.gradient) {
                this.removeGradient(x.gradient);
            }
        }
        for (let i = 0; i < manifest.add.length; i++) {
            const [el, attrs] = manifest.add[i];
            if (!this.disableAnimation) {
                const centerX = attrs.x + attrs.width / 2;
                const bottom = attrs.y + attrs.height;
                el.setAttribute('d', this._makeBarPath(centerX, bottom, 0, 0));
            }
            this._barsEl.append(el);
        }
        if (!this.disableAnimation && manifest.add.length) {
            this._rootSvgEl.clientWidth;
        }
        for (let i = 0; i < manifest.update.length; i++) {
            const [el, attrs] = manifest.update[i];
            const width = Math.max(0, attrs.width - this.barSpacing);
            const x = attrs.x + this.barSpacing / 2;
            el.setAttribute('d', this._makeBarPath(x, attrs.y, width, attrs.height));
            el.setAttribute('fill', attrs.fill);
        }
    }
}
