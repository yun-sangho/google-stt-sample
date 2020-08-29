const paths = document.getElementsByTagName("path");
const visualizer = document.getElementById("visualizer");
const mask = visualizer.getElementById("mask");
const audioInputSelect = document.querySelector('select#audioSource');

const runAnalyser = (stream) => {
  const audioContext = new AudioContext();
  const audioStream = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  audioStream.connect(analyser);
  analyser.fftSize = 1024;

  const frequencyArray = new Uint8Array(analyser.frequencyBinCount);
  visualizer.setAttribute("viewBox", "0 0 255 255");

  for (let i = 0; i < 255; i++) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("stroke-dasharray", "4,1");
    mask.appendChild(path);
  }

  const doDraw = () => {
    requestAnimationFrame(doDraw);
    analyser.getByteFrequencyData(frequencyArray);

    for (let i = 0; i < 255; i++) {
      const adjustedLength = Math.floor(frequencyArray[i]) - (Math.floor(frequencyArray[i]) % 5);
      paths[i].setAttribute("d", "M " + i + ",255 l 0,-" + adjustedLength);
    }
  };

  doDraw();
};

const handleDevices = (deviceInfos) => {
  let value = audioInputSelect.value

  deviceInfos = deviceInfos.filter((d) => d.kind === 'audioinput');

  audioInputSelect.innerHTML = '';

  for (let i = 0; i !== deviceInfos.length; ++i) {
    const deviceInfo = deviceInfos[i];
    const option = document.createElement('option');
    option.value = deviceInfo.deviceId;
    option.text = deviceInfo.label || `microphone ${audioInputSelect.length + 1}`;
    audioInputSelect.appendChild(option);
  }

  if (!value) {
    value = audioInputSelect[0].value;
  }

  audioInputSelect.value = value;
}

function handleStream(stream) {
  window.stream = stream
  runAnalyser(stream);

  return navigator.mediaDevices.enumerateDevices();
}

const handleError = (e) => {
  console.log(e)
}

function start() {
  if (window.stream) {
    window.stream.getTracks().forEach(track => {
      track.stop();
    });
  }
  const audioSource = audioInputSelect.value;
  const constraints = {
    audio: {deviceId: audioSource ? {exact: audioSource} : 'defualt'},
  };
  navigator.mediaDevices.getUserMedia(constraints).then(handleStream).then(handleDevices).catch(handleError);
}

audioInputSelect.onchange = start;
navigator.mediaDevices.enumerateDevices().then(handleDevices).catch(handleError);

start();