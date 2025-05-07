import * as common from './common.mjs';
import * as colorMod from './color.mjs';


export class BarChart extends common.Chart {

    init(options={}) {
        this.barSpacing = options.barSpacing ?? 6;
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
        this._plotRegionEl.replaceChildren(defs, this._barsEl);
    }

    doReset() {
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
        this._schedGC();
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
            norm[0] = {index: 0, width, x: width / 2, y: data[0][1] || 0, ref: data[0]};
            let offt = width;
            for (let i = 1; i < data.length; i++) {
                const o = data[i];
                const width = o[0] || 0;
                offt += width;
                norm[i] = {index: i, width, x: offt - (width / 2), y: o[1] || 0, ref: o};
            }
        } else if (typeof data[0] === 'object') {
            // [{width, y, ...}, {width, y, ...}, ...]
            const width = data[0].width || 0;
            norm[0] = {...data[0], index: 0, width, x: width / 2, y: data[0].y || 0, ref: data[0]};
            let offt = width;
            for (let i = 1; i < data.length; i++) {
                const o = data[i];
                const width = o.width || 0;
                offt += width;
                norm[i] = {...o, index: i, width, x: offt - (width / 2), y: o.y || 0, ref: o};
            }
        } else {
            // [y, y1, ...]
            for (let i = 0; i < data.length; i++) {
                norm[i] = {index: i, width: 1, x: i + 0.5, y: data[i] || 0, ref: data[i]};
            }
        }
        return norm;
    }

    adjustScale(manifest) {
        super.adjustScale(manifest);
        if (this._yMax === this._yMin) {
            this._yMin -= 1;
        }
        if (this.xMin == null) {
            this._xMin = 0;
        }
        if (this.xMax == null) {
            this._xMax = manifest.data.reduce((agg, x) => agg + x.width, 0);
        }
    }

    _renderBeforeLayout({data, resampling}, options={}) {
        const unclaimed = new Map(this._bars);
        const layout = {
            add: [],
            remove: [],
            update: [],
        };
        const yMinCoord = this.toY(Math.max(0, this._yMin));
        const adding = [];
        for (let index = 0; index < data.length; index++) {
            const entry = data[index];
            const x1 = this.toX(entry.x - entry.width / 2);
            const x2 = this.toX(entry.x + entry.width / 2);
            const y = this.toY(entry.y);
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
                    debugger; // verify we didn't regress with entry.ref change
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
        let unclaimedIter = adding.length && resampling && unclaimed.size && unclaimed.entries();
        for (let i = 0; i < adding.length; i++) {
            const {bar, ref} = adding[i];
            if (resampling) {
                if (unclaimedIter) {
                    const next = unclaimedIter.next().value;
                    if (next) {
                        const [oldKey, replace] = next;
                        unclaimed.delete(oldKey);
                        this._bars.delete(oldKey);
                        Object.assign(replace, bar);
                        this._bars.set(ref, replace);
                        layout.update.push(replace);
                        continue;
                    } else {
                        unclaimedIter = null;
                    }
                }
                if (this._barsPendingRemoval.size) {
                    debugger; // verify we didn't regress with entry.ref change
                    const [oldKey, replace] = this._barsPendingRemoval.entries().next().value;
                    this._barsPendingRemoval.delete(oldKey);
                    Object.assign(replace, bar);
                    this._bars.set(ref, replace);
                    layout.update.push(replace);
                    continue;
                }
            }
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

    _renderDoLayout(layout, {disableAnimation}={}) {
        const plotQuarterX = this._plotWidth / 4 + this._plotInset[3];
        const baselineY = this.toY(Math.max(0, this._yMin));
        const leftX = this.toX(this._xMin);
        const rightX = this.toX(this._xMax);
        for (let i = 0; i < layout.add.length; i++) {
            const {el, attrs} = layout.add[i];
            if (!disableAnimation) {
                const centerX = attrs.x + attrs.width / 2;
                const x = centerX < plotQuarterX ? leftX : centerX > plotQuarterX * 3 ? rightX : centerX;
                el.setAttribute('d', this._makeBarPath(x, baselineY, 0, 0));
            }
            this._barsEl.append(el);
        }
        if ((!disableAnimation && layout.add.length) || disableAnimation) {
            this._rootSvgEl.clientWidth;
        }
        for (let i = 0; i < layout.update.length; i++) {
            const {el, attrs} = layout.update[i];
            const width = Math.max(0, attrs.width - this.barSpacing);
            const x = attrs.x + this.barSpacing / 2;
            el.setAttribute('d', this._makeBarPath(x, attrs.y, width, attrs.height));
            el.setAttribute('fill', attrs.fill);
        }
        for (let i = 0; i < layout.remove.length; i++) {
            const {attrs, el} = layout.remove[i];
            if (!disableAnimation) {
                const centerX = attrs.x + attrs.width / 2;
                const x = centerX < plotQuarterX ? leftX : centerX > plotQuarterX * 3 ? rightX : centerX;
                el.setAttribute('d', this._makeBarPath(x, baselineY, 0, 0));
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
        const animDur = common.getStyleValue(this.el, '--transition-duration', 'time') || 0;
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
