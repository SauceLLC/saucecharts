/**
 * @module bar
 */
import * as common from './common.mjs';
import * as colorMod from './color.mjs';


/**
 * @typedef {object} BarChartOptions
 * @property {number} [barPadding=6]
 * @property {number} [barRadius=4]
 */


/**
 * @extends module:common.Chart
 * @param {BarChartOptions|module:common~ChartOptions} [options]
 *
 * @example
 *
 * const sl = new bar.BarChart({
 *     el: document.body
 * });
 * sl.setData([0,10,20,10,0,-10,-20,-10,0,10,20,10,0]);
 *

 */
export class BarChart extends common.Chart {

    static usesEntryWidths = true;

    resampleThreshold = null;

    init(options={}) {
        this.barPadding = options.barPadding ?? 6;
        this.barRadius = options.barRadius ?? 4;
        this._bars = new Map();
        this._barsPendingRemoval = new Map();
        this._barFills = new Map();
    }

    beforeSetElement(el) {
        el.classList.add('sc-barchart');
    }

    afterSetElement(el) {
        const barsClipId = `bars-clip-${this.id}`;
        const defs = common.createSVG({
            name: 'defs',
            children: [{
                name: 'clipPath',
                id: barsClipId,
                children: [{
                    name: 'rect',
                    class: ['sc-bars-clip']
                }]
            }]
        });
        this._barsEl = common.createSVG({
            name: 'g',
            class: 'sc-bars',
            attrs: {
                'clip-path': `url(#${barsClipId})`,
            }
        });
        this._plotRegionEl.append(defs, this._barsEl);
    }

    doReset() {
        this._prevXRange = null;
        this._prevYRange = null;
        this._barsEl.replaceChildren();
        this._bars.clear();
        this._barsPendingRemoval.clear();
        for (const x of this._barFills.values()) {
            this.removeGradient(x.gradient);
        }
        this._barFills.clear();
    }

    doLayout(manifest, options) {
        this._renderDoLayout(this._renderBeforeLayout(manifest, options), options);
        this._prevXRange = [this._xMin, this._xMax];
        this._prevYRange = [this._yMin, this._yMax];
        this._schedGC();
    }

    normalizeData(data) {
        const norm = new Array(data.length);
        if (!data.length) {
            return norm;
        }
        if (Array.isArray(data[0])) {
            // [[width, y], [width, y], ...]
            let offt = 0;
            for (let i = 0; i < data.length; i++) {
                const o = data[i];
                norm[i] = {index: i, width: o[0], x: offt, y: o[1], ref: o};
                offt += o[0];
            }
        } else if (typeof data[0] === 'object' && Object.getPrototypeOf(data[0]) === Object.prototype) {
            if (data[0].width != null && data[0].y != null && data[0].x === undefined) {
                // [{width, y, ...}, {width, y, ...}, ...]
                // x is calculated based on all bars being edge to edge
                let prev = norm[0] = {...data[0], index: 0, x: 0, ref: data[0]};
                for (let i = 1; i < data.length; i++) {
                    const o = data[i];
                    prev = norm[i] = {...o, index: i, x: prev.x + prev.width, ref: o};
                }
            } else if (data[0].x != null && data[0].y != null && data[0].width === undefined) {
                // [{x, y, ...}, {x, y, ...}, ...]
                // width becomes the implicit gaps between entries (gap to next, so last entry is a sentinel)
                for (let i = 0; i < data.length - 1; i++) {
                    const o = data[i];
                    norm[i] = {...o, index: i, width: data[i + 1].x - o.x, ref: o};
                }
                const end = data.length - 1;
                norm[end] = {...data[end], index: end, width: 0, ref: data[end]};
            } else if (data[0].x != null && data[0].y != null && data[0].width != null) {
                // [{width, x, y, ...}, {width, x, y, ...}, ...]
                // Full custom placement and size
                for (let i = 1; 0 < data.length; i++) {
                    const o = data[i];
                    norm[i] = {...o, index: i, ref: o};
                }
            } else {
                throw new TypeError('unable to infer data structure');
            }
        } else {
            // [y, y1, ...]
            let convWarn = 0;
            for (let i = 0; i < data.length; i++) {
                // Importantly, we need unique objects for the data ref and not primatives..
                // Option 1: do not allow this, throw TypeError
                // Option 2: alter the users data (they did give it to us)
                let y;
                if (typeof data[i] === 'number') {
                    convWarn++;
                    y = data[i];
                    data[i] = new Number(y);
                } else {
                    y = +data[i];
                }
                norm[i] = {index: i, width: 1, x: i, y, ref: data[i]};
            }
            if (convWarn) {
                console.warn(`Converted ${convWarn} primative numbers to unique objects.`);
            }
        }
        return norm;
    }

    adjustScale(manifest) {
        super.adjustScale(manifest);
        const data = manifest.data;
        this._xMin ??= data[0].x;
        this._xMax ??= data[data.length - 1].x + data[data.length - 1].width;
        if (this._yMax === this._yMin) {
            this._yMin -= 1;
        }
    }

    _renderBeforeLayout({data}, options={}) {
        const unclaimed = new Map(this._bars);
        const layout = {
            add: [],
            remove: [],
            update: [],
        };
        const yMinCoord = this.yValueToCoord(Math.max(0, this._yMin));
        const adding = [];
        for (let index = 0; index < data.length; index++) {
            const entry = data[index];
            const x1 = this.xValueToCoord(entry.x);
            const x2 = this.xValueToCoord(entry.x + entry.width);
            const y = this.yValueToCoord(entry.y);
            const height = yMinCoord - y;
            const color = entry.color || this.getColor();
            const fillKey = `${color}-${height < 0 ? 'down' : 'up'}`;
            let barFill = this._barFills.get(fillKey);
            if (!barFill) {
                const fill = colorMod.parse(color);
                const gradient = this.addGradient((fill instanceof colorMod.Gradient) ? fill : {
                    rotate: height < 0 ? 180 : 0,
                    type: 'linear',
                    colors: [
                        fill.adjustAlpha(-0.5).adjustLight(-0.2),
                        fill.adjustAlpha(-0.14),
                    ]
                });
                this._barFills.set(fillKey, barFill = {gradient});
            }
            const attrs = {
                width: x2 - x1,
                height,
                x: x1,
                y,
                fill: `url(#${barFill.gradient.id})`,
            };
            let bar = this._bars.get(entry.ref);
            if (!bar) {
                bar = this._barsPendingRemoval.get(entry.ref);
                if (bar) {
                    bar.sig = null;
                    this._barsPendingRemoval.delete(entry.ref);
                    this._bars.set(entry.ref, bar);
                }
            } else {
                unclaimed.delete(entry.ref);
            }
            if (!bar) {
                bar = {};
                adding.push({bar, ref: entry.ref});
            }
            const sig = `${attrs.width} ${attrs.height} ${attrs.x} ${attrs.y} ${attrs.fill}`;
            if (bar.sig !== sig) {
                bar.sig = sig;
                bar.attrs = attrs;
                bar.fillKey = fillKey;
                if (bar.el) {
                    layout.update.push(bar);
                }
            }
        }
        for (let i = 0; i < adding.length; i++) {
            const {bar, ref} = adding[i];
            bar.el = common.createSVG({name: 'path', class: ['sc-bar', 'sc-visual-data-bar']});
            this._bars.set(ref, bar);
            layout.add.push(bar);
            layout.update.push(bar);
        }
        for (const [key, bar] of unclaimed) {
            bar.lastUsed = document.timeline.currentTime;
            this._bars.delete(key);
            this._barsPendingRemoval.set(key, bar);
            layout.remove.push(bar);
        }
        if (options.disableAnimation) {
            // Terminate any active animations from previously removed bars (test case: aggressive resizing)
            for (const bar of this._barsPendingRemoval.values()) {
                layout.remove.push(bar);
            }
        }
        return layout;
    }

    /**
     * @param {number} value
     * @param {Array<number>} domain - [xMin, xMax] to use for coordinate scheme
     * @returns {number}
     */
    xValueToCoordUsing(value, domain) {
        domain ??= [this._xMin, this._xMax];
        return (value - domain[0]) * (this._plotWidth / (domain[1] - domain[0])) + this._plotBox[3];
    }

    /**
     * @param {number} value
     * @param {Array<number>} domain - [xMin, xMax] to use for coordinate scheme
     * @returns {number}
     */
    yValueToCoordUsing(value, domain) {
        domain ??= [this._yMin, this._yMax];
        return this._plotBox[2] - ((value - domain[0]) * (this._plotHeight / (domain[1] - domain[0])));
    }

    _renderDoLayout(layout, {disableAnimation}={}) {
        const baselineY = this.yValueToCoord(Math.max(0, this._yMin));
        const shiftY = this._prevXRange ?
            this.yValueToCoordUsing(Math.max(0, this._yMin), this._prevYRange) - baselineY :
            0;
        for (let i = 0; i < layout.add.length; i++) {
            const {el, attrs} = layout.add[i];
            if (!disableAnimation) {
                const centerX = attrs.x + attrs.width / 2;
                el.setAttribute('d', this._makeBarPath(centerX, baselineY + shiftY, 0, 0));
            }
            this._barsEl.append(el);
        }
        if (!disableAnimation && layout.add.length) {
            this._rootSvgEl.clientWidth;
        }
        for (let i = 0; i < layout.update.length; i++) {
            const {el, attrs} = layout.update[i];
            const width = Math.max(0, attrs.width - this.barPadding);
            const x = attrs.x + this.barPadding / 2;
            el.setAttribute('d', this._makeBarPath(x, attrs.y, width, attrs.height));
            el.setAttribute('fill', attrs.fill);
        }
        for (let i = 0; i < layout.remove.length; i++) {
            const {attrs, el} = layout.remove[i];
            if (!disableAnimation) {
                const centerX = attrs.x + attrs.width / 2;
                el.setAttribute('d', this._makeBarPath(centerX, baselineY, 0, 0));
            } else {
                el.removeAttribute('d');
            }
        }
    }

    _makeBarPath(x, y, width, height) {
        const radius = Math.min(this.barRadius, width * 0.5, Math.abs(height));
        const rCtrl = height < 0 ? -radius : radius;
        return (
            `M ${x},${y + height} ` +
            `v ${-height + rCtrl} ` +
            `q 0,${-rCtrl} ${radius},${-rCtrl} ` +
            `h ${width - (2 * radius)} ` +
            `q ${radius},0 ${radius},${rCtrl} ` +
            `v ${height - rCtrl} Z`
        );
    }

    _schedGC() {
        if (this._gcTimeout) {
            return;
        }
        this._gcTimeout = setTimeout(() => {
            common.requestIdle(() => {
                this._gcTimeout = null;
                this._gc();
            });
        }, 1100);
    }

    _gc() {
        const animDur = common.getStyleValue(this.el, '--transition-duration', 'time') || 100;
        const unclaimedFills = new Set(this._barFills.keys());
        for (const x of this._bars.values()) {
            unclaimedFills.delete(x.fillKey);
        }
        const expiration = document.timeline.currentTime - animDur - 100;
        let more;
        for (const [key, bar] of this._barsPendingRemoval) {
            if (bar.lastUsed > expiration) {
                more = true;
                unclaimedFills.delete(bar.fillKey);
            } else {
                this._barsPendingRemoval.delete(key);
                bar.el.remove();
                bar.el = null;
            }
        }
        for (const x of unclaimedFills) {
            const {gradient} = this._barFills.get(x);
            this.removeGradient(gradient);
            this._barFills.delete(x);
        }
        if (more) {
            this._schedGC();
        }
    }
}
