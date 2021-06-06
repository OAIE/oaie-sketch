<template>
  <div id="app">
    <Sketch ref="sketch"></Sketch>
    <div style='position: fixed; right: 50px; bottom: 30px; font-size: 20pt;'>
      <span class='oaie'>sketch</span>
    </div>
  </div>
</template>

<script>
import Sketch from './components/Sketch.vue'

export default {
  name: 'App',
  components: {
    Sketch
  }
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
body, td, th { font-family: sans-serif; }
</style>
