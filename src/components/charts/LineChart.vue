<script setup>
// Generic, reusable Line chart wrapper for vue-chartjs v5 + Chart.js v4
// Registers only the elements we need and exposes a lightweight API.
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  Title, Tooltip, Legend,
  LineElement, PointElement, Filler,
  CategoryScale, LinearScale,
} from 'chart.js'

// Idempotent registration (Chart.js ignores duplicate registrations)
ChartJS.register(Title, Tooltip, Legend, LineElement, PointElement, Filler, CategoryScale, LinearScale)

const props = defineProps({
  // Full Chart.js data object
  data: { type: Object, required: true },
  // Full Chart.js options object
  options: { type: Object, required: false, default: () => ({}) },
  // Optional explicit height in pixels (kept for back-compat)
  height: { type: [Number, String], default: 150 },
  // Mobile-first responsive container classes (Tailwind). If provided, overrides inline height style.
  // Optional plugins
  plugins: { type: Array, required: false, default: () => [] },
})
</script>

<template>
  <div
    :class="props.containerClass"
    :style="props.containerClass ? undefined : { height: typeof height === 'number' ? height + 'px' : String(height) }"
  >
    <Line :data="props.data" :options="props.options" :plugins="props.plugins" />
  </div>
  
</template>

<style scoped>
/* Wrapper is size‑controlled by the parent via height prop or container styles */
</style>
