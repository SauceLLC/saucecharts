/**
 * @module common
 */
import * as colorMod from './color.mjs';


/**
 * Native CSS Color value (browser support dependent)
 *
 * @typedef CSS_Color
 * @type {string}
 * @external
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/CSS/color_value}
 */

/**
 * Coordinate box [top, right, bottom, left]
 *
 * @typedef BoxArray
 * @type {Array<number>}
 * @property {number} 0 - top
 * @property {number} 1 - right
 * @property {number} 2 - bottom
 * @property {number} 3 - left
 */

/**
 * Chart Tooltip positions
 *
 * A string containing horizontal and/or veritical placement hints.
 *
 * @example
 * "left below"
 *
 * @typedef TooltipPosition
 * @type {string}
 * @property {"left"|"center"|"right"|"leftright"} 0 - Horizontal placement hints
 * @property {"above"|"top"|"middle"|"bottom"|"below"} 1 - Vertical placement hints
 */

/**
 * Chart Axis options
 *
 * @typedef AxisOptions
 * @type {object}
 * @property {boolean} [disabled]
 * @property {("left"|"right"|"top"|"bottom")} [position=("left"|"bottom")] - Where to place the axis
 * @property {("inside"|"outside")} [align="outside"] - Alignment axis labels and ticks
 * @property {number} [ticks] - Number of labeled ticks to draw.
 * @property {boolean} [showFirst] - Show the first (visual-low) label of the axis
 * @property {boolean} [hideLast] - Hide the last (visual-high) label of the axis
 * @property {number} [tickLength=5] - Size of the tick marks
 * @property {function} [format] - Custom callback function for label values
 * @property {string} [padding] - Custom axis label padding
 * @property {number} [rotate] - Degrees of rotation.  Negative values on an xAxis will invert the alignment.
 */

/**
 * Chart Tooltip options
 *
 * @typedef TooltipOptions
 * @type {object}
 * @property {boolean} [disabled]
 * @property {BoxArray} [padding] - Padding offsets for tooltip box
 * @property {number} [linger=800] - Milliseconds to linger before hiding
 * @property {TooltipPosition} [position="leftright"] - Relative positioning of tooltip with
 *                                                      respect to the pointer
 * @property {function} [format] - Custom callback function for tooltip value
 * @property {function} [formatKey] - Custom callback function for tooltip key
 */

/**
 * Chart type specific normalized data entry
 *
 * @typedef DataEntry
 * @type object
 */

/**
 * Chart data array - Chart specific meaning
 *
 * @typedef ChartData
 * @type {Array<DataEntry|DataValue|DataTuple>}
 */

/**
 * Value only for data entry.  The X position is inferred by array index
 *
 * @typedef DataValue
 * @type number
 */

/**
 * An array with the position/size and value components
 *
 * @typedef DataTuple
 * @type Array<number>
 * @property {number} 0 - position/size
 * @property {number} 1 - value
 */

/**
 * X, Y coordinate values
 *
 * @typedef CoordTuple
 * @type Array<number>
 * @property {number} 0 - X coordinate
 * @property {number} 1 - Y coordinate
 */

/**
 * Coordinate range tuple
 *
 * @typedef CoordRange
 * @type Array<number>
 * @property {number} 0 - start value
 * @property {number} 1 - end value
 */

/**
 * Tooltip position event
 *
 * @event tooltip
 * @type {object}
 * @property {number} [x]
 * @property {number} [y]
 * @property {number} [index]
 * @property {boolean} internal - Was the event triggered internally by pointer events
 * @property {Chart} chart
 */

/**
 * Zoom event
 *
 * @event zoom
 * @type {object}
 * @property {("data"|"visual")} type
 * @property {CoordRange} [xRange]
 * @property {CoordRange} [yRange]
 * @property {CoordTuple} [translate]
 * @property {number} [scale]
 * @property {boolean} internal - Was the event triggered internally by pointer events
 * @property {Chart} chart
 */

const defaultTooltipId = '__default__';
let globalIdCounter = 0;


export const createSVG = _createNodes.bind(
    null, document.createElementNS.bind(document, 'http://www.w3.org/2000/svg'));

export const createHTML = _createNodes.bind(
    null, document.createElement.bind(document));


function _createNodes(createFunction, options) {
    const el = createFunction(options.name);
    if (options) {
        if (options.id) {
            el.id = options.id;
        }
        if (options.class) {
            const classes = Array.isArray(options.class) ? options.class : [options.class];
            el.classList.add(...classes);
        }
        if (options.data) {
            Object.assign(el.dataset, options.data);
        }
        if (options.attrs) {
            for (const [k, v] of Object.entries(options.attrs)) {
                el.setAttribute(k, v);
            }
        }
        if (options.style) {
            for (const [k, v] of Object.entries(options.style)) {
                el.style.setProperty(k, v);
            }
        }
        if (options.children) {
            el.append(...options.children.map(x => _createNodes(createFunction, x)));
        }
    }
    return el;
}


export function getStyleValue(el, key, type) {
    const raw = getComputedStyle(el).getPropertyValue(key);
    if (!type) {
        return raw;
    } else if (type === 'number') {
        return parseFloat(raw);
    } else if (type === 'time') {
        return parseFloat(raw) * (raw.endsWith('ms') ? 1 : 1000);
    }
}


export function requestIdle(cb, timeout=400) {
    if (window.requestIdleCallback) {
        return requestIdleCallback(cb, {timeout});
    } else {
        return setTimeout(cb, timeout / 2);
    }
}


export function cancelIdle(id) {
    if (window.requestIdleCallback) {
        return cancelIdleCallback(id);
    } else {
        return clearTimeout(id);
    }
}


export function lerp(n1, n2, t) {
    return ((1 - t) * n1) + (t * n2);
}


// Ported from https://github.com/joshcarr/largest-triangle-three-buckets.js
// See: https://github.com/sveinn-steinarsson/flot-downsample
function largestTriangleThreeBuckets(inData, outLen) {
    if (!outLen || outLen >= inData.length) {
        return inData;
    }
    const outData = [inData[0]];
    const every = (inData.length - 2) / (outLen - 2);
    let a = 0;
    let nextA;
    let maxAreaPoint;
    for (let i = 0; i < outLen - 2; i++) {
        const bStart = ((i + 1) * every | 0) + 1;
        const bEnd = Math.min(inData.length, ((i + 2) * every | 0) + 1);
        const bFactor = 1 / (bEnd - bStart);
        let avgX = 0, avgY = 0;
        for (let ii = bStart; ii < bEnd; ii++) {
            avgX += inData[ii].x * bFactor;
            avgY += inData[ii].y * bFactor;
        }
        const rangeFrom = ((i + 0) * every | 0) + 1;
        const rangeTo = ((i + 1) * every | 0) + 1;
        const aX = inData[a].x;
        const aY = inData[a].y;
        const aXAvgDist = aX - avgX;
        const ayAvgDist = avgY - aY;
        let maxArea = -1;
        for (let ii = rangeFrom; ii < rangeTo; ii++) {
            const area = Math.abs((aXAvgDist * (inData[ii].y - aY)) - (ayAvgDist * (aX - inData[ii].x)));
            if (area > maxArea) {
                maxArea = area;
                maxAreaPoint = inData[ii];
                nextA = i;
            }
        }
        outData.push(maxAreaPoint);
        a = nextA;
    }
    outData.push(inData[inData.length - 1]);
    return outData;
}


const resample = largestTriangleThreeBuckets;


/**
 * @typedef ChartOptions
 * @type {object}
 * @property {Element} [el] - DOM Element to insert chart into
 * @property {Chart} [parent] - Make this chart a child chart that shares one svg element
 * @property {ChartData} [data] - Initial data to use for chart rendering
 * @property {number} [xMin] - Minimum X data value
 * @property {number} [xMax] - Maximum X data value
 * @property {number} [yMin] - Minimum Y data value
 * @property {number} [yMax] - Maximum Y data value
 * @property {string} [title] - Visually displayed title of chart
 * @property {external:CSS_Color} [color] - The CSS color basis for this chart's data
 * @property {BoxArray} [padding] - Plot padding in DPI adjusted coordinates.
 * @property {number} [width] - Fixed width of plot
 * @property {number} [height] - Fixed height of plot
 * @property {TooltipOptions} [tooltip] - Tooltip options
 * @property {AxisOptions} [xAxis] - X axis options
 * @property {AxisOptions} [yAxis] - Y axis options
 * @property {boolean} [disableAnimation] - Disable all animation/transitions
 * @property {boolean} [darkMode] - Force use of darkmode
 */


/**
 * Base class for charts subclasses.
 *
 * @abstract
 * @extends {EventTarget}
 * @param {ChartOptions} [options] - Common chart options
 * @emits zoom
 * @emits tooltip
 */
export class Chart extends EventTarget {

    static usesEntryWidths = false;

    resampleThreshold = 1.5;
    resampleTarget = 1.0;

    constructor(options={}) {
        super();
        this.onPointerOver = this.onPointerOver.bind(this);
        this.init(options);
        this.id = globalIdCounter++;
        this.xMin = options.xMin;
        this.xMax = options.xMax;
        this.yMin = options.yMin;
        this.yMax = options.yMax;
        this.title = options.title;
        this.color = options.color;
        this.width = options.width;
        this.height = options.height;
        this.parent = options.parent;
        this.isRoot = !this.parent;
        this._tooltipViews = new Map();
        this._tooltips = new Map();
        this.xAxis = options.xAxis ?? {};
        this.yAxis = options.yAxis ?? {};
        this.padding = options.padding;
        if (!this.padding) {
            const defPad = 4;
            const hAxisPad = 20;
            const vAxisPad = 40;
            this.padding = [defPad, defPad, defPad, defPad];
            if (!this.xAxis.disabled && this.xAxis.align !== 'inside') {
                if (this.xAxis.position !== 'top') {
                    this.padding[2] += hAxisPad;
                } else {
                    this.padding[0] += hAxisPad;
                }
            }
            if (!this.yAxis.disabled && this.yAxis.align !== 'inside') {
                if (this.yAxis.position !== 'right') {
                    this.padding[3] += vAxisPad;
                } else {
                    this.padding[1] += vAxisPad;
                }
            }
        }
        this.disableAnimation = options.disableAnimation;
        this.darkMode = options.darkMode;
        this.childCharts = [];
        this._zoomState = {rev: 0};
        this._gradients = new Set();
        this._resizeObserver = new ResizeObserver(this.onResize.bind(this));
        if (options.el) {
            if (options.parent) {
                throw new Error("`parent` and `el` options are mutually exclusive");
            }
            this.setElement(options.el);
        } else if (options.parent) {
            options.parent.addChart(this);
        }
        if (this.isRoot) {
            addEventListener('scroll', ev => {
                for (const view of this._tooltipViews.values()) {
                    let rect;
                    if (view.state.visible) {
                        if (!rect) {
                            rect = this.el.getBoundingClientRect();
                        }
                        view.state.elOffset = [rect.x, rect.y];
                        this._updateTooltipView(view, {disableAnimation: true});
                    }
                }
            }, {passive: true, capture: true});
        }
        const tooltipOptions = options.tooltip ?? {};
        if (!tooltipOptions.disabled) {
            this.addTooltip(defaultTooltipId, {pointerEvents: true, ...tooltipOptions});
        }
        if (options.data) {
            this.setData(options.data);
        }
    }

    /**
     * @protected
     * @param {ChartOptions} options
     */
    init(options) {
    }

    /**
     * Add a color gradient which can be used in SVG contexts
     *
     * @param {(module:color.Gradient|module:color~GradientOptions)} gradient
     * @returns {module:color.Gradient}
     */
    addGradient(gradient) {
        if (!(gradient instanceof colorMod.Gradient)) {
            gradient = colorMod.Gradient.fromObject(gradient);
        }
        gradient.render();
        this._gradients.add(gradient);
        this._defsEl.append(gradient.el);
        return gradient;
    }

    /**
     * @param {module:color.Gradient} gradient
     */
    removeGradient(gradient) {
        this._gradients.delete(gradient);
        gradient.el.remove();
        gradient.el = null;
    }

    onResize(entries) {
        for (let i = 0; i < entries.length; i++) {
            const x = entries[i];
            if (x.target.classList.contains('sc-tooltip-box')) {
                requestAnimationFrame(() => this._onResizeTooltip(x));
            } else if (x.target === this.el) {
                requestAnimationFrame(() => this._onResizeContainer(x));
            }
        }
    }

    _onResizeTooltip(resize) {
        const minChange = 10;
        const courseWidth = Math.ceil(resize.borderBoxSize[0].inlineSize / minChange) * minChange;
        resize.target._positioner.style.setProperty('--course-width', `${courseWidth}px`);
    }

    _onResizeContainer(resize) {
        const hasAnim = !this.el.classList.contains('sc-disable-animation');
        if (hasAnim) {
            this.el.classList.add('sc-disable-animation');
        }
        try {
            this.adjustSize(resize.contentRect.width, resize.contentRect.height);
            this.render({disableAnimation: true});
        } finally {
            if (hasAnim) {
                this.el.offsetWidth;
                this.el.classList.remove('sc-disable-animation');
            }
        }
    }

    /**
     * @protected
     */
    adjustSize(boxWidth, boxHeight) {
        this.devicePixelRatio = devicePixelRatio || 1;
        if (boxWidth === undefined) {
            ({width: boxWidth, height: boxHeight} = this._rootSvgEl.getBoundingClientRect());
        }
        const allCharts = this.getAllCharts();
        if (allCharts.every(x => x.width != null)) {
            boxWidth = Math.max(...allCharts.map(x => x.padding[3] + x.width + x.padding[1]));
        }
        if (allCharts.every(x => x.height != null)) {
            boxHeight = Math.max(...allCharts.map(x => x.padding[0] + x.height + x.padding[2]));
        }
        if (!boxWidth || !boxHeight) {
            this._boxWidth = 0;
            this._boxHeight = 0;
            this._plotWidth = 0;
            this._plotHeight = 0;
            this._plotBox = [0, 0, 0, 0];
            return;
        }
        this._boxWidth = Math.round(boxWidth * this.devicePixelRatio);
        this._boxHeight = Math.round(boxHeight * this.devicePixelRatio);
        const inset = this.padding.map(x => x * this.devicePixelRatio);
        this._plotWidth = Math.max(0, this.width ?
            Math.round(this.width * this.devicePixelRatio) :
            this._boxWidth - inset[3] - inset[1]);
        this._plotHeight = Math.max(0, this.height ?
            Math.round(this.height * this.devicePixelRatio) :
            this._boxHeight - inset[0] - inset[2]);
        this._plotBox = [
            inset[0],
            this._plotWidth + inset[3],
            this._plotHeight + inset[0],
            inset[3]
        ];
        const plotStyle = this._plotRegionEl.style;
        plotStyle.setProperty('--plot-box-top', `${this._plotBox[0]}px`);
        plotStyle.setProperty('--plot-box-right', `${this._plotBox[1]}px`);
        plotStyle.setProperty('--plot-box-bottom', `${this._plotBox[2]}px`);
        plotStyle.setProperty('--plot-box-left', `${this._plotBox[3]}px`);
        plotStyle.setProperty('--plot-width', `${this._plotWidth}px`);
        plotStyle.setProperty('--plot-height', `${this._plotHeight}px`);
        if (this.isRoot) {
            this._rootSvgEl.setAttribute('viewBox', `0 0 ${this._boxWidth} ${this._boxHeight}`);
            this.el.style.setProperty('--dpr', this.devicePixelRatio);
        }
        for (const view of this._tooltipViews.values()) {
            if (view.state.visible) {
                this._establishTooltipViewState(view);
            }
        }
    }

    _drawXAxis() {
        this._drawAxis('horizontal', this._xAxisEl, this.xAxis);
    }

    _drawYAxis() {
        this._drawAxis('vertical', this._yAxisEl, this.yAxis);
    }

    _drawAxis(orientation, el, options) {
        const vert = orientation === 'vertical';
        const baseline = el.querySelector('line.sc-baseline');
        const [top, right, bottom, left] = this._plotBox;
        let position;
        if (vert) {
            position = options.position ?? 'left';
            el.classList.toggle('sc-right', position === 'right');
            baseline.setAttribute('x1', position === 'right' ? right : left);
            baseline.setAttribute('x2', position === 'right' ? right : left);
            baseline.setAttribute('y1', top);
            baseline.setAttribute('y2', bottom);
        } else {
            position = options.position ?? 'bottom';
            el.classList.toggle('sc-top', position !== 'bottom');
            baseline.setAttribute('x1', left);
            baseline.setAttribute('x2', right);
            baseline.setAttribute('y1', position === 'bottom' ? bottom : top);
            baseline.setAttribute('y2', position === 'bottom' ? bottom : top);
        }
        const inside = (options.align ?? 'outside') === 'inside';
        el.classList.toggle('sc-inside', inside);
        if (options.padding) {
            el.style.setProperty('--axis-padding', options.padding);
        } else {
            el.style.removeProperty('--axis-padding');
        }
        el.style.setProperty('--axis-angle', `${options.rotate}deg`);
        el.classList.toggle('axis-rotate', !!options.rotate);
        if (!vert) {
            el.classList.toggle('axis-rotate-invert', options.rotate < 0);
        }
        let ticks = options.ticks;
        const trackLength = vert ? this._plotHeight : this._plotWidth;
        if (ticks == null) {
            ticks = 1 + Math.floor((trackLength / devicePixelRatio) / (vert ? 100 : 200));
        }
        const tickLen = options.tickLength ?? 5;
        const existingTicks = el.querySelectorAll('line.sc-tick');
        const existingLabels = el.querySelectorAll('text.sc-label');
        let visualCount = 0;
        ticks += !options.showFirst + !!options.hideLast; // pad calcs
        const range = ticks > 1 ? ticks - 1 : 1;
        for (let i = options.showFirst ? 0 : 1; i < (options.hideLast ? ticks - 1 : ticks); i++) {
            const percent = i / range;
            let x1, x2, y1, y2;
            if (vert) {
                x1 = position === 'right' ? right : left;
                if (inside) {
                    x2 = x1 + tickLen * (position === 'right' ? -1 : 1);
                } else {
                    x2 = x1 - tickLen * (position === 'right' ? -1 : 1);
                }
                y1 = y2 = bottom - trackLength * percent;
            } else {
                x1 = x2 = left + trackLength * percent;
                y1 = position === 'bottom' ? bottom : top;
                if ((inside && position === 'bottom') || (!inside && position !== 'bottom')) {
                    y2 = y1 - tickLen;
                } else {
                    y2 = y1 + tickLen;
                }
            }
            let tick = existingTicks[visualCount];
            if (!tick) {
                tick = createSVG({name: 'line', class: 'sc-tick'});
                el.append(tick);
            }
            tick.setAttribute('x1', x1);
            tick.setAttribute('x2', x2);
            tick.setAttribute('y1', y1);
            tick.setAttribute('y2', y2);
            let label = existingLabels[visualCount];
            if (!label) {
                label = createSVG({name: 'text', class: 'sc-label'});
                el.append(label);
            }
            label.setAttribute('x', x1);
            label.setAttribute('y', y1);
            label.style.setProperty('--x', `${x1}px`);
            label.style.setProperty('--y', `${y1}px`);
            label.setAttribute('data-percent', percent);
            label.replaceChildren(this.onAxisLabel({
                orientation,
                percent,
                format: options.format,
            }));
            visualCount++;
        }
        for (let i = visualCount; i < existingTicks.length; i++) {
            existingTicks[i].remove();
        }
        for (let i = visualCount; i < existingLabels.length; i++) {
            existingLabels[i].remove();
        }
    }

    /**
     * Set the DOM element to be used by this chart
     *
     * @param {Element} el
     */
    setElement(el) {
        this.beforeSetElement(el);
        const old = this.el;
        this.el = el;
        if (old) {
            this.doReset();
        }
        this._resizeObserver.disconnect();
        if (this.isRoot) {
            if (old) {
                old.removeEventListener('pointerover', this.onPointerOver);
                if (this._plotRegionEl) {
                    this._plotRegionEl.remove();
                    this._plotRegionEl = null;
                }
                if (this._xAxisEl) {
                    this._xAxisEl.remove();
                    this._xAxisEl = null;
                }
                if (this._yAxisEl) {
                    this._yAxisEl.remove();
                    this._yAxisEl = null;
                }
            }
            el.classList.add('saucechart', 'sc-wrap');
            el.classList.toggle('sc-disable-animation', !!this.disableAnimation);
            let darkMode = this.darkMode;
            if (darkMode === undefined) {
                const c = colorMod.parse(getStyleValue(el, 'color'));
                darkMode = c.l >= 0.5;
            }
            this.el.classList.toggle('sc-darkmode', darkMode);
            const svg = createSVG({
                name: 'svg',
                class: 'sc-root',
                attrs: {
                    version: '1.1',
                    preserveAspectRatio: 'none',
                },
                children: [{
                    name: 'defs'
                }, {
                    name: 'g',
                    class: 'sc-plot-regions',
                }]
            });
            const tooltips = createHTML({
                name: 'div',
                class: 'sc-tooltips',
            });
            el.replaceChildren(svg, tooltips);
        }
        this._rootSvgEl = el.querySelector('svg.sc-root');
        this._defsEl = this._rootSvgEl.querySelector(':scope > defs');
        const plotRegionsEl = this._rootSvgEl.querySelector('.sc-plot-regions');
        this._plotRegionEl = createSVG({name: 'g', class: 'sc-plot-region', data: {id: this.id}});
        if (this.color) {
            this._plotRegionEl.style.setProperty('--color', this.color);
            this._computedColor = null;
        }
        if (this.title) {
            const titleEl = createSVG({
                name: 'text',
                class: 'sc-title',
                x: 0,
                y: 10,
            });
            titleEl.textContent = this.title;
            this._plotRegionEl.append(titleEl);
        }
        plotRegionsEl.append(this._plotRegionEl);
        if (!this.xAxis.disabled) {
            this._xAxisEl = createSVG({
                name: 'g',
                class: ['sc-axis', 'sc-x-axis'],
                children: [{name: 'line', class: 'sc-baseline'}]
            });
            this._rootSvgEl.append(this._xAxisEl);
        }
        if (!this.yAxis.disabled) {
            this._yAxisEl = createSVG({
                name: 'g',
                class: ['sc-axis', 'sc-y-axis'],
                children: [{name: 'line', class: 'sc-baseline'}]
            });
            this._rootSvgEl.append(this._yAxisEl);
        }
        if (this.isRoot) {
            const tooltipsEl = el.querySelector('.sc-tooltips');
            for (const view of this._tooltipViews.values()) {
                tooltipsEl.append(view.positioner);
                plotRegionsEl.after(view.graphics);
                this._resizeObserver.observe(view.box);
            }
            for (const x of this.childCharts) {
                x.setElement(el);
            }
            el.addEventListener('pointerover', this.onPointerOver);
        }
        this._resizeObserver.observe(el);
        this.afterSetElement(el);
        this.adjustSize();
        this.render();
    }

    /**
     * @protected
     */
    beforeSetElement() {}

    /**
     * @protected
     */
    afterSetElement() {}

    /**
     * Retrieve the computed CSS color for this chart
     *
     * @returns {external:CSS_Color}
     */
    getColor() {
        if (!this._computedColor) {
            this._computedColor = getStyleValue(this._plotRegionEl, '--color');
        }
        return this._computedColor;
    }

    /**
     * @protected
     * @param {Chart} chart
     */
    addChart(chart) {
        if (this.parent) {
            throw new TypeError("only valid on parent");
        }
        if (this.childCharts.indexOf(chart) !== -1) {
            throw new Error("Chart already present");
        }
        this.childCharts.push(chart);
        chart.parent = this;
        for (const x of this.childCharts) {
            x._computedColor = null;
        }
        this._computedColor = null;
        if (this.el) {
            chart.setElement(this.el);
        }
    }

    /**
     * @returns {Array<Chart>} All the charts sharing this chart's `el` property
     */
    getAllCharts() {
        const root = this.parent ?? this;
        return [root, ...root.childCharts];
    }

    /**
     * Add a new tooltip to this chart.
     *
     * @param {string} id - Identifier for this tooltip
     * @param {TooltipOptions} - Options for this tooltip
     */
    addTooltip(id, options={}) {
        if (this._tooltips.has(id)) {
            throw new Error('Tooltip already present');
        }
        const tooltip = {
            id,
            chart: this,
            options: {
                format: options.format,
                formatKey: options.formatKey,
            },
            ephemeral: new Map(),
        };
        const root = this.parent ?? this;
        let view = root._tooltipViews.get(id);
        if (!view) {
            const positioner = createHTML({
                name: 'div',
                class: 'sc-tooltip-positioner',
                data: {id},
                children: [{
                    name: 'div',
                    class: 'sc-tooltip-box-wrap',
                    children: [{
                        name: 'div',
                        class: 'sc-tooltip-box',
                    }]
                }]
            });
            const box = positioner.querySelector('.sc-tooltip-box');
            box._positioner = positioner;
            const graphics = createSVG({name: 'g', class: 'sc-tooltip-graphics', data: {id}});
            if (root.el) {
                root.el.querySelector('.sc-tooltips').append(positioner);
                root._rootSvgEl.querySelector('.sc-plot-regions').after(graphics);
                root._resizeObserver.observe(box);
            }
            view = {
                id,
                positioner,
                box,
                graphics,
                options: {
                    padding: [0, 0, 0, 0],
                    position: 'leftright',
                    linger: 800,
                },
                tooltips: new Set(),
                state: {suspendRefCnt: 0},
            };
            root._tooltipViews.set(id, view);
        }
        if (options.padding != null) {
            view.options.padding = options.padding;
        }
        if (options.position != null) {
            view.options.position = options.position;
        }
        if (options.linger != null) {
            view.options.linger = options.linger;
        }
        if (options.pointerEvents != null) {
            view.options.pointerEvents = options.pointerEvents;
        }
        tooltip.view = view;
        view.tooltips.add(tooltip);
        this._tooltips.set(id, tooltip);
    }

    /**
     * Remove a tooltip from this chart
     */
    removeTooltip(id) {
        const tooltip = this._tooltips.get(id);
        if (!tooltip) {
            throw new Error('Tooltip not found');
        }
        this._tooltips.delete(id);
        for (const x of tooltip.ephemeral.values()) {
            x.remove();
        }
        tooltip.ephemeral.clear();
        tooltip.view.tooltips.delete(tooltip);
        if (!tooltip.view.tooltips.size) {
            tooltip.view.positioner.remove();
            tooltip.view.graphics.remove();
            const root = this.parent ?? this;
            root._tooltipViews.delete(id);
        }
    }

    localeNumber(value) {
        let localeConfig;
        if (value % 1 && value < 1e4) {
            localeConfig = {
                maximumFractionDigits: 2,
                minimumFractionDigits: 2,
                useGrouping: 'min2',
            };
        } else if (value < 100) {
            localeConfig = {maximumFractionDigits: 1};
        } else {
            localeConfig = {
                useGrouping: 'min2',
                maximumFractionDigits: 0
            };
        }
        return value.toLocaleString(undefined, localeConfig);
    }

    /**
     * The default tooltip formatter
     *
     * @protected
     * @param {object} options
     * @param {DataEntry} options.entry - Data Entry
     * @param {object} options.tooltip - Tooltip
     * @returns {Element} Tooltip contents
     */
    onTooltip({entry, tooltip}) {
        let entryEl = tooltip.ephemeral.get(`entry-${this.id}`);
        let keyEl, valueEl;
        if (!entryEl) {
            entryEl = document.createElement('div');
            entryEl.className = 'sc-tooltip-entry';
            entryEl.dataset.chartId = this.id;
            keyEl = document.createElement('key');
            valueEl = document.createElement('value');
            tooltip.ephemeral.set(`key-${this.id}`, keyEl);
            tooltip.ephemeral.set(`value-${this.id}`, valueEl);
            entryEl.append(keyEl, valueEl);
        } else {
            keyEl = tooltip.ephemeral.get(`key-${this.id}`);
            valueEl = tooltip.ephemeral.get(`value-${this.id}`);
        }
        entryEl.style.setProperty('--color', entry.color ?? this.getColor());
        let key, value;
        if (tooltip.options.formatKey) {
            key = tooltip.options.formatKey({
                value: entry.x,
                index: entry.index,
                entry,
                chart: this
            });
        } else if (!isNaN(entry.x) && entry.x !== null) {
            if (this.xAxis.format) {
                key = this.xAxis.format({value: entry.x, chart: this});
            } else {
                key = this.localeNumber(entry.x);
            }
        }
        if (tooltip.options.format) {
            value = tooltip.options.format({
                value: entry.y,
                index: entry.index,
                entry,
                chart: this
            });
        } else if (!isNaN(entry.y) && entry.y !== null) {
            if (this.yAxis.format) {
                value = this.yAxis.format({value: entry.y, chart: this});
            } else {
                value = this.localeNumber(entry.y);
            }
        }
        if (key != null && value != null) {
            keyEl.replaceChildren(key);
            valueEl.replaceChildren(value);
            return entryEl;
        }
    }

    /**
     * The default Axis Label formatter
     *
     * @protected
     * @param {object} options
     * @param {string} options.orientation - "vertical" or "horizontal" orientation
     * @param {number} options.percent - Normalized percentage of label, i.e. 0 -> 1
     * @param {function} [options.format] - Optional format callback
     * @returns {string} Label contents
     */
    onAxisLabel({orientation, percent, format}) {
        let range;
        let start;
        if (orientation === 'vertical') {
            start = this._yMin;
            range = this._yMax - this._yMin;
        } else {
            start = this._xMin;
            range = this._xMax - this._xMin;
        }
        const value = start + (range * percent);
        if (isNaN(value) || value === null) {
            return '';
        }
        if (format) {
            return format({value, chart: this});
        } else {
            let localeConfig;
            if (range <= 1) {
                localeConfig = {
                    maximumFractionDigits: 2,
                    minimumFractionDigits: 2
                };
            } else if (range < 100) {
                localeConfig = {maximumFractionDigits: 1};
            } else {
                localeConfig = {
                    useGrouping: 'min2',
                    maximumFractionDigits: 0
                };
            }
            return value.toLocaleString(undefined, localeConfig);
        }
    }

    onPointerOver(ev) {
        for (const view of this._tooltipViews.values()) {
            if (view.options.pointerEvents) {
                this.onPointerStartForTooltip(view, ev);
            }
        }
    }

    onPointerStartForTooltip(view, ev) {
        if (!this._isTooltipViewAvailable(view) ||
            this._isTooltipViewPointing(view) ||
            !this._renderData ||
            !this._renderData.length) {
            return;
        }
        const state = this._establishTooltipViewState(view);
        const pointerAborter = state.pointerAborter = new AbortController();
        const signal = pointerAborter.signal;
        signal.addEventListener('abort', () => {
            setTimeout(() => {
                if (view.state.pointerAborter === pointerAborter) {
                    this._hideTooltipView(view);
                }
            }, view.options.linger);
            this.dispatchEvent(new CustomEvent('tooltip', {
                detail: {internal: true, chart: this}
            }));
        });
        // Cancel-esc pointer events are sloppy and unreliable (proven).  Kitchen sink...
        addEventListener('pointercancel', () => pointerAborter.abort(), {signal});
        addEventListener('pointerout', ev => !this.el.contains(ev.target) && pointerAborter.abort(),
                         {signal});
        this.el.addEventListener('pointerleave', () => pointerAborter.abort(), {signal});
        let af;
        this.el.addEventListener('pointermove', ev => {
            cancelAnimationFrame(af);
            const x = (ev.x - state.elOffset[0]) * this.devicePixelRatio;
            af = requestAnimationFrame(() => {
                if (!pointerAborter.signal.aborted) {
                    this._setTooltipViewPosition(view, {x, disableAnimation: true, internal: true});
                }
            });
        }, {signal});
        const x = (ev.x - state.elOffset[0]) * this.devicePixelRatio;
        this._setTooltipViewPosition(view, {x, disableAnimation: true, internal: true});
        this._showTooltipView(view);
    }

    /**
     * Hide tooltip (if visible)
     *
     * @param {string} [id] - ID of the tooltip to hide
     */
    hideTooltip(id=defaultTooltipId) {
        return this._hideTooltipView(this._tooltips.get(id).view);
    }

    _hideTooltipView(view) {
        const state = view.state;
        if (state.pointerAborter && !state.pointerAborter.signal.aborted) {
            state.pointerAborter.abort();
        }
        if (!state.visible) {
            return;
        }
        view.positioner.classList.remove('sc-active');
        view.graphics.classList.remove('sc-active');
        state.visible = false;
    }

    /**
     * Show tooltip (if available)
     *
     * @param {string} [id] - ID of the tooltip to show
     */
    showTooltip(id=defaultTooltipId) {
        const tooltip = this._tooltips.get(id);
        if (!tooltip) {
            throw new Error('Tooltip not found');
        }
        return this._showTooltipView(tooltip.view);
    }

    _showTooltipView(view) {
        if (!this._isTooltipViewAvailable(view) || view.state.visible) {
            return;
        }
        const state = this._establishTooltipViewState(view);
        const hasAnim = !view.positioner.classList.contains('sc-disable-animation') &&
            !this.el.classList.contains('sc-disable-animation');
        if (hasAnim) {
            view.positioner.classList.add('sc-disable-animation');
        }
        view.positioner.classList.add('sc-active');
        view.graphics.classList.add('sc-active');
        state.visible = true;
        if (hasAnim) {
            view.positioner.offsetWidth;
            view.positioner.classList.remove('sc-disable-animation');
        }
    }

    /**
     * Increment the tooltip's suspend reference count by 1.
     * While the tooltip suspend reference count is > 0 the tooltip will not be
     * available and thus won't be visible.
     *
     * @param {string} [id] - ID of the tooltip to suspend
     */
    suspendTooltip(id=defaultTooltipId) {
        this._suspendTooltipView(this._tooltips.get(id).view);
    }

    _suspendTooltipView(view) {
        view.state.suspendRefCnt++;
        if (view.state.visible) {
            this._hideTooltipView(view);
        }
    }

    /**
     * Decrement the tooltip's suspend reference count by 1
     *
     * @param {string} [id] - ID of the tooltip to suspend
     */
    resumeTooltip(id=defaultTooltipId) {
        this._resumeTooltipView(this._tooltips.get(id).view);
    }

    _resumeTooltipView(view) {
        if (view.state.suspendRefCnt === 0) {
            throw new Error("not suspended");
        }
        view.state.suspendRefCnt--;
    }

    /**
     * @returns {boolean} Is the tooltip suspended or disabled
     *
     * @param {string} [id] - ID of the tooltip to check
     */
    isTooltipAvailable(id=defaultTooltipId) {
        return this._isTooltipViewAvailable(this._tooltips.get(id).view);
    }

    _isTooltipViewAvailable(view) {
        return view.state.suspendRefCnt === 0;
    }

    /**
     * @returns {boolean} Is the tooltip actively handling pointer events
     */
    isTooltipPointing(id=defaultTooltipId) {
        return this._isTooltipViewPointing(this._tooltips.get(id).view);
    }

    _isTooltipViewPointing(view) {
        return !!(
            view.state.visible &&
            view.state.pointerAborter &&
            !view.state.pointerAborter.signal.aborted
        );
    }

    _establishTooltipViewState(view) {
        let positionCallback, hAlign, vAlign;
        if (typeof view.options.position === 'function') {
            positionCallback = view.opptions.position;
        } else {
            let tp = view.options.position;
            if (typeof tp === 'string') {
                tp = tp.split(/\s+/);
            }
            hAlign = tp.find(x => ['left', 'center', 'right', 'leftright'].includes(x));
            vAlign = tp.find(x => ['above', 'top', 'middle', 'bottom', 'below'].includes(x)) || 'top';
            if (vAlign && !hAlign) {
                hAlign = {
                    below: 'center',
                    above: 'center',
                }[vAlign] || 'leftright';
            }
        }
        const rect = this.el.getBoundingClientRect();
        Object.assign(view.state, {
            elOffset: [rect.x, rect.y],
            positionCallback,
            hAlign,
            vAlign,
            lastDrawSig: undefined,
            hasDrawn: false,
        });
        return view.state;
    }

    /**
     * Place the tooltip at specific data value coordinates or by data index
     *
     * @param {object} options
     * @param {number} [options.x]
     * @param {number} [options.y]
     * @param {number} [options.index] - Data index
     * @param {string} [id] - ID of the tooltip to position
     */
    setTooltipPosition(options, id=defaultTooltipId) {
        const tooltip = this._tooltips.get(id);
        if (!tooltip) {
            throw new Error('Tooltip not found');
        }
        if (!tooltip.view.state.visible) {
            this._establishTooltipViewState(tooltip.view);
        }
        return this._setTooltipViewPosition(tooltip.view, options);
    }

    _setTooltipViewPosition(view, {x, y, index, disableAnimation, internal=false}) {
        Object.assign(view.state, {x, y, index});
        this._updateTooltipView(view, {disableAnimation});
        queueMicrotask(() => this.dispatchEvent(new CustomEvent('tooltip', {
            detail: {
                id: view.id,
                x,
                y,
                index,
                internal,
                chart: this,
            }
        })));
    }

    /**
     * @protected
     */
    updateVisibleTooltips(options) {
        const root = this.parent ?? this;
        for (const view of root._tooltipViews.values()) {
            cancelAnimationFrame(view.state.pendingUpdateAnimFrame);
            if (view.state.visible && this._isTooltipViewAvailable(view)) {
                view.state.pendingUpdateAnimFrame = requestAnimationFrame(() => {
                    if (view.state.visible && this._isTooltipViewAvailable(view)) {
                        this._updateTooltipView(view, options);
                    }
                });
            }
        }
    }

    _updateTooltipView(view, options={}) {
        const contents = [];
        const state = view.state;
        let drawSig = state.elOffset.join();
        for (const tooltip of view.tooltips) {
            const chart = tooltip.chart;
            let xRef = state.index != null ?
                chart.xValueToCoord(chart.normalizedData?.[state.index]?.x) :
                state.x;
            if (isNaN(xRef)) {
                continue;
            }
            if (xRef >= chart._plotBox[1]) {
                xRef = chart._plotBox[1] - 1e-6;
            } else if (xRef <= chart._plotBox[3]) {
                xRef = chart._plotBox[3] + 1e-6;
            }
            const entry = chart.findNearestFromXCoord(xRef);
            if (entry === undefined || entry.x < chart._xMin || entry.x > chart._xMax) {
                continue;
            }
            const element = chart.onTooltip({entry, tooltip});
            if (element) {
                const coordinates = chart.constructor.usesEntryWidths ?
                    [chart.xValueToCoord(entry.x + entry.width / 2), chart.yValueToCoord(entry.y)] :
                    [chart.xValueToCoord(entry.x), chart.yValueToCoord(entry.y)];
                contents.push({chart, entry, coordinates, element});
                drawSig += ` ${chart.id} ${entry.index} ${coordinates[0]} ${coordinates[1]}`;
            }
        }
        if (drawSig !== state.lastDrawSig) {
            state.lastDrawSig = drawSig;
            const disableAnim = (options.disableAnimation || !state.hasDrawn) &&
                (!view.positioner.classList.contains('sc-disable-animation') &&
                 !this.el.classList.contains('sc-disable-animation'));
            if (disableAnim) {
                view.positioner.classList.add('sc-disable-animation');
                view.graphics.classList.add('sc-disable-animation');
            }
            try {
                this._drawTooltipView(view, contents);
            } finally {
                if (disableAnim) {
                    view.positioner.offsetWidth;
                    view.positioner.classList.remove('sc-disable-animation');
                    view.graphics.classList.remove('sc-disable-animation');
                }
            }
        }
    }

    _drawTooltipView(view, contents) {
        if (!contents.length) {
            view.box.replaceChildren();
            return;
        }
        const state = view.state;
        let centerX = 0;
        let top = Infinity;
        let bottom = -Infinity;
        for (let i = 0; i < contents.length; i++) {
            const {chart, coordinates} = contents[i];
            centerX += coordinates[0];
            const t = chart._plotBox[0];
            const b = chart._plotBox[2];
            if (t < top) {
                top = t;
            }
            if (b > bottom) {
                bottom = b;
            }
        }
        centerX /= contents.length;
        const centerY = top + (bottom - top) / 2;
        if (!view.graphics.childNodes.length) {
            const line = createSVG({
                name: 'path',
                class: ['sc-line', 'sc-vertical']
            });
            view.graphics.append(line);
        }
        const vertLine = view.graphics.childNodes[0];
        const existingHLines = view.graphics.querySelectorAll('.sc-line.sc-horizontal');
        const existingDots = view.graphics.querySelectorAll('circle.sc-highlight-dot');
        let minX = this._boxWidth;
        let minY = this._boxHeight;
        let maxX = 0;
        let maxY = 0;
        let hLinesCount = 0;
        for (let i = 0; i < contents.length; i++) {
            const [x, y] = contents[i].coordinates;
            let dot = existingDots[i];
            if (!dot) {
                dot = createSVG({name: 'circle', class: 'sc-highlight-dot'});
                view.graphics.append(dot);
            }
            dot.setAttribute('cx', x);
            dot.setAttribute('cy', y);
            if (x > maxX) {
                maxX = x;
            }
            if (x < minX) {
                minX = x;
            }
            if (y > maxY) {
                maxY = y;
            }
            if (y < minY) {
                minY = y;
            }
            if (Math.abs(x - centerX) > 1) {
                let horizLine = existingHLines[hLinesCount];
                if (!horizLine) {
                    horizLine = createSVG({name: 'path', class: ['sc-line', 'sc-horizontal']});
                    vertLine.after(horizLine);
                }
                horizLine.setAttribute(
                    'd', `M ${x}, ${y} L ${centerX}, ${Math.min(bottom, Math.max(y, top))}`);
                hLinesCount++;
            }
        }
        for (let i = hLinesCount; i < existingHLines.length; i++) {
            existingHLines[i].remove();
        }
        for (let i = contents.length; i < existingDots.length; i++) {
            existingDots[i].remove();
        }
        let vAlign, hAlign;
        if (state.positionCallback) {
            [vAlign, hAlign] = state.positionCallback({
                id: view.id,
                chart: this,
                minX,
                minY,
                maxX,
                maxY,
                contents,
            });
        } else {
            hAlign = state.hAlign === 'leftright' ?
                (centerX >= this._boxWidth * 0.5 ? 'left' : 'right') :
                state.hAlign;
            vAlign = state.vAlign;
        }
        vertLine.setAttribute('d', `M ${centerX}, ${bottom} V ${top}`);
        view.box.replaceChildren(...contents.map(x => x.element));
        view.positioner.dataset.hAlign = hAlign;
        view.positioner.dataset.vAlign = vAlign;
        const f = 1 / this.devicePixelRatio;
        const [offtX, offtY] = state.elOffset;
        view.positioner.style.setProperty('--x-left', `${minX * f + offtX}px`);
        view.positioner.style.setProperty('--x-right', `${maxX * f + offtX}px`);
        view.positioner.style.setProperty('--x-center', `${centerX * f + offtX}px`);
        view.positioner.style.setProperty('--y-center', `${centerY * f + offtY}px`);
        view.positioner.style.setProperty('--y-top', `${top * f + offtY}px`);
        view.positioner.style.setProperty('--y-bottom', `${bottom * f + offtY}px`);
        state.hasDrawn = true;
    }

    /**
     * Binary search for nearest data entry using an X coordinate
     *
     * @param {number} coord - X coord
     * @param {Array<DataEntry>} [data=this._renderData]
     * @returns {DataEntry}
     */
    findNearestFromXCoord(coord, data=this._renderData) {
        const index = this.findNearestIndexFromXCoord(coord, data);
        return index !== undefined ? data[index] : undefined;
    }

    /**
     * Binary search for nearest data entry using an X value
     *
     * @param {number} value - X value
     * @param {Array<DataEntry>} [data=this._renderData]
     * @returns {DataEntry}
     */
    findNearestFromXValue(value, data=this._renderData) {
        const index = this.findNearestIndexFromXValue(value, data);
        return index !== undefined ? data[index] : undefined;
    }

    /**
     * Binary search for nearest data index using an X coordinate
     *
     * @param {number} coord - X coord
     * @param {Array<DataEntry>} [data=this.normalizedData]
     * @returns {number}
     */
    findNearestIndexFromXCoord(coord, data=this.normalizedData) {
        return this.findNearestIndexFromXValue(this.xCoordToValue(coord), data);
    }

    /**
     * Binary search for nearest data index using an X value
     *
     * @param {number} value - X value
     * @param {Array<DataEntry>} [data=this.normalizedData]
     * @returns {number}
     */
    findNearestIndexFromXValue(value, data=this.normalizedData) {
        if (isNaN(value) || value === null || !data || !data.length) {
            return;
        }
        if (this.constructor.usesEntryWidths) {
            return this._findNearestIndexFromXValueWithWidth(value, data);
        } else {
            return this._findNearestIndexFromXValue(value, data);
        }
    }

    _findNearestIndexFromXValue(value, data) {
        const len = data.length;
        let left = 0;
        let right = len - 1;
        for (let i = (len * 0.5) | 0;; i = ((right - left) * 0.5 + left) | 0) {
            const x = data[i].x;
            if (x > value) {
                right = i;
            } else if (x < value) {
                left = i;
            } else {
                return i;
            }
            if (right - left <= 1) {
                const lDist = value - data[left].x;
                const rDist = data[right].x - value;
                return lDist < rDist ? left : right;
            }
        }
    }

    _findNearestIndexFromXValueWithWidth(value, data) {
        const len = data.length;
        let left = 0;
        let right = len - 1;
        for (let i = (len * 0.5) | 0;; i = ((right - left) * 0.5 + left) | 0) {
            const xCenter = data[i].x + data[i].width;
            if (xCenter > value) {
                right = i;
            } else if (xCenter < value) {
                left = i;
            } else {
                return i;
            }
            if (right - left <= 1) {
                const lDist = value - (data[left].x + data[left].width / 2);
                const rDist = (data[right].x + data[right].width / 2) - value;
                return lDist < rDist ? left : right;
            }
        }
    }

    /**
     * @param {object} options
     * @param {("data"|"visual")} [options.type="data"] - What coordinate scheme to use and how to keep this
     *                                                    zoom anchored when data is updated
     * @param {CoordRange} [options.xRange] - x axis coordinates (type=data only)
     * @param {CoordRange} [options.yRange] - y axis coordinates (type=data only)
     * @param {CoordTuple} [options.translate] - [x, y] coordinate offsets (type=visual only)
     * @param {number} [options.scale] - Scaling factor (type=visual only)
     */
    setZoom(options) {
        this._zoomState.rev++;
        if (!options || options.type === null) {
            this._zoomState.active = false;
            this._zoomState.type = null;
            this._zoomState.translate = this._zoomState.scale = null;
            this._zoomState.xRange = this._zoomState.yRange = null;
        } else {
            const {xRange, yRange, translate, scale, type='data'} = options;
            if (type === 'data') {
                this._zoomState.translate = this._zoomState.scale = null;
                this._zoomState.xRange = xRange ?? null;
                this._zoomState.yRange = yRange ?? null;
            } else if (type === 'visual') {
                this._zoomState.xRange = this._zoomState.yRange = null;
                this._zoomState.translate = translate ?? null;
                this._zoomState.scale = scale ?? null;
            } else {
                throw new TypeError("invalid zoom type");
            }
            this._zoomState.active = true;
            this._zoomState.type = type;
        }
        this.render();
        queueMicrotask(() => this.dispatchEvent(new CustomEvent('zoom', {
            detail: {
                ...this._zoomState,
                internal: !!options?._internal,
                chart: this,
            }
        })));
    }

    /**
     * @param {ChartData} [data]
     * @param {object} [options]
     */
    setData(data, options={}) {
        this.data = data;
        this.normalizedData = this.normalizeData(data);
        if (options.render !== false) {
            this.render(options);
        }
    }

    /**
     * @protected
     *
     * @param {ChartData} data
     * @returns {Array<DataEntry>}
     */
    normalizeData(data) {
        const norm = new Array(data.length);
        if (!data.length) {
            return norm;
        }
        if (Array.isArray(data[0])) {
            // [[x, y], [x1, y1], ...]
            for (let i = 0; i < data.length; i++) {
                norm[i] = {index: i, x: data[i][0] || 0, y: data[i][1] || 0};
            }
        } else if (typeof data[0] === 'object' && Object.getPrototypeOf(data[0]) === Object.prototype) {
            // [{x, y, ...}, {x, y, ...}, ...]
            for (let i = 0; i < data.length; i++) {
                const o = data[i];
                norm[i] = {...o, index: i, x: o.x || 0, y: o.y || 0};
            }
        } else {
            // [y, y1, ...]
            for (let i = 0; i < data.length; i++) {
                norm[i] = {index: i, x: i, y: data[i] || 0};
            }
        }
        return norm;
    }

    /**
     * Render the chart
     *
     * @param {object} [options]
     */
    render(options={}) {
        if (!this.el || !this._boxWidth || !this._boxHeight) {
            return;
        }
        if (!this.data || !this.data.length) {
            this.doReset();
            return;
        }
        options.disableAnimation ||= this.disableAnimation;
        const manifest = this.beforeRender(options);
        this._xMin = this.xMin;
        this._xMax = this.xMax;
        this._yMin = this.yMin;
        this._yMax = this.yMax;
        const zoomType = this._zoomState.active ? this._zoomState.type : undefined;
        if (zoomType === 'data') {
            this.applyDataZoom();
        }
        this.adjustScale(manifest);
        if (zoomType === 'visual') {
            this.applyVisualZoom();
        }
        this.doLayout(manifest, options);
        const axisSig = [
            this._xMin,
            this._xMax,
            this._yMin,
            this._yMax,
            this._plotWidth,
            this._plotHeight,
            this._zoomState.rev,
            this.xAxis.rotate,
            this.yAxis.rotate,
            this.xAxis.showFirst,
            this.yAxis.showFirst,
            this.xAxis.hideLast,
            this.yAxis.hideLast,
        ].join('-');
        if (this._lastAxisSig !== axisSig) {
            this._lastAxisSig = axisSig;
            if (this._xAxisEl) {
                this._drawXAxis();
            }
            if (this._yAxisEl) {
                this._drawYAxis();
            }
        }
        this.afterRender(manifest, options);
    }

    /**
     * @protected
     */
    applyDataZoom() {
        if (!this._zoomState.active || this._zoomState.type !== 'data') {
            throw new TypeError('data zoom not active');
        }
        if (this._zoomState.xRange) {
            this._xMin = this._zoomState.xRange[0];
            this._xMax = this._zoomState.xRange[1];
        }
        if (this._zoomState.yRange) {
            this._yMin = this._zoomState.yRange[0];
            this._yMax = this._zoomState.yRange[1];
        }
    }

    /**
     * @protected
     */
    applyVisualZoom() {
        if (!this._zoomState.active || this._zoomState.type !== 'visual') {
            throw new TypeError('visual zoom not active');
        }
        // Get offsets and size before transforms...
        const xOfft = this._zoomState.translate ? this.xCoordScale(this._zoomState.translate[0]) : 0;
        const yOfft = this._zoomState.translate ? this.yCoordScale(this._zoomState.translate[1]) : 0;
        if (this._zoomState.scale) {
            this._xMax = this._xMin + (this._xMax - this._xMin) / this._zoomState.scale[0];
            this._yMax = this._yMin + (this._yMax - this._yMin) / this._zoomState.scale[1];
        }
        this._xMin += xOfft;
        this._xMax += xOfft;
        this._yMin += yOfft;
        this._yMax += yOfft;
    }

    /**
     * Called before any visual reflow/painting
     *
     * @protected
     * @param {object} [options] - Render options
     */
    beforeRender(options) {
        let data = this.normalizedData;
        if (this._zoomState.active && this._zoomState.type === 'data' && this._zoomState.xRange) {
            const [start, end] = this._zoomState.xRange;
            const dataPad = 2; // allow some basic regression analysis on data slice.
            const startIndex = this.findNearestIndexFromXValue(start, data) - 1 - dataPad;
            const endIndex = this.findNearestIndexFromXValue(end, data) + 1 + dataPad;
            if (startIndex != null && endIndex != null) {
                data = data.slice(Math.max(0, startIndex), Math.max(0, endIndex) + 1);
            }
        }
        const resampling = this.resampleThreshold ?? data.length > this._plotWidth * this.resampleThreshold;
        if (resampling) {
            data = resample(data, this._plotWidth * this.resampleTarget | 0);
        }
        this._renderData = data;
        return {data, resampling};
    }

    /**
     * @protected
     */
    adjustScale({data}) {
        if (this._yMin == null || this._yMax == null) {
            let min = Infinity;
            let max = -Infinity;
            for (let i = 0; i < data.length; i++) {
                const v = data[i].y;
                if (v < min) {
                    min = v;
                }
                if (v > max) {
                    max = v;
                }
            }
            if (this._yMin == null) {
                this._yMin = min;
            }
            if (this._yMax == null) {
                this._yMax = max;
            }
        }
    }

    /**
     * @protected
     * @abstract
     */
    doLayout(manifest, options) {
        throw new Error("subclass impl required");
    }

    /**
     * @protected
     */
    afterRender(manifest, options) {
        this.updateVisibleTooltips();
    }

    /**
     * @param {number} value
     * @returns {number}
     */
    xValueScale(value) {
        return value * (this._plotWidth / (this._xMax - this._xMin));
    }

    /**
     * @param {number} value
     * @returns {number}
     */
    yValueScale(value) {
        return value * (this._plotHeight / (this._yMax - this._yMin));
    }

    /**
     * @param {number} value
     * @returns {number}
     */
    xValueToCoord(value) {
        return (value - this._xMin) * (this._plotWidth / (this._xMax - this._xMin)) + this._plotBox[3];
    }

    /**
     * @param {number} value
     * @returns {number}
     */
    yValueToCoord(value) {
        return this._plotBox[2] - ((value - this._yMin) * (this._plotHeight / (this._yMax - this._yMin)));
    }

    /**
     * @param {number} coord
     * @returns {number}
     */
    xCoordScale(coord) {
        return coord / (this._plotWidth / (this._xMax - this._xMin));
    }

    /**
     * @param {number} coord
     * @returns {number}
     */
    yCoordScale(coord) {
        return coord / (this._plotHeight / (this._yMax - this._yMin));
    }

    /**
     * @param {number} coord
     * @returns {number}
     */
    xCoordToValue(coord) {
        return (coord - this._plotBox[3]) / (this._plotWidth / (this._xMax - this._xMin)) + this._xMin;
    }

    /**
     * @param {number} coord
     * @returns {number}
     */
    yCoordToValue(coord) {
        return (this._plotBox[2] - coord) / (this._plotHeight / (this._yMax - this._yMin)) + this._yMin;
    }

    /**
     * Clear this charts data and rendering
     */
    reset() {
        if (this.data) {
            this.data.length = 0;
        }
        this._renderData = null;
        this._lastAxisSig = null;
        this.doReset();
    }

    /**
     * @protected
     * @abstract
     */
    doReset() {}

    /**
     * Create an SVG or CSS path
     *
     * @param {Array<CoordTuple>} coords
     * @param {object} [options]
     * @param {boolean} [options.css] - CSS compatible output
     * @param {boolean} [options.closed] - Close the Path so it can be filled
     */
    makePath(coords, {css, closed}={}) {
        if (!coords.length) {
            return '';
        }
        let path = closed ?
            `M ${coords[0][0]},${this._plotBox[2]} V ${coords[0][1]}` :
            `M ${coords[0][0]},${coords[0][1]}`;
        for (let i = 1; i < coords.length; i++) {
            path += ` L ${coords[i][0]},${coords[i][1]}`;
        }
        if (closed) {
            path += ` V ${this._plotBox[2]} Z`;
        }
        return css ? `path('${path}')` : path;
    }
}
