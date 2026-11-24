import './style.css';
import * as echarts from 'echarts';
import { initScene, ZONES } from './scene.js';

// ---------- 3D 场景 ----------
const world = initScene(document.getElementById('scene'), document.getElementById('tooltip'));

document.querySelectorAll('.view-btn[data-view]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.view-btn[data-view]').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    world.setView(btn.dataset.view);
  });
});
let rotating = false;
document.getElementById('btn-rotate').addEventListener('click', (e) => {
  rotating = !rotating;
  e.currentTarget.classList.toggle('active', rotating);
  world.setAutoRotate(rotating);
});

// ---------- 顶部时间 ----------
function tick() {
  const now = new Date();
  document.getElementById('clock').textContent = now.toLocaleTimeString('zh-CN', { hour12: false });
  document.getElementById('date').textContent = now.toLocaleDateString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
  });
}
tick();
setInterval(tick, 1000);

// ---------- KPI 数字（模拟数据，数字滚动动画） ----------
const kpi = { in: 12860, out: 11342, stock: 286450, rate: 78.6 };
function animateNumber(el, to, suffix = '', digits = 0) {
  const from = parseFloat(el.dataset.v || 0);
  const start = performance.now();
  function step(now) {
    const k = Math.min((now - start) / 800, 1);
    const v = from + (to - from) * k;
    el.textContent = v.toLocaleString('zh-CN', { maximumFractionDigits: digits, minimumFractionDigits: digits }) + suffix;
    if (k < 1) requestAnimationFrame(step);
  }
  el.dataset.v = to;
  requestAnimationFrame(step);
}
function renderKpi() {
  animateNumber(document.getElementById('kpi-in'), kpi.in);
  animateNumber(document.getElementById('kpi-out'), kpi.out);
  animateNumber(document.getElementById('kpi-stock'), kpi.stock);
  animateNumber(document.getElementById('kpi-rate'), kpi.rate, '%', 1);
}
renderKpi();

// ---------- 图表（ECharts） ----------
const BLUE = '#1677ff';
const CYAN = '#36cfff';
const axisStyle = {
  axisLine: { lineStyle: { color: '#a9cdfa' } },
  axisLabel: { color: '#5a7a9a', fontSize: 11 },
  splitLine: { lineStyle: { color: 'rgba(22,119,255,0.1)' } },
};
const charts = [];
function makeChart(id, option) {
  const c = echarts.init(document.getElementById(id));
  c.setOption(option);
  charts.push(c);
  return c;
}

const days = [...Array(7)].map((_, i) => {
  const d = new Date(Date.now() - (6 - i) * 86400000);
  return `${d.getMonth() + 1}/${d.getDate()}`;
});
makeChart('chart-trend', {
  grid: { left: 40, right: 10, top: 28, bottom: 22 },
  tooltip: { trigger: 'axis' },
  legend: { data: ['入库', '出库'], right: 0, top: 0, textStyle: { color: '#5a7a9a', fontSize: 11 }, itemHeight: 8 },
  xAxis: { type: 'category', data: days, boundaryGap: false, ...axisStyle },
  yAxis: { type: 'value', ...axisStyle },
  series: [
    {
      name: '入库', type: 'line', smooth: true, symbol: 'circle', color: BLUE,
      data: [10200, 11800, 9800, 12500, 13100, 11900, 12860],
      areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: 'rgba(22,119,255,0.4)' }, { offset: 1, color: 'rgba(22,119,255,0)' }]) },
    },
    {
      name: '出库', type: 'line', smooth: true, symbol: 'circle', color: CYAN,
      data: [9600, 10900, 10400, 11800, 12200, 12100, 11342],
      areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: 'rgba(54,207,255,0.35)' }, { offset: 1, color: 'rgba(54,207,255,0)' }]) },
    },
  ],
});

makeChart('chart-category', {
  tooltip: { trigger: 'item', formatter: '{b}：{d}%' },
  legend: { orient: 'vertical', right: 0, top: 'center', textStyle: { color: '#5a7a9a', fontSize: 11 }, itemWidth: 10, itemHeight: 10 },
  color: ['#0a5bd8', '#1677ff', '#4fa3ff', '#36cfff', '#a9cdfa'],
  series: [{
    type: 'pie', radius: ['45%', '72%'], center: ['35%', '50%'],
    itemStyle: { borderColor: '#fff', borderWidth: 2 },
    label: { show: false },
    data: [
      { name: '电子产品', value: 28 }, { name: '日用百货', value: 24 },
      { name: '食品饮料', value: 20 }, { name: '服装鞋帽', value: 16 }, { name: '大件家电', value: 12 },
    ],
  }],
});

const zoneChart = makeChart('chart-zone', {
  grid: { left: 70, right: 36, top: 6, bottom: 6 },
  xAxis: { type: 'value', max: 100, show: false },
  yAxis: {
    type: 'category', inverse: true, data: ZONES.map((z) => z.name.split(' · ')[0]),
    axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#0b2a4a' },
  },
  series: [{
    type: 'bar', barWidth: 10, showBackground: true,
    backgroundStyle: { color: 'rgba(22,119,255,0.08)', borderRadius: 5 },
    itemStyle: { borderRadius: 5, color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
      { offset: 0, color: BLUE }, { offset: 1, color: CYAN }]) },
    label: { show: true, position: 'right', formatter: '{c}%', color: BLUE },
    data: [86, 72, 91, 65, 78],
  }],
});

const devices = [
  { name: 'AGV 小车', total: 5, run: 4 },
  { name: '堆垛机', total: 6, run: 5 },
  { name: '分拣线', total: 3, run: 3 },
  { name: '传送带', total: 4, run: 3 },
];
const runTotal = devices.reduce((s, d) => s + d.run, 0);
const allTotal = devices.reduce((s, d) => s + d.total, 0);
makeChart('chart-device', {
  series: [{
    type: 'gauge', startAngle: 210, endAngle: -30, radius: '95%', center: ['50%', '60%'],
    min: 0, max: 100,
    progress: { show: true, width: 10, itemStyle: { color: BLUE } },
    axisLine: { lineStyle: { width: 10, color: [[1, 'rgba(22,119,255,0.12)']] } },
    axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false }, pointer: { show: false },
    title: { offsetCenter: [0, '40%'], color: '#5a7a9a', fontSize: 12 },
    detail: { offsetCenter: [0, '-5%'], formatter: '{value}%', color: BLUE, fontSize: 22, fontWeight: 'bold' },
    data: [{ value: Math.round((runTotal / allTotal) * 100), name: '设备在线率' }],
  }],
});
document.getElementById('device-list').innerHTML = devices.map((d) => {
  const cls = d.run === d.total ? 'run' : 'warn';
  return `<li><span><i class="dot ${cls}"></i>${d.name}</span><span>运行 ${d.run} / ${d.total}</span></li>`;
}).join('');

addEventListener('resize', () => charts.forEach((c) => c.resize()));

// ---------- 实时任务流（模拟） ----------
const taskList = document.getElementById('task-list');
const TYPES = ['入库', '出库', '移库', '盘点'];
function pushTask() {
  const zone = 'ABCDE'[Math.floor(Math.random() * 5)];
  const type = TYPES[Math.floor(Math.random() * TYPES.length)];
  const no = 'T' + String(Math.floor(Math.random() * 1e6)).padStart(6, '0');
  const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  const li = document.createElement('li');
  li.innerHTML = `<span><span class="type">${type}</span>${no} · ${zone} 区</span><time>${time}</time>`;
  taskList.prepend(li);
  while (taskList.children.length > 6) taskList.lastChild.remove();
}
for (let i = 0; i < 6; i++) pushTask();
setInterval(pushTask, 2500);

// 每隔几秒随机刷新数据，模拟实时上报
setInterval(() => {
  const inc = Math.floor(Math.random() * 30);
  const dec = Math.floor(Math.random() * 25);
  kpi.in += inc;
  kpi.out += dec;
  kpi.stock += inc - dec;
  kpi.rate = Math.min(99, Math.max(60, kpi.rate + (Math.random() - 0.5)));
  renderKpi();
  zoneChart.setOption({
    series: [{ data: [86, 72, 91, 65, 78].map((v) => Math.min(99, v + Math.round((Math.random() - 0.5) * 6))) }],
  });
}, 5000);
