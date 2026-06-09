const scenes = [...document.querySelectorAll(".scene")];
const progress = document.querySelector("#progress");
const totalDuration = scenes.reduce((sum, scene) => sum + Number(scene.dataset.duration), 0);
let current = 0;
let elapsed = 0;

function playScene(index) {
  scenes.forEach((scene, sceneIndex) => scene.classList.toggle("active", sceneIndex === index));
  const duration = Number(scenes[index].dataset.duration);
  setTimeout(() => {
    elapsed += duration;
    current = (current + 1) % scenes.length;
    if (current === 0) elapsed = 0;
    playScene(current);
  }, duration);
}

const startedAt = performance.now();
function animateProgress(now) {
  const runtime = (now - startedAt) % totalDuration;
  progress.style.width = `${runtime / totalDuration * 100}%`;
  requestAnimationFrame(animateProgress);
}

playScene(0);
requestAnimationFrame(animateProgress);
