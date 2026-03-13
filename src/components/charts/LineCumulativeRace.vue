<script setup>
import { computed } from 'vue'
import LineChart from './LineChart.vue'

const props = defineProps({
  labels: { type: Array, required: true },
  youValues: { type: Array, required: true }, // user_cumulative
  marganaValues: { type: Array, required: true }, // margana_cumulative
  title: { type: String, default: 'Cumulative score race' },
  youLabel: { type: String, default: 'You' },
  marganaLabel: { type: String, default: 'Margana' },
  singleLabel: { type: Boolean, default: false },
  hideFutureLabels: { type: Boolean, default: true },
  beginAtZero: { type: Boolean, default: true },
  grace: { type: String, default: '0%' },
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
      label: props.marganaLabel,
      data: (props.marganaValues || []).map(toNumOrNaN),
      borderColor: '#3A9873',
      backgroundColor: '#3A9873',
      pointBackgroundColor: '#3A9873',

      pointBorderColor: 'white',
      borderWidth: 6,
      pointRadius: 5,
      pointHoverRadius: 7,
      tension: 0,
      spanGaps: false,
      order: 2,
      clip: false,
    },
    {
      label: props.youLabel,
      data: (props.youValues || []).map(toNumOrNaN),
      // Match "You" styling from You vs Margana chart: violet with subtle fill and points
      borderColor: '#F97316',
      backgroundColor: '#F97316', // solid legend box + subtle area fill
      pointBackgroundColor: '#F97316',
      pointBorderColor: 'white',
      pointRadius: 5,
      pointHoverRadius: 7,
      borderWidth: 6,
      tension: 0,
      spanGaps: false,
      order: 1,
      clip: false,
    },
  ],
}))

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { intersect: false, mode: 'index' },
  layout: {
    padding: {
      bottom: 8
    }
  },
  plugins: {
    legend: { display: true,
      labels: {
        color: '#e5e7eb',
        font: { size: 12 },
        boxWidth: 15,
        boxHeight: 2,
        padding: 10
      },
      align: 'end'
    },
    title: {
      display: true,
      text: props.title,
      color: '#e5e7eb',
      align: 'start',
      font: { size: 15, weight: '700' } },
    tooltip: {
      enabled: false
    },
    // Custom plugin to draw labels on data points
    datalabels: {
      color: '#e5e7eb',
      font: { size: 16, weight: '700' },
      formatter: (v) => (Number.isFinite(v) && v > 0 ? String(v) : '')
    }
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { color: '#c7d2fe', padding: 8 },
      border: { display: false },
    },
    y: {
      beginAtZero: props.beginAtZero,
      grace: props.grace,
      ticks: { display: false },
      grid: { color: 'rgba(255,255,255,0.08)' },
      border: { display: false },
    },
  },
}))

// Simple inline plugin to render data labels since we don't have chartjs-plugin-datalabels
const dataLabelsPlugin = {
  id: 'dataLabelsPlugin',
  afterDatasetsDraw(chart, args, options) {
    const { ctx } = chart
    chart.data.datasets.forEach((dataset, i) => {
      const meta = chart.getDatasetMeta(i)
      if (meta.hidden) return

      meta.data.forEach((element, index) => {
        const data = dataset.data[index]
        if (data == null || Number.isNaN(data)) return

        // Per requirement: if singleLabel is true, only show target line label on Thursday (index 3)
        // Others (like "You") show all data points
        const isTargetLine = dataset.label === props.marganaLabel
        const isFuture = props.days && props.days[index] && props.today && props.days[index] > props.today

        // Do not show labels for future days if requested
        if (props.hideFutureLabels && isFuture) return

        if (props.singleLabel && isTargetLine && index !== 3) return

        const label = options.formatter ? options.formatter(data) : String(data)
        if (!label) return

        ctx.font = `${options.font?.weight || 'normal'} ${options.font?.size || 12}px sans-serif`
        const textWidth = ctx.measureText(label).width
        const textHeight = options.font?.size || 12
        const paddingH = 8
        const paddingV = 4
        const rectWidth = textWidth + paddingH * 2
        const rectHeight = textHeight + paddingV * 2
        
        // Calculate raw position with vertical and horizontal offset
        const xOffset = 0 // Centered by default
        let x = element.x + xOffset - rectWidth / 2
        let y = element.y - rectHeight - 10

        // Clamp x to stay within chart area (with small 2px margin)
        const margin = 2
        if (x < margin) x = margin
        if (x + rectWidth > chart.width - margin) x = chart.width - rectWidth - margin

        // Draw tag background
        ctx.fillStyle = dataset.backgroundColor || 'rgba(30, 41, 59, 0.8)'
        ctx.beginPath()
        const radius = 4
        ctx.roundRect(x, y, rectWidth, rectHeight, radius)
        ctx.fill()
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
        ctx.lineWidth = 1
        ctx.stroke()

        // Draw text - centered relative to the CLAMPED rectangle
        ctx.fillStyle = options.color || '#fff'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(label, x + rectWidth / 2, y + rectHeight / 2 + 0.5)
      })
    })
  }
}
</script>

<template>
  <LineChart :data="chartData" :options="chartOptions" :plugins="[dataLabelsPlugin]" />
</template>

<style scoped>
</style>
