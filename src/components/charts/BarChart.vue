<script setup>
// Generic, reusable Bar chart wrapper for vue-chartjs v5 + Chart.js v4
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  Title, Tooltip, Legend,
  BarElement,
  CategoryScale, LinearScale,
} from 'chart.js'

// Idempotent registration
ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)

const props = defineProps({
  data: { type: Object, required: true },
  options: { type: Object, default: () => ({}) },
  // Optional explicit height (back-compat)
  height: { type: [Number, String], default: 220 },
  // Mobile-first responsive container classes (Tailwind). If provided, overrides inline height style.
  containerClass: {
    type: String,
    default:
      'w-full min-h-[160px] h-48 sm:h-56 md:h-64 lg:h-72 max-h-[70vh] md:max-h-none',
  },
  plugins: { type: Array, required: false, default: () => [] },
})
</script>

<template>
  <div
    :class="props.containerClass"
    :style="props.containerClass ? undefined : { height: typeof height === 'number' ? height + 'px' : String(height) }"
  >
    <Bar :data="props.data" :options="props.options" :plugins="props.plugins" />
  </div>
</template>

<style scoped>
</style>
