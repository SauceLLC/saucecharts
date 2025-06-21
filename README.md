saucecharts
========
Simple, modern, web chart library

[![Docs](https://img.shields.io/badge/docs-api-lightgrey.svg)](https://saucellc.github.io/saucecharts)

 * Charts:
    * Line Chart
    * Bar Chart
 * Renders to SVG
 * Dynamic resizing and placement in flexible DOM containers
 * CSS transitions
 * CSS styling and customization (devicePixelRatio aware)
 * High performance data updating
 * Large dataset support (lttb resampling)
 * Brushing and Zooming by data range or visual ranges
 * Customizable HTML tooltips


Compatibility
--------
 * Chromium and Firefox: Fully supported
 * Safari (webkit): limited animations (as of 05-2025)
 

Examples
--------
Simple Line Chart
```javascript
import {LineChart} from '../src/index.mjs';
const sl = new LineChart({
    el: document.body,
    padding: [10, 10, 20, 40],
});
sl.setData([0,10,20,10,0,-10,-20,-10,0,10,20,10,0]);
```
[Try it](examples/simple-line.html)


Simple Bar Chart
```javascript
import {BarChart} from '../src/index.mjs';
const sl = new BarChart({
    el: document.body,
    padding: [10, 10, 20, 40],
});
sl.setData([0,10,20,10,0,-10,-20,-10,0,10,20,10,0]);
```
[Try it](examples/simple-bar.html)
