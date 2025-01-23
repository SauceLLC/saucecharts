import * as sc from '../src/index.mjs';


function randomColor() {
    return '#' + [
        (Math.random() * 0x100 | 0).toString(16).padStart(2, '0'),
        (Math.random() * 0x100 | 0).toString(16).padStart(2, '0'),
        (Math.random() * 0x100 | 0).toString(16).padStart(2, '0'),
        (Math.random() * 0x100 | 0).toString(16).padStart(2, '0'),
    ].join('');
}


function ts() {
    //return Date.now();
    return 1e1 + Math.round(performance.now());
}


let paused = false;
const tests = [1, 2, 3, 4, 5, 6, 7, 8];
//const tests = [1];
const speed = 2000;
const maxSize = 10;
let sinFactor = speed / Number(document.querySelector('#freq').value);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const commonOptions = {
    padding: [20, 5, 20, 40],
    tooltipPadding: [20, 20],
};

const _setInterval = setInterval;
window.setInterval = (fn, timeout) => {
    fn();
    return _setInterval(fn, timeout);
};

document.querySelector('#freq').addEventListener('input', ev => {
    const f = Number(ev.currentTarget.value);
    console.log('freq', f, maxSize / f);
    sinFactor = speed / f;
});

let dir = 1;
let steps = 0;
/*setInterval(() => {
    if ((steps++) > 2) {
        dir = -dir;
        steps = 0;
    }
    maxSize += dir;
}, speed * 2);*/

if (tests.includes(1)) {
    const data = [];
    const sl = new sc.BarChart({
        ...commonOptions,
        el: document.querySelector(".graph.i1"),
        title: 'ltr (below tp)',
        tooltipPosition: 'below',
    });
    self.chart1 = sl;
    setInterval(() => {
        if (paused) return;
        data.push([5, Math.sin(ts() / sinFactor)]);
        while (data.length > maxSize) {
            data.shift();
        }
        sl.setData(data);
    }, speed);
}


if (tests.includes(2)) {
    const data = [];
    const sl = new sc.BarChart({
        ...commonOptions,
        el: document.querySelector(".graph.i2"),
        title: 'ltr, 3 points per interval (left tp)',
        tooltipPosition: 'above',
    });
    self.chart2 = sl;
    setInterval(async () => {
        if (paused) return;
        data.push({color: randomColor(), width: 1, y: Math.sin(ts() / sinFactor)});
        await sleep(speed / 3);
        data.push({color: 'hsl(100, 50, 50 / 2)', width: 0.5, y: Math.sin(ts() / sinFactor)});
        await sleep(speed / 3);
        data.push({color: randomColor(), width: 1, y: Math.sin(ts() / sinFactor)});
        while (data.length > maxSize * 3) {
            data.shift();
        }
        sl.setData(data);
    }, speed);
}


if (tests.includes(3)) {
    const data = [];
    const sl = new sc.BarChart({
        ...commonOptions,
        el: document.querySelector(".graph.i3"),
        title: 'rtl (right tp)',
        tooltipPosition: 'right',
    });
    self.chart3 = sl;
    setInterval(() => {
        if (paused) return;
        data.unshift(Math.sin(ts() / sinFactor));
        while (data.length > maxSize) {
            data.pop();
        }
        sl.setData(data);
    }, speed);
}


if (tests.includes(4)) {
    const data = [];
    const sl = new sc.BarChart({
        ...commonOptions,
        el: document.querySelector(".graph.i4"),
        title: 'rtl, 2 points per interval (leftright top tp)',
        tooltipPosition: 'leftright top',
    });
    setInterval(async () => {
        if (paused) return;
        data.unshift(Math.sin(ts() / sinFactor));
        await sleep(speed / 2);
        data.unshift(Math.sin(ts() / sinFactor));
        while (data.length > maxSize * 2) {
            data.pop();
        }
        sl.setData(data);
    }, speed);
}


if (tests.includes(5)) {
    const data = new Array(maxSize);
    const sl = new sc.BarChart({
        ...commonOptions,
        el: document.querySelector(".graph.i5"),
        title: 'random, same size (leftright bottom tp)',
        tooltipPosition: 'leftright bottom',
    });
    setInterval(() => {
        if (paused) return;
        for (let i = 0; i < data.length; i++) {
            data[i] = Math.random();
        }
        sl.setData(data);
    }, speed);
}


if (tests.includes(6)) {
    const data = new Array(maxSize);
    const sl = new sc.BarChart({
        ...commonOptions,
        el: document.querySelector(".graph.i6"),
        title: 'random, random size (middle center tp)',
        tooltipPosition: 'middle center',
    });
    setInterval(() => {
        if (paused) return;
        data.length = Math.random() * maxSize * 2 | 0;
        for (let i = 0; i < data.length; i++) {
            data[i] = Math.random();
        }
        sl.setData(data);
    }, speed);
}

if (tests.includes(7)) {
    const data1 = [];
    const data2 = [];
    const data3 = [];
    const data4 = [];
    const padding = [10, 10, 10, 10];
    const sharedOptions = {
        xAxis: {disabled: true},
        yAxis: {disabled: true},
    };

    const sl1 = new sc.BarChart({
        ...commonOptions,
        ...sharedOptions,
        el: document.querySelector(".graph.i7"),
        padding,
        title: 'Multiple graphs (top tp)',
        tooltipPosition: 'top',
    });
    const sl2 = new sc.BarChart({
        ...commonOptions,
        ...sharedOptions,
        el: sl1.el,
        merge: true,
        padding: [sl1.padding[0] + 30, ...padding.slice(1)],
    });
    const sl3 = new sc.BarChart({
        ...commonOptions,
        ...sharedOptions,
        el: sl1.el,
        merge: true,
        padding: [sl2.padding[0] + 30, ...padding.slice(1)],
    });
    const sl4 = new sc.BarChart({
        ...commonOptions,
        ...sharedOptions,
        el: sl1.el,
        merge: true,
        padding: [sl3.padding[0] + 30, ...padding.slice(1)],
    });

    setInterval(() => {
        if (paused) return;
        data1.push([1, Math.sin(ts() / sinFactor)]);
        while (data1.length > maxSize) {
            data1.shift();
        }
        sl1.setData(data1);

        data2.unshift([1, Math.sin(ts() / sinFactor)]);
        while (data2.length > maxSize) {
            data2.pop();
        }
        sl2.setData(data2);

        data3.push([1, Math.cos(ts() / sinFactor)]);
        while (data3.length > maxSize) {
            data3.shift();
        }
        sl3.setData(data3);

        data4.unshift([1, Math.cos(ts() / sinFactor)]);
        while (data4.length > maxSize) {
            data4.pop();
        }
        sl4.setData(data4);
    }, speed);
}


if (tests.includes(8)) {
    const size = 100;
    let i = size;
    const data = Array.from(new Array(size)).map((x, i) => Math.sin(i / (size / 20)));
    const sl = new sc.BarChart({
        ...commonOptions,
        el: document.querySelector(".graph.i8"),
        title: 'large-data (right bottom tp)',
        tooltipPosition: 'right bottom',
        barSpacing: 0,
    });
    sl.setData(data);
    let showingTooltip;
    setInterval(() => {
        if (paused) return;
        i++;
        data.push(Math.sin(i / (size / 20)));
        while (data.length > size) {
            data.shift();
        }
        sl.setData(data);
        if (Math.random() > 0.80) {
            sl.setTooltipPosition({index: Math.random() * size | 0});
            if (!showingTooltip) {
                sl.showTooltip();
                showingTooltip = true;
            }
        }
        if (Math.random() > 0.95) {
            console.log("hide");
            sl.hideTooltip();
            showingTooltip = false;
        }
    }, speed);
}


document.querySelector('#playpause').addEventListener('click', () => {
    paused = !paused;
});
