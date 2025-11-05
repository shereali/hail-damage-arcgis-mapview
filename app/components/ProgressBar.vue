<!-- Progress Bar -->
<template>
  <div class="w-full bg-gray-200 rounded-full h-2 mt-1">
    <div
      class="h-full bg-blue-600 rounded-full transition-all"
      :style="{ width: `${Math.min(100, (value / max) * 100)}%` }"
    />
  </div>
  <span class="text-xs text-gray-600">
    {{ format === "$" ? "$" : "" }}{{ value.toLocaleString() }}
  </span>
</template>
<script setup lang="ts">
defineProps<{ value: number; max: number; format?: string }>();
</script>
