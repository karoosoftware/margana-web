<script setup>
import { computed } from 'vue'
import BarChart from './BarChart.vue'

const props = defineProps({
  labels: { type: Array, required: true },
  youValues: { type: Array, required: true },
  marganaValues: { type: Array, required: true },
  title: { type: String, default: 'Daily scores' },
  youLabel: { type: String, default: 'You' },
  marganaLabel: { type: String, default: 'Margana' },
  beginAtZero: { type: Boolean, default: true },
  grace: { type: String, default: '0%' },
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
      backgroundColor: '#3A9873', // violet-500
      borderColor: '#3A9873',
      borderWidth: 1,
      borderRadius: { topLeft: 10, topRight: 10 },
      order: 1,
    },
    {
      label: props.youLabel,
      data: (props.youValues || []).map(toNumOrNaN),
      backgroundColor: '#F97316', // amber-500
      borderColor: '#F97316',
      borderWidth: 1,
      borderRadius: { topLeft: 10, topRight: 10 },
      order: 2,
    },
  ],
}))

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { intersect: true, mode: 'index' },
  plugins: {
    legend: { display: true,
      labels: {
        color: '#e5e7eb',
        font: { size: 12 },
        boxWidth: 15,
        boxHeight: 10,
        padding: 20
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
    // Custom plugin to draw labels on bars
    datalabels: {
      color: '#e5e7eb',
      font: { size: 16, weight: '700' },
      formatter: (v) => (Number.isFinite(v) && v > 0 ? String(v) : '')
    }
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { color: '#c7d2fe' },
      border: { display: false },
      stacked: false,
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

        const label = options.formatter ? options.formatter(data) : String(data)
        if (!label) return

        ctx.font = `${options.font?.weight || 'normal'} ${options.font?.size || 12}px sans-serif`
        const textWidth = ctx.measureText(label).width
        const textHeight = options.font?.size || 12
        const paddingH = 8
        const paddingV = 4
        const rectWidth = textWidth + paddingH * 2
        const rectHeight = textHeight + paddingV * 2
        
        // Calculate raw position
        let x = element.x - rectWidth / 2
        const y = element.y - rectHeight - 10 // Position above the bar

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
  <BarChart :data="chartData" :options="chartOptions" :plugins="[dataLabelsPlugin]" />
</template>

<style scoped>
</style>
