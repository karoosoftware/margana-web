<script setup>
import { computed } from 'vue'
import marganaLogo from '@/assets/margana_full_logo.svg'

// A lightweight, reusable brand component for consistent logo usage
// Props:
// - size: 'xs' | 'sm' | 'md' | 'lg' (controls image height)
// - layout: 'inline' | 'stackedOnMobile' (split over two lines on mobile like survey header)
// - label, subtitle: retained for backward compatibility (not rendered by default)
// - srLabel: aria-label for the wrapper for better accessibility
// - align: 'left' | 'center' (default center)
// - showWordmark: when true, render the classic logo + "argana" wordmark snippet
// - wordmarkClass: optional extra classes to apply to the outer span of the wordmark
const props = defineProps({
  size: { type: String, default: 'md' },
  layout: { type: String, default: 'inline' },
  label: { type: String, default: 'argana' },
  subtitle: { type: String, default: '' },
  srLabel: { type: String, default: 'Margana' },
  align: { type: String, default: 'center' },
  showWordmark: { type: Boolean, default: false },
  wordmarkClass: { type: String, default: '' },
})

const logoStyles = {
  xs: { height: 'var(--margana-logo-h-header)' },
  sm: { height: 'var(--margana-logo-h-medium)' },
  md: { height: 'var(--margana-logo-h-large)' },
  lg: { height: 'var(--margana-logo-h-xlarge)' },
}

const activeLogoStyle = computed(() => logoStyles[props.size] || logoStyles.md)
</script>

<template>
  <div
    class="text-white drop-shadow margana-proportions"
    :class="[align === 'left' ? 'text-left' : 'text-center']"
    :aria-label="srLabel"
    role="img"
  >
    <!-- Stacked on mobile, inline on sm+ -->
    <template v-if="layout === 'stackedOnMobile'">
      <!-- Mobile: either wordmark snippet or plain image -->
      <span class="sm:hidden leading-tight">
        <template v-if="showWordmark">
          <span class="inline-flex items-center justify-center" :class="wordmarkClass">
            <img
              :src="marganaLogo"
              alt=""
              aria-hidden="true"
              role="presentation"
              class="align-middle select-none"
              :style="{ height: activeLogoStyle.height, marginRight: 'calc(var(--margana-navbar-logo-x) * -2.5)' }"
              draggable="false"
            />
          </span>
        </template>
        <template v-else>
          <span class="inline-flex items-center justify-center select-none">
            <img :src="marganaLogo" alt="" aria-hidden="true" role="presentation" class="align-middle select-none" :style="activeLogoStyle" draggable="false" />
          </span>
        </template>
      </span>
      <!-- Desktop/tablet: either wordmark snippet or plain image -->
      <span class="hidden sm:inline-flex items-center justify-center select-none">
        <template v-if="showWordmark">
          <span class="inline-flex items-center justify-center" :class="wordmarkClass">
            <img
              :src="marganaLogo"
              alt=""
              aria-hidden="true"
              role="presentation"
              class="align-middle select-none"
              :style="{ height: activeLogoStyle.height, marginRight: 'calc(var(--margana-navbar-logo-x) * -2.5)' }"
              draggable="false"
            />
          </span>
        </template>
        <template v-else>
          <img :src="marganaLogo" alt="" aria-hidden="true" role="presentation" class="align-middle select-none" :style="activeLogoStyle" draggable="false" />
        </template>
      </span>
    </template>

    <!-- Always inline -->
    <template v-else>
      <template v-if="showWordmark">
        <div class="items-center justify-center" :class="wordmarkClass">
          <img
            :src="marganaLogo"
            alt=""
            aria-hidden="true"
            role="presentation"
            class="align-left select-none"
            :style="{ height: activeLogoStyle.height, marginRight: 'calc(var(--margana-navbar-logo-x) * -2.5)' }"
            draggable="false"
          />
        </div>
      </template>
      <template v-else>
        <span class="inline-flex items-center justify-center select-none">
          <img :src="marganaLogo" alt="" aria-hidden="true" role="presentation" class="align-middle select-none" :style="activeLogoStyle" draggable="false" />
        </span>
      </template>
    </template>
  </div>
</template>

<style scoped>
/* No extra CSS; relies on Tailwind utility classes. */
</style>
