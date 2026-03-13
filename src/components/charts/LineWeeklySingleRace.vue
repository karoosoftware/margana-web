<script setup>
import { computed } from 'vue'
import LineChart from './LineChart.vue'

const props = defineProps({
  labels: { type: Array, required: true },
  youValues: { type: Array, required: true }, // user_cumulative
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
      label: props.youLabel,
      data: (props.youValues || []).map(toNumOrNaN),
      // Dark purple styling for single race
      borderColor: '#a855f7',
      backgroundColor: '#a855f7', // solid legend box + data labels background
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
    legend: { display: false },
    title: {
      display: false
    },
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

// Simple inline plugin to render data labels since we don't have chartjs-plugin-datalabels
const dataLabelsPlugin = {
  id: 'datalabels',
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
        const isFuture = props.days && props.days[index] && props.today && props.days[index] > props.today

        // Do not show labels for future days if requested
        if (props.hideFutureLabels && isFuture) return

        const label = options.formatter ? options.formatter(data) : String(data)
        if (!label) return

        ctx.font = `${options.font?.weight || 'normal'} ${options.font?.size || 12}px 'Poppins', sans-serif`
        const textWidth = ctx.measureText(label).width
        
        // Calculate raw position with vertical offset to stay above the point
        let x = element.x
        let y = element.y - 30

        // Clamp x to stay within chart area
        const margin = 4
        const halfWidth = textWidth / 2
        if (x - halfWidth < margin) x = margin + halfWidth
        if (x + halfWidth > chart.width - margin) x = chart.width - halfWidth - margin

        // Draw text
        ctx.fillStyle = options.color || '#fff'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(label, x, y)
      })
    })
  }
}
</script>

<template>
  <div class="flex flex-col">
    <h3 v-if="props.title" class="text-indigo-100/80 font-medium text-base mb-4">
      {{ props.title }}
    </h3>
    <LineChart :data="chartData" :options="chartOptions" :plugins="[dataLabelsPlugin]" />
  </div>
</template>

<style scoped>
</style>
