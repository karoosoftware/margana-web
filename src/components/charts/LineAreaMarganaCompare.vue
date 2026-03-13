<script setup>
import { computed } from 'vue'
import LineChart from './LineChart.vue'

const props = defineProps({
  labels: { type: Array, required: true },
  youValues: { type: Array, required: true }, // current week user_cumulative
  marganaValues: { type: Array, required: true },  // margana_cumulative
  title: { type: String, default: 'You vs Margana' },
  youLabel: { type: String, default: 'You' },
  marganaLabel: { type: String, default: 'Margana' },
  beginAtZero: { type: Boolean, default: true },
  grace: { type: String, default: '5%' },
  days: { type: Array, default: () => [] },
  today: { type: String, default: '' },
})

function toNumOrNaN(v) {
  if (v == null) return NaN
  const n = Number(v)
  return Number.isFinite(n) ? n : NaN
}

const chartData = computed(() => ({
  labels: props.labels,
  datasets: [
    {
      label: props.youLabel,
      data: (props.youValues || []).map(toNumOrNaN),
      borderColor: '#a855f7',
      backgroundColor: '#a855f7',
      pointBackgroundColor: '#a855f7',
      pointBorderColor: 'white',
      pointRadius: 10,
      pointHoverRadius: 0,
      borderWidth: 5,
      tension: 0.1,
      spanGaps: false,
      order: 1,
      clip: false,
    },
    {
      label: props.marganaLabel,
      data: (props.marganaValues || []).map(toNumOrNaN),
      borderColor: 'rgba(99, 102, 241, 0.5)',
      backgroundColor: 'rgba(99, 102, 241, 0.2)',
      fill: true,
      pointRadius: 0,
      borderWidth: 2,
      tension: 0.4,
      spanGaps: true,
      order: 2,
    },
  ],
}))

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  events: [],
  interaction: { intersect: false, mode: 'index' },
  layout: {
    padding: {
      top: 40,
      bottom: 10
    }
  },
  plugins: {
    legend: {
      display: false,
      position: 'top',
      align: 'end',
      labels: {
        color: '#c7d2fe',
        boxWidth: 12,
        boxHeight: 12,
        usePointStyle: false,
        pointStyle: 'circle',
        padding: 15,
        font: { size: 11, weight: '600' }
      }
    },
    title: { display: false },
    tooltip: { enabled: false },
    datalabels: {
      color: '#e5e7eb',
      font: { size: 16, weight: '700' },
      formatter: (v) => (Number.isFinite(v) && v > 0 ? String(v) : '')
    }
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { color: '#c7d2fe', padding: 15 },
      border: { display: false },
    },
    y: {
      beginAtZero: props.beginAtZero,
      grace: props.grace,
      ticks: { display: false },
      grid: { display: false },
      border: { display: false },
    },
  },
}))

// Custom plugin to draw labels on data points (only for the "You" dataset)
const dataLabelsPlugin = {
  id: 'datalabels',
  afterDatasetsDraw(chart, args, options) {
    const { ctx } = chart
    const i = 0 // "You" dataset
    const dataset = chart.data.datasets[i]
    if (!dataset) return
    const meta = chart.getDatasetMeta(i)
    if (meta.hidden) return

    meta.data.forEach((element, index) => {
      const data = dataset.data[index]
      if (data == null || Number.isNaN(data)) return

      const isFuture = props.days && props.days[index] && props.today && props.days[index] > props.today
      if (isFuture) return

      const label = options.formatter ? options.formatter(data) : String(data)
      if (!label) return

      ctx.font = `${options.font?.weight || 'normal'} ${options.font?.size || 12}px sans-serif`
      const textWidth = ctx.measureText(label).width
      
      let x = element.x
      let y = element.y - 30

      const margin = 4
      const halfWidth = textWidth / 2
      if (x - halfWidth < margin) x = margin + halfWidth
      if (x + halfWidth > chart.width - margin) x = chart.width - halfWidth - margin

      ctx.fillStyle = options.color || '#fff'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(label, x, y)
    })
  }
}
</script>

<template>
  <div class="flex flex-col">
    <h3 v-if="props.title" class="text-[#e5e7eb] font-bold text-[15px]">
      {{ props.title }}
    </h3>
    <LineChart :data="chartData" :options="chartOptions" :plugins="[dataLabelsPlugin]" />
  </div>
</template>
