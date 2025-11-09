<template>
  <div></div>
</template>

<script setup>
// Temporary debug function to check CSV structure
const debugCSV = async () => {
  const response = await fetch(
    "https://www.spc.noaa.gov/climo/reports/251024_rpts_hail.csv"
  );
  const text = await response.text();
  const lines = text.split("\n").slice(0, 5); // First 5 lines
  console.log("CSV Headers:", lines[0]);
  console.log("First data row:", lines[1]);
};

debugCSV();
</script>
